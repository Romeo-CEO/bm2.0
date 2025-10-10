import { getConnection } from '../config/database';
import { SSOMetrics } from '../types';
import { generateToken, generateSSOToken, verifyToken, verifySSOToken } from '../utils/jwt';
import crypto from 'crypto';

// SSO Service Configuration
export interface SSOSessionData {
  id: string;
  userId: string;
  masterTokenSignature: string;
  platformSessionId: string;
  domainSessions: Record<string, DomainSession>;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
}

export interface DomainSession {
  domainToken: string;
  expiresAt: Date;
  userContext: UserContext;
  status: 'active' | 'expired' | 'revoked';
}

export interface UserContext {
  userId: string;
  companyId?: string;
  role: string;
  permissions: string[];
  subscriptionTier: string;
}

export interface SSOApplication {
  id: string;
  name: string;
  domain: string;
  ssoEnabled: boolean;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DISABLED';
}

/**
 * Central SSO Service - Handles cross-domain authentication and token management
 */
export class SSOCentralService {

  private static instance: SSOCentralService;
  private tokenExpiryCache = new Map<string, number>();

  static getInstance(): SSOCentralService {
    if (!SSOCentralService.instance) {
      SSOCentralService.instance = new SSOCentralService();
    }
    return SSOCentralService.instance;
  }

  /**
   * Validate platform token and create SSO session
   */
  async validateMasterToken(token: string, userId: string): Promise<{
    isValid: boolean;
    sessionId?: string;
    error?: string;
  }> {
    try {
      const db = await getConnection();

      // Verify the token is valid
      const tokenData = verifyToken(token);
      if (!tokenData) {
        await this.logAudit('TOKEN_REFRESH', userId, null, null, null, false, 'Invalid token');
        return { isValid: false, error: 'Invalid token' };
      }

      // Check if user exists and is active
      const userResult = await db.query(
        'SELECT role FROM users WHERE id = ? AND is_active = 1',
        [tokenData.userId]
      );

      if (userResult.rows.length === 0) {
        await this.logAudit('FAILED_CONTEXT', userId, null, null, null, false, 'User not found or inactive');
        return { isValid: false, error: 'User not found or inactive' };
      }

      const user = userResult.rows[0];

      // Create or update SSO session
      const sessionId = await this.createOrUpdateSSOSession(token, userId, user.role);

      await this.logAudit('SSO_LOGIN', userId, null, 'platform.business-suite.com', null, true, 'Master token validated');

      return {
        isValid: true,
        sessionId
      };

    } catch (error) {
      console.error('Master token validation error:', error);
      await this.logAudit('FAILED_CONTEXT', userId, null, null, null, false, `Validation error: ${error}`);
      return {
        isValid: false,
        error: 'Token validation failed'
      };
    }
  }

  /**
   * Generate domain-specific token for application
   */
  async generateDomainToken(sessionId: string, targetDomain: string): Promise<{
    domainToken?: string;
    userContext?: UserContext;
    error?: string;
  }> {
    const startedAt = Date.now();
    try {
      const db = await getConnection();

      // Get SSO session
      const sessionResult = await db.query(
        'SELECT * FROM sso_sessions WHERE id = ?',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return { error: 'SSO session not found' };
      }

      const session = sessionResult.rows[0];

      // Check if session is expired
      const now = new Date();
      if (new Date(session.expires_at) < now) {
        return { error: 'SSO session expired' };
      }

      // Get user permissions and context
      const userResult = await db.query(`
        SELECT
          u.id, u.role, u.subscription_tier,
          c.id as company_id, c.domain
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = ?
      `, [session.user_id]);

      if (userResult.rows.length === 0) {
        return { error: 'User not found' };
      }

      const userData = userResult.rows[0];

      // Generate user context
      const userContext: UserContext = {
        userId: userData.id,
        companyId: userData.company_id,
        role: userData.role,
        permissions: this.getUserPermissions(userData.role),
        subscriptionTier: userData.subscription_tier || 'trial'
      };

      // Check if domain token already exists and is valid
      const existingDomainSessions = session.domain_sessions || {};
      const existingSession = existingDomainSessions[targetDomain];

      if (existingSession && existingSession.status === 'active') {
        const domainExpiry = new Date(existingSession.expiresAt);
        if (domainExpiry > now) {
          // Return existing valid token
          return {
            domainToken: existingSession.domainToken,
            userContext: existingSession.userContext
          };
        }
      }

      // Generate new domain-specific token
      const domainToken = generateSSOToken({
        userId: userContext.userId,
        email: '',
        companyId: userContext.companyId || '',
        contextType: 'domain',
        domain: targetDomain
      }, '1h');

      // Update session with new domain token
      const domainSession: DomainSession = {
        domainToken,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        userContext,
        status: 'active'
      };

      existingDomainSessions[targetDomain] = domainSession;

      // Update database
      await db.query(
        'UPDATE sso_sessions SET domain_sessions = ?, last_activity = NOW() WHERE id = ?',
        [JSON.stringify(existingDomainSessions), sessionId]
      );

      await this.logAudit('DOMAIN_SWITCH', userContext.userId, null, 'platform.business-suite.com', targetDomain, true, 'Domain token generated', { latencyMs: Date.now() - startedAt, sessionId });

      return {
        domainToken,
        userContext
      };

    } catch (error) {
      console.error('Domain token generation error:', error);
      return { error: 'Failed to generate domain token' };
    }
  }

