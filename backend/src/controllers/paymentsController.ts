import { Request, Response } from 'express';
import { getConnection } from '../config/database';
import {
  sanitizeNotification,
  verifySignature,
  isIpAllowed,
  postBackToPayfast,
  computeSignature,
} from '../services/payfastService';
import { logAuditEvent } from '../services/auditService';
import { sendError, sendSuccess } from '../utils/responses';

interface PayFastSettings {
  merchantId: string;
  merchantKey: string; // sensitive
  passPhrase?: string; // optional
  sandbox: boolean;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

const resolveClientIp = (req: Request): string | null => {
  const header = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (typeof header === 'string' && header.length > 0) {
    return header.split(',')[0]?.trim() || null;
  }
  if (Array.isArray(header) && header.length > 0) {
    return header[0];
  }
  if (req.ip) return req.ip;
  if (req.connection && 'remoteAddress' in req.connection) {
    return (req.connection as any).remoteAddress || null;
  }
  return null;
};

const appendStatusHistory = (current: unknown, status: string, payload: Record<string, unknown>) => {
  let history: Array<{ status: string; at: string; payload?: Record<string, unknown> }> = [];
  if (typeof current === 'string' && current.trim().length > 0) {
    try {
      const parsed = JSON.parse(current);
      if (Array.isArray(parsed)) {
        history = parsed;
      }
    } catch {
      history = [];
    }
  }
  history.push({ status, at: new Date().toISOString(), payload });
  return JSON.stringify(history);
};

export class PaymentsController {
  private async loadPayfastSettings(): Promise<PayFastSettings | null> {
    const db = await getConnection();
    try {
      const result = await db.query(
        "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key LIKE 'payfast:%'"
      );
      const map: Record<string,string> = {};
      for (const row of result.rows) map[row.setting_key] = row.setting_value;

      const merchantId = map['payfast:merchantId'] || process.env.PAYFAST_MERCHANT_ID;
      const merchantKey = map['payfast:merchantKey'] || process.env.PAYFAST_MERCHANT_KEY;
      const passPhrase = map['payfast:passPhrase'] || process.env.PAYFAST_PASSPHRASE || undefined;
      if (!merchantId || !merchantKey) return null;
      return {
        merchantId,
        merchantKey,
        passPhrase,
        sandbox: (map['payfast:sandbox'] ?? process.env.PAYFAST_SANDBOX ?? 'true') === 'true',
        returnUrl: map['payfast:returnUrl'] || process.env.PAYFAST_RETURN_URL || '',
        cancelUrl: map['payfast:cancelUrl'] || process.env.PAYFAST_CANCEL_URL || '',
        notifyUrl: map['payfast:notifyUrl'] || process.env.PAYFAST_NOTIFY_URL || ''
      };
    } finally {
      if ((db as any).release) (db as any).release();
    }
  }

  payfastCheckout = async (req: Request, res: Response) => {
    try {
      const settings = await this.loadPayfastSettings();
      if (!settings) return sendError(res, 400, 'PAYFAST_NOT_CONFIGURED', 'PayFast not configured');

      const amount = String(req.body.amount || '0');
      const item_name = String(req.body.item_name || 'Subscription');
      const m_payment_id = req.body.m_payment_id || `sub_${Date.now()}`;

      const fields: Record<string,string> = {
        merchant_id: settings.merchantId,
        merchant_key: settings.merchantKey,
        return_url: settings.returnUrl,
        cancel_url: settings.cancelUrl,
        notify_url: settings.notifyUrl,
        name_first: req.user?.firstName || 'User',
        name_last: req.user?.lastName || 'Account',
        email_address: req.user?.email || '',
        m_payment_id,
        amount,
        item_name
      };

      const signature = computeSignature(fields, settings.passPhrase);
      const action = settings.sandbox
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process';

      return sendSuccess(res, { action, fields: { ...fields, signature } });
    } catch (error) {
      console.error('payfastCheckout error:', error);
      return sendError(res, 500, 'PAYFAST_CHECKOUT_FAILED', 'Checkout init failed');
    }
  };

