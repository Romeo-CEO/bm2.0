import { Request, Response } from 'express';
import { getConnection, DB_TYPE, DatabaseType } from '../config/database';
import { User, Company, Application, Template } from '../types';

export class AdminController {
  // User Management
  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let whereClause = '1=1';
      const params: string[] = [];

      if (search) {
        whereClause += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (role) {
        whereClause += ' AND role = ?';
        params.push(String(role));
      }

      if (status) {
        if (status === 'active') {
          whereClause += ' AND is_active = 1';
        } else if (status === 'inactive') {
          whereClause += ' AND is_active = 0';
        }
      }

      const db = await getConnection();
      try {
        // Get total count
        const countResult = await db.query(
          `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
          params
        );
        const total = countResult.rows[0].total;

        // Get users with pagination
        const usersResult = await db.query(
          `SELECT id, email, first_name, last_name, role, company_id, subscription_tier, 
                  is_active, created_at, last_login_at
           FROM users 
           WHERE ${whereClause}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, Number(limit), offset]
        );

        res.json({
          users: usersResult.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  };

  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const db = await getConnection();
      try {
        const result = await db.query(
          `SELECT u.*, c.name as company_name, c.subscription_tier as company_subscription
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.id
           WHERE u.id = ?`,
          [id]
        );

        if (result.rows.length === 0) {
          res.status(404).json({ error: 'User not found' });
          return;
        }

        res.json({ user: result.rows[0] });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  };

  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { role, is_active, subscription_tier } = req.body;

      const db = await getConnection();
      try {
        const result = await db.query(
          'UPDATE users SET role = ?, is_active = ?, subscription_tier = ?, updated_at = GETDATE() WHERE id = ?',
          [role, is_active, subscription_tier, id]
        );

        if (result.rowCount === 0) {
          res.status(404).json({ error: 'User not found' });
          return;
        }

        res.json({ message: 'User updated successfully' });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  };

  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const db = await getConnection();
      try {
        // Check if user exists
        const userResult = await db.query('SELECT id FROM users WHERE id = ?', [id]);
        if (userResult.rows.length === 0) {
          res.status(404).json({ error: 'User not found' });
          return;
        }

        // Soft delete user
        await db.query('UPDATE users SET is_active = 0, deleted_at = GETDATE() WHERE id = ?', [id]);

        res.json({ message: 'User deleted successfully' });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  };

  // Company Management
  getAllCompanies = async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, search = '', subscription_tier = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let whereClause = '1=1';
      const params: string[] = [];

      if (search) {
        whereClause += ' AND (name LIKE ? OR email LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      if (subscription_tier) {
        whereClause += ' AND subscription_tier = ?';
        params.push(String(subscription_tier));
      }

      const db = await getConnection();
      try {
        // Get total count
        const countResult = await db.query(
          `SELECT COUNT(*) as total FROM companies WHERE ${whereClause}`,
          params
        );
        const total = countResult.rows[0].total;

        // Get companies with user count
        const companiesResult = await db.query(
          `SELECT c.*, 
                  (SELECT COUNT(*) FROM users WHERE company_id = c.id AND is_active = 1) as user_count
           FROM companies c
           WHERE ${whereClause}
           ORDER BY c.created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, Number(limit), offset]
        );

        res.json({
          companies: companiesResult.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  };

  updateCompany = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { subscription_tier, is_active } = req.body;

      const db = await getConnection();
      try {
        const result = await db.query(
          'UPDATE companies SET subscription_tier = ?, is_active = ?, updated_at = GETDATE() WHERE id = ?',
          [subscription_tier, is_active, id]
        );

        if (result.rowCount === 0) {
          res.status(404).json({ error: 'Company not found' });
          return;
        }

        res.json({ message: 'Company updated successfully' });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ error: 'Failed to update company' });
    }
  };

  // Analytics
  getAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { period = '30' } = req.query; // days
      const days = Number(period);

      const db = await getConnection();
      try {
        // Date expressions per database
        const dateSinceExpr = DB_TYPE === DatabaseType.MSSQL
          ? `DATEADD(DAY, -?, GETDATE())`
          : `DATE_SUB(NOW(), INTERVAL ? DAY)`;
        const dateSince7Expr = DB_TYPE === DatabaseType.MSSQL
          ? `DATEADD(DAY, -7, GETDATE())`
          : `DATE_SUB(NOW(), INTERVAL 7 DAY)`;

        // User statistics
        const userStats = await db.query(
          `SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
            COUNT(CASE WHEN created_at >= ${dateSinceExpr} THEN 1 END) as new_users_${days}d,
            COUNT(CASE WHEN last_login_at >= ${dateSince7Expr} THEN 1 END) as active_last_7d
           FROM users`,
          [days]
        );

        // Company statistics
        const companyStats = await db.query(
          `SELECT 
            COUNT(*) as total_companies,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_companies,
            COUNT(CASE WHEN created_at >= ${dateSinceExpr} THEN 1 END) as new_companies_${days}d
           FROM companies`,
          [days]
        );

        // Subscription distribution
        const subscriptionStats = await db.query(`
          SELECT 
            subscription_tier,
            COUNT(*) as count
          FROM companies
          WHERE is_active = 1
          GROUP BY subscription_tier
        `);

        // Application usage
        const appStats = await db.query(`
          SELECT 
            a.name,
            a.category,
            COUNT(ua.id) as usage_count
          FROM applications a
          LEFT JOIN user_applications ua ON a.id = ua.application_id
          WHERE a.status = 'active'
          GROUP BY a.id, a.name, a.category
          ORDER BY usage_count DESC
          LIMIT 10
        `);

        // Template usage
        const templateStats = await db.query(`
          SELECT 
            t.category,
            COUNT(ut.id) as usage_count
          FROM templates t
          LEFT JOIN user_templates ut ON t.id = ut.template_id
          WHERE t.is_active = 1
          GROUP BY t.category
          ORDER BY usage_count DESC
        `);

        res.json({
          users: userStats.rows[0],
          companies: companyStats.rows[0],
          subscriptions: subscriptionStats.rows,
          topApplications: appStats.rows,
          templateUsage: templateStats.rows,
          period: days
        });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  };

  // Platform Settings
  getPlatformSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const db = await getConnection();
      try {
        const result = await db.query(
          'SELECT * FROM platform_settings ORDER BY setting_key'
        );

        type PlatformSettingRow = { setting_key: string; setting_value: string };
        const settings: { [key: string]: string } = {};
        result.rows.forEach((row: PlatformSettingRow) => {
          settings[row.setting_key] = row.setting_value;
        });

        res.json({ settings });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
      res.status(500).json({ error: 'Failed to fetch platform settings' });
    }
  };

  updatePlatformSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        res.status(400).json({ error: 'Invalid settings format' });
        return;
      }

      const db = await getConnection();
      try {
        for (const [key, value] of Object.entries(settings)) {
          const val = JSON.stringify(value);
          try {
            await db.query(
              `IF EXISTS (SELECT 1 FROM platform_settings WHERE setting_key = ?)
                 UPDATE platform_settings SET setting_value = ?, updated_at = GETDATE() WHERE setting_key = ?
               ELSE
                 INSERT INTO platform_settings (setting_key, setting_value, updated_at) VALUES (?, ?, GETDATE())`,
              [key, val, key, key, val]
            );
          } catch {
            await db.query(
              `INSERT INTO platform_settings (setting_key, setting_value, updated_at) 
               VALUES (?, ?, GETDATE())`,
              [key, val]
            );
          }
        }
        res.json({ message: 'Platform settings updated successfully' });
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error updating platform settings:', error);
      res.status(500).json({ error: 'Failed to update platform settings' });
    }
  };

  // System Health
  getSystemHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const db = await getConnection();
      try {
        // Database health
        const dbHealth = await db.query('SELECT 1 as health');
        const dbStatus = dbHealth.rows.length > 0 ? 'healthy' : 'unhealthy';

        // Storage health (if using Azure Blob Storage)
        const storageType = process.env.STORAGE_TYPE || 'database';
        let storageStatus = 'healthy';
        
        if (storageType === 'azure_blob') {
          // TODO: Add Azure Blob Storage health check
          storageStatus = 'unknown';
        }

        // Memory usage
        const memoryUsage = process.memoryUsage();
        const memoryStatus = memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9 ? 'warning' : 'healthy';

        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: dbStatus,
            storage: storageStatus,
            memory: memoryStatus
          },
          metrics: {
            memory: {
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              external: Math.round(memoryUsage.external / 1024 / 1024)
            }
          }
        });
      } finally {
        if (db.release) db.release();
      }
    } catch (error) {
      console.error('Error checking system health:', error);
      res.status(500).json({ 
        status: 'unhealthy',
        error: 'Failed to check system health',
        timestamp: new Date().toISOString()
      });
    }
  };
}