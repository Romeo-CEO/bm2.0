import { Request, Response } from 'express';
import { getConnection } from '../config/database';
import { sendError, sendPaginated, sendSuccess } from '../utils/responses';

export class UsersController {
  /**
   * Get all users (admin only)
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = '1', pageSize = '25' } = req.query as Record<string, string>;
      const pageNumber = Math.max(parseInt(String(page), 10) || 1, 1);
      const pageSizeNumber = Math.max(Math.min(parseInt(String(pageSize), 10) || 25, 100), 1);
      const offset = (pageNumber - 1) * pageSizeNumber;

      const db = await getConnection();
      const countResult = await db.query('SELECT COUNT(*) AS total FROM users');
      const total = Number(countResult.rows?.[0]?.total ?? 0);
      const result = await db.query(
        `SELECT id, email, first_name, last_name, role, company_id, subscription_tier, is_active, created_at
         FROM users
         ORDER BY created_at DESC
         OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
        [offset, pageSizeNumber]
      );

      sendPaginated(res, {
        items: result.rows,
        page: pageNumber,
        pageSize: pageSizeNumber,
        total,
        totalPages: Math.max(Math.ceil(total / pageSizeNumber), 1),
      });

    } catch (error) {
      console.error('Get users error:', error);
      sendError(res, 500, 'USERS_FETCH_FAILED', 'Failed to get users');
    }
  }

  /**
   * Update user (admin only)
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, subscriptionTier, isActive } = req.body;

      if (!id) { sendError(res, 400, 'USER_ID_REQUIRED', 'User ID required'); return; }

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

      if (updates.length === 0) { sendError(res, 400, 'NO_FIELDS', 'No fields to update'); return; }

      values.push(id);

      const result = await db.query(`
        UPDATE users 
        SET ${updates.join(', ')}, updated_at = GETDATE()
        WHERE id = ?
      `, values);

      if (result.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      sendSuccess(res, { message: 'User updated successfully' });

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

      if (!id) { sendError(res, 400, 'USER_ID_REQUIRED', 'User ID required'); return; }

      const db = await getConnection();
      const result = await db.query('DELETE FROM users WHERE id = ?', [id]);

      if (result.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      sendSuccess(res, { message: 'User deleted successfully' });

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
      if (!id || !companyId) { sendError(res, 400, 'COMPANY_ASSIGNMENT_INVALID', 'user id and companyId are required'); return; }
      if (!req.user) { sendError(res, 401, 'AUTH_REQUIRED', 'Unauthorized'); return; }

      const db = await getConnection();
      const subscriptionTier = req.user.subscriptionTier || 'trial';
      const subscriptionExpiry = req.user.subscriptionTier === 'trial' ? null : req.user.subscriptionExpiry || null;

      const updateResult = await db.query("UPDATE users SET company_id = ?, subscription_tier = ?, subscription_expiry = ?, updated_at = GETDATE() WHERE id = ?", [companyId, subscriptionTier, subscriptionExpiry, id]);
      if (updateResult.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }

      const adminCheck = await db.query("SELECT COUNT(*) AS count FROM users WHERE company_id = ? AND (role = 'admin' OR company_admin = 1)", [companyId]);
      const existingAdmins = Number(adminCheck.rows?.[0]?.count || 0);
      const shouldPromote = makeCompanyAdmin || existingAdmins === 0;
      if (shouldPromote) {
        await db.query('UPDATE users SET company_admin = 1, updated_at = GETDATE() WHERE id = ?', [id]);
      }

      sendSuccess(res, { companyAdmin: shouldPromote });
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
      if (typeof isCompanyAdmin !== 'boolean') { sendError(res, 400, 'COMPANY_ADMIN_FLAG_INVALID', 'isCompanyAdmin boolean required'); return; }
      if (!req.user) { sendError(res, 401, 'AUTH_REQUIRED', 'Unauthorized'); return; }
      const db = await getConnection();
      const userQ = await db.query('SELECT company_id FROM users WHERE id = ?', [id]);
      if (userQ.rows.length === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }
      const targetCompanyId = userQ.rows[0].company_id;
      if (req.user.role !== 'admin' && req.user.companyId !== targetCompanyId) {
        sendError(res, 403, 'COMPANY_SCOPE_VIOLATION', 'Forbidden'); return; }
      const result = await db.query('UPDATE users SET company_admin = ?, updated_at = GETDATE() WHERE id = ?', [isCompanyAdmin ? 1 : 0, id]);
      if (result.rowCount === 0) { sendError(res, 404, 'USER_NOT_FOUND', 'User not found'); return; }
      sendSuccess(res);
    } catch (error) {
      console.error('setCompanyAdmin error:', error);
      sendError(res, 500, 'COMPANY_ADMIN_UPDATE_FAILED', 'Failed to set company admin');
    }
  }
}
