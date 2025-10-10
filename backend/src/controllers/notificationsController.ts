import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getConnection, DB_TYPE, DatabaseType } from '../config/database';
import { sendNotificationEmail } from '../services/emailService';

type Audience = 'all' | 'company' | 'user';
type Channel = 'email' | 'in_app';

interface AudienceFilter {
  companyIds?: string[];
  userIds?: string[];
  subscriptionTiers?: string[];
}

const ALLOWED_AUDIENCES: Audience[] = ['all', 'company', 'user'];
const ALLOWED_CHANNELS: Channel[] = ['email', 'in_app'];

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (value && typeof value === 'object') {
    return value as T;
  }
  return fallback;
};

const buildEmailBody = (title: string, body: string): string => `
  <h2 style="margin-bottom: 16px; font-family: Arial, sans-serif;">${title}</h2>
  <div style="font-family: Arial, sans-serif; line-height: 1.5; white-space: pre-wrap;">${body}</div>
  <hr style="margin: 24px 0;" />
  <p style="font-family: Arial, sans-serif; color: #666; font-size: 12px;">
    You are receiving this message because your notification preferences allow critical product notices.
  </p>
`;

export class NotificationsController {
  async listForUser(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const currentUser = req.user!;
    const connection = await getConnection();

    try {
      const nowIso = new Date().toISOString();
      const limitClause = DB_TYPE === DatabaseType.MSSQL ? 'OFFSET 0 ROWS FETCH NEXT 200 ROWS ONLY' : 'LIMIT 200';
      const result = await connection.query(
        `SELECT id, title, body, audience, audience_filter, channels, created_at, expires_at, dispatched_at
         FROM notifications
         WHERE (expires_at IS NULL OR expires_at > ?)
         ORDER BY created_at DESC ${limitClause}`,
        [nowIso]
      );

      const preferenceResult = await connection.query(
        'SELECT channel, is_enabled FROM notification_preferences WHERE user_id = ?',
        [req.user.id]
      );

      const preferences = new Map<string, boolean>();
      for (const pref of preferenceResult.rows || []) {
        const channel = (pref.channel ?? pref.CHANNEL ?? '').toString();
        const isEnabled = Boolean(pref.is_enabled ?? pref.IS_ENABLED ?? true);
        preferences.set(channel, isEnabled);
      }

      const items = (result.rows || []).filter((row: any) => {
        const audience: Audience = row.audience ?? row.AUDIENCE ?? 'all';
        const filter: AudienceFilter = parseJson(row.audience_filter ?? row.AUDIENCE_FILTER, {});
        const channels: Channel[] = parseJson(row.channels ?? row.CHANNELS, []);

        const channelEnabled = (ch: Channel) => preferences.get(ch) ?? true;

        if (!channels.some(channelEnabled)) {
          return false;
        }

        if (audience === 'all') return true;
        if (audience === 'company') {
          if (!currentUser.companyId) return false;
          const companyIds = filter.companyIds || [];
          return companyIds.length === 0 || companyIds.includes(currentUser.companyId);
        }
        if (audience === 'user') {
          const userIds = filter.userIds || [];
          return userIds.includes(currentUser.id);
        }
        return false;
      }).map((row: any) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        audience: row.audience,
        channels: parseJson(row.channels, [] as Channel[]),
        createdAt: row.created_at ?? row.CREATED_AT,
        expiresAt: row.expires_at ?? row.EXPIRES_AT ?? null,
        dispatchedAt: row.dispatched_at ?? row.DISPATCHED_AT ?? null,
      }));

