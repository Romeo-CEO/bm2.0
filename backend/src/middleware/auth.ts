import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConnection } from '../config/database';

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
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.substring(7);
    
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
      res.status(401).json({ error: 'Token expired or invalid' });
      return;
    }

    // Get user details
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, role, company_id, company_admin, subscription_tier, subscription_expiry, is_active FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'User not found or inactive' });
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

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};