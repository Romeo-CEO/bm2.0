import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getConnection } from '../config/database';

export class CompaniesController {
  /**
   * Get companies with pagination (admin only)
   */
  async getCompanies(req: Request, res: Response) {
    let db: any = null;
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { page = 1, pageSize = 20, search = '' } = req.query;
      
      db = await getConnection();
      
      // Build WHERE clause
      const whereConditions = ['1=1'];
      const params: any[] = [];

      if (search) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM companies WHERE ${whereClause}`,
        params
      );
      const total = countResult.rows[0].total;

      // Get paginated results with user count and subscription info
      const offset = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);
      
      const result = await db.query(`
        SELECT c.*,
               (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) as user_count,
               (SELECT TOP 1 subscription_tier FROM users WHERE company_id = c.id AND (role = 'admin' OR company_admin = 1) ORDER BY created_at ASC) as subscription_tier,
               (SELECT TOP 1 subscription_expiry FROM users WHERE company_id = c.id AND (role = 'admin' OR company_admin = 1) ORDER BY created_at ASC) as subscription_expiry
        FROM companies c
        WHERE ${whereClause}
        ORDER BY c.created_at DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
      `, [...params, offset, limit]);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize))
        }
      });
      return;

    } catch (error) {
      console.error('Error getting companies:', error);
      res.status(500).json({ error: 'Failed to get companies' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Get single company by ID
   */
  async getCompany(req: Request, res: Response) {
    let db: any = null;
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const normalizedId = (id || '').toLowerCase();
      const userCompanyId = (user.companyId || '').toLowerCase();

      if (!normalizedId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      // Authorization: admin can access any company, company_admin can only access their own
      if (user.role !== 'admin' && userCompanyId !== normalizedId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db = await getConnection();

      const result = await db.query(`
        SELECT c.*,
               (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) as user_count,
               (SELECT TOP 1 subscription_tier FROM users WHERE company_id = c.id AND (role = 'admin' OR company_admin = 1) ORDER BY created_at ASC) as subscription_tier,
               (SELECT TOP 1 subscription_expiry FROM users WHERE company_id = c.id AND (role = 'admin' OR company_admin = 1) ORDER BY created_at ASC) as subscription_expiry
        FROM companies c
        WHERE c.id = ?
      `, [id ? id.toUpperCase() : id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
      return;

    } catch (error) {
      console.error('Error getting company:', error);
      res.status(500).json({ error: 'Failed to get company' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Create new company (admin only)
   */
  async createCompany(req: Request, res: Response) {
    let db: any = null;
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { name, description, industry, size, website, address, phone, email, tagline } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Company name is required' });
      }

      db = await getConnection();
      const companyId = randomUUID();

      await db.query(`
        INSERT INTO companies (id, name, description, industry, size, website, address, phone, email, tagline, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        companyId,
        name,
        description || null,
        industry || null,
        size || null,
        website || null,
        address || null,
        phone || null,
        email || null,
        tagline || null
      ]);

