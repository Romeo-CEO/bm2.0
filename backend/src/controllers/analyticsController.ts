import { Request, Response } from 'express';
import { getConnection } from '../config/database';

export class AnalyticsController {
  async getCompanyAnalytics(req: Request, res: Response): Promise<void> {
    const { user } = req;
    if (!user?.companyId) {
      res.status(403).json({ error: 'User is not associated with a company' });
      return;
    }

    const { companyId } = user;
    let db: any = null;

    try {
      db = await getConnection();

      const totalApplicationsQuery = `
        SELECT COUNT(DISTINCT ua.application_id) as totalApplications
        FROM user_applications ua
        JOIN users u ON ua.user_id = u.id
        WHERE u.company_id = ?;
      `;
      const totalApplicationsResult = await db.query(totalApplicationsQuery, [companyId]);

      const totalUsersQuery = `
        SELECT COUNT(id) as totalUsers
        FROM users
        WHERE company_id = ?;
      `;
      const totalUsersResult = await db.query(totalUsersQuery, [companyId]);

      const usageByCategoryQuery = `
        SELECT a.category, COUNT(ua.id) as usageCount
        FROM user_applications ua
        JOIN applications a ON ua.application_id = a.id
        JOIN users u ON ua.user_id = u.id
        WHERE u.company_id = ?
        GROUP BY a.category
        ORDER BY usageCount DESC;
      `;
      const usageByCategoryResult = await db.query(usageByCategoryQuery, [companyId]);

      res.json({
        totalApplications: Number(totalApplicationsResult.rows?.[0]?.totalApplications || 0),
        totalUsers: Number(totalUsersResult.rows?.[0]?.totalUsers || 0),
        usageByCategory: usageByCategoryResult.rows || [],
      });
    } catch (error) {
      console.error('Error fetching company analytics:', error);
      res.status(500).json({ error: 'Failed to fetch company analytics' });
    } finally {
      if (db?.release) db.release();
    }
  }

  // Dashboard endpoint used by frontend
  async getDashboard(req: Request, res: Response): Promise<void> {
    const { user } = req;
    if (!user?.companyId) {
      res.status(403).json({ error: 'User is not associated with a company' });
      return;
    }
    let db: any = null;
    try {
      db = await getConnection();
      const companyId = user.companyId;

      const totalUsersQ = await db.query('SELECT COUNT(*) AS c FROM users WHERE company_id = ?', [companyId]);
      const activeSubsQ = await db.query("SELECT COUNT(*) AS c FROM users WHERE company_id = ? AND subscription_tier <> 'trial'", [companyId]);
      const tplDownloadsQ = await db.query(
        `SELECT COALESCE(SUM(ut.access_count), 0) AS c
         FROM user_templates ut
         JOIN users u ON ut.user_id = u.id
         WHERE u.company_id = ?`, [companyId]
      );
      const popularProductsQ = await db.query(
        `SELECT t.name, t.category, SUM(ut.access_count) AS download_count
         FROM user_templates ut
         JOIN templates t ON ut.template_id = t.id
         JOIN users u ON ut.user_id = u.id
         WHERE u.company_id = ?
         GROUP BY t.name, t.category
         ORDER BY download_count DESC
         OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY`, [companyId]
      );

      res.json({
        totalUsers: Number(totalUsersQ.rows?.[0]?.c || 0),
        activeSubscriptions: Number(activeSubsQ.rows?.[0]?.c || 0),
        templateDownloads: Number(tplDownloadsQ.rows?.[0]?.c || 0),
        monthlyRevenue: 0, // No payments table yet
        recentActivity: [], // No activity table currently
        popularProducts: (popularProductsQ.rows || []).map((r: any) => ({
          name: r.name,
          category: r.category,
          download_count: Number(r.download_count || 0)
        }))
      });
    } catch (error) {
      console.error('Error building dashboard analytics:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
    } finally { if (db?.release) db.release(); }
  }
}