      res.json({ success: true, items });
    } catch (error) {
      console.error('Failed to list notifications', error);
      res.status(500).json({ success: false, error: 'Failed to list notifications' });
    } finally {
      connection.release?.();
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    const { title, body, audience = 'all', audienceFilter = {}, channels = ['email'], expiresAt } = req.body as {
      title?: string;
      body?: string;
      audience?: Audience;
      audienceFilter?: AudienceFilter;
      channels?: Channel[];
      expiresAt?: string | null;
    };

    if (!title || !body) {
      res.status(400).json({ success: false, error: 'title and body are required' });
      return;
    }

    if (!ALLOWED_AUDIENCES.includes(audience)) {
      res.status(400).json({ success: false, error: 'Invalid audience specified' });
      return;
    }

    const normalizedChannels = Array.isArray(channels) ? channels.filter((ch): ch is Channel => ALLOWED_CHANNELS.includes(ch)) : [];
    if (normalizedChannels.length === 0) {
      res.status(400).json({ success: false, error: 'At least one valid channel is required' });
      return;
    }

    const connection = await getConnection();

    try {
      // Prevent duplicate critical alerts within short window
      const duplicateWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const duplicateCheck = await connection.query(
        `SELECT id FROM notifications WHERE title = ? AND body = ? AND created_at >= ?`,
        [title, body, duplicateWindow]
      );
      if (duplicateCheck.rows && duplicateCheck.rows.length > 0) {
        res.status(409).json({ success: false, error: 'A similar notification was recently dispatched' });
        return;
      }

      const notificationId = req.body.id || randomUUID();
      const nowIso = new Date().toISOString();
      await connection.query(
        `INSERT INTO notifications (id, title, body, audience, audience_filter, channels, created_by, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        notificationId,
        title,
        body,
        audience,
        JSON.stringify(audienceFilter || {}),
        JSON.stringify(normalizedChannels),
        req.user.id,
        expiresAt || null,
        nowIso,
      ]);

      let recipientQuery = '';
      const params: any[] = [];

      if (audience === 'all') {
        recipientQuery = 'SELECT id, email FROM users WHERE is_active = 1';
      } else if (audience === 'company') {
        const companyIds = Array.isArray(audienceFilter.companyIds) ? audienceFilter.companyIds : [];
        if (companyIds.length === 0) {
          res.status(400).json({ success: false, error: 'companyIds are required for company audience' });
          return;
        }
        recipientQuery = `SELECT id, email FROM users WHERE is_active = 1 AND company_id IN (${companyIds.map(() => '?').join(', ')})`;
        params.push(...companyIds);
      } else {
        const userIds = Array.isArray(audienceFilter.userIds) ? audienceFilter.userIds : [];
        if (userIds.length === 0) {
          res.status(400).json({ success: false, error: 'userIds are required for user audience' });
          return;
        }
        recipientQuery = `SELECT id, email FROM users WHERE id IN (${userIds.map(() => '?').join(', ')})`;
        params.push(...userIds);
      }

      let dispatchedAt: string | null = null;

      if (normalizedChannels.includes('email')) {
        const recipients = await connection.query(recipientQuery, params);
        if (recipients.rows && recipients.rows.length > 0) {
          const preferenceRows = await connection.query(
            `SELECT user_id, channel, is_enabled FROM notification_preferences
             WHERE channel = 'email' AND user_id IN (${recipients.rows.map(() => '?').join(', ')})`,
            recipients.rows.map((row: any) => row.id ?? row.ID)
          );

          const preferenceMap = new Map<string, boolean>();
          for (const pref of preferenceRows.rows || []) {
            preferenceMap.set(pref.user_id ?? pref.USER_ID, Boolean(pref.is_enabled ?? pref.IS_ENABLED ?? true));
          }

          for (const user of recipients.rows) {
            const email = user.email ?? user.EMAIL;
            if (!email) continue;
            const userId = String(user.id ?? user.ID);
            if (preferenceMap.has(userId) && !preferenceMap.get(userId)) {
              continue;
            }
            try {
              await sendNotificationEmail(email, title, buildEmailBody(title, body));
            } catch (error) {
              console.error('Failed to send notification email', { userId, email, error });
            }
          }
          dispatchedAt = new Date().toISOString();
        }
      }

      if (dispatchedAt) {
        await connection.query('UPDATE notifications SET dispatched_at = ? WHERE id = ?', [dispatchedAt, notificationId]);
      }

      res.status(201).json({
        success: true,
        data: {
          id: notificationId,
          title,
          body,
          audience,
          audienceFilter,
          channels: normalizedChannels,
          expiresAt: expiresAt || null,
          dispatchedAt,
        },
      });
    } catch (error) {
      console.error('Failed to create notification', error);
      res.status(500).json({ success: false, error: 'Failed to create notification' });
    } finally {
      connection.release?.();
    }
  }

  async getPreferences(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const connection = await getConnection();
    try {
      const result = await connection.query('SELECT channel, is_enabled FROM notification_preferences WHERE user_id = ?', [req.user.id]);
      const preferences: Record<string, boolean> = {};
      for (const row of result.rows || []) {
        const channel = row.channel ?? row.CHANNEL;
        preferences[channel] = Boolean(row.is_enabled ?? row.IS_ENABLED ?? true);
      }
      res.json({ success: true, data: preferences });
    } catch (error) {
      console.error('Failed to fetch notification preferences', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notification preferences' });
    } finally {
      connection.release?.();
    }
  }

  async updatePreferences(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const updates = req.body as Record<string, boolean>;
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid preferences payload' });
      return;
    }

    const connection = await getConnection();
    try {
      for (const [channel, enabled] of Object.entries(updates)) {
        if (!ALLOWED_CHANNELS.includes(channel as Channel)) {
          continue;
        }
        await connection.query('DELETE FROM notification_preferences WHERE user_id = ? AND channel = ?', [req.user.id, channel]);
        await connection.query(
          'INSERT INTO notification_preferences (id, user_id, channel, is_enabled, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [randomUUID(), req.user.id, channel, enabled ? 1 : 0]
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update notification preferences', error);
      res.status(500).json({ success: false, error: 'Failed to update notification preferences' });
    } finally {
      connection.release?.();
    }
  }
}

export const notificationsController = new NotificationsController();
