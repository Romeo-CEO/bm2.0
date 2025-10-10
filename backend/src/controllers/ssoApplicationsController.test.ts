import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { SsoApplicationsController } from './ssoApplicationsController';

const {
  getConnectionMock,
  logAuditEventMock
} = vi.hoisted(() => ({
  getConnectionMock: vi.fn(),
  logAuditEventMock: vi.fn()
}));

vi.mock('../config/database', () => ({
  getConnection: (...args: any[]) => getConnectionMock(...args)
}));

vi.mock('../services/auditService', () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args)
}));

const createResponse = () => {
  const res: Partial<Response & { body?: any; statusCode?: number }> = {};
  res.statusCode = 200;
  res.status = vi.fn(function (this: any, code: number) {
    this.statusCode = code;
    return this;
  }) as any;
  res.json = vi.fn(function (this: any, payload: any) {
    this.body = payload;
    return this;
  }) as any;
  return res as Response & { body?: any; statusCode?: number };
};

const controller = new SsoApplicationsController();

let connectionMock: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

beforeEach(() => {
  connectionMock = {
    query: vi.fn(),
    release: vi.fn()
  };
  getConnectionMock.mockReset();
  getConnectionMock.mockResolvedValue(connectionMock);
  logAuditEventMock.mockReset();
});

describe('SsoApplicationsController.create', () => {
  it('rejects non-admin requests', async () => {
    const req = { body: {}, user: { role: 'user' } } as unknown as Request;
    const res = createResponse();

    await controller.create(req, res);

    expect(res.statusCode).toBe(403);
    expect(connectionMock.query).not.toHaveBeenCalled();
  });

  it('creates application with unique validation', async () => {
    const req = {
      body: { name: 'Contoso HR', domain: 'hr.contoso.com', ssoEnabled: true },
      user: { role: 'admin', id: 'admin-1' }
    } as unknown as Request;
    const res = createResponse();

    connectionMock.query
      .mockResolvedValueOnce({ rows: [] }) // duplicate check
      .mockResolvedValueOnce({}); // insert

    await controller.create(req, res);

    expect(connectionMock.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id FROM sso_applications WHERE LOWER(name) = LOWER(?) OR domain = ?',
      ['Contoso HR', 'hr.contoso.com']
    );
    expect(connectionMock.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO sso_applications'),
      expect.arrayContaining(['Contoso HR', 'hr.contoso.com', 1])
    );
    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'SSO_APPLICATION_UPDATED',
        metadata: expect.objectContaining({ action: 'create', domain: 'hr.contoso.com' })
      })
    );
  });

  it('returns 409 on duplicate', async () => {
    const req = {
      body: { name: 'Contoso HR', domain: 'hr.contoso.com' },
      user: { role: 'admin', id: 'admin-1' }
    } as unknown as Request;
    const res = createResponse();

    connectionMock.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

    await controller.create(req, res);

    expect(res.statusCode).toBe(409);
    expect(connectionMock.query).toHaveBeenCalledTimes(1);
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});

describe('SsoApplicationsController.update', () => {
  it('updates metadata and toggles sso', async () => {
    const req = {
      params: { id: 'app-1' },
      body: { ssoEnabled: false, metadata: { callbackUrl: 'https://contoso.com/sso' } },
      user: { role: 'admin', id: 'admin-2' }
    } as unknown as Request;
    const res = createResponse();

    connectionMock.query
      .mockResolvedValueOnce({ rows: [{
        id: 'app-1', name: 'Contoso HR', domain: 'hr.contoso.com', sso_enabled: 1, metadata: JSON.stringify({})
      }] })
      .mockResolvedValueOnce({ rows: [] }) // duplicate check
      .mockResolvedValueOnce({}); // update

    await controller.update(req, res);

    expect(connectionMock.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sso_applications'),
      expect.arrayContaining(['Contoso HR', 'hr.contoso.com', 0, JSON.stringify({ callbackUrl: 'https://contoso.com/sso' })])
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          action: 'update',
          next: expect.objectContaining({ ssoEnabled: false })
        })
      })
    );
  });
});