  payfastItn = async (req: Request, res: Response) => {
    try {
      const settings = await this.loadPayfastSettings();
      if (!settings) {
        await logAuditEvent({
          eventType: 'PAYMENT_ITN_REJECTED',
          success: false,
          metadata: { reason: 'settings_missing' },
        });
        return sendError(res, 400, 'PAYFAST_NOT_CONFIGURED', 'PayFast not configured');
      }

      const params = sanitizeNotification(req.body || {});
      const ip = resolveClientIp(req);
      const signatureValid = verifySignature(params, settings.passPhrase);
      const ipAllowed = isIpAllowed(ip, settings.sandbox, process.env.PAYFAST_DISABLE_IP_CHECK === 'true');
      const postback = await postBackToPayfast(params, settings.sandbox);
      const reference = params.pf_payment_id || params.m_payment_id;

      await logAuditEvent({
        eventType: 'PAYMENT_ITN_RECEIVED',
        success: true,
        metadata: {
          reference,
          paymentStatus: params.payment_status,
          signatureValid,
          ipAllowed,
          postback: postback.body,
        },
      });

      if (!reference) {
        await logAuditEvent({
          eventType: 'PAYMENT_ITN_REJECTED',
          success: false,
          metadata: { reason: 'missing_reference', payload: params },
        });
        return sendError(res, 400, 'PAYFAST_INVALID_REFERENCE', 'Missing payment reference');
      }

      if (!signatureValid || !ipAllowed || !postback.ok) {
        await logAuditEvent({
          eventType: 'PAYMENT_ITN_REJECTED',
          success: false,
          metadata: {
            reference,
            signatureValid,
            ipAllowed,
            postback: postback.body,
          },
        });
        return sendError(res, 400, 'PAYFAST_VALIDATION_FAILED', 'Unable to verify PayFast notification', {
          signatureValid,
          ipAllowed,
          postback: postback.body,
        });
      }

      const status = (params.payment_status || 'PENDING').toUpperCase();
      const amount = parseFloat(params.amount_gross || params.amount || '0');
      const fee = parseFloat(params.amount_fee || '0');
      const currency = params.currency || 'ZAR';
      let userId = params.custom_str1 || null;
      let companyId = params.custom_str2 || null;
      const tier = params.custom_str3 || params.item_name || 'diy';
      const periodDays = parseInt(params.custom_int1 || '30', 10) || 30;

      const db = await getConnection();
      try {
        // Attempt to resolve user by email if not provided
        if (!userId && params.email_address) {
          const lookup = await db.query('SELECT TOP 1 id, company_id FROM users WHERE email = ?', [params.email_address]);
          if (lookup.rows?.length) {
            userId = lookup.rows[0].id;
            companyId = companyId || lookup.rows[0].company_id || null;
          }
        }

        const existing = await db.query('SELECT id, status, status_history, processed_at, user_id, company_id FROM payments WHERE payment_reference = ?', [reference]);
        const existingRecord = existing.rows?.[0];
        const alreadyProcessed = Boolean(existingRecord?.processed_at);
        const statusHistory = appendStatusHistory(existingRecord?.status_history, status, params);

        if (existing.rows?.length) {
          await db.query(
            `UPDATE payments
             SET status = ?,
                 status_history = ?,
                 amount = ?,
                 fee = ?,
                 currency = ?,
                 user_id = COALESCE(user_id, ?),
                 company_id = COALESCE(company_id, ?),
                 raw_payload = ?,
                 processed_at = CASE WHEN ? = 'COMPLETE' THEN ISNULL(processed_at, SYSUTCDATETIME()) ELSE processed_at END,
                 updated_at = SYSUTCDATETIME()
             WHERE payment_reference = ?`,
            [
              status,
              statusHistory,
              isNaN(amount) ? null : amount,
              isNaN(fee) ? null : fee,
              currency,
              userId,
              companyId,
              JSON.stringify(params),
              status,
              reference,
            ]
          );
        } else {
          await db.query(
            `INSERT INTO payments (gateway, payment_reference, invoice_number, status, status_history, amount, fee, currency, user_id, company_id, raw_payload, processed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'payfast',
              reference,
              params.m_payment_id || null,
              status,
              statusHistory,
              isNaN(amount) ? null : amount,
              isNaN(fee) ? null : fee,
              currency,
              userId,
              companyId,
              JSON.stringify(params),
              status === 'COMPLETE' ? new Date() : null,
            ]
          );
        }

        if (status === 'COMPLETE' && userId && !alreadyProcessed) {
          const expiry = new Date(Date.now() + periodDays * 86400000);
          await db.query(
            `UPDATE users
             SET subscription_tier = ?,
                 subscription_expiry = ?,
                 updated_at = SYSUTCDATETIME()
             WHERE id = ?`,
            [tier, expiry, userId]
          );

          await logAuditEvent({
            eventType: 'PAYMENT_STATUS_UPDATE',
            success: true,
            userId,
            metadata: {
              reference,
              status,
              tier,
              periodDays,
            },
          });
        } else if (status === 'COMPLETE' && alreadyProcessed) {
          await logAuditEvent({
            eventType: 'PAYMENT_STATUS_UPDATE_SKIPPED',
            success: true,
            userId: userId || existingRecord?.user_id || undefined,
            metadata: {
              reference,
              reason: 'already_processed',
            },
          });
        }
      } finally {
        db.release?.();
      }

      return sendSuccess(res, { status });
    } catch (error) {
      console.error('payfastVerify error:', error);
      await logAuditEvent({
        eventType: 'PAYMENT_ITN_REJECTED',
        success: false,
        metadata: {
          reason: 'exception',
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return sendError(res, 500, 'PAYFAST_ITN_ERROR', 'Verification failed');
    }
  };

  getPaymentStatus = async (req: Request, res: Response) => {
    try {
      const { m_payment_id } = req.query as any;
      if (!m_payment_id) return sendError(res, 400, 'PAYMENT_REFERENCE_REQUIRED', 'm_payment_id required');
      const db = await getConnection();
      try {
        const result = await db.query('SELECT status, amount, currency, processed_at FROM payments WHERE payment_reference = ?', [m_payment_id]);
        if (result.rows?.length) {
          return sendSuccess(res, {
            status: result.rows[0].status,
            amount: result.rows[0].amount,
            currency: result.rows[0].currency,
            processedAt: result.rows[0].processed_at,
          });
        }
      } finally {
        db.release?.();
      }
      return sendSuccess(res, { status: 'UNKNOWN' });
    } catch (error) {
      console.error('getPaymentStatus error:', error);
      return sendError(res, 500, 'PAYMENT_STATUS_FAILED', 'Failed to get status');
    }
  };

  // Mock helpers
  mockActivate = async (req: Request, res: Response) => {
    try {
      const { userId, tier = 'diy', days = 30 } = req.body || {};
      if (!userId) return sendError(res, 400, 'USER_ID_REQUIRED', 'userId required');
      const db = await getConnection();
      try {
        const expiry = new Date(Date.now() + Number(days) * 86400000);
        await db.query(
          'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, updated_at = NOW() WHERE id = ?',
          [tier, expiry, userId]
        );
      } finally { if ((db as any).release) (db as any).release(); }
      return sendSuccess(res);
    } catch (error) {
      console.error('mockActivate error:', error);
      return sendError(res, 500, 'MOCK_ACTIVATE_FAILED', 'Failed to activate');
    }
  };

  mockExpire = async (req: Request, res: Response) => {
    try {
      const { userId } = req.body || {};
      if (!userId) return sendError(res, 400, 'USER_ID_REQUIRED', 'userId required');
      const db = await getConnection();
      try {
        await db.query(
          'UPDATE users SET subscription_expiry = ?, updated_at = NOW() WHERE id = ?',
          [new Date(Date.now() - 86400000), userId]
        );
      } finally { if ((db as any).release) (db as any).release(); }
      return sendSuccess(res);
    } catch (error) {
      console.error('mockExpire error:', error);
      return sendError(res, 500, 'MOCK_EXPIRE_FAILED', 'Failed to expire');
    }
  };

  mockCancel = async (req: Request, res: Response) => {
    try {
      const { userId } = req.body || {};
      if (!userId) return sendError(res, 400, 'USER_ID_REQUIRED', 'userId required');
      const db = await getConnection();
      try {
        await db.query(
          'UPDATE users SET subscription_tier = ?, updated_at = NOW() WHERE id = ?',
          ['trial', userId]
        );
      } finally { if ((db as any).release) (db as any).release(); }
      return sendSuccess(res);
    } catch (error) {
      console.error('mockCancel error:', error);
      return sendError(res, 500, 'MOCK_CANCEL_FAILED', 'Failed to cancel');
    }
  };
}
