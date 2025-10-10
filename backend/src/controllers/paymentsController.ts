import { Request, Response } from 'express';
import crypto from 'crypto';
import { getConnection } from '../config/database';

interface PayFastSettings {
  merchantId: string;
  merchantKey: string; // sensitive
  passPhrase?: string; // optional
  sandbox: boolean;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export class PaymentsController {
  private async loadPayfastSettings(): Promise<PayFastSettings | null> {
    const db = await getConnection();
    try {
      const result = await db.query(
        "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key LIKE 'payfast:%'"
      );
      const map: Record<string,string> = {};
      for (const row of result.rows) map[row.setting_key] = row.setting_value;
      if (!map['payfast:merchantId'] || !map['payfast:merchantKey']) return null;
      return {
        merchantId: map['payfast:merchantId'],
        merchantKey: map['payfast:merchantKey'],
        passPhrase: map['payfast:passPhrase'] || undefined,
        sandbox: (map['payfast:sandbox'] || 'true') === 'true',
        returnUrl: map['payfast:returnUrl'] || '',
        cancelUrl: map['payfast:cancelUrl'] || '',
        notifyUrl: map['payfast:notifyUrl'] || ''
      };
    } finally {
      if ((db as any).release) (db as any).release();
    }
  }

  // Build signature per PayFast rules
  private buildSignature(fields: Record<string,string>, passPhrase?: string): string {
    // Sort fields by name ascending, exclude empty values
    const ordered = Object.keys(fields)
      .filter(k => fields[k] !== undefined && fields[k] !== null && fields[k] !== '')
      .sort()
      .map(k => `${k}=${encodeURIComponent(fields[k]).replace(/%20/g, '+')}`)
      .join('&');
    const toSign = passPhrase ? `${ordered}&passphrase=${encodeURIComponent(passPhrase)}` : ordered;
    const md5 = crypto.createHash('md5').update(toSign).digest('hex');
    return md5;
  }

  payfastCheckout = async (req: Request, res: Response) => {
    try {
      const settings = await this.loadPayfastSettings();
      if (!settings) return res.status(400).json({ success: false, error: 'PayFast not configured' });

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

      const signature = this.buildSignature(fields, settings.passPhrase);
      const action = settings.sandbox
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process';

      return res.json({ success: true, action, fields: { ...fields, signature } });
    } catch (error) {
      console.error('payfastCheckout error:', error);
      return res.status(500).json({ success: false, error: 'Checkout init failed' });
    }
  };

  payfastVerify = async (req: Request, res: Response) => {
    try {
      // NOTE: Proper ITN verify includes posting back to PayFast and IP allowlists.
      // For MVP, accept the request and update subscription if m_payment_id present.
      const { m_payment_id, status, userId, tier, days } = req.body || {};
      if (!m_payment_id) return res.status(400).json({ success: false, error: 'm_payment_id required' });

      // Minimal: if status=='COMPLETE' (or provided), update subscription
      if ((status || 'COMPLETE') === 'COMPLETE' && (userId || req.user?.id)) {
        const db = await getConnection();
        try {
          const uid = userId || req.user?.id;
          const targetTier = tier || 'diy';
          const daysInt = Number(days || 30);
          const expiry = new Date(Date.now() + daysInt * 86400000);
          await db.query(
            'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, updated_at = NOW() WHERE id = ?',
            [targetTier, expiry, uid]
          );
        } finally {
          if ((db as any).release) (db as any).release();
        }
      }
      return res.json({ success: true, status: status || 'COMPLETE' });
    } catch (error) {
      console.error('payfastVerify error:', error);
      return res.status(500).json({ success: false, error: 'Verification failed' });
    }
  };

  getPaymentStatus = async (req: Request, res: Response) => {
    try {
      const { m_payment_id } = req.query as any;
      if (!m_payment_id) return res.status(400).json({ success: false, error: 'm_payment_id required' });
      // MVP: We do not persist payments yet; return complete
      return res.json({ success: true, status: 'COMPLETE' });
    } catch (error) {
      console.error('getPaymentStatus error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get status' });
    }
  };

  // Mock helpers
  mockActivate = async (req: Request, res: Response) => {
    try {
      const { userId, tier = 'diy', days = 30 } = req.body || {};
      if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
      const db = await getConnection();
      try {
        const expiry = new Date(Date.now() + Number(days) * 86400000);
        await db.query(
          'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, updated_at = NOW() WHERE id = ?',
          [tier, expiry, userId]
        );
      } finally { if ((db as any).release) (db as any).release(); }
      return res.json({ success: true });
    } catch (error) {
      console.error('mockActivate error:', error);
      return res.status(500).json({ success: false, error: 'Failed to activate' });
    }
  };

  mockExpire = async (req: Request, res: Response) => {
    try {
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
      const db = await getConnection();
      try {
        await db.query(
          'UPDATE users SET subscription_expiry = ?, updated_at = NOW() WHERE id = ?',
          [new Date(Date.now() - 86400000), userId]
        );
      } finally { if ((db as any).release) (db as any).release(); }
      return res.json({ success: true });
    } catch (error) {
      console.error('mockExpire error:', error);
      return res.status(500).json({ success: false, error: 'Failed to expire' });
    }
  };

  mockCancel = async (req: Request, res: Response) => {
    try {
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
      const db = await getConnection();
      try {
        await db.query(
          'UPDATE users SET subscription_tier = ?, updated_at = NOW() WHERE id = ?',
          ['trial', userId]
        );
      } finally { if ((db as any).release) (db as any).release(); }
      return res.json({ success: true });
    } catch (error) {
      console.error('mockCancel error:', error);
      return res.status(500).json({ success: false, error: 'Failed to cancel' });
    }
  };
}