  /**
   * Validate domain token from application
   */
  async validateDomainToken(domainToken: string, sourceDomain: string): Promise<{
    isValid: boolean;
    userContext?: UserContext;
    error?: string;
  }> {
    const startedAt = Date.now();
    try {
      // Verify token structure
      const tokenData = verifySSOToken(domainToken);

      if (!tokenData) {
        return { isValid: false, error: 'INVALID_TOKEN' };
      }

      // Ensure token is intended for domain context
      if (tokenData.contextType !== 'domain') {
        return { isValid: false, error: 'INVALID_CONTEXT' };
      }

      // Check target domain matches for domain tokens
      if (tokenData.domain && tokenData.domain !== sourceDomain) {
        return { isValid: false, error: 'DOMAIN_MISMATCH' };
      }

      const db = await getConnection();

      // Get user information
      const userResult = await db.query(`
        SELECT
          u.id, u.role, u.subscription_tier, u.is_active,
          c.id as company_id, c.domain
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = ?
      `, [tokenData.userId]);

      if (userResult.rows.length === 0) {
        return { isValid: false, error: 'User not found' };
      }

      const userData = userResult.rows[0];

      if (!userData.is_active) {
        return { isValid: false, error: 'User account is inactive' };
      }

      // Create user context
      const userContext: UserContext = {
        userId: userData.id,
        companyId: userData.company_id,
        role: userData.role,
        permissions: this.getUserPermissions(userData.role),
        subscriptionTier: userData.subscription_tier || 'trial'
      };

      await this.logAudit('TOKEN_REFRESH', userContext.userId, null, sourceDomain, null, true, 'Domain token validated', { latencyMs: Date.now() - startedAt });

      return {
        isValid: true,
        userContext
      };

    } catch (error) {
      console.error('Domain token validation error:', error);
      return { isValid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Get registered SSO applications
   */
  async getRegisteredApplications(): Promise<SSOApplication[]> {
    try {
      const db = await getConnection();

      const result = await db.query(`
        SELECT id, name, domain, sso_enabled, status
        FROM sso_applications
        WHERE status = 'ACTIVE'
        ORDER BY name
      `);

      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        ssoEnabled: row.sso_enabled,
        status: row.status
      }));

    } catch (error) {
      console.error('Get applications error:', error);
      return [];
    }
  }

  /**
   * Register a new application for SSO
   */
  async registerApplication(name: string, domain: string): Promise<{
    applicationId?: string;
    error?: string;
  }> {
    try {
      const db = await getConnection();

      // Check if application already exists
      const existing = await db.query(
        'SELECT id FROM sso_applications WHERE domain = ?',
        [domain]
      );

      if (existing.rows.length > 0) {
        return { error: 'Application already registered for this domain' };
      }

      const applicationId = crypto.randomUUID();

      await db.query(`
        INSERT INTO sso_applications (id, name, domain, sso_enabled, status)
        VALUES (?, ?, ?, false, 'ACTIVE')
      `, [applicationId, name, domain]);

      return { applicationId };

    } catch (error) {
      console.error('Application registration error:', error);
      return { error: 'Failed to register application' };
    }
  }

  /**
   * Create or update SSO session
   */
  private async createOrUpdateSSOSession(
    token: string,
    userId: string,
    userRole: string
  ): Promise<string> {
    const db = await getConnection();

    // Create token signature for tracking
    const tokenSignature = crypto.createHash('sha256')
      .update(token.slice(0, 32))
      .digest('hex');

    // Check for existing session
    const existingSession = await db.query(
      'SELECT id FROM sso_sessions WHERE master_token_signature = ?',
      [tokenSignature]
    );

    if (existingSession.rows.length > 0) {
      // Update existing session
      const sessionId = existingSession.rows[0].id;
      const expiresAt = new Date(Date.now() + 86400000); // 24 hours

      await db.query(
        'UPDATE sso_sessions SET expires_at = ?, last_activity = NOW() WHERE id = ?',
        [expiresAt, sessionId]
      );

      return sessionId;
    }

    // Create new session
    const sessionId = crypto.randomUUID();
    const platformSessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 86400000); // 24 hours

