import { Request, Response } from 'express';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { getConnection } from '../config/database';
import { logAuditEvent } from '../services/auditService';
import { emailService, sendCompanyInvitationEmail } from '../services/emailService';
import { generateToken, getJwtExpiryDurationMs } from '../utils/jwt';
import { hashPassword, passwordMeetsPolicy } from '../utils/passwordPolicy';
import { getSeatUsage } from '../utils/companySeats';

const sanitizeEmail = (email: string): string => email.trim().toLowerCase();
const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const resolveClientIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  if (req.ip) return req.ip;
  if (req.connection && 'remoteAddress' in req.connection) {
    return (req.connection as any).remoteAddress || null;
  }
  return null;
};

const buildInvitationUrl = (token: string, email: string): string => {
  const base =
    process.env.COMPANY_INVITE_ACCEPT_URL_BASE ||
    process.env.PASSWORD_RESET_URL_BASE ||
    'http://localhost:5173';

  try {
    const url = new URL(base);
    url.pathname = '/accept-invite';
    url.searchParams.set('token', token);
    url.searchParams.set('email', email);
    return url.toString();
  } catch (error) {
    console.warn('Invalid COMPANY_INVITE_ACCEPT_URL_BASE, falling back to default.', error);
    const fallback = new URL('http://localhost:5173/accept-invite');
    fallback.searchParams.set('token', token);
    fallback.searchParams.set('email', email);
    return fallback.toString();
  }
};

const getInviteExpiryDate = (): Date => {
  const configuredDays = parseInt(process.env.COMPANY_INVITE_EXPIRY_DAYS || '7', 10);
  const days = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : 7;
  const clampedDays = Math.min(days, 7);
  return new Date(Date.now() + clampedDays * 24 * 60 * 60 * 1000);
};

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface InvitationRecord {
  id: string;
  companyId: string;
  email: string;
  status: string;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  invitedBy: string | null;
}

const normalizeInvitationRow = (row: any): InvitationRecord | null => {
  if (!row) return null;
  const id = row.id ?? row.ID ?? null;
  const companyId = row.company_id ?? row.COMPANY_ID ?? null;
  const email = (row.email ?? row.EMAIL ?? '').toString().trim().toLowerCase();
  const status = (row.status ?? row.STATUS ?? 'pending').toString().toLowerCase();
  const expiresAt = parseDateValue(row.expires_at ?? row.EXPIRES_AT ?? null);
  const acceptedAt = parseDateValue(row.accepted_at ?? row.ACCEPTED_AT ?? null);
  const invitedBy = row.invited_by ?? row.INVITED_BY ?? null;

  if (!id || !companyId || !email) {
    return null;
  }

  return {
    id,
    companyId,
    email,
    status,
    expiresAt,
    acceptedAt,
    invitedBy,
  };
};

const isInvitationExpired = (invitation: InvitationRecord): boolean => {
  if (!invitation.expiresAt) return true;
  return invitation.expiresAt.getTime() <= Date.now();
};

