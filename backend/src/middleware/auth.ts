import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConnection } from '../config/database';
import { logAuditEvent } from '../services/auditService';

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

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
        companyId?: string;
        subscriptionTier?: string;
        companyAdmin?: boolean;
        subscriptionExpiry?: string | null;
      };
      authToken?: string;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' });
      return;
    }

    const token = authHeader.substring(7);
    req.authToken = token;

    // Verify JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Also check database token for compatibility
    const db = await getConnection();
    const tokenResult = await db.query(
      'SELECT user_id FROM auth_tokens WHERE token = ? AND expires_at > GETDATE()',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      db.release?.();
      res.status(401).json({ success: false, error: 'Token expired or invalid', code: 'TOKEN_INVALID' });
      return;
    }

    // Get user details
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, role, company_id, company_admin, subscription_tier, subscription_expiry, is_active FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      db.release?.();
      res.status(401).json({ success: false, error: 'User not found or inactive', code: 'USER_NOT_FOUND' });
      return;
    }

    const user = userResult.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      companyId: user.company_id,
      subscriptionTier: user.subscription_tier,
      companyAdmin: Boolean(user.company_admin),
      subscriptionExpiry: user.subscription_expiry
    };
    db.release?.();

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', code: 'AUTH_INTERNAL_ERROR' });
  }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user || req.user.role !== 'admin') {
    await logAuditEvent({
      eventType: 'AUTHZ_DENIED',
      success: false,
      userId: req.user?.id,
      email: req.user?.email,
      ipAddress: resolveClientIp(req),
      userAgent: req.headers['user-agent']?.toString() ?? null,
      metadata: {
        requiredRole: 'admin',
        path: req.originalUrl,
        method: req.method,
      },
    });
    res.status(403).json({ success: false, error: 'Admin access required', code: 'ADMIN_REQUIRED' });
    return;
  }
  next();
};

export const requireCompanyAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    return;
  }

  if (req.user.role === 'admin' || req.user.companyAdmin) {
    next();
    return;
  }

  await logAuditEvent({
    eventType: 'AUTHZ_DENIED',
    success: false,
    userId: req.user.id,
    email: req.user.email,
    ipAddress: resolveClientIp(req),
    userAgent: req.headers['user-agent']?.toString() ?? null,
    metadata: {
      requiredRole: 'company_admin',
      path: req.originalUrl,
      method: req.method,
    },
  });
  res.status(403).json({ success: false, error: 'Company admin access required', code: 'COMPANY_ADMIN_REQUIRED' });
};