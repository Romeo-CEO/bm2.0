import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getConnection } from '../config/database';

export class CompanyProfileController {
  async getMyCompanyProfile(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const user = req.user;
      if (!user?.companyId) {
        res.status(404).json({ error: 'No company associated with user' });
        return;
      }
      db = await getConnection();
      const result = await db.query(
        `SELECT id, name, domain, industry, size, website, address, phone, email, is_active as isActive,
                description, description as companyDescription, tagline,
                logo_url as logoUrl, primary_color as primaryColor, secondary_color as secondaryColor,
                created_at as createdAt, updated_at as updatedAt
         FROM companies WHERE id = ?`,
        [user.companyId]
      );
      if (result.rows.length === 0) { res.status(404).json({ error: 'Company not found' }); return; }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('getMyCompanyProfile error:', error);
      res.status(500).json({ error: 'Failed to get company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }

  async updateMyCompanyProfile(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const user = req.user;
      if (!user?.companyId) { res.status(404).json({ error: 'No company associated with user' }); return; }

      const { name, domain, industry, size, website, address, phone, email, description, tagline, logoUrl, primaryColor, secondaryColor } = req.body || {};

      db = await getConnection();

      const updates: string[] = [];
      const values: any[] = [];
      const push = (col: string, val: any) => { updates.push(`${col} = ?`); values.push(val); };

      if (name !== undefined) push('name', name);
      if (domain !== undefined) push('domain', domain);
      if (industry !== undefined) push('industry', industry);
      if (size !== undefined) push('size', size);
      if (website !== undefined) push('website', website);
      if (description !== undefined) push('description', description);
      if (tagline !== undefined) push('tagline', tagline);
      if (address !== undefined) push('address', address);
      if (phone !== undefined) push('phone', phone);
      if (email !== undefined) push('email', email);
      if (logoUrl !== undefined) push('logo_url', logoUrl);
      if (primaryColor !== undefined) push('primary_color', primaryColor);
      if (secondaryColor !== undefined) push('secondary_color', secondaryColor);

      if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

      values.push(user.companyId);
      await db.query(
        `UPDATE companies SET ${updates.join(', ')}, updated_at = GETDATE() WHERE id = ?`,
        values
      );
      res.json({ success: true });
    } catch (error) {
      console.error('updateMyCompanyProfile error:', error);
      res.status(500).json({ error: 'Failed to update company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }

  async getCompanyProfileById(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const { id } = req.params;
      db = await getConnection();
      const result = await db.query(
        `SELECT id, name, domain, industry, size, website, address, phone, email, is_active as isActive,
                description, description as companyDescription, tagline,
                logo_url as logoUrl, primary_color as primaryColor, secondary_color as secondaryColor,
                created_at as createdAt, updated_at as updatedAt
         FROM companies WHERE id = ?`,
        [id]
      );
      if (result.rows.length === 0) { res.status(404).json({ error: 'Company not found' }); return; }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('getCompanyProfileById error:', error);
      res.status(500).json({ error: 'Failed to get company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }

  // Get users for current user's company
  async getMyCompanyUsers(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const companyId = req.user?.companyId;
      if (!companyId) { res.status(404).json({ error: 'No company associated with user' }); return; }
      db = await getConnection();
      const result = await db.query(
        `SELECT id, email, first_name, last_name, role, company_admin, subscription_tier, is_active, created_at
         FROM users WHERE company_id = ? ORDER BY created_at DESC`,
        [companyId]
      );
      res.json(Array.isArray(result.rows) ? result.rows : []);
    } catch (error) {
      console.error('getMyCompanyUsers error:', error);
      res.status(500).json({ error: 'Failed to get company users' });
    } finally { if (db?.release) db.release(); }
  }

  // Create a user in current company with temp password
  async addCompanyUser(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const companyId = req.user?.companyId;
      if (!companyId) { res.status(404).json({ error: 'No company associated with user' }); return; }
      const { email, firstName, lastName } = req.body || {};
      if (!email || !firstName || !lastName) { res.status(400).json({ error: 'email, firstName, lastName are required' }); return; }
      db = await getConnection();
      const userId = randomUUID();
      const tempPassword = Math.random().toString(36).slice(-10);
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash(tempPassword, 10);
      await db.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, role, subscription_tier, is_active, company_id, company_admin, created_at)
         VALUES (?, ?, ?, ?, ?, 'user', 'trial', 1, ?, 0, GETDATE())`,
        [userId, email, passwordHash, firstName, lastName, companyId]
      );
      res.status(201).json({ userId, tempPassword });
    } catch (error) {
      console.error('addCompanyUser error:', error);
      res.status(500).json({ error: 'Failed to add company user' });
    } finally { if (db?.release) db.release(); }
  }

  async updateCompanyProfileById(req: Request, res: Response): Promise<void> {
    let db: any = null;
    try {
      const { id } = req.params;
      const { name, domain, industry, size, website, address, phone, email, description, tagline, logoUrl, primaryColor, secondaryColor, isActive } = req.body || {};

      db = await getConnection();

      const updates: string[] = [];
      const values: any[] = [];
      const push = (col: string, val: any) => { updates.push(`${col} = ?`); values.push(val); };

      if (name !== undefined) push('name', name);
      if (domain !== undefined) push('domain', domain);
      if (industry !== undefined) push('industry', industry);
      if (size !== undefined) push('size', size);
      if (website !== undefined) push('website', website);
      if (description !== undefined) push('description', description);
      if (tagline !== undefined) push('tagline', tagline);
      if (address !== undefined) push('address', address);
      if (phone !== undefined) push('phone', phone);
      if (email !== undefined) push('email', email);
      if (logoUrl !== undefined) push('logo_url', logoUrl);
      if (primaryColor !== undefined) push('primary_color', primaryColor);
      if (secondaryColor !== undefined) push('secondary_color', secondaryColor);
      if (isActive !== undefined) push('is_active', isActive ? 1 : 0);

      if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

      values.push(id);
      const result = await db.query(
        `UPDATE companies SET ${updates.join(', ')}, updated_at = GETDATE() WHERE id = ?`,
        values
      );
      if (result.rowCount === 0) { res.status(404).json({ error: 'Company not found' }); return; }
      res.json({ success: true });
    } catch (error) {
      console.error('updateCompanyProfileById error:', error);
      res.status(500).json({ error: 'Failed to update company profile' });
    } finally {
      if (db?.release) db.release();
    }
  }
}
