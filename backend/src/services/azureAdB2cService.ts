import { ConfidentialClientApplication, AuthenticationResult, AuthorizationCodeRequest } from '@azure/msal-node';
import { getMSALInstance, getAzureADB2CConfig, AUTH_TYPE } from '../config/azure-ad-b2c';
import { getDatabaseConnection } from '../config/database';
import { generateToken } from '../utils/jwt';
import { randomUUID } from 'crypto';

export interface AzureADB2CUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  tenantId: string;
  objectId: string;
  companyId?: string;
  companyAdmin?: boolean;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: AzureADB2CUser;
  error?: string;
  authUrl?: string;
}

export class AzureADB2CService {
  private msalInstance: ConfidentialClientApplication;
  private config: ReturnType<typeof getAzureADB2CConfig>;

  constructor() {
    try {
      this.msalInstance = getMSALInstance();
      this.config = getAzureADB2CConfig();
    } catch (error) {
      // Azure AD B2C not configured, will be handled in methods
      this.msalInstance = null as never;
      this.config = getAzureADB2CConfig();
    }
  }

  /**
   * Get authorization URL for login
   */
  async getAuthUrl(state?: string): Promise<string> {
    try {
      if (!this.msalInstance) {
        throw new Error('Azure AD B2C is not configured');
      }

      const authCodeUrlParameters = {
        scopes: this.config.scopes,
        redirectUri: this.config.redirectUri,
        state: state || 'default-state',
        prompt: 'login' as const,
      };

      const response = await this.msalInstance.getAuthCodeUrl(authCodeUrlParameters);
      return response;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      throw new Error('Failed to generate authorization URL');
    }
  }

