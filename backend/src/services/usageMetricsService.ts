import { v4 as uuidv4 } from 'uuid';
import { getConnection } from '../config/database';

export type UsageEventType = 'app_launch' | 'template_download';

export interface UsageEventOptions {
  eventType: UsageEventType;
  userId?: string | null;
  companyId?: string | null;
  subjectId?: string | null;
  subjectType?: 'application' | 'template' | null;
  userRole?: string | null;
  subscriptionTier?: string | null;
  payload?: Record<string, unknown> | null;
}

export const recordUsageEvent = async (options: UsageEventOptions): Promise<void> => {
  const { eventType, userId, companyId, subjectId, subjectType, userRole, subscriptionTier, payload } = options;
  const connection = await getConnection();

  try {
    await connection.query(
      `INSERT INTO usage_metrics (id, event_type, user_id, company_id, subject_id, subject_type, user_role, subscription_tier, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      uuidv4(),
      eventType,
      userId ?? null,
      companyId ?? null,
      subjectId ?? null,
      subjectType ?? null,
      userRole ?? null,
      subscriptionTier ?? null,
      payload ? JSON.stringify(payload) : null,
    ]);
  } catch (error) {
    console.error('Failed to record usage event', error);
  } finally {
    connection.release?.();
  }
};

export interface UsageSummaryOptions {
  eventType: UsageEventType;
  companyId?: string | null;
  periodDays?: number;
}

export interface UsageSummaryResult {
  total: number;
  uniqueUsers: number;
  uniqueCompanies: number;
}

export const getUsageSummary = async (options: UsageSummaryOptions): Promise<UsageSummaryResult> => {
  const { eventType, companyId, periodDays = 30 } = options;
  const connection = await getConnection();

  try {
    const params: any[] = [eventType];
    let timeFilter = '';

    if (companyId) {
      params.push(companyId);
    }

    const whereCompany = companyId ? 'AND company_id = ?' : '';

    if (periodDays > 0) {
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
      timeFilter = 'AND occurred_at >= ?';
      params.push(since.toISOString());
    }

    const result = await connection.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(DISTINCT user_id) AS unique_users,
         COUNT(DISTINCT company_id) AS unique_companies
       FROM usage_metrics
       WHERE event_type = ?
       ${whereCompany}
       ${timeFilter}`,
      params
    );

    const row = result.rows?.[0] ?? {};
    return {
      total: Number(row.total ?? row.TOTAL ?? 0),
      uniqueUsers: Number(row.unique_users ?? row.UNIQUE_USERS ?? 0),
      uniqueCompanies: Number(row.unique_companies ?? row.UNIQUE_COMPANIES ?? 0),
    };
  } catch (error) {
    console.error('Failed to build usage summary', error);
    return { total: 0, uniqueUsers: 0, uniqueCompanies: 0 };
  } finally {
    connection.release?.();
  }
};
