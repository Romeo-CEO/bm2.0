import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Request, Response } from 'express';
import { PaymentsController } from './paymentsController';
import * as database from '../config/database';
import * as auditService from '../services/auditService';
import * as payfastService from '../services/payfastService';

const controller = new PaymentsController();

vi.mock('../config/database');
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

describe('PaymentsController.payfastItn', () => {
  const queryMock = vi.fn();
  const releaseMock = vi.fn();
  let existingPaymentRow: any = null;

  beforeEach(() => {
    vi.resetAllMocks();
    existingPaymentRow = null;
    (database.getConnection as unknown as Mock).mockResolvedValue({ query: queryMock, release: releaseMock });
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM platform_settings')) {
        return { rows: [] };
      }
      if (sql.startsWith('SELECT TOP 1 id')) {
        return { rows: [{ id: 'user-1', company_id: 'company-1' }] };
      }
      if (sql.startsWith('SELECT id, status')) {
        return existingPaymentRow ? { rows: [existingPaymentRow] } : { rows: [] };
      }
      return { rows: [], rowCount: 0 };
    });
    vi.spyOn(payfastService, 'postBackToPayfast').mockResolvedValue({ ok: true, body: 'VALID' });
    process.env.PAYFAST_MERCHANT_ID = 'merchant';
    process.env.PAYFAST_MERCHANT_KEY = 'key';
    process.env.PAYFAST_PASSPHRASE = 'passphrase';
    process.env.PAYFAST_NOTIFY_URL = 'https://example.com';
    process.env.PAYFAST_RETURN_URL = 'https://example.com/return';
    process.env.PAYFAST_CANCEL_URL = 'https://example.com/cancel';
  });

  it('processes a valid notification and stores payment', async () => {
    const params = {
      payment_status: 'COMPLETE',
      amount_gross: '149.00',
      pf_payment_id: 'pf-123',
      email_address: 'user@example.com',
      custom_int1: '30',
      custom_str3: 'diy',
      custom_str4: 'diy:monthly',
      custom_str5: 'monthly',
      item_name: 'DIY Monthly',
      currency: 'ZAR',
    };
    const signature = payfastService.computeSignature(params, 'passphrase');

    const req = {
      body: { ...params, signature },
      headers: { 'x-forwarded-for': '196.33.227.206' },
      originalUrl: '/api/payments/payfast/itn',
      method: 'POST',
    } as unknown as Request;
    const res = createResponse();

    await controller.payfastItn(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payments'),
      expect.arrayContaining(['payfast', 'pf-123', expect.anything(), 'COMPLETE'])
    );
    expect(auditService.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'PAYMENT_STATUS_UPDATE' }));
  });

  it('rejects invalid signatures', async () => {
    const req = {
      body: { payment_status: 'COMPLETE', pf_payment_id: 'pf-123', signature: 'invalid' },
      headers: { 'x-forwarded-for': '196.33.227.206' },
      originalUrl: '/api/payments/payfast/itn',
      method: 'POST',
    } as unknown as Request;
    const res = createResponse();

    await controller.payfastItn(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.code).toBe('PAYFAST_VALIDATION_FAILED');
  });

  it('rejects notifications with mismatched plan details', async () => {
    const params = {
      payment_status: 'COMPLETE',
      amount_gross: '10.00',
      pf_payment_id: 'pf-456',
      email_address: 'user@example.com',
      custom_str3: 'diy',
      custom_str4: 'diy:monthly',
      custom_str5: 'monthly',
      item_name: 'DIY Monthly',
      currency: 'ZAR',
    };
    const signature = payfastService.computeSignature(params, 'passphrase');

    const req = {
      body: { ...params, signature },
      headers: { 'x-forwarded-for': '196.33.227.206' },
      originalUrl: '/api/payments/payfast/itn',
      method: 'POST',
    } as unknown as Request;
    const res = createResponse();

    await controller.payfastItn(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.code).toBe('PAYFAST_PLAN_MISMATCH');
  });

  it('does not extend subscriptions for duplicate completed notifications', async () => {
    const params = {
      payment_status: 'COMPLETE',
      amount_gross: '149.00',
      pf_payment_id: 'pf-789',
      email_address: 'user@example.com',
      custom_str3: 'diy',
      custom_str4: 'diy:monthly',
      custom_str5: 'monthly',
      item_name: 'DIY Monthly',
      currency: 'ZAR',
    };
    const signature = payfastService.computeSignature(params, 'passphrase');

    existingPaymentRow = {
      id: 'payment-1',
      status: 'COMPLETE',
      status_history: '[]',
      processed_at: new Date().toISOString(),
      user_id: 'user-1',
      company_id: 'company-1',
    };

    const req = {
      body: { ...params, signature },
      headers: { 'x-forwarded-for': '196.33.227.206' },
      originalUrl: '/api/payments/payfast/itn',
      method: 'POST',
    } as unknown as Request;
    const res = createResponse();

    await controller.payfastItn(req, res);

    expect(res.statusCode).toBe(200);
    expect(
      auditService.logAuditEvent
    ).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'PAYMENT_STATUS_DUPLICATE_IGNORED' }));
  });
});