  /**
   * Handle authorization code callback
   */
  async handleCallback(code: string, state?: string): Promise<AuthResult> {
    try {
      if (!this.msalInstance) {
        throw new Error('Azure AD B2C is not configured');
      }

      const tokenRequest: AuthorizationCodeRequest = {
        code,
        scopes: this.config.scopes,
        redirectUri: this.config.redirectUri,
      };

      const response: AuthenticationResult = await this.msalInstance.acquireTokenByCode(tokenRequest);
      
      if (!response.account) {
        return {
          success: false,
          error: 'No account information received'
        };
      }

      // Extract user information from ID token
      const user = this.extractUserFromToken(response);
      
      // Sync user with database
      const syncedUser = await this.syncUserWithDatabase(user);
      
      // Generate our own JWT token for API access
      const token = generateToken({
        userId: syncedUser.id,
        email: syncedUser.email,
        companyId: syncedUser.companyId || '',
        companyAdmin: Boolean(syncedUser.companyAdmin),
        role: 'user'
      });

      // Persist token for middleware compatibility
      try {
      const db = await getDatabaseConnection();
      const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1);
        await db.query('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [token, syncedUser.id, expiresAt]);
        if ((db as any).release) { try { (db as any).release(); } catch {} }
      } catch (e) {
        // Non-fatal: proceed even if token persistence fails
        console.warn('Warning: failed to persist auth token:', e);
      }
 
      return {
        success: true,
        token,
        user: syncedUser
      };

    } catch (error) {
      console.error('Error handling callback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Extract user information from ID token
   */
  private extractUserFromToken(authResult: AuthenticationResult): AzureADB2CUser {
    const account = authResult.account!;
    const idTokenClaims = authResult.idTokenClaims as any;

    return {
      id: account.localAccountId,
      email: account.username,
      firstName: idTokenClaims.given_name || '',
      lastName: idTokenClaims.family_name || '',
      displayName: idTokenClaims.name || account.username,
      tenantId: account.tenantId,
      objectId: account.homeAccountId
    };
  }

  /**
   * Sync user with database
   */
  private async syncUserWithDatabase(azureUser: AzureADB2CUser): Promise<AzureADB2CUser & { companyId?: string; companyAdmin: boolean }> {
    const db = await getDatabaseConnection();

    try {
      const existingUserResult = await db.query(
        'SELECT * FROM users WHERE email = ?',
        [azureUser.email]
      );

      if (existingUserResult.rows.length > 0) {
        const existingUser = existingUserResult.rows[0];
        let companyId: string | null = existingUser.company_id || null;
        let companyAdmin = Boolean(existingUser.company_admin);

        await db.query(
          `UPDATE users 
           SET first_name = ?, last_name = ?, updated_at = GETDATE()
           WHERE id = ?`,
          [azureUser.firstName, azureUser.lastName, existingUser.id]
        );

        if (!companyId) {
          companyId = randomUUID();
          const companyName = azureUser.displayName || `${azureUser.firstName} ${azureUser.lastName}` || azureUser.email.split('@')[0];
          const emailDomain = (azureUser.email?.split('@')[1] || '').toLowerCase();
          const domain = emailDomain || `company-${companyId.substring(0, 8)}.local`;

          await db.query(
            `INSERT INTO companies (id, name, domain, owner_id, is_active, created_at)
             VALUES (?, ?, ?, ?, 1, GETDATE())`,
            [companyId, companyName, domain, existingUser.id]
          );

          await db.query(
            `UPDATE users SET company_id = ?, company_admin = 1, updated_at = GETDATE() WHERE id = ?`,
            [companyId, existingUser.id]
          );

          companyAdmin = true;
        }

        return {
          ...azureUser,
          id: existingUser.id,
          companyId: companyId || undefined,
          companyAdmin
        };
      } else {
        const userId = randomUUID();

        // Calculate trial expiry (7 days from now)
        const trialExpiry = new Date();
        trialExpiry.setDate(trialExpiry.getDate() + 7);

        await db.query(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, role, subscription_tier, subscription_expiry, is_active, created_at, company_admin)
           VALUES (?, ?, ?, ?, ?, 'user', 'trial', ?, 1, GETDATE(), 1)`,
          [userId, azureUser.email, 'azure_ad_b2c', azureUser.firstName, azureUser.lastName, trialExpiry]
        );

        const companyId = randomUUID();
        const companyName = azureUser.displayName || `${azureUser.firstName} ${azureUser.lastName}` || azureUser.email.split('@')[0];
        const emailDomain = (azureUser.email?.split('@')[1] || '').toLowerCase();
        const domain = emailDomain || `company-${companyId.substring(0, 8)}.local`;

        await db.query(
          `INSERT INTO companies (id, name, domain, owner_id, is_active, created_at)
           VALUES (?, ?, ?, ?, 1, GETDATE())`,
          [companyId, companyName, domain, userId]
        );

        await db.query(
          `UPDATE users SET company_id = ?, company_admin = 1, updated_at = GETDATE() WHERE id = ?`,
          [companyId, userId]
        );

        return {
          ...azureUser,
          id: userId,
          companyId,
          companyAdmin: true
        };
      }
    } catch (error) {
      console.error('Error syncing user with database:', error);
      throw new Error('Failed to sync user with database');
    } finally {
      if ((db as any)?.release) {
        try { (db as any).release(); } catch {}
      }
    }
  }
  /**
   * Get logout URL
   */
  getLogoutUrl(): string {
    // CIAM uses ciamlogin.com/<tenantGuid>/oauth2/v2.0/logout; classic B2C uses b2clogin.com/<tenant>.onmicrosoft.com/oauth2/v2.0/logout
    const isCiam = this.config.authority.includes('.ciamlogin.com');
    const host = this.config.authority.split('/')[2];
    const pathTenant = this.config.authority.split('/')[3];
    const base = isCiam
      ? `https://${host}/${pathTenant}/oauth2/v2.0/logout`
      : `https://${host}/oauth2/v2.0/logout`;
    const logoutUrl = `${base}?post_logout_redirect_uri=${encodeURIComponent(this.config.postLogoutRedirectUri)}`;
    return logoutUrl;
  }

  /**
   * Validate token (for API endpoints)
   */
  async validateToken(token: string): Promise<AzureADB2CUser | null> {
    try {
      // Validate our JWT and extract user id
      const { verifyToken } = await import('../utils/jwt');
      const payload = verifyToken(token);
      if (!payload?.userId) return null;

      const db = await getDatabaseConnection();
      const result = await db.query(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        [payload.userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: `${user.first_name} ${user.last_name}`,
        tenantId: '',
        objectId: user.id
      };
    } catch (error) {
      console.error('Error validating token:', error);
      return null;
    }
  }
}
