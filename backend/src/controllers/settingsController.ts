import { Request, Response } from 'express';
import { getConnection } from '../config/database';

export class SettingsController {
  async getPayfastSettings(req: Request, res: Response) {
    let db: any = null;
    try {
      db = await getConnection();
      const result = await db.query(
        "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key LIKE 'payfast:%'"
      );
      const map: Record<string,string> = {};
      for (const row of result.rows) map[row.setting_key] = row.setting_value;
      // Mask secrets
      const response = {
        merchantId: map['payfast:merchantId'] || '',
        sandbox: (map['payfast:sandbox'] || 'true') === 'true',
        returnUrl: map['payfast:returnUrl'] || '',
        cancelUrl: map['payfast:cancelUrl'] || '',
        notifyUrl: map['payfast:notifyUrl'] || '',
        hasMerchantKey: Boolean(map['payfast:merchantKey']),
        hasPassPhrase: Boolean(map['payfast:passPhrase'])
      };
      res.json(response);
    } catch (error) {
      console.error('getPayfastSettings error:', error);
      res.status(500).json({ error: 'Failed to load PayFast settings' });
    } finally { if (db?.release) db.release(); }
  }

  async savePayfastSettings(req: Request, res: Response) {
    let db: any = null;
    try {
      const { merchantId, merchantKey, passPhrase, sandbox, returnUrl, cancelUrl, notifyUrl } = req.body || {};
      db = await getConnection();
      const set = async (k: string, v: string | undefined) => {
        if (v === undefined) return;
        // MSSQL-friendly upsert; other DBs will use the MySQL-style below
        const valueStr = String(v);
        try {
          // Try MSSQL IF EXISTS pattern
          await db.query(
            `IF EXISTS (SELECT 1 FROM platform_settings WHERE setting_key = ?)
               UPDATE platform_settings SET setting_value = ?, updated_at = GETDATE() WHERE setting_key = ?
             ELSE
               INSERT INTO platform_settings (setting_key, setting_value, updated_at) VALUES (?, ?, GETDATE())`,
            [k, valueStr, k, k, valueStr]
          );
        } catch {
          // Fallback to MySQL-style upsert for non-MSSQL
          await db.query(
            `INSERT INTO platform_settings (setting_key, setting_value, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
            [k, valueStr]
          );
        }
      };
      await set('payfast:merchantId', merchantId);
      await set('payfast:merchantKey', merchantKey);
      await set('payfast:passPhrase', passPhrase);
      await set('payfast:sandbox', sandbox !== undefined ? String(Boolean(sandbox)) : undefined);
      await set('payfast:returnUrl', returnUrl);
      await set('payfast:cancelUrl', cancelUrl);
      await set('payfast:notifyUrl', notifyUrl);
      res.json({ success: true });
    } catch (error) {
      console.error('savePayfastSettings error:', error);
      res.status(500).json({ error: 'Failed to save PayFast settings' });
    } finally { if (db?.release) db.release(); }
  }
}