      res.status(201).json({
        success: true,
        data: {
          id: companyId,
          name,
          description,
          industry,
          size,
          website,
          address,
          phone,
          email,
          tagline,
          isActive: true
        }
      });
      return;

    } catch (error) {
      console.error('Error creating company:', error);
      res.status(500).json({ error: 'Failed to create company' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Update company
   */
  async updateCompany(req: Request, res: Response) {
    let db: any = null;
    try {
      const { id } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Authorization: admin can update any company, company_admin can only update their own
      if (user.role !== 'admin' && user.companyId !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { name, description, industry, size, website, address, phone, email, tagline, isActive } = req.body;

      db = await getConnection();
      
      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (industry !== undefined) {
        updates.push('industry = ?');
        values.push(industry);
      }
      if (size !== undefined) {
        updates.push('size = ?');
        values.push(size);
      }
      if (website !== undefined) {
        updates.push('website = ?');
        values.push(website);
      }
      if (tagline !== undefined) {
        updates.push('tagline = ?');
        values.push(tagline);
      }
      if (address !== undefined) {
        updates.push('address = ?');
        values.push(address);
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone);
      }
      if (email !== undefined) {
        updates.push('email = ?');
        values.push(email);
      }
      if (isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(isActive ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);

      const result = await db.query(`
        UPDATE companies 
        SET ${updates.join(', ')}, updated_at = GETDATE()
        WHERE id = ?
      `, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({
        success: true,
        message: 'Company updated successfully'
      });
      return;

    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ error: 'Failed to update company' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Delete company (admin only)
   */
  async deleteCompany(req: Request, res: Response) {
    let db: any = null;
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      db = await getConnection();
      
      const result = await db.query('DELETE FROM companies WHERE id = ?', [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({
        success: true,
        message: 'Company deleted successfully'
      });
      return;

    } catch (error) {
      console.error('Error deleting company:', error);
      res.status(500).json({ error: 'Failed to delete company' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Get company branding data
   */
  async getCompanyBranding(req: Request, res: Response) {
    let db: any = null;
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Authorization: admin can access any company, company_admin can only access their own
      if (user.role !== 'admin' && user.companyId !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db = await getConnection();

      // Get current branding data from companies table (initially using existing logo_url, primary_color, secondary_color columns)
      const result = await db.query(`
        SELECT logo_url as logoUrl, primary_color as primaryColor, secondary_color as secondaryColor
        FROM companies
        WHERE id = ?
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
      return;

    } catch (error) {
      console.error('Error getting company branding:', error);
      res.status(500).json({ error: 'Failed to get company branding' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Update company branding data
   */
  async updateCompanyBranding(req: Request, res: Response) {
    let db: any = null;
    try {
      const { id } = req.params;
      const user = req.user;
      const { logoUrl, primaryColor, secondaryColor } = req.body;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Authorization: admin can update any company, company_admin can only update their own
      if (user.role !== 'admin' && user.companyId !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Validate input data
      if (logoUrl !== undefined && typeof logoUrl !== 'string') {
        return res.status(400).json({ error: 'Logo URL must be a string' });
      }

      if (primaryColor !== undefined && typeof primaryColor !== 'string') {
        return res.status(400).json({ error: 'Primary color must be a string' });
      }

      if (secondaryColor !== undefined && typeof secondaryColor !== 'string') {
        return res.status(400).json({ error: 'Secondary color must be a string' });
      }

      db = await getConnection();

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (logoUrl !== undefined) {
        updates.push('logo_url = ?');
        values.push(logoUrl);
      }

      if (primaryColor !== undefined) {
        updates.push('primary_color = ?');
        values.push(primaryColor);
      }

      if (secondaryColor !== undefined) {
        updates.push('secondary_color = ?');
        values.push(secondaryColor);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No branding fields to update' });
      }

      values.push(id);

      const result = await db.query(`
        UPDATE companies
        SET ${updates.join(', ')}, updated_at = GETDATE()
        WHERE id = ?
      `, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      res.json({
        success: true,
        message: 'Company branding updated successfully'
      });
      return;

    } catch (error) {
      console.error('Error updating company branding:', error);
      res.status(500).json({ error: 'Failed to update company branding' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Get company users
   */
  async getCompanyUsers(req: Request, res: Response) {
    let db: any = null;
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Authorization: admin can access any company, company_admin can only access their own
      if (user.role !== 'admin' && user.companyId !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db = await getConnection();

      const result = await db.query(`
        SELECT id, email, first_name, last_name, role, company_admin, subscription_tier, is_active, created_at
        FROM users
        WHERE company_id = ?
        ORDER BY created_at DESC
      `, [id]);

      res.json({
        success: true,
        data: result.rows
      });
      return;

    } catch (error) {
      console.error('Error getting company users:', error);
      res.status(500).json({ error: 'Failed to get company users' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }
}
