import { randomBytes, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { getConnection } from '../config/database';
import { logAuditEvent } from '../services/auditService';
import { sendTemporaryPasswordEmail } from '../services/emailService';
import { getSeatUsage } from '../utils/companySeats';
import { hashPassword, passwordMeetsPolicy } from '../utils/passwordPolicy';
import { sendError, sendPaginated, sendSuccess } from '../utils/responses';

const sanitizeEmail = (email: string): string => email.trim().toLowerCase();
const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const shuffleString = (value: string): string =>
  value
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');

const randomChar = (charset: string): string => charset[Math.floor(Math.random() * charset.length)];

const generateTemporaryPassword = (): string => {
  const baseCharset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
  const segments = [
    randomChar('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    randomChar('abcdefghijkmnopqrstuvwxyz'),
    randomChar('0123456789'),
    randomBytes(6)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6),
  ];
  let candidate = shuffleString(segments.join(''));

  while (candidate.length < 12) {
    candidate += randomChar(baseCharset);
  }

  candidate = shuffleString(candidate).slice(0, 12);

  if (!passwordMeetsPolicy(candidate)) {
    return generateTemporaryPassword();
  }

  return candidate;
};

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

export class UsersController {
  async createUserWithTemporaryPassword(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 401, 'AUTH_REQUIRED', 'Unauthorized');
      return;
    }

    const emailInput = typeof req.body?.email === 'string' ? req.body.email : '';
    const email = sanitizeEmail(emailInput);

    if (!email || !isValidEmail(email)) {
      sendError(res, 400, 'INVALID_EMAIL', 'A valid email address is required');
      return;
    }

    const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';

    let targetCompanyId: string | null = null;
    let subscriptionTierForSeatCheck: string | null | undefined = null;
    let subscriptionExpiry: string | null | undefined = null;

    if (req.user.role === 'admin') {
      targetCompanyId =
        typeof req.body?.companyId === 'string' && req.body.companyId.trim().length > 0
          ? req.body.companyId.trim()
          : null;
      subscriptionTierForSeatCheck =
        typeof req.body?.subscriptionTier === 'string' && req.body.subscriptionTier.trim().length > 0
          ? req.body.subscriptionTier.trim()
          : null;
      if (typeof req.body?.subscriptionExpiry === 'string' && req.body.subscriptionExpiry.trim().length > 0) {
        subscriptionExpiry = req.body.subscriptionExpiry.trim();
      }
    } else {
      targetCompanyId = req.user.companyId ?? null;
      subscriptionTierForSeatCheck = req.user.subscriptionTier ?? null;
      subscriptionExpiry = req.user.subscriptionExpiry ?? null;

      if (!targetCompanyId) {
        sendError(res, 404, 'COMPANY_NOT_FOUND', 'No company associated with current user');
        return;
      }
    }

    let db: any = null;

    try {
      db = await getConnection();

      if (targetCompanyId) {
        const { seatLimit, activeUsers, pendingInvites } = await getSeatUsage(
          db,
          targetCompanyId,
          subscriptionTierForSeatCheck
        );

        if (activeUsers + pendingInvites >= seatLimit) {
          sendError(res, 409, 'SEAT_LIMIT_EXCEEDED', 'Seat limit exceeded for this company');
          return;
        }
      }

      const existingUserResult = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUserResult.rows.length > 0) {
        sendError(res, 409, 'USER_EXISTS', 'A user with this email already exists');
        return;
      }

      let companyName: string | null = null;
      if (targetCompanyId) {
        const companyResult = await db.query('SELECT name FROM companies WHERE id = ?', [targetCompanyId]);
        if (companyResult.rows.length > 0) {
          const row = companyResult.rows[0];
          companyName = row.name ?? row.NAME ?? null;
        }
      }

      let temporaryPassword = generateTemporaryPassword();
      let attempts = 0;
      while (!passwordMeetsPolicy(temporaryPassword) && attempts < 5) {
        temporaryPassword = generateTemporaryPassword();
        attempts += 1;
      }

      if (!passwordMeetsPolicy(temporaryPassword)) {
        sendError(res, 500, 'TEMP_PASSWORD_GENERATION_FAILED', 'Failed to generate temporary password');
        return;
      }

      const passwordHash = await hashPassword(temporaryPassword);
      const userId = randomUUID();

      await db.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, subscription_tier, subscription_expiry, is_active, company_id, company_admin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'user', ?, ?, 1, ?, 0, GETDATE(), GETDATE())`,
        [
          userId,
          email,
          passwordHash,
          firstName || null,
          lastName || null,
          targetCompanyId ? subscriptionTierForSeatCheck || 'trial' : null,
          targetCompanyId ? subscriptionExpiry || null : null,
          targetCompanyId,
        ]
      );

      const maxAttempts = 3;
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await sendTemporaryPasswordEmail(email, temporaryPassword, {
            companyName,
            firstName: firstName || null,
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          console.error(`Temporary password email attempt ${attempt} failed`, error);
        }
      }

      if (lastError) {
        await logAuditEvent({
          eventType: 'USER_TEMP_PASSWORD_CREATED',
          success: false,
          userId: req.user.id,
          email: req.user.email,
          ipAddress: resolveClientIp(req),
          userAgent: req.headers['user-agent']?.toString() ?? null,
          metadata: {
            companyId: targetCompanyId,
            email,
            reason: 'EMAIL_FAILED',
            message: (lastError as Error)?.message ?? 'EMAIL_FAILED',
          },
        });

        sendError(res, 502, 'EMAIL_DELIVERY_FAILED', 'Failed to send temporary password email');
        return;
      }

      await logAuditEvent({
        eventType: 'USER_TEMP_PASSWORD_CREATED',
        success: true,
        userId: req.user.id,
        email: req.user.email,
        ipAddress: resolveClientIp(req),
        userAgent: req.headers['user-agent']?.toString() ?? null,
        metadata: {
          createdUserId: userId,
          companyId: targetCompanyId,
          email,
        },
      });

      res.status(201).json({ success: true, userId });
    } catch (error) {
      console.error('createUserWithTemporaryPassword error:', error);

      await logAuditEvent({
        eventType: 'USER_TEMP_PASSWORD_CREATED',
        success: false,
        userId: req.user?.id ?? null,
        email: req.user?.email ?? null,
        ipAddress: resolveClientIp(req),
        userAgent: req.headers['user-agent']?.toString() ?? null,
        metadata: {
          email,
          companyId: targetCompanyId,
          reason: 'ERROR',
          message: (error as Error)?.message,
        },
      });

      sendError(res, 500, 'TEMP_USER_CREATE_FAILED', 'Failed to create user with temporary password');
    } finally {
      db?.release?.();
    }
  }

  /**
   * Get all users (admin only)
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = '1', pageSize = '25' } = req.query as Record<string, string>;
      const pageNumber = Math.max(parseInt(String(page), 10) || 1, 1);
      const pageSizeNumber = Math.max(Math.min(parseInt(String(pageSize), 10) || 25, 100), 1);
      const offset = (pageNumber - 1) * pageSizeNumber;

      const db = await getConnection();
      const countResult = await db.query('SELECT COUNT(*) AS total FROM users');
      const total = Number(countResult.rows?.[0]?.total ?? 0);
      const result = await db.query(
        `SELECT id, email, first_name, last_name, role, company_id, subscription_tier, is_active, created_at
         FROM users
         ORDER BY created_at DESC
         OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
        [offset, pageSizeNumber]
      );

      sendPaginated(res, {
        items: result.rows,
        page: pageNumber,
        pageSize: pageSizeNumber,
        total,
        totalPages: Math.max(Math.ceil(total / pageSizeNumber), 1),
      });

    } catch (error) {
      console.error('Get users error:', error);
      sendError(res, 500, 'USERS_FETCH_FAILED', 'Failed to get users');
    }
  }

  /**
   * Update user (admin only)
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, subscriptionTier, isActive } = req.body;

      if (!id) { sendError(res, 400, 'USER_ID_REQUIRED', 'User ID required'); return; }

      const db = await getConnection();
      
      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (firstName !== undefined) {
        updates.push('first_name = ?');
        values.push(firstName);
      }
      if (lastName !== undefined) {
        updates.push('last_name = ?');
        values.push(lastName);
      }
      if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
      }
      if (subscriptionTier !== undefined) {
        updates.push('subscription_tier = ?');
        values.push(subscriptionTier);
      }
      if (isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(isActive ? 1 : 0);
      }

      if (updates.length === 0) { sendError(res, 400, 'NO_FIELDS', 'No fields to update'); return; }

      values.push(id);

      const result = await db.query(`
        UPDATE users 
        SET ${updates.join(', ')}, updated_at = GETDATE()
        WHERE id = ?
      `, values);

      if (result.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      sendSuccess(res, { message: 'User updated successfully' });

    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) { sendError(res, 400, 'USER_ID_REQUIRED', 'User ID required'); return; }

      const db = await getConnection();
      const result = await db.query('DELETE FROM users WHERE id = ?', [id]);

      if (result.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      sendSuccess(res, { message: 'User deleted successfully' });

    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id) {
      sendError(res, 400, 'USER_ID_REQUIRED', 'User ID required');
      return;
    }

    if (!req.user) {
      sendError(res, 401, 'AUTH_REQUIRED', 'Unauthorized');
      return;
    }

    let db: any = null;

    try {
      db = await getConnection();
      const result = await db.query(
        `SELECT id, email, first_name, last_name, role, company_id, company_admin, subscription_tier, subscription_expiry, is_active, created_at, updated_at
         FROM users WHERE id = ?`,
        [id]
      );

      if (result.rows.length === 0) {
        sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
        return;
      }

      const row = result.rows[0];
      const companyId = row.company_id ?? row.COMPANY_ID ?? null;

      if (req.user.role !== 'admin') {
        if (!req.user.companyAdmin) {
          sendError(res, 403, 'COMPANY_ADMIN_REQUIRED', 'Company admin access required');
          return;
        }

        if (!req.user.companyId || req.user.companyId !== companyId) {
          sendError(res, 403, 'COMPANY_SCOPE_VIOLATION', 'Forbidden');
          return;
        }
      }

      const user = {
        id: row.id ?? row.ID,
        email: row.email ?? row.EMAIL,
        firstName: row.first_name ?? row.FIRST_NAME ?? null,
        lastName: row.last_name ?? row.LAST_NAME ?? null,
        role: row.role ?? row.ROLE ?? 'user',
        companyId,
        companyAdmin: Boolean(row.company_admin ?? row.COMPANY_ADMIN ?? 0),
        subscriptionTier: row.subscription_tier ?? row.SUBSCRIPTION_TIER ?? null,
        subscriptionExpiry: row.subscription_expiry ?? row.SUBSCRIPTION_EXPIRY ?? null,
        isActive: Boolean(row.is_active ?? row.IS_ACTIVE ?? 0),
        createdAt: row.created_at ?? row.CREATED_AT ?? null,
        updatedAt: row.updated_at ?? row.UPDATED_AT ?? null,
      };

      sendSuccess(res, { user });
    } catch (error) {
      console.error('getUserById error:', error);
      sendError(res, 500, 'USER_FETCH_FAILED', 'Failed to fetch user');
    } finally {
      db?.release?.();
    }
  }

  // Assign user to a company (admin or company admin)
  async assignCompany(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId, makeCompanyAdmin = false } = req.body || {};
      if (!id || !companyId) { sendError(res, 400, 'COMPANY_ASSIGNMENT_INVALID', 'user id and companyId are required'); return; }
      if (!req.user) { sendError(res, 401, 'AUTH_REQUIRED', 'Unauthorized'); return; }

      const db = await getConnection();
      const subscriptionTier = req.user.subscriptionTier || 'trial';
      const subscriptionExpiry = req.user.subscriptionTier === 'trial' ? null : req.user.subscriptionExpiry || null;

      const updateResult = await db.query("UPDATE users SET company_id = ?, subscription_tier = ?, subscription_expiry = ?, updated_at = GETDATE() WHERE id = ?", [companyId, subscriptionTier, subscriptionExpiry, id]);
      if (updateResult.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      const adminCheck = await db.query("SELECT COUNT(*) AS count FROM users WHERE company_id = ? AND (role = 'admin' OR company_admin = 1)", [companyId]);
      const existingAdmins = Number(adminCheck.rows?.[0]?.count || 0);
      const shouldPromote = makeCompanyAdmin || existingAdmins === 0;
      if (shouldPromote) {
        await db.query('UPDATE users SET company_admin = 1, updated_at = GETDATE() WHERE id = ?', [id]);
      }

      sendSuccess(res, { companyAdmin: shouldPromote });
    } catch (error) {
      console.error('assignCompany error:', error);
      res.status(500).json({ error: 'Failed to assign company' });
    }
  }


  // Set or unset company admin flag (admin or company admin)
  async setCompanyAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isCompanyAdmin } = req.body || {};
      if (typeof isCompanyAdmin !== 'boolean') { sendError(res, 400, 'COMPANY_ADMIN_FLAG_INVALID', 'isCompanyAdmin boolean required'); return; }
      if (!req.user) { sendError(res, 401, 'AUTH_REQUIRED', 'Unauthorized'); return; }
      const db = await getConnection();
      const userQ = await db.query('SELECT company_id FROM users WHERE id = ?', [id]);
      if (userQ.rows.length === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }
      const targetCompanyId = userQ.rows[0].company_id;
      if (req.user.role !== 'admin' && req.user.companyId !== targetCompanyId) {
        sendError(res, 403, 'COMPANY_SCOPE_VIOLATION', 'Forbidden'); return; }
      const result = await db.query('UPDATE users SET company_admin = ?, updated_at = GETDATE() WHERE id = ?', [isCompanyAdmin ? 1 : 0, id]);
      if (result.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }
      sendSuccess(res);
    } catch (error) {
      console.error('setCompanyAdmin error:', error);
      sendError(res, 500, 'COMPANY_ADMIN_UPDATE_FAILED', 'Failed to set company admin');
    }
  }
}
