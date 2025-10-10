import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getConnection } from '../config/database';
import { generateToken, getJwtExpiryDurationMs } from '../utils/jwt';
import { logAuditEvent } from '../services/auditService';
import {
  createPasswordResetToken,
  markPasswordResetTokenUsed,
  verifyPasswordResetToken,
} from '../services/passwordResetService';
import { emailService, sendPasswordResetEmail } from '../services/emailService';
import { hashPassword, passwordMeetsPolicy } from '../utils/passwordPolicy';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 30;

const sanitizeEmail = (email: string): string => email.trim().toLowerCase();

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip || req.connection.remoteAddress || '';
};

const buildUserResponse = (row: any) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  companyId: row.company_id,
  subscriptionTier: row.subscription_tier,
  companyAdmin: Boolean(row.company_admin),
  subscriptionExpiry: row.subscription_expiry ?? null,
});

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'company';
};

const buildCompanyDomain = (companyName: string): string => {
  const suffix = process.env.COMPANY_DOMAIN_SUFFIX || 'example.local';
  return `${slugify(companyName)}.${suffix}`;
};

const buildPasswordResetUrl = (token: string): string => {
  const base = process.env.PASSWORD_RESET_URL_BASE || process.env.FRONTEND_URL || 'http://localhost:5173';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}/reset-password?token=${encodeURIComponent(token)}`;
};

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const email = typeof req.body?.email === 'string' ? sanitizeEmail(req.body.email) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const ipAddress = getClientIp(req);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const db = await getConnection();

    try {
      const result = await db.query(
        `SELECT id, email, password_hash, first_name, last_name, role, company_id, company_admin, subscription_tier,
                subscription_expiry, is_active, failed_login_attempts, lockout_until
         FROM users
         WHERE LOWER(email) = ?`,
        [email]
      );

      if (result.rows.length === 0) {
        await logAuditEvent({
          eventType: 'AUTH_LOGIN',
          success: false,
          email,
          ipAddress,
          userAgent,
          metadata: { reason: 'USER_NOT_FOUND' },
        });
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
        return;
      }

      const user = result.rows[0];

      if (!user.is_active) {
        await logAuditEvent({
          eventType: 'AUTH_LOGIN',
          success: false,
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          metadata: { reason: 'USER_INACTIVE' },
        });
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
        return;
      }

      if (user.lockout_until) {
        const lockoutUntil = new Date(user.lockout_until);
        if (lockoutUntil.getTime() > Date.now()) {
          await logAuditEvent({
            eventType: 'AUTH_LOGIN_LOCKOUT',
            success: false,
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            metadata: { lockoutUntil: lockoutUntil.toISOString() },
          });
          res.status(423).json({ success: false, error: 'Account temporarily locked. Try again later.' });
          return;
        }
      }

      const passwordsMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordsMatch) {
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        const shouldLock = newAttempts >= LOCKOUT_THRESHOLD;
        const lockoutUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

        await db.query(
          'UPDATE users SET failed_login_attempts = ?, last_failed_login_at = GETDATE(), lockout_until = ? WHERE id = ?',
          [newAttempts, lockoutUntil, user.id]
        );

        await logAuditEvent({
          eventType: shouldLock ? 'AUTH_LOGIN_LOCKOUT' : 'AUTH_LOGIN',
          success: false,
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          metadata: shouldLock
            ? { reason: 'LOCKOUT_TRIGGERED', attempts: newAttempts, lockoutMinutes: LOCKOUT_MINUTES }
            : { reason: 'INVALID_PASSWORD', attempts: newAttempts },
        });

        if (shouldLock) {
          res.status(423).json({ success: false, error: 'Account temporarily locked. Try again later.' });
        } else {
          res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }
        return;
      }

      await db.query(
        'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL, last_failed_login_at = NULL, updated_at = GETDATE() WHERE id = ?',
        [user.id]
      );

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.company_id || '',
      });
      const expiresAt = new Date(Date.now() + getJwtExpiryDurationMs());

      await db.query(
        'INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
        [token, user.id, expiresAt]
      );

      await logAuditEvent({
        eventType: 'AUTH_LOGIN',
        success: true,
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        token,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
      db.release?.();
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    const { email, password, firstName, lastName, companyName } = req.body || {};

    if (![email, password, firstName, lastName, companyName].every((val) => typeof val === 'string' && val.trim().length > 0)) {
      res.status(400).json({ success: false, error: 'All fields are required.' });
      return;
    }

    const normalizedEmail = sanitizeEmail(email);
    if (!passwordMeetsPolicy(password)) {
      res.status(400).json({ success: false, error: 'Password does not meet complexity requirements.' });
      return;
    }

    const ipAddress = getClientIp(req);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const db = await getConnection();

    try {
      const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
      if (existing.rows.length > 0) {
        await logAuditEvent({
          eventType: 'AUTH_REGISTER',
          success: false,
          email: normalizedEmail,
          ipAddress,
          userAgent,
          metadata: { reason: 'EMAIL_IN_USE' },
        });
        res.status(409).json({ success: false, error: 'Registration failed. Please try again.' });
        return;
      }

      const userId = uuidv4();
      const companyId = uuidv4();
      const passwordHash = await hashPassword(password);
      const domain = buildCompanyDomain(companyName);

      await db.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, company_admin, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'user', 1, 1, GETDATE(), GETDATE())`,
        [userId, normalizedEmail, passwordHash, firstName.trim(), lastName.trim()]
      );

      await db.query(
        `INSERT INTO companies (id, name, domain, owner_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, GETDATE(), GETDATE())`,
        [companyId, companyName.trim(), domain, userId]
      );

      await db.query('UPDATE users SET company_id = ? WHERE id = ?', [companyId, userId]);

      const token = generateToken({
        userId,
        email: normalizedEmail,
        role: 'user',
        companyId,
      });
      const expiresAt = new Date(Date.now() + getJwtExpiryDurationMs());

      await db.query('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expiresAt]);

      const userResult = await db.query(
        `SELECT id, email, first_name, last_name, role, company_id, company_admin, subscription_tier, subscription_expiry
         FROM users WHERE id = ?`,
        [userId]
      );

      const responseUser = userResult.rows.length > 0 ? buildUserResponse(userResult.rows[0]) : null;

      await logAuditEvent({
        eventType: 'AUTH_REGISTER',
        success: true,
        userId,
        email: normalizedEmail,
        ipAddress,
        userAgent,
        metadata: { companyId },
      });

      res.status(201).json({ success: true, token, user: responseUser });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
      db.release?.();
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.authToken) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const db = await getConnection();

    try {
      await db.query('DELETE FROM auth_tokens WHERE token = ?', [req.authToken]);

      await logAuditEvent({
        eventType: 'AUTH_LOGOUT',
        success: true,
        userId: req.user.id,
        email: req.user.email,
        ipAddress: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
      db.release?.();
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const email = typeof req.body?.email === 'string' ? sanitizeEmail(req.body.email) : '';
    const ipAddress = getClientIp(req);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    if (!email) {
      res.status(200).json({ success: true });
      return;
    }

    const db = await getConnection();

    try {
      const userResult = await db.query('SELECT id, email FROM users WHERE LOWER(email) = ? AND is_active = 1', [email]);

      if (userResult.rows.length === 0) {
        await logAuditEvent({
          eventType: 'AUTH_PASSWORD_FORGOT',
          success: true,
          email,
          ipAddress,
          userAgent,
          metadata: { issued: false },
        });
        res.status(200).json({ success: true });
        return;
      }

      const user = userResult.rows[0];
      const { token, expiresAt } = await createPasswordResetToken(user.id);
      const resetUrl = buildPasswordResetUrl(token);

      try {
        await sendPasswordResetEmail(user.email, resetUrl, expiresAt);
      } catch (emailError) {
        console.error('Password reset email error:', emailError);
        await logAuditEvent({
          eventType: 'AUTH_PASSWORD_FORGOT',
          success: false,
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          metadata: { reason: 'EMAIL_FAILED' },
        });
        res.status(500).json({ success: false, error: 'Failed to send password reset email.' });
        return;
      }

      await logAuditEvent({
        eventType: 'AUTH_PASSWORD_FORGOT',
        success: true,
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        metadata: { issued: true, emailEnabled: emailService.isEnabled },
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
      db.release?.();
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!token || !newPassword) {
      res.status(400).json({ success: false, error: 'Token and password are required.' });
      return;
    }

    if (!passwordMeetsPolicy(newPassword)) {
      res.status(400).json({ success: false, error: 'Password does not meet complexity requirements.' });
      return;
    }

    const verification = await verifyPasswordResetToken(token);

    if (!verification) {
      await logAuditEvent({
        eventType: 'AUTH_PASSWORD_RESET',
        success: false,
        ipAddress: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        metadata: { reason: 'INVALID_TOKEN' },
      });
      res.status(400).json({ success: false, error: 'Invalid or expired token.' });
      return;
    }

    const db = await getConnection();

    try {
      const passwordHash = await hashPassword(newPassword);

      await db.query(
        `UPDATE users
         SET password_hash = ?, failed_login_attempts = 0, lockout_until = NULL, last_failed_login_at = NULL, updated_at = GETDATE()
         WHERE id = ?`,
        [passwordHash, verification.userId]
      );

      await db.query('DELETE FROM auth_tokens WHERE user_id = ?', [verification.userId]);
      await markPasswordResetTokenUsed(verification.id);

      await logAuditEvent({
        eventType: 'AUTH_PASSWORD_RESET',
        success: true,
        userId: verification.userId,
        ipAddress: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
      db.release?.();
    }
  }

  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyId: user.companyId,
          subscriptionTier: user.subscriptionTier,
          companyAdmin: Boolean(user.companyAdmin),
          subscriptionExpiry: user.subscriptionExpiry ?? null,
        },
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ success: false, error: 'Failed to get user' });
    }
  }
}
