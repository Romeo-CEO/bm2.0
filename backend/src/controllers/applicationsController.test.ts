import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { ApplicationsController } from './applicationsController';

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

const controller = new ApplicationsController();

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

describe('ApplicationsController.getDeploymentChecklist', () => {
  it('returns normalized checklist with status map', async () => {
    const req = { params: { id: 'app-1' } } as unknown as Request;
    const res = createResponse();

    connectionMock.query
      .mockResolvedValueOnce({ rows: [{
        id: 'app-1',
        name: 'Contoso HR',
        subdomain: 'hr.contoso.com',
        app_url: 'https://hr.contoso.com',
        description: 'HR',
        icon_url: 'https://cdn/logo.png',
        ssl_status: 'provisioned'
      }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });

    await controller.getDeploymentChecklist(req, res);

    expect(connectionMock.query).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(res.body?.deploymentStatus?.statusMap).toEqual({
      sslCertificate: 'configured',
      dnsCname: 'configured',
      catalogListing: 'configured',
      launcherConfigured: 'configured',
      metadataComplete: 'configured'
    });
    expect(res.body?.deploymentStatus?.deploymentReady).toBe(true);
  });
});

describe('ApplicationsController.deployApplication', () => {
  it('rejects non-admin users', async () => {
    const req = { params: { id: 'app-1' }, user: { role: 'user' } } as unknown as Request;
    const res = createResponse();

    await controller.deployApplication(req, res);

    expect(res.statusCode).toBe(403);
    expect(connectionMock.query).not.toHaveBeenCalled();
  });

  it('prevents deployment when checklist incomplete', async () => {
    const req = { params: { id: 'app-1' }, user: { role: 'admin', id: 'admin-1' } } as unknown as Request;
    const res = createResponse();

    connectionMock.query
      .mockResolvedValueOnce({ rows: [{ id: 'app-1', name: 'Contoso HR' }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });

    await controller.deployApplication(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.statusMap?.catalogListing).toBe('pending');
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it('deploys and audits when checklist satisfied', async () => {
    const req = { params: { id: 'app-1' }, user: { role: 'admin', id: 'admin-1' } } as unknown as Request;
    const res = createResponse();

    connectionMock.query
      .mockResolvedValueOnce({ rows: [{
        id: 'app-1',
        name: 'Contoso HR',
        subdomain: 'hr.contoso.com',
        app_url: 'https://hr.contoso.com',
        description: 'HR',
        icon_url: 'https://cdn/logo.png',
        ssl_status: 'provisioned',
        subscription_tiers: JSON.stringify(['trial'])
      }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await controller.deployApplication(req, res);

    expect(connectionMock.query.mock.calls.some(call => String(call[0]).includes('INSERT INTO marketplace_applications'))).toBe(true);
    expect(connectionMock.query.mock.calls.some(call => call[0] === 'UPDATE applications SET status = ?, deployed_at = GETDATE() WHERE id = ?')).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body?.status).toBe('deployed');
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'APPLICATION_DEPLOYED', userId: 'admin-1' })
    );
  });
});
