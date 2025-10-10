import { Request, Response } from 'express';
import { getConnection } from '../config/database';

export class UsersController {
  /**
   * Get all users (admin only)
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const db = await getConnection();
      const result = await db.query(`
        SELECT id, email, first_name, last_name, role, company_id, subscription_tier, is_active, created_at
        FROM users 
        ORDER BY created_at DESC
      `);

      res.json({
        success: true,
        users: result.rows
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  }

  /**
   * Update user (admin only)
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, subscriptionTier, isActive } = req.body;

      if (!id) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const db = await getConnection();
      
      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (firstName !== undefined) {
        updates.push('first_name = ?');
        values.push(firstName);
      }
      if (lastName !== undefined) {
        updates.push('last_name = ?');
        values.push(lastName);
      }
      if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
      }
      if (subscriptionTier !== undefined) {
        updates.push('subscription_tier = ?');
        values.push(subscriptionTier);
      }
      if (isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(isActive ? 1 : 0);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      values.push(id);

      const result = await db.query(`
        UPDATE users 
        SET ${updates.join(', ')}, updated_at = GETDATE()
        WHERE id = ?
      `, values);

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        message: 'User updated successfully'
      });

    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'User ID required' });
        return;
      }

      const db = await getConnection();
      const result = await db.query('DELETE FROM users WHERE id = ?', [id]);

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  // Assign user to a company (admin or company admin)
  async assignCompany(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId, makeCompanyAdmin = false } = req.body || {};
      if (!id || !companyId) { res.status(400).json({ error: 'user id and companyId are required' }); return; }
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      // Non-admins can only assign within their own company and must be company administrators
      if (req.user.role !== 'admin') {
        if (!req.user.companyId || req.user.companyId !== companyId || !req.user.companyAdmin) {
          res.status(403).json({ error: 'Forbidden' }); return;
        }
      }

      const db = await getConnection();
      const subscriptionTier = req.user.subscriptionTier || 'trial';
      const subscriptionExpiry = req.user.subscriptionTier === 'trial' ? null : req.user.subscriptionExpiry || null;

      const updateResult = await db.query("UPDATE users SET company_id = ?, subscription_tier = ?, subscription_expiry = ?, updated_at = GETDATE() WHERE id = ?", [companyId, subscriptionTier, subscriptionExpiry, id]);
      if (updateResult.rowCount === 0) { res.status(404).json({ error: 'User not found' }); return; }

      const adminCheck = await db.query("SELECT COUNT(*) AS count FROM users WHERE company_id = ? AND (role = 'admin' OR company_admin = 1)", [companyId]);
      const existingAdmins = Number(adminCheck.rows?.[0]?.count || 0);
      const shouldPromote = makeCompanyAdmin || existingAdmins === 0;
      if (shouldPromote) {
        await db.query('UPDATE users SET company_admin = 1, updated_at = GETDATE() WHERE id = ?', [id]);
      }

      res.json({ success: true, companyAdmin: shouldPromote });
    } catch (error) {
      console.error('assignCompany error:', error);
      res.status(500).json({ error: 'Failed to assign company' });
    }
  }


  // Set or unset company admin flag (admin or company admin)
  async setCompanyAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isCompanyAdmin } = req.body || {};
      if (typeof isCompanyAdmin !== 'boolean') { res.status(400).json({ error: 'isCompanyAdmin boolean required' }); return; }
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      // If not platform admin, ensure same company
      const db = await getConnection();
      const userQ = await db.query('SELECT company_id FROM users WHERE id = ?', [id]);
      if (userQ.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
      const targetCompanyId = userQ.rows[0].company_id;
      if (req.user.role !== 'admin' && req.user.companyId !== targetCompanyId) {
        res.status(403).json({ error: 'Forbidden' }); return; }
      const result = await db.query('UPDATE users SET company_admin = ?, updated_at = GETDATE() WHERE id = ?', [isCompanyAdmin ? 1 : 0, id]);
      if (result.rowCount === 0) { res.status(404).json({ error: 'User not found' }); return; }
      res.json({ success: true });
    } catch (error) {
      console.error('setCompanyAdmin error:', error);
      res.status(500).json({ error: 'Failed to set company admin' });
    }
  }
}
