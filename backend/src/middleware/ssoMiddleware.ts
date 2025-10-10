import { Request, Response, NextFunction } from 'express';
import { ssoCentralService } from '../services/ssoCentralService';
import { verifyToken, verifySSOToken } from '../utils/jwt';

/**
 * SSO Middleware for automatic token detection and validation
 */
export class SSOMiddleware {

  /**
   * Middleware to detect and validate SSO tokens from application headers
   */
  static authenticateSSO(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    const ssoHeader = req.headers['x-sso-token'] as string;
    const userDomain = req.headers['x-user-domain'] as string || req.hostname;

    let token: string | null = null;
    let isDomainToken = false;

    // Try authorization header first (standard Bearer token)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      const decodedToken = verifyToken(token) as any;

      if (decodedToken && decodedToken.contextType === 'domain') {
        isDomainToken = true;
      }
    }
    // Fallback to SSO header for applications that use x-sso-token
    else if (ssoHeader) {
      token = ssoHeader;
      const decodedToken = verifyToken(ssoHeader) as any;

      if (decodedToken && decodedToken.contextType === 'domain') {
        isDomainToken = true;
      }
    }

    if (!token) {
      return next();
    }

    if (isDomainToken) {
      // For domain tokens, store context for later validation in controller
      (req as any)._ssoCandidate = {
        token: token,
        domain: userDomain,
        tokenType: 'domain'
      };

      // Attach SSO context for logging
      (req as any).ssoContext = {
        tokenType: 'domain',
        source: 'middleware',
        domain: userDomain
      };
    }
    // Regular token validation fallback
    else {
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: '', // Need to fetch from database
          companyId: decoded.companyId,
          subscriptionTier: 'trial'
        };
      }
    }

    next();
  }

  /**
   * Middleware for validating master tokens from platform
   */
  static validateMasterToken(req: Request, res: Response, next: NextFunction): void {
    const { token } = req.body;

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    if (decoded && decoded.userId) {
      (req as any).masterToken = decoded;
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: '', // Fetch from database in controller
        companyId: decoded.companyId,
        subscriptionTier: 'trial'
      };
    }

    next();
  }

  /**
   * Middleware to ensure SSO session for cross-domain requests
   */
  static requireSSOSession(req: Request, res: Response, next: NextFunction): void {
    const ssoContext = (req as any).ssoContext;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!ssoContext) {
      res.status(401).json({
        success: false,
        error: 'SSO session required for this operation'
      });
      return;
    }

    next();
  }

  /**
   * Admin-only middleware for SSO management
   */
  static requireSSOAdmin(req: Request, res: Response, next: NextFunction): void {
    const user = req.user;

    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'SSO administrator privileges required'
      });
      return;
    }

    next();
  }
}

/**
 * SSO Context Extension Types
 */
declare module 'express-serve-static-core' {
  interface Request {
    ssoContext?: {
      tokenType: 'domain' | 'master';
      source: string;
      domain: string;
    };
    masterToken?: any;
    _ssoCandidate?: {
      token: string;
      domain: string;
      tokenType: string;
    };
  }
}