export class CompanyProfileController {
  async getMyCompanyProfile(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const user = req.user;
      if (!user?.companyId) {
        res.status(404).json({ error: 'No company associated with user' });
        return;
      }
      db = await getConnection();
      const result = await db.query(
        `SELECT id, name, domain, industry, size, website, address, phone, email, is_active as isActive,
                description, description as companyDescription, tagline,
                logo_url as logoUrl, primary_color as primaryColor, secondary_color as secondaryColor,
                created_at as createdAt, updated_at as updatedAt
         FROM companies WHERE id = ?`,
        [user.companyId]
      );
      if (result.rows.length === 0) { res.status(404).json({ error: 'Company not found' }); return; }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('getMyCompanyProfile error:', error);
      res.status(500).json({ error: 'Failed to get company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }

  async updateMyCompanyProfile(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const user = req.user;
      if (!user?.companyId) { res.status(404).json({ error: 'No company associated with user' }); return; }

      const { name, domain, industry, size, website, address, phone, email, description, tagline, logoUrl, primaryColor, secondaryColor } = req.body || {};

      db = await getConnection();

      const updates: string[] = [];
      const values: any[] = [];
      const push = (col: string, val: any) => { updates.push(`${col} = ?`); values.push(val); };

      if (name !== undefined) push('name', name);
      if (domain !== undefined) push('domain', domain);
      if (industry !== undefined) push('industry', industry);
      if (size !== undefined) push('size', size);
      if (website !== undefined) push('website', website);
      if (description !== undefined) push('description', description);
      if (tagline !== undefined) push('tagline', tagline);
      if (address !== undefined) push('address', address);
      if (phone !== undefined) push('phone', phone);
      if (email !== undefined) push('email', email);
      if (logoUrl !== undefined) push('logo_url', logoUrl);
      if (primaryColor !== undefined) push('primary_color', primaryColor);
      if (secondaryColor !== undefined) push('secondary_color', secondaryColor);

      if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

      values.push(user.companyId);
      await db.query(
        `UPDATE companies SET ${updates.join(', ')}, updated_at = GETDATE() WHERE id = ?`,
        values
      );
      res.json({ success: true });
    } catch (error) {
      console.error('updateMyCompanyProfile error:', error);
      res.status(500).json({ error: 'Failed to update company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }

  async getCompanyProfileById(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const { id } = req.params;
      db = await getConnection();
      const result = await db.query(
        `SELECT id, name, domain, industry, size, website, address, phone, email, is_active as isActive,
                description, description as companyDescription, tagline,
                logo_url as logoUrl, primary_color as primaryColor, secondary_color as secondaryColor,
                created_at as createdAt, updated_at as updatedAt
         FROM companies WHERE id = ?`,
        [id]
      );
      if (result.rows.length === 0) { res.status(404).json({ error: 'Company not found' }); return; }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('getCompanyProfileById error:', error);
      res.status(500).json({ error: 'Failed to get company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }

  // Get users for current user's company
  async getMyCompanyUsers(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const companyId = req.user?.companyId;
      if (!companyId) { res.status(404).json({ error: 'No company associated with user' }); return; }
      db = await getConnection();
      const result = await db.query(
        `SELECT id, email, first_name, last_name, role, company_admin, subscription_tier, is_active, created_at
         FROM users WHERE company_id = ? ORDER BY created_at DESC`,
        [companyId]
      );
      res.json(Array.isArray(result.rows) ? result.rows : []);
    } catch (error) {
      console.error('getMyCompanyUsers error:', error);
      res.status(500).json({ error: 'Failed to get company users' });
    } finally { if (db?.release) db.release(); }
  }

  async inviteCompanyUser(req: Request, res: Response): Promise<void> {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(404).json({ success: false, error: 'No company associated with user' });
      return;
    }

    const emailInput = typeof req.body?.email === 'string' ? req.body.email : '';
    const email = sanitizeEmail(emailInput);

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ success: false, error: 'Invalid email address.' });
      return;
    }

    let db: any = null;

    try {
      db = await getConnection();

      const { seatLimit, activeUsers, pendingInvites } = await getSeatUsage(
        db,
        companyId,
        req.user?.subscriptionTier
      );

      if (activeUsers + pendingInvites >= seatLimit) {
        res.status(409).json({ success: false, error: 'Seat limit exceeded', errorCode: 'SEAT_LIMIT_EXCEEDED' });
        return;
      }

      const invitationId = randomUUID();
      const token = randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = getInviteExpiryDate();

      await db.query(
        `INSERT INTO company_invitations (id, company_id, email, token_hash, expires_at, status, invited_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [invitationId, companyId, email, tokenHash, expiresAt, 'pending', req.user?.id ?? null]
      );

      const companyResult = await db.query('SELECT name FROM companies WHERE id = ?', [companyId]);
      const companyName =
        companyResult.rows.length > 0
          ? companyResult.rows[0].name ?? companyResult.rows[0].NAME ?? null
          : null;

      const inviterName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ') || null;
      const inviteUrl = buildInvitationUrl(token, email);

      const maxAttempts = 3;
      let attempt = 0;
      let lastError: unknown = null;

      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          console.info(`Sending company invitation email (attempt ${attempt})`, { to: email });
          await sendCompanyInvitationEmail(email, inviteUrl, {
            companyName,
            invitedByName: inviterName,
            expiresAt,
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          console.error(`Company invitation email attempt ${attempt} failed`, error);
        }
      }

      if (lastError) {
        await logAuditEvent({
          eventType: 'COMPANY_USER_INVITE_SENT',
          success: false,
          userId: req.user?.id ?? null,
          email: req.user?.email ?? null,
          ipAddress: resolveClientIp(req),
          metadata: {
            invitedEmail: email,
            companyId,
            invitationId,
            seatLimit,
            activeUsers,
            pendingInvites,
            reason: 'EMAIL_FAILED',
          },
        });
        res.status(500).json({ success: false, error: 'Failed to send invitation email.' });
        return;
      }

      await logAuditEvent({
        eventType: 'COMPANY_USER_INVITE_SENT',
        success: true,
        userId: req.user?.id ?? null,
        email: req.user?.email ?? null,
        ipAddress: resolveClientIp(req),
        metadata: {
          invitedEmail: email,
          companyId,
          invitationId,
          seatLimit,
          activeUsers,
          pendingInvites,
          emailEnabled: emailService.isEnabled,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('inviteCompanyUser error:', error);
      res.status(500).json({ success: false, error: 'Failed to invite company user' });
    } finally {
      db?.release?.();
    }
  }

  async validateCompanyInvitation(req: Request, res: Response): Promise<void> {
    const tokenParam = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    if (!tokenParam) {
      res.json({ status: 'invalid' });
      return;
    }

    const tokenHash = hashToken(tokenParam);
    let db: any = null;

    try {
      db = await getConnection();
      const result = await db.query(
        `SELECT id, company_id, email, status, expires_at, accepted_at
         FROM company_invitations WHERE token_hash = ?`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        res.json({ status: 'invalid' });
        return;
      }

      const invitation = normalizeInvitationRow(result.rows[0]);
      if (!invitation) {
        res.json({ status: 'invalid' });
        return;
      }

      if (invitation.status !== 'pending') {
        const status = invitation.status === 'cancelled' ? 'cancelled' : 'used';
        res.json({ status });
        return;
      }

      if (isInvitationExpired(invitation)) {
        await db.query(
          `UPDATE company_invitations SET status = ?, updated_at = GETDATE() WHERE id = ? AND status = ?`,
          ['expired', invitation.id, 'pending']
        );
        res.json({ status: 'expired' });
        return;
      }

      res.json({ status: 'valid' });
    } catch (error) {
      console.error('validateCompanyInvitation error:', error);
      res.status(500).json({ status: 'invalid' });
    } finally {
      db?.release?.();
    }
  }

  async acceptCompanyInvitation(req: Request, res: Response): Promise<void> {
    const tokenInput = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';

    if (!tokenInput || !password) {
      res.status(400).json({ success: false, error: 'Token and password are required.' });
      return;
    }

    if (!passwordMeetsPolicy(password)) {
      res.status(400).json({ success: false, error: 'Password does not meet complexity requirements.' });
      return;
    }

    const tokenHash = hashToken(tokenInput);
    let db: any = null;
    let transactionStarted = false;

    try {
      db = await getConnection();
      await db.query('BEGIN TRANSACTION');
      transactionStarted = true;

      const invitationResult = await db.query(
        `SELECT id, company_id, email, status, expires_at, accepted_at
         FROM company_invitations WHERE token_hash = ?`,
        [tokenHash]
      );

      if (invitationResult.rows.length === 0) {
        await db.query('ROLLBACK TRANSACTION');
        transactionStarted = false;
        await logAuditEvent({
          eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
          success: false,
          email: null,
          ipAddress: resolveClientIp(req),
          metadata: { reason: 'NOT_FOUND' },
        });
        res.status(400).json({ success: false, error: 'Invalid or expired invitation.' });
        return;
      }

      const invitation = normalizeInvitationRow(invitationResult.rows[0]);
      if (!invitation) {
        await db.query('ROLLBACK TRANSACTION');
        transactionStarted = false;
        await logAuditEvent({
          eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
          success: false,
          email: null,
          ipAddress: resolveClientIp(req),
          metadata: { reason: 'INVALID_RECORD' },
        });
        res.status(400).json({ success: false, error: 'Invalid or expired invitation.' });
        return;
      }

      if (invitation.status === 'cancelled') {
        await db.query('ROLLBACK TRANSACTION');
        transactionStarted = false;
        await logAuditEvent({
          eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
          success: false,
          email: invitation.email,
          ipAddress: resolveClientIp(req),
          metadata: { reason: 'CANCELLED', invitationId: invitation.id, companyId: invitation.companyId },
        });
        res.status(410).json({ success: false, error: 'Invitation is no longer valid.' });
        return;
      }

      if (invitation.status !== 'pending' || invitation.acceptedAt) {
        await db.query('ROLLBACK TRANSACTION');
        transactionStarted = false;
        await logAuditEvent({
          eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
          success: false,
          email: invitation.email,
          ipAddress: resolveClientIp(req),
          metadata: { reason: 'ALREADY_USED', invitationId: invitation.id, companyId: invitation.companyId },
        });
        res.status(410).json({ success: false, error: 'Invitation has already been used.' });
        return;
      }

      if (isInvitationExpired(invitation)) {
        await db.query(
          `UPDATE company_invitations SET status = ?, updated_at = GETDATE() WHERE id = ? AND status = ?`,
          ['expired', invitation.id, 'pending']
        );
        await db.query('COMMIT TRANSACTION');
        transactionStarted = false;
        await logAuditEvent({
          eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
          success: false,
          email: invitation.email,
          ipAddress: resolveClientIp(req),
          metadata: { reason: 'EXPIRED', invitationId: invitation.id, companyId: invitation.companyId },
        });
        res.status(410).json({ success: false, error: 'Invitation has expired.' });
        return;
      }

      const normalizedEmail = sanitizeEmail(invitation.email);
      const existingUserResult = await db.query(
        `SELECT id, email, first_name, last_name, role, company_id, company_admin, is_active, subscription_tier
         FROM users WHERE LOWER(email) = ?`,
        [normalizedEmail]
      );

      const invitationMetadata = {
        invitationId: invitation.id,
        companyId: invitation.companyId,
      };

      let userId: string;
      let isExistingUser = false;

      if (existingUserResult.rows.length > 0) {
        isExistingUser = true;
        const userRow = existingUserResult.rows[0];

        if (userRow.company_id && userRow.company_id !== invitation.companyId) {
          await db.query('ROLLBACK TRANSACTION');
          transactionStarted = false;
          await logAuditEvent({
            eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
            success: false,
            userId: userRow.id,
            email: userRow.email,
            ipAddress: resolveClientIp(req),
            metadata: { ...invitationMetadata, reason: 'DIFFERENT_COMPANY' },
          });
          res.status(409).json({ success: false, error: 'Invitation cannot be accepted for this account.' });
          return;
        }

        const updateFields = ['password_hash = ?', 'company_id = ?', 'company_admin = 0', 'is_active = 1', 'updated_at = GETDATE()'];
        const updateParams: any[] = [await hashPassword(password), invitation.companyId];

        if (firstName) {
          updateFields.push('first_name = ?');
          updateParams.push(firstName);
        }
        if (lastName) {
          updateFields.push('last_name = ?');
          updateParams.push(lastName);
        }

        updateParams.push(userRow.id);

        await db.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
        userId = userRow.id;
      } else {
        userId = randomUUID();
        const passwordHash = await hashPassword(password);
        await db.query(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, role, subscription_tier, is_active, company_id, company_admin, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'user', 'trial', 1, ?, 0, GETDATE(), GETDATE())`,
          [userId, normalizedEmail, passwordHash, firstName || null, lastName || null, invitation.companyId]
        );
      }

      await db.query(
        `UPDATE company_invitations SET status = ?, accepted_at = GETDATE(), updated_at = GETDATE() WHERE id = ? AND status = ?`,
        ['accepted', invitation.id, 'pending']
      );

      const userResult = await db.query(
        `SELECT id, email, first_name, last_name, role, company_id, company_admin, subscription_tier
         FROM users WHERE id = ?`,
        [userId]
      );

      const userRow = userResult.rows[0];
      const token = generateToken({
        userId: userRow.id,
        email: userRow.email,
        role: userRow.role,
        companyId: userRow.company_id || '',
      });
      const tokenExpiresAt = new Date(Date.now() + getJwtExpiryDurationMs());

      await db.query('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userRow.id, tokenExpiresAt]);

      await db.query('COMMIT TRANSACTION');
      transactionStarted = false;

      await logAuditEvent({
        eventType: 'COMPANY_INVITE_ACCEPTED',
        success: true,
        userId: userRow.id,
        email: userRow.email,
        ipAddress: resolveClientIp(req),
        metadata: { ...invitationMetadata, existingUser: isExistingUser },
      });

      res.json({
        success: true,
        token,
        user: {
          id: userRow.id,
          email: userRow.email,
          firstName: userRow.first_name,
          lastName: userRow.last_name,
          role: userRow.role,
          companyId: userRow.company_id,
          companyAdmin: Boolean(userRow.company_admin),
          subscriptionTier: userRow.subscription_tier,
        },
      });
    } catch (error) {
      console.error('acceptCompanyInvitation error:', error);
      if (transactionStarted) {
        try {
          await db?.query?.('ROLLBACK TRANSACTION');
        } catch (rollbackError) {
          console.error('Failed to rollback transaction for acceptCompanyInvitation', rollbackError);
        }
      }
      await logAuditEvent({
        eventType: 'COMPANY_INVITE_ACCEPT_FAILED',
        success: false,
        email: null,
        ipAddress: resolveClientIp(req),
        metadata: { reason: 'ERROR', message: (error as Error)?.message },
      });
      res.status(500).json({ success: false, error: 'Failed to accept invitation.' });
    } finally {
      db?.release?.();
    }
  }

  async resendCompanyInvitation(req: Request, res: Response): Promise<void> {
    const invitationId = typeof req.params?.id === 'string' ? req.params.id : '';
    if (!invitationId) {
      res.status(400).json({ success: false, error: 'Invitation id is required.' });
      return;
    }

    let db: any = null;
    let transactionStarted = false;

    try {
      db = await getConnection();
      await db.query('BEGIN TRANSACTION');
      transactionStarted = true;

      const invitationResult = await db.query(
        `SELECT id, company_id, email, status, expires_at
         FROM company_invitations WHERE id = ?`,
        [invitationId]
      );

      if (invitationResult.rows.length === 0) {
        await db.query('ROLLBACK TRANSACTION');
        transactionStarted = false;
        res.status(404).json({ success: false, error: 'Invitation not found.' });
        return;
      }

      const invitation = normalizeInvitationRow(invitationResult.rows[0]);
      if (!invitation) {
        await db.query('ROLLBACK TRANSACTION');
        transactionStarted = false;
        res.status(404).json({ success: false, error: 'Invitation not found.' });
        return;
      }

      if (req.user?.role !== 'admin') {
        if (!req.user?.companyId || req.user.companyId !== invitation.companyId) {
          await db.query('ROLLBACK TRANSACTION');
          transactionStarted = false;
          res.status(403).json({ success: false, error: 'You are not authorized to manage this invitation.' });
          return;
        }
      }

      if (invitation.status !== 'pending') {
        await db.query('ROLLBACK TRANSACTION');
        transactionStarted = false;
        res.status(400).json({ success: false, error: 'Only pending invitations can be resent.' });
        return;
      }

      const newToken = randomBytes(32).toString('hex');
      const newTokenHash = hashToken(newToken);
      const newExpiresAt = getInviteExpiryDate();

      await db.query(
        `UPDATE company_invitations SET token_hash = ?, expires_at = ?, updated_at = GETDATE() WHERE id = ?`,
        [newTokenHash, newExpiresAt, invitation.id]
      );

      const companyResult = await db.query('SELECT name FROM companies WHERE id = ?', [invitation.companyId]);
      const companyName =
        companyResult.rows.length > 0
          ? companyResult.rows[0].name ?? companyResult.rows[0].NAME ?? null
          : null;

      const inviterName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ') || null;
      const inviteUrl = buildInvitationUrl(newToken, invitation.email);

      await sendCompanyInvitationEmail(invitation.email, inviteUrl, {
        companyName,
        invitedByName: inviterName,
        expiresAt: newExpiresAt,
      });

      await db.query('COMMIT TRANSACTION');
      transactionStarted = false;

      await logAuditEvent({
        eventType: 'COMPANY_INVITE_RESENT',
        success: true,
        userId: req.user?.id ?? null,
        email: req.user?.email ?? null,
        ipAddress: resolveClientIp(req),
        metadata: {
          invitationId: invitation.id,
          companyId: invitation.companyId,
          invitedEmail: invitation.email,
          emailEnabled: emailService.isEnabled,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('resendCompanyInvitation error:', error);
      if (transactionStarted) {
        try {
          await db?.query?.('ROLLBACK TRANSACTION');
        } catch (rollbackError) {
          console.error('Failed to rollback transaction for resendCompanyInvitation', rollbackError);
        }
      }
      await logAuditEvent({
        eventType: 'COMPANY_INVITE_RESENT',
        success: false,
        userId: req.user?.id ?? null,
        email: req.user?.email ?? null,
        ipAddress: resolveClientIp(req),
        metadata: {
          invitationId,
          reason: 'ERROR',
          message: (error as Error)?.message,
        },
      });
      res.status(500).json({ success: false, error: 'Failed to resend invitation.' });
    } finally {
      db?.release?.();
    }
  }

  async cancelCompanyInvitation(req: Request, res: Response): Promise<void> {
    const invitationId = typeof req.params?.inviteId === 'string' ? req.params.inviteId : '';
    if (!invitationId) {
      res.status(400).json({ success: false, error: 'Invitation id is required.' });
      return;
    }

    let db: any = null;

    try {
      db = await getConnection();

      const invitationResult = await db.query(
        `SELECT id, company_id, email, status FROM company_invitations WHERE id = ?`,
        [invitationId]
      );

      if (invitationResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Invitation not found.' });
        return;
      }

      const invitation = normalizeInvitationRow(invitationResult.rows[0]);
      if (!invitation) {
        res.status(404).json({ success: false, error: 'Invitation not found.' });
        return;
      }

      if (req.user?.role !== 'admin') {
        if (!req.user?.companyId || req.user.companyId !== invitation.companyId) {
          res.status(403).json({ success: false, error: 'You are not authorized to manage this invitation.' });
          return;
        }
      }

      if (invitation.status === 'accepted') {
        res.status(400).json({ success: false, error: 'Accepted invitations cannot be cancelled.' });
        return;
      }

      if (invitation.status === 'cancelled') {
        res.status(200).json({ success: true });
        return;
      }

      await db.query(
        `UPDATE company_invitations SET status = 'cancelled', updated_at = GETDATE() WHERE id = ?`,
        [invitation.id]
      );

      await logAuditEvent({
        eventType: 'COMPANY_INVITE_CANCELLED',
        success: true,
        userId: req.user?.id ?? null,
        email: req.user?.email ?? null,
        ipAddress: resolveClientIp(req),
        metadata: {
          invitationId: invitation.id,
          companyId: invitation.companyId,
          invitedEmail: invitation.email,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('cancelCompanyInvitation error:', error);
      await logAuditEvent({
        eventType: 'COMPANY_INVITE_CANCELLED',
        success: false,
        userId: req.user?.id ?? null,
        email: req.user?.email ?? null,
        ipAddress: resolveClientIp(req),
        metadata: {
          invitationId,
          reason: 'ERROR',
          message: (error as Error)?.message,
        },
      });
      res.status(500).json({ success: false, error: 'Failed to cancel invitation.' });
    } finally {
      db?.release?.();
    }
  }


  async removeCompanyUser(req: Request, res: Response): Promise<void> {
    const targetUserId = req.params?.id;

    if (!targetUserId) {
      res.status(400).json({ success: false, error: 'User ID is required.' });
      return;
    }

    let db: any = null;

    try {
      db = await getConnection();

      const userResult = await db.query(
        `SELECT id, email, company_id, company_admin, is_active FROM users WHERE id = ?`,
        [targetUserId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }

      const userRow = userResult.rows[0];
      const targetCompanyId = userRow.company_id ?? userRow.COMPANY_ID ?? null;
      const targetEmail = userRow.email ?? userRow.EMAIL ?? null;
      const targetIsCompanyAdmin = Boolean(userRow.company_admin ?? userRow.COMPANY_ADMIN ?? 0);

      if (!targetCompanyId) {
        res.status(400).json({ success: false, error: 'User is not assigned to a company.' });
        return;
      }

      const actingUser = req.user;

      if (!actingUser) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      if (actingUser.role !== 'admin' && actingUser.companyId !== targetCompanyId) {
        res.status(403).json({ success: false, error: 'Forbidden.' });
        return;
      }

      if (actingUser.id === targetUserId && targetIsCompanyAdmin) {
        const adminCountResult = await db.query(
          `SELECT COUNT(*) AS total FROM users WHERE company_id = ? AND company_admin = 1 AND is_active = 1 AND id <> ?`,
          [targetCompanyId, targetUserId]
        );
        const remainingAdmins = Number(
          adminCountResult.rows?.[0]?.total ??
            adminCountResult.rows?.[0]?.count ??
            adminCountResult.rows?.[0]?.COUNT ??
            0
        );

        if (remainingAdmins === 0) {
          res
            .status(400)
            .json({ success: false, error: 'Cannot remove yourself as the last company admin.' });
          return;
        }
      }

      const updateResult = await db.query(
        `UPDATE users SET company_id = NULL, company_admin = 0, updated_at = GETDATE() WHERE id = ?`,
        [targetUserId]
      );

      if (updateResult.rowCount === 0) {
        res.status(500).json({ success: false, error: 'Failed to update user record.' });
        return;
      }

      await logAuditEvent({
        eventType: 'COMPANY_USER_REMOVED',
        success: true,
        userId: actingUser.id,
        email: actingUser.email,
        ipAddress: resolveClientIp(req),
        metadata: {
          companyId: targetCompanyId,
          removedUserId: targetUserId,
          removedEmail: targetEmail,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('removeCompanyUser error:', error);

      await logAuditEvent({
        eventType: 'COMPANY_USER_REMOVED',
        success: false,
        userId: req.user?.id ?? null,
        email: req.user?.email ?? null,
        ipAddress: resolveClientIp(req),
        metadata: {
          removedUserId: targetUserId,
          reason: 'ERROR',
          message: (error as Error)?.message,
        },
      });

      res.status(500).json({ success: false, error: 'Failed to remove user from company.' });
    } finally {
      db?.release?.();
    }
  }


  async updateCompanyProfileById(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const { id } = req.params;
      const { name, domain, industry, size, website, address, phone, email, description, tagline, logoUrl, primaryColor, secondaryColor, isActive } = req.body || {};

      db = await getConnection();

      const updates: string[] = [];
      const values: any[] = [];
      const push = (col: string, val: any) => { updates.push(`${col} = ?`); values.push(val); };

      if (name !== undefined) push('name', name);
      if (domain !== undefined) push('domain', domain);
      if (industry !== undefined) push('industry', industry);
      if (size !== undefined) push('size', size);
      if (website !== undefined) push('website', website);
      if (description !== undefined) push('description', description);
      if (tagline !== undefined) push('tagline', tagline);
      if (address !== undefined) push('address', address);
      if (phone !== undefined) push('phone', phone);
      if (email !== undefined) push('email', email);
      if (logoUrl !== undefined) push('logo_url', logoUrl);
      if (primaryColor !== undefined) push('primary_color', primaryColor);
      if (secondaryColor !== undefined) push('secondary_color', secondaryColor);
      if (isActive !== undefined) push('is_active', isActive ? 1 : 0);

      if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

      values.push(id);
      const result = await db.query(
        `UPDATE companies SET ${updates.join(', ')}, updated_at = GETDATE() WHERE id = ?`,
        values
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'Company not found' }); return; }
      res.json({ success: true });
    } catch (error) {
      console.error('updateCompanyProfileById error:', error);
      res.status(500).json({ error: 'Failed to update company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }
}
