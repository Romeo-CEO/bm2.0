import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { TemplatesController } from './templatesController';

const {
  getConnectionMock,
  logAuditEventMock,
  personalizeTemplateMock
} = vi.hoisted(() => ({
  getConnectionMock: vi.fn(),
  logAuditEventMock: vi.fn(),
  personalizeTemplateMock: vi.fn()
}));

vi.mock('../config/database', () => ({
  getConnection: (...args: any[]) => getConnectionMock(...args)
}));

vi.mock('../services/auditService', () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args)
}));

vi.mock('../services/templatePersonalizationService', async () => {
  const actual = await vi.importActual<any>('../services/templatePersonalizationService');
  return {
    ...actual,
    personalizeTemplate: (...args: any[]) => personalizeTemplateMock(...args)
  };
});

const createResponse = () => {
  const res: Partial<Response & { body?: any; statusCode?: number; headers?: Record<string, string> }> = {};
  res.statusCode = 200;
  res.headers = {};
  res.status = vi.fn(function (this: any, code: number) {
    this.statusCode = code;
    return this;
  }) as any;
  res.json = vi.fn(function (this: any, payload: any) {
    this.body = payload;
    return this;
  }) as any;
  res.setHeader = vi.fn(function (this: any, key: string, value: string) {
    this.headers![key] = value;
  }) as any;
  res.send = vi.fn(function (this: any, payload: any) {
    this.body = payload;
    return this;
  }) as any;
  res.end = vi.fn(function (this: any) {
    return this;
  }) as any;
  return res as Response & { body?: any; statusCode?: number; headers?: Record<string, string> };
};

let connectionMock: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
const controller = new TemplatesController();

beforeEach(() => {
  connectionMock = {
    query: vi.fn(),
    release: vi.fn()
  };
  getConnectionMock.mockReset();
  getConnectionMock.mockResolvedValue(connectionMock);
  logAuditEventMock.mockReset();
  personalizeTemplateMock.mockReset();
});

describe('TemplatesController.downloadTemplate', () => {
  it('personalizes supported templates and audits download', async () => {
    const req = {
      params: { id: 'tpl-1' },
      user: { id: 'user-1', companyId: 'co-1', role: 'user', subscriptionTier: 'diy', email: 'user@co.com' }
    } as unknown as Request;
    const res = createResponse();

    connectionMock.query
      .mockResolvedValueOnce({
        rows: [{
          id: 'tpl-1',
          file_name: 'welcome.docx',
          file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          subscription_tiers: JSON.stringify(['diy']),
          template_content: 'Hello {{company.name}}'
        }]
      })
      .mockResolvedValueOnce({ rows: [{ name: 'Contoso', email: 'info@contoso.com', primary_color: '#112233', secondary_color: '#445566', logo_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/lkCJ9QAAAABJRU5ErkJggg==' }] });

    personalizeTemplateMock.mockResolvedValue({
      buffer: Buffer.from('doc'),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: 'welcome.docx'
    });

    await controller.downloadTemplate(req, res);

    expect(personalizeTemplateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'docx',
        templateContent: 'Hello {{company.name}}'
      })
    );
    expect(res.headers?.['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(res.headers?.['Content-Disposition']).toContain('welcome.docx');
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TEMPLATE_DOWNLOADED',
        metadata: expect.objectContaining({ templateId: 'tpl-1', format: 'docx' })
      })
    );
  });

  it('returns 403 when subscription tier not permitted', async () => {
    const req = {
      params: { id: 'tpl-1' },
      user: { id: 'user-1', companyId: 'co-1', role: 'user', subscriptionTier: 'trial' }
    } as unknown as Request;
    const res = createResponse();

    connectionMock.query.mockResolvedValueOnce({
      rows: [{
        file_type: 'application/pdf',
        file_name: 'guide.pdf',
        subscription_tiers: JSON.stringify(['diy'])
      }]
    });

    await controller.downloadTemplate(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe('Upgrade required');
  });

  it('redirects when personalization unavailable', async () => {
    const req = {
      params: { id: 'tpl-2' },
      user: { id: 'admin-1', role: 'admin' }
    } as unknown as Request;
    const res = createResponse();

    connectionMock.query.mockResolvedValueOnce({
      rows: [{
        download_url: 'https://cdn/templates/raw',
        file_type: 'application/octet-stream',
        subscription_tiers: JSON.stringify([])
      }]
    });

    await controller.downloadTemplate(req, res);

    expect(res.statusCode).toBe(302);
    expect(res.headers?.Location).toBe('https://cdn/templates/raw');
  });
});
