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

interface PayFastPlanDefinition {
  key: string;
  tier: string;
  cadence: string;
  amount: number;
  itemName: string;
  periodDays: number;
  currency: string;
  customFields?: Record<string, string>;
}

interface PayFastSettings {
  merchantId: string;
  merchantKey: string; // sensitive
  passPhrase?: string; // optional
  sandbox: boolean;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  plans: Record<string, PayFastPlanDefinition>;
}

const DEFAULT_PAYFAST_PLANS: PayFastPlanDefinition[] = [
  {
    key: 'diy:monthly',
    tier: 'diy',
    cadence: 'monthly',
    amount: 149,
    itemName: 'DIY Monthly',
    periodDays: 30,
    currency: 'ZAR',
  },
  {
    key: 'diy:yearly',
    tier: 'diy',
    cadence: 'yearly',
    amount: 1490,
    itemName: 'DIY Yearly',
    periodDays: 365,
    currency: 'ZAR',
  },
  {
    key: 'diy_accountant:monthly',
    tier: 'diy_accountant',
    cadence: 'monthly',
    amount: 349,
    itemName: 'DIY + Accountant Monthly',
    periodDays: 30,
    currency: 'ZAR',
  },
  {
    key: 'diy_accountant:yearly',
    tier: 'diy_accountant',
    cadence: 'yearly',
    amount: 3490,
    itemName: 'DIY + Accountant Yearly',
    periodDays: 365,
    currency: 'ZAR',
  },
];

const buildPlanKey = (tier: string, cadence?: string) => {
  const normalizedTier = tier?.toLowerCase().trim();
  const normalizedCadence = cadence?.toLowerCase().trim() || 'monthly';
  if (!normalizedTier) return '';
  return `${normalizedTier}:${normalizedCadence}`;
};

