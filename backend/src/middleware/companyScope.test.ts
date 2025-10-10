import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { enforceCompanyScoping } from './companyScope';
import * as auditService from '../services/auditService';

vi.mock('../services/auditService', () => ({
  logAuditEvent: vi.fn(),
}));

const createResponse = () => {
  const res: Partial<Response & { statusCode?: number; body?: any }> = {};
  res.statusCode = 200;
  res.status = vi.fn(function (this: any, code: number) {
    this.statusCode = code;
    return this;
  });
  res.json = vi.fn(function (this: any, payload: any) {
    this.body = payload;
    return this;
  });
  return res as Response & { statusCode?: number; body?: any };
};

describe('enforceCompanyScoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows admin users without enforcing company scope', async () => {
    const req = {
      user: { id: 'admin', email: 'admin@example.com', role: 'admin', companyId: null },
      params: {},
      body: {},
      query: {},
      headers: {},
      originalUrl: '/api/companies',
      method: 'GET',
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    await enforceCompanyScoping(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.companyScope).toEqual({ companyId: null, isAdmin: true });
    expect(auditService.logAuditEvent).not.toHaveBeenCalled();
  });

  it('enforces company scoping for non-admins and rewrites companyId', async () => {
    const req = {
      user: { id: 'user', email: 'user@example.com', role: 'user', companyId: 'company-1' },
      params: { companyId: 'company-1' },
      body: { companyId: 'company-1' },
      query: { companyId: 'company-1' },
      headers: {},
      originalUrl: '/api/companies/company-1',
      method: 'GET',
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    await enforceCompanyScoping(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.companyScope).toEqual({ companyId: 'company-1', isAdmin: false });
    expect(req.params.companyId).toBe('company-1');
    expect(req.body.companyId).toBe('company-1');
  });

  it('rejects mismatched companyId attempts and audits the event', async () => {
    const req = {
      user: { id: 'user', email: 'user@example.com', role: 'user', companyId: 'company-1' },
      params: { companyId: 'company-2' },
      body: {},
      query: {},
      headers: {},
      originalUrl: '/api/companies/company-2',
      method: 'GET',
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn();

    await enforceCompanyScoping(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body?.success).toBe(false);
    expect(res.body?.code).toBe('COMPANY_SCOPE_VIOLATION');
    expect(auditService.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SECURITY_SCOPE_DENIED',
        success: false,
      })
    );
  });
});
