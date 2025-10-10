import { Request, Response, NextFunction } from 'express';
import { logAuditEvent } from '../services/auditService';

declare global {
  namespace Express {
    interface Request {
      companyScope?: {
        companyId: string | null;
        isAdmin: boolean;
      };
    }
  }
}

const PAYFAST_IP_HEADER_CANDIDATES = ['x-forwarded-for', 'x-real-ip'];

const getClientIp = (req: Request): string | null => {
  for (const header of PAYFAST_IP_HEADER_CANDIDATES) {
    const value = req.headers[header];
    if (!value) continue;
    if (Array.isArray(value)) {
      const first = value[0];
      if (first) return first.split(',')[0]?.trim() || null;
    }
    if (typeof value === 'string') {
      return value.split(',')[0]?.trim() || null;
    }
  }

  if (req.ip) return req.ip;
  if (req.connection && 'remoteAddress' in req.connection) {
    return (req.connection as any).remoteAddress || null;
  }
  return null;
};

export const enforceCompanyScoping = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    return;
  }

  if (req.user.role === 'admin') {
    req.companyScope = { companyId: null, isAdmin: true };
    next();
    return;
  }

  const companyId = req.user.companyId;
  if (!companyId) {
    await logAuditEvent({
      eventType: 'SECURITY_SCOPE_DENIED',
      success: false,
      userId: req.user.id,
      email: req.user.email,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']?.toString() ?? null,
      metadata: {
        reason: 'missing_company_id',
        path: req.originalUrl,
      },
    });
    res.status(403).json({ success: false, error: 'Company context required', code: 'COMPANY_SCOPE_REQUIRED' });
    return;
  }

  const requestedCompanyId =
    (req.params?.companyId as string | undefined) ||
    (typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>).companyId as string | undefined : undefined) ||
    (req.query?.companyId as string | undefined);

  if (requestedCompanyId && requestedCompanyId !== companyId) {
    await logAuditEvent({
      eventType: 'SECURITY_SCOPE_DENIED',
      success: false,
      userId: req.user.id,
      email: req.user.email,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']?.toString() ?? null,
      metadata: {
        attemptedCompanyId: requestedCompanyId,
        companyId,
        path: req.originalUrl,
        method: req.method,
      },
    });
    res.status(403).json({ success: false, error: 'Forbidden', code: 'COMPANY_SCOPE_VIOLATION' });
    return;
  }

  if (req.params && Object.prototype.hasOwnProperty.call(req.params, 'companyId')) {
    req.params.companyId = companyId;
  }
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    if (Object.prototype.hasOwnProperty.call(req.body, 'companyId')) {
      req.body.companyId = companyId;
    }
  }
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'companyId')) {
    (req.query as any).companyId = companyId;
  }

  req.companyScope = { companyId, isAdmin: false };
  next();
};