    await db.query(`
      INSERT INTO sso_sessions (
        id, user_id, master_token_signature, platform_session_id,
        domain_sessions, expires_at, created_at, last_activity
      ) VALUES (?, ?, ?, ?, '{}', ?, NOW(), NOW())
    `, [sessionId, userId, tokenSignature, platformSessionId, expiresAt]);

    return sessionId;
  }

  /**
   * Get user permissions based on role
   */
  private getUserPermissions(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['*', 'manage_users', 'manage_system', 'access_all_domains', 'manage_billing'];
      case 'user':
        return ['read_profile', 'manage_own_profile', 'access_applications'];
      default:
        return ['read_profile'];
    }
  }

    /**
   * Aggregate SSO metrics for monitoring endpoints
   */
  async getMetrics(): Promise<SSOMetrics> {
    const db = await getConnection();
    try {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000);
      const oneDayAgo = new Date(now - 24 * 3600000);

      const sessionsResult = await db.query("SELECT id, user_id, expires_at, last_activity FROM sso_sessions");
      const applicationsResult = await db.query("SELECT id, sso_enabled, status FROM sso_applications");
      const auditResult = await db.query("SELECT event_type, success, created_at FROM sso_audit WHERE created_at >= ?", [oneDayAgo]);

      const sessions = Array.isArray(sessionsResult.rows) ? sessionsResult.rows : [];
      const applications = Array.isArray(applicationsResult.rows) ? applicationsResult.rows : [];
      const audits24h = Array.isArray(auditResult.rows) ? auditResult.rows : [];

      const activeSessions = sessions.filter((row: any) => {
        const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
        return expires > now;
      });

      const expiringSoon = activeSessions.filter((row: any) => {
        const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
        return expires > now && expires <= now + 3600000;
      });

      const audits1h = audits24h.filter((row: any) => {
        const created = row.created_at ? new Date(row.created_at).getTime() : 0;
        return created >= oneHourAgo.getTime();
      });

      const countByType = (rows: any[], type: string) => rows.filter((row) => (row.event_type || '').toUpperCase() === type).length;
      const failures24h = audits24h.filter((row: any) => row.success === false);
      const lastFailure: string | null = failures24h.reduce((acc: string | null, row: any) => {
        const created = row.created_at ? new Date(row.created_at).toISOString() : null;
        if (!created) return acc;
        if (!acc) return created;
        return created > acc ? created : acc;
      }, null as string | null);

      const failureRate24h = audits24h.length === 0 ? 0 : failures24h.length / audits24h.length;

      let status: 'healthy' | 'warning' | 'degraded' = 'healthy';
      if (failureRate24h > 0.25 || failures24h.length > 25) {
        status = 'degraded';
      } else if (failureRate24h > 0.05 || failures24h.length > 0 || activeSessions.length === 0) {
        status = 'warning';
      }

      return {
        timestamp: new Date(now).toISOString(),
        summary: {
          totalSessions: sessions.length,
          activeSessions: activeSessions.length,
          expiringSoon: expiringSoon.length,
          totalApplications: applications.length,
          enabledApplications: applications.filter((row: any) => row.sso_enabled === true || row.sso_enabled === 1 || String(row.sso_enabled).toLowerCase() === 'true').length
        },
        activity: {
          loginsLastHour: countByType(audits1h, 'SSO_LOGIN'),
          domainTokensLastHour: countByType(audits1h, 'DOMAIN_SWITCH'),
          validationsLastHour: countByType(audits1h, 'TOKEN_REFRESH'),
          failuresLastHour: audits1h.filter((row: any) => row.success === false).length,
          failureRate24h
        },
        health: {
          status,
          lastFailureAt: lastFailure
        }
      };
    } finally {
      if ((db as any)?.release) {
        try { (db as any).release(); } catch {}
      }
    }
  }

/**
   * Log SSO audit event
   */
  private async logAudit(
    eventType: string,
    userId: string | null,
    applicationId: string | null,
    sourceDomain: string | null,
    targetDomain: string | null,
    success: boolean,
    message: string,
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      const db = await getConnection();

      const eventDataJson = eventData ? JSON.stringify(eventData) : '{}';

      await db.query(`
        INSERT INTO sso_audit (
          event_type, user_id, application_id, source_domain,
          target_domain, success, error_message, event_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        eventType,
        userId,
        applicationId,
        sourceDomain,
        targetDomain,
        success,
        message,
        eventDataJson
      ]);

    } catch (error) {
      console.error('SSO audit logging error:', error);
      // Don't throw - audit logging should not break SSO flow
    }
  }
}

export const ssoCentralService = new SSOCentralService();