const parsePlans = (raw: string | undefined | null): Record<string, PayFastPlanDefinition> => {
  const plans: Record<string, PayFastPlanDefinition> = {};
  const appendPlan = (plan: Partial<PayFastPlanDefinition> & { tier?: string; cadence?: string; amount?: number }) => {
    const tierValue = typeof plan.tier === 'string' ? plan.tier.trim() : '';
    const cadenceValue = typeof plan.cadence === 'string' ? plan.cadence.trim() : '';
    const tier = tierValue.toLowerCase();
    const cadence = cadenceValue.toLowerCase();
    const providedKey = typeof plan.key === 'string' && plan.key ? plan.key : buildPlanKey(tier, cadence);
    const key = providedKey.toLowerCase();
    const amount = Number(plan.amount);
    const itemName = typeof plan.itemName === 'string' ? plan.itemName : undefined;
    const periodDays = Number(plan.periodDays);
    const currency = typeof plan.currency === 'string' ? plan.currency.toUpperCase() : 'ZAR';
    if (!key || !tier || !Number.isFinite(amount) || amount <= 0 || !itemName) {
      return;
    }
    const resolvedCadence = cadence || key.split(':')[1] || 'monthly';
    plans[key] = {
      key,
      tier,
      cadence: resolvedCadence,
      amount,
      itemName,
      periodDays: Number.isFinite(periodDays) && periodDays > 0 ? periodDays : resolvedCadence?.toLowerCase() === 'yearly' ? 365 : 30,
      currency,
      customFields: plan.customFields && typeof plan.customFields === 'object' ? plan.customFields : undefined,
    };
  };

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const plan of parsed) appendPlan(plan);
      } else if (parsed && typeof parsed === 'object') {
        for (const value of Object.values(parsed)) appendPlan(value as any);
      }
    } catch (error) {
      console.warn('Failed to parse PayFast plans configuration:', error);
    }
  }

  if (!Object.keys(plans).length) {
    for (const plan of DEFAULT_PAYFAST_PLANS) {
      appendPlan(plan);
    }
  }

  return plans;
};

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
      const planConfig = parsePlans(map['payfast:plans'] || process.env.PAYFAST_PLANS);
      return {
        merchantId,
        merchantKey,
        passPhrase,
        sandbox: (map['payfast:sandbox'] ?? process.env.PAYFAST_SANDBOX ?? 'true') === 'true',
        returnUrl: map['payfast:returnUrl'] || process.env.PAYFAST_RETURN_URL || '',
        cancelUrl: map['payfast:cancelUrl'] || process.env.PAYFAST_CANCEL_URL || '',
        notifyUrl: map['payfast:notifyUrl'] || process.env.PAYFAST_NOTIFY_URL || '',
        plans: planConfig,
      };
    } finally {
      if ((db as any).release) (db as any).release();
    }
  }

  payfastCheckout = async (req: Request, res: Response) => {
    try {
      const settings = await this.loadPayfastSettings();
      if (!settings) return sendError(res, 400, 'PAYFAST_NOT_CONFIGURED', 'PayFast not configured');

      const candidateKeys: string[] = [];
      const rawPlan = typeof req.body.plan === 'string' ? req.body.plan : typeof req.body.planId === 'string' ? req.body.planId : typeof req.body.planKey === 'string' ? req.body.planKey : undefined;
      if (rawPlan) candidateKeys.push(rawPlan);
      const tierInput = typeof req.body.tier === 'string' ? req.body.tier : undefined;
      const cadenceInput = typeof req.body.cadence === 'string' ? req.body.cadence : undefined;
      if (tierInput) {
        candidateKeys.push(buildPlanKey(tierInput, cadenceInput));
        if (!cadenceInput) {
          candidateKeys.push(buildPlanKey(tierInput, 'monthly'));
        }
      }
      let plan: PayFastPlanDefinition | undefined;
      for (const key of candidateKeys) {
        const normalizedKey = typeof key === 'string' ? key.trim().toLowerCase() : '';
        if (normalizedKey && settings.plans[normalizedKey]) {
          plan = settings.plans[normalizedKey];
          break;
        }
      }
      if (!plan) {
        return sendError(res, 400, 'PAYFAST_PLAN_INVALID', 'Unknown or unsupported PayFast plan requested');
      }

      const m_payment_id = typeof req.body.m_payment_id === 'string' && req.body.m_payment_id.trim().length
        ? req.body.m_payment_id
        : `${plan.key}_${Date.now()}`;

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
        amount: plan.amount.toFixed(2),
        item_name: plan.itemName,
        currency: plan.currency,
      };

      if (req.user?.id) {
        fields.custom_str1 = String(req.user.id);
      }
      if ((req.user as any)?.companyId) {
        fields.custom_str2 = String((req.user as any).companyId);
      }
      fields.custom_str3 = plan.tier;
      fields.custom_str4 = plan.key;
      fields.custom_str5 = plan.cadence;
      fields.custom_int1 = String(plan.periodDays);

      if (plan.customFields) {
        for (const [key, value] of Object.entries(plan.customFields)) {
          if (typeof value === 'string' && key) {
            fields[key] = value;
          }
        }
      }

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
      const planKeyParam = typeof params.custom_str4 === 'string' ? params.custom_str4.toLowerCase() : '';
      const planFromKey = planKeyParam ? settings.plans[planKeyParam] : undefined;
      const planFromTier = typeof params.custom_str3 === 'string'
        ? settings.plans[buildPlanKey(params.custom_str3, typeof params.custom_str5 === 'string' ? params.custom_str5 : undefined)]
        : undefined;
      const planFromItemName = typeof params.item_name === 'string'
        ? Object.values(settings.plans).find((p) => p.itemName === params.item_name)
        : undefined;
      const plan = planFromKey || planFromTier || planFromItemName;
      if (!plan) {
        await logAuditEvent({
          eventType: 'PAYMENT_ITN_REJECTED',
          success: false,
          metadata: { reason: 'plan_not_found', reference, itemName: params.item_name, planKey: planKeyParam, tier: params.custom_str3 },
        });
        return sendError(res, 400, 'PAYFAST_PLAN_UNKNOWN', 'Notification does not match a configured plan');
      }

      const amount = parseFloat(params.amount_gross || params.amount || '0');
      const fee = parseFloat(params.amount_fee || '0');
      const currencyReceived = (params.currency || '').toUpperCase();
      const currency = currencyReceived || plan.currency;
      const expectedAmount = plan.amount;
      const amountMatches = Number.isFinite(amount) && Math.abs(amount - expectedAmount) <= 0.01;
      const currencyMatches = currency === plan.currency;
      if (!amountMatches || !currencyMatches) {
        await logAuditEvent({
          eventType: 'PAYMENT_ITN_REJECTED',
          success: false,
          metadata: {
            reason: 'plan_mismatch',
            reference,
            expectedAmount,
            receivedAmount: Number.isFinite(amount) ? amount : params.amount,
            expectedCurrency: plan.currency,
            receivedCurrency: currencyReceived || null,
            planKey: plan.key,
          },
        });
        return sendError(res, 400, 'PAYFAST_PLAN_MISMATCH', 'Notification amount or currency did not match expected plan');
      }
      let userId = params.custom_str1 || null;
      let companyId = params.custom_str2 || null;
      const tier = plan.tier;
      const periodDays = plan.periodDays;

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
              planKey: plan.key,
              cadence: plan.cadence,
              amount: plan.amount,
              currency: plan.currency,
            },
          });
        } else if (status === 'COMPLETE' && (userId || existingRecord?.user_id) && alreadyProcessed) {
          await logAuditEvent({
            eventType: 'PAYMENT_STATUS_DUPLICATE_IGNORED',
            success: false,
            userId: userId || existingRecord?.user_id || undefined,
            metadata: {
              reference,
              status,
              planKey: plan.key,
              processedAt: existingRecord?.processed_at,
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
              planKey: plan.key,
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
