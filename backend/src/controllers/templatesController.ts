import { Request, Response } from 'express';
import { getConnection } from '../config/database';

export class TemplatesController {
  /**
   * Get templates with pagination and filtering
   */
  async getTemplates(req: Request, res: Response) {
    let db: any = null;
    try {
      const { page = 1, pageSize = 20, search = '', category = '' } = req.query as any;
      
      db = await getConnection();
      
      // Build WHERE clause
      const whereConditions = ['is_active = 1'];
      const params: any[] = [];

      if (search) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (category) {
        whereConditions.push('category = ?');
        params.push(category);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM templates WHERE ${whereClause}`,
        params
      );
      const total = Number((countResult.rows[0] as any).total ?? 0);

      // Get paginated results
      const offset = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);
      
      const result = await db.query(
        `SELECT * FROM templates WHERE ${whereClause} ORDER BY created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
        [...params, offset, limit]
      );

      res.json({
        success: true,
        items: result.rows,
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize))
      });
      return;

    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({ error: 'Failed to get templates' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }

  /**
   * Public: Get templates (paged) in shape expected by frontend
   */
  async getPublicTemplatesPaged(req: Request, res: Response) {
    let db: any = null;
    try {
      const { page = 1, pageSize = 20, q = '', category = '', sortBy = 'date', sortDir = 'desc' } = req.query as any;
      db = await getConnection();

      const whereConditions = ['is_active = 1'];
      const params: any[] = [];

      if (q) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
      }
      if (category) {
        whereConditions.push('category = ?');
        params.push(category);
      }
      const whereClause = whereConditions.join(' AND ');

      let orderBy = 'created_at';
      if ((sortBy as string) === 'name') orderBy = 'name';
      const direction = (String(sortDir).toLowerCase() === 'asc') ? 'ASC' : 'DESC';

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM templates WHERE ${whereClause}`,
        params
      );
      const total = Number((countResult.rows[0] as any).total ?? 0);

      const offset = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);

      const result = await db.query(
        `SELECT id, name, description, category, file_name as fileName, file_size as fileSize, file_type as fileType, subscription_tiers as subscriptionTiers
         FROM templates
         WHERE ${whereClause}
         ORDER BY ${orderBy} ${direction} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
         [...params, offset, limit]
         );

      const items = (result.rows as any[]).map(r => ({
        ...r,
        subscriptionTiers: (() => { try { return Array.isArray(r.subscriptionTiers) ? r.subscriptionTiers : JSON.parse(r.subscriptionTiers || '[]'); } catch { return []; } })()
      }));

      res.json({
        success: true,
        items,
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize))
      });
      return;
    } catch (error) {
      console.error('Error getting public templates:', error);
      res.status(500).json({ error: 'Failed to get public templates' });
      return;
    } finally {
      if (db && db.release) db.release();
    }
  }

  /**
  * Get single template by ID
  */
  async getTemplate(req: Request, res: Response) {
  let db: any = null;
  try {
  const { id } = req.params;
  db = await getConnection();
  
  const result = await db.query(
  'SELECT * FROM templates WHERE id = ? AND is_active = 1',
  [id]
  );
  
  if (result.rows.length === 0) {
  return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json({
  success: true,
  data: result.rows[0]
  });
  return;
  
  } catch (error) {
  console.error('Error getting template:', error);
  res.status(500).json({ error: 'Failed to get template' });
  return;
  } finally {
  if (db && db.release) {
  db.release();
  }
  }
  }

  /**
    * Download template: redirect to download_url if present, else 404
    */
   async downloadTemplate(req: Request, res: Response) {
     let db: any = null;
     try {
       const { id } = req.params;
       db = await getConnection();
       const result = await db.query(
         'SELECT download_url, file_name, file_type, subscription_tiers FROM templates WHERE id = ? AND is_active = 1',
         [id]
       );
       if (result.rows.length === 0) {
         return res.status(404).json({ error: 'Template not found' });
       }
       const tpl = result.rows[0];

       // Subscription tier check (admins bypass)
       if (!req.user || req.user.role !== 'admin') {
         const userTier = req.user?.subscriptionTier || 'trial';
         let tiers: string[] = [];
         try {
           tiers = Array.isArray(tpl.subscription_tiers)
             ? tpl.subscription_tiers
             : JSON.parse(tpl.subscription_tiers || '[]');
         } catch {
           tiers = [];
         }
         const allowed = tiers.includes(userTier);
         if (!allowed) {
           return res.status(403).json({ error: 'Upgrade required', requiredTiers: tiers });
         }
       }

       if (tpl.download_url) {
         // Standard pattern: return 302 redirect for binary download
         res.setHeader('Location', tpl.download_url);
         return res.status(302).end();
       }
       return res.status(404).json({ error: 'Template has no download URL' });
     } catch (error) {
       console.error('Error downloading template:', error);
       return res.status(500).json({ error: 'Failed to download template' });
     } finally {
       if (db && db.release) db.release();
     }
   }

  /**
   * Create new template (admin only)
   */
  async createTemplate(req: Request, res: Response) {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id, name, description, category, downloadUrl, fileName, fileSize, fileType, subscriptionTiers } = req.body;

      if (!id || !name || !category || !subscriptionTiers) {
        return res.status(400).json({ error: 'Required fields: id, name, category, subscriptionTiers' });
      }

      const db = await getConnection();

      await db.query(`
        INSERT INTO templates (id, name, description, category, download_url, file_name, file_size, file_type, subscription_tiers, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        id,
        name,
        description || null,
        category,
        downloadUrl || null,
        fileName || null,
        fileSize || null,
        fileType || null,
        JSON.stringify(subscriptionTiers)
      ]);

      res.status(201).json({
        success: true,
        data: {
          id,
          name,
          description,
          category,
          downloadUrl,
          fileName,
          fileSize,
          fileType,
          subscriptionTiers,
          isActive: true
        }
      });
      return;

    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
      return;
    }
  }

  /**
   * Update template (admin only)
   */
  async updateTemplate(req: Request, res: Response) {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { name, description, category, downloadUrl, fileName, fileSize, fileType, subscriptionTiers, isActive } = req.body;

      const db = await getConnection();
      
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
      if (category !== undefined) {
        updates.push('category = ?');
        values.push(category);
      }
      if (downloadUrl !== undefined) {
        updates.push('download_url = ?');
        values.push(downloadUrl);
      }
      if (fileName !== undefined) {
        updates.push('file_name = ?');
        values.push(fileName);
      }
      if (fileSize !== undefined) {
        updates.push('file_size = ?');
        values.push(fileSize);
      }
      if (fileType !== undefined) {
        updates.push('file_type = ?');
        values.push(fileType);
      }
      if (subscriptionTiers !== undefined) {
        updates.push('subscription_tiers = ?');
        values.push(JSON.stringify(subscriptionTiers));
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
        UPDATE templates 
        SET ${updates.join(', ')}, updated_at = GETDATE()
        WHERE id = ?
      `, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({
        success: true,
        message: 'Template updated successfully'
      });
      return;

    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: 'Failed to update template' });
      return;
    }
  }

  /**
   * Delete template (admin only)
   */
  async deleteTemplate(req: Request, res: Response) {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const db = await getConnection();
      
      const result = await db.query('DELETE FROM templates WHERE id = ?', [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
      return;

    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
      return;
    }
  }

  /**
   * Get template categories
   */
  async getCategories(req: Request, res: Response) {
    let db: any = null;
    try {
      db = await getConnection();
      
      const result = await db.query(
        'SELECT DISTINCT category FROM templates WHERE is_active = 1 ORDER BY category'
      );

      const categories = result.rows.map((row: any) => row.category);

      res.json({
        success: true,
        data: categories
      });
      return;

    } catch (error) {
      console.error('Error getting template categories:', error);
      res.status(500).json({ error: 'Failed to get template categories' });
      return;
    } finally {
      if (db && db.release) {
        db.release();
      }
    }
  }
}
