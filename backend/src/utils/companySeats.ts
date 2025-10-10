import type { DatabaseConnection } from '../config/database';

const TIER_SEAT_LIMITS: Record<string, number> = {
  trial: 5,
  diy: 25,
  diy_accountant: 100,
};

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/^"|"$/g, '');
    const numeric = parseInt(trimmed, 10);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    const match = trimmed.match(/\d+/);
    if (match) {
      const fallback = parseInt(match[0], 10);
      return Number.isNaN(fallback) ? null : fallback;
    }
  }
  return null;
};

const getCountFromRow = (row: any): number => {
  if (!row) return 0;
  const value = row.total ?? row.count ?? row.COUNT ?? row.TOTAL;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const getSeatLimit = async (
  db: Pick<DatabaseConnection, 'query'>,
  subscriptionTier?: string | null
): Promise<number> => {
  const defaultSeatLimit = parseInt(process.env.COMPANY_INVITE_DEFAULT_SEAT_LIMIT || '50', 10) || 50;
  let seatLimit = defaultSeatLimit;

  try {
    const result = await db.query(
      'SELECT setting_value FROM platform_settings WHERE setting_key = ?',
      ['max_users_per_company']
    );
    if (result.rows.length > 0) {
      const parsed = parseNumericValue(result.rows[0].setting_value ?? result.rows[0].SETTING_VALUE);
      if (parsed && parsed > 0) {
        seatLimit = parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to load seat limit from platform settings, using default.', error);
  }

  if (subscriptionTier) {
    const tierKey = subscriptionTier.toLowerCase();
    if (tierKey in TIER_SEAT_LIMITS) {
      seatLimit = Math.min(seatLimit, TIER_SEAT_LIMITS[tierKey]);
    }
  }

  return seatLimit;
};

export const getActiveUserCount = async (
  db: Pick<DatabaseConnection, 'query'>,
  companyId: string
): Promise<number> => {
  const result = await db.query(
    'SELECT COUNT(*) AS total FROM users WHERE company_id = ? AND is_active = 1',
    [companyId]
  );
  return getCountFromRow(result.rows?.[0]);
};

export const getPendingInvitationCount = async (
  db: Pick<DatabaseConnection, 'query'>,
  companyId: string
): Promise<number> => {
  const result = await db.query(
    `SELECT COUNT(*) AS total FROM company_invitations WHERE company_id = ? AND status = ? AND expires_at > GETDATE()`,
    [companyId, 'pending']
  );
  return getCountFromRow(result.rows?.[0]);
};

export interface SeatUsageResult {
  seatLimit: number;
  activeUsers: number;
  pendingInvites: number;
}

export const getSeatUsage = async (
  db: Pick<DatabaseConnection, 'query'>,
  companyId: string,
  subscriptionTier?: string | null
): Promise<SeatUsageResult> => {
  const [seatLimit, activeUsers, pendingInvites] = await Promise.all([
    getSeatLimit(db, subscriptionTier),
    getActiveUserCount(db, companyId),
    getPendingInvitationCount(db, companyId),
  ]);

  return { seatLimit, activeUsers, pendingInvites };
};
