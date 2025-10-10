import { Request, Response } from 'express';
import { getConnection } from '../config/database';
import { logAuditEvent } from '../services/auditService';
import { personalizeTemplate, resolveTemplateFormat } from '../services/templatePersonalizationService';
import { recordUsageEvent } from '../services/usageMetricsService';
import { trackEvent } from '../services/telemetryService';
import { DEFAULT_CATEGORY_ID } from '../services/schemaService';

const slugifyValue = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);

const valueFromRow = (row: any, ...keys: string[]): any => {
  if (!row) return undefined;
  for (const key of keys) {
    if (key in row && row[key] !== undefined) return row[key];
    const lower = key.toLowerCase();
    if (lower in row && row[lower] !== undefined) return row[lower];
    const upper = key.toUpperCase();
    if (upper in row && row[upper] !== undefined) return row[upper];
  }
  return undefined;
};

const parseSubscriptionTiers = (value: unknown): string[] => {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapTemplateRow = (row: any) => {
  const subscriptionTiers = parseSubscriptionTiers(valueFromRow(row, 'subscription_tiers', 'subscriptionTiers'));

  const categoryId = valueFromRow(row, 'category_id', 'categoryId');
  const categoryName = valueFromRow(row, 'category_name', 'categoryName') || valueFromRow(row, 'category');
  const categorySlug =
    valueFromRow(row, 'category_slug', 'categorySlug') ||
    (typeof categoryName === 'string' ? slugifyValue(categoryName) : null);

  const typeId = valueFromRow(row, 'type_id', 'typeId');
  const typeName = valueFromRow(row, 'type_name', 'typeName');
  const typeSlug =
    valueFromRow(row, 'type_slug', 'typeSlug') || (typeof typeName === 'string' ? slugifyValue(typeName) : null);

  return {
    id: valueFromRow(row, 'id'),
    name: valueFromRow(row, 'name'),
    description: valueFromRow(row, 'description'),
    category: categoryName ?? null,
    categoryDetails: categoryName
      ? {
          id: categoryId ?? null,
          name: categoryName,
          slug: categorySlug,
        }
      : null,
    typeDetails:
      typeId || typeName
        ? {
            id: typeId ?? null,
            name: typeName ?? null,
            slug: typeSlug,
          }
        : null,
    downloadUrl: valueFromRow(row, 'download_url', 'downloadUrl'),
    fileName: valueFromRow(row, 'file_name', 'fileName'),
    fileSize: valueFromRow(row, 'file_size', 'fileSize'),
    fileType: valueFromRow(row, 'file_type', 'fileType'),
    subscriptionTiers,
    isActive: Boolean(valueFromRow(row, 'is_active', 'isActive', 'IS_ACTIVE') ?? 0),
    createdAt: valueFromRow(row, 'created_at', 'createdAt'),
    updatedAt: valueFromRow(row, 'updated_at', 'updatedAt'),
  };
};

const applyCategoryFilter = (value: string, conditions: string[], params: any[]) => {
  if (!value) return;
  conditions.push('((c.id = ?) OR (LOWER(c.slug) = LOWER(?)) OR (LOWER(c.name) = LOWER(?)) OR (LOWER(t.category) = LOWER(?)))');
  params.push(value, value, value, value);
};

export class TemplatesController {
  /**
   * Get templates with pagination and filtering
   */
  async getTemplates(req: Request, res: Response) {
    let db: any = null;
    try {
      const { page = 1, pageSize = 20, search = '', category = '', type = '' } = req.query as any;

      db = await getConnection();

      // Build WHERE clause
      const whereConditions = ['t.is_active = 1'];
      const params: any[] = [];

      if (search) {
        whereConditions.push('(t.name LIKE ? OR t.description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (category) {
        applyCategoryFilter(String(category), whereConditions, params);
      }

      if (type) {
        whereConditions.push('(tt.id = ? OR LOWER(tt.slug) = LOWER(?) OR LOWER(tt.name) = LOWER(?))');
        params.push(type, type, type);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM (
            SELECT t.id
            FROM templates t
            LEFT JOIN template_category_assignments a ON a.template_id = t.id
            LEFT JOIN template_categories c ON c.id = a.category_id
            LEFT JOIN template_types tt ON tt.id = a.type_id
            WHERE ${whereClause}
        ) AS counted`,
        params
      );
      const total = Number(valueFromRow(countResult.rows?.[0] ?? {}, 'total') ?? 0);

      // Get paginated results
      const offset = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);

      const result = await db.query(
        `SELECT t.*, c.id as category_id, c.name as category_name, c.slug as category_slug,
                tt.id as type_id, tt.name as type_name, tt.slug as type_slug
         FROM templates t
         LEFT JOIN template_category_assignments a ON a.template_id = t.id
         LEFT JOIN template_categories c ON c.id = a.category_id
         LEFT JOIN template_types tt ON tt.id = a.type_id
         WHERE ${whereClause}
         ORDER BY t.created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
        [...params, offset, limit]
      );

      res.json({
        success: true,
        items: (result.rows || []).map(mapTemplateRow),
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
      const { page = 1, pageSize = 20, q = '', category = '', type = '', sortBy = 'date', sortDir = 'desc' } = req.query as any;
      db = await getConnection();

      const whereConditions = ['t.is_active = 1'];
      const params: any[] = [];

      if (q) {
        whereConditions.push('(t.name LIKE ? OR t.description LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
      }
      if (category) {
        applyCategoryFilter(String(category), whereConditions, params);
      }
      if (type) {
        whereConditions.push('(tt.id = ? OR LOWER(tt.slug) = LOWER(?) OR LOWER(tt.name) = LOWER(?))');
        params.push(type, type, type);
      }
      const whereClause = whereConditions.join(' AND ');

      let orderColumn = 't.created_at';
      if (String(sortBy).toLowerCase() === 'name') {
        orderColumn = 't.name';
      }
      const direction = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM (
           SELECT t.id
           FROM templates t
           LEFT JOIN template_category_assignments a ON a.template_id = t.id
           LEFT JOIN template_categories c ON c.id = a.category_id
           LEFT JOIN template_types tt ON tt.id = a.type_id
           WHERE ${whereClause}
        ) AS counted`,
        params
      );
      const total = Number(valueFromRow(countResult.rows?.[0] ?? {}, 'total') ?? 0);

      const offset = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);

      const result = await db.query(
        `SELECT t.*, c.id as category_id, c.name as category_name, c.slug as category_slug,
                tt.id as type_id, tt.name as type_name, tt.slug as type_slug
         FROM templates t
         LEFT JOIN template_category_assignments a ON a.template_id = t.id
         LEFT JOIN template_categories c ON c.id = a.category_id
         LEFT JOIN template_types tt ON tt.id = a.type_id
         WHERE ${whereClause}
         ORDER BY ${orderColumn} ${direction} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
         [...params, offset, limit]
         );

      const items = (result.rows as any[]).map(mapTemplateRow);

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
  `SELECT t.*, c.id as category_id, c.name as category_name, c.slug as category_slug,
          tt.id as type_id, tt.name as type_name, tt.slug as type_slug
   FROM templates t
   LEFT JOIN template_category_assignments a ON a.template_id = t.id
   LEFT JOIN template_categories c ON c.id = a.category_id
   LEFT JOIN template_types tt ON tt.id = a.type_id
   WHERE t.id = ? AND t.is_active = 1`,
  [id]
  );
  
  if (result.rows.length === 0) {
  return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json({
  success: true,
  data: mapTemplateRow(result.rows[0])
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
        'SELECT * FROM templates WHERE id = ? AND is_active = 1',
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

      const format = resolveTemplateFormat(tpl.file_type || tpl.fileType, tpl.file_name || tpl.fileName);
      const templateContent = tpl.template_content || tpl.sample_content || tpl.body || tpl.content || '';

      if (format && templateContent) {
        let companyBranding: any = null;
        if (req.user?.companyId) {
          const companyResult = await db.query(
            `SELECT TOP 1 name, email, phone, address, logo_url, primary_color, secondary_color
             FROM companies WHERE id = ?`,
            [req.user.companyId]
          );
          if (companyResult.rows.length > 0) {
            companyBranding = companyResult.rows[0];
          }
        }

        const decodeLogo = (value?: string | null): Buffer | null => {
          if (!value || typeof value !== 'string') return null;
          if (!value.startsWith('data:image/')) return null;
          const parts = value.split(',');
          if (parts.length !== 2) return null;
          try {
            return Buffer.from(parts[1], 'base64');
          } catch {
            return null;
          }
        };

        const brandingCompany = {
          name: companyBranding?.name || companyBranding?.company_name || 'Your Company',
          email: companyBranding?.email || req.user?.email || null,
          phone: companyBranding?.phone || null,
          address: companyBranding?.address || null
        };

        const theme = {
          primaryColor: companyBranding?.primary_color || companyBranding?.primaryColor || null,
          secondaryColor: companyBranding?.secondary_color || companyBranding?.secondaryColor || null
        };

        const logoBuffer = decodeLogo(companyBranding?.logo_url || companyBranding?.logoUrl || null);

        const personalized = await personalizeTemplate({
          format,
          templateContent,
          company: brandingCompany,
          theme,
          logoBuffer,
          fileName: tpl.file_name || tpl.fileName || undefined
        });

        res.setHeader('Content-Type', personalized.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${personalized.fileName}"`);
        res.send(personalized.buffer);

        await logAuditEvent({
          eventType: 'TEMPLATE_DOWNLOADED',
          success: true,
          userId: req.user?.id,
          metadata: {
            templateId: id,
            companyId: req.user?.companyId || null,
            format
          }
        });

        recordUsageEvent({
          eventType: 'template_download',
          userId: req.user?.id ?? null,
          companyId: req.user?.companyId ?? null,
          subjectId: id,
          subjectType: 'template',
          userRole: req.user?.role ?? null,
          subscriptionTier: req.user?.subscriptionTier ?? null,
          payload: { format }
        }).catch(error => {
          console.error('Failed to record template download metric', error);
        });

        trackEvent({
          name: 'template_download',
          properties: {
            templateId: String(id),
            companyId: String(req.user?.companyId ?? ''),
            userId: String(req.user?.id ?? ''),
            tier: String(req.user?.subscriptionTier ?? ''),
            role: String(req.user?.role ?? ''),
          },
        });
        return;
      }

      if (tpl.download_url) {
        res.setHeader('Location', tpl.download_url);
        recordUsageEvent({
          eventType: 'template_download',
          userId: req.user?.id ?? null,
          companyId: req.user?.companyId ?? null,
          subjectId: id,
          subjectType: 'template',
          userRole: req.user?.role ?? null,
          subscriptionTier: req.user?.subscriptionTier ?? null,
          payload: { format: tpl.file_type || tpl.fileType || null, delivery: 'redirect' }
        }).catch(error => console.error('Failed to record template redirect metric', error));

        trackEvent({
          name: 'template_download',
          properties: {
            templateId: String(id),
            companyId: String(req.user?.companyId ?? ''),
            userId: String(req.user?.id ?? ''),
            tier: String(req.user?.subscriptionTier ?? ''),
            role: String(req.user?.role ?? ''),
            delivery: 'redirect'
          },
        });
        return res.status(302).end();
      }

      return res.status(415).json({ error: 'Template format not supported for personalization' });
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

      const { id, name, description, categoryId, category, typeId, downloadUrl, fileName, fileSize, fileType, subscriptionTiers } = req.body;

      if (!id || !name || !subscriptionTiers) {
        return res.status(400).json({ error: 'Required fields: id, name, subscriptionTiers' });
      }

      if (!Array.isArray(subscriptionTiers)) {
        return res.status(400).json({ error: 'subscriptionTiers must be an array' });
      }

      const db = await getConnection();

      let resolvedCategoryId: string | null = categoryId || null;
      let resolvedCategoryName: string | null = typeof category === 'string' && category.trim() ? category.trim() : null;

      if (resolvedCategoryId) {
        const categoryResult = await db.query('SELECT id, name FROM template_categories WHERE id = ? AND is_active = 1', [resolvedCategoryId]);
        if (!categoryResult.rows || categoryResult.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid categoryId provided' });
        }
        resolvedCategoryName = valueFromRow(categoryResult.rows[0], 'name');
      } else if (resolvedCategoryName) {
        const slug = slugifyValue(resolvedCategoryName);
        const categoryResult = await db.query('SELECT id, name FROM template_categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)', [resolvedCategoryName, slug]);
        if (categoryResult.rows && categoryResult.rows.length > 0) {
          resolvedCategoryId = valueFromRow(categoryResult.rows[0], 'id');
          resolvedCategoryName = valueFromRow(categoryResult.rows[0], 'name');
        }
      }

      let resolvedTypeId: string | null = null;
      if (typeId) {
        const typeResult = await db.query('SELECT id, category_id, name FROM template_types WHERE id = ? AND is_active = 1', [typeId]);
        if (!typeResult.rows || typeResult.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid template type provided' });
        }
        const typeCategoryId = valueFromRow(typeResult.rows[0], 'category_id', 'categoryId');
        if (resolvedCategoryId && typeCategoryId && String(typeCategoryId) !== String(resolvedCategoryId)) {
          return res.status(400).json({ error: 'Template type does not belong to selected category' });
        }
        resolvedTypeId = valueFromRow(typeResult.rows[0], 'id');
        if (!resolvedCategoryId && typeCategoryId) {
          resolvedCategoryId = String(typeCategoryId);
          const typeCategory = await db.query('SELECT name FROM template_categories WHERE id = ?', [typeCategoryId]);
          resolvedCategoryName = valueFromRow(typeCategory.rows?.[0] ?? {}, 'name') ?? resolvedCategoryName;
        }
      }

      if (!resolvedCategoryId) {
        resolvedCategoryId = DEFAULT_CATEGORY_ID;
        const defaultCategory = await db.query('SELECT name FROM template_categories WHERE id = ?', [DEFAULT_CATEGORY_ID]);
        resolvedCategoryName = valueFromRow(defaultCategory.rows?.[0] ?? {}, 'name') ?? resolvedCategoryName ?? 'General';
      } else if (!resolvedCategoryName) {
        const categoryResult = await db.query('SELECT name FROM template_categories WHERE id = ?', [resolvedCategoryId]);
        resolvedCategoryName = valueFromRow(categoryResult.rows?.[0] ?? {}, 'name') ?? resolvedCategoryName ?? 'General';
      }

      await db.query(`
        INSERT INTO templates (id, name, description, category, download_url, file_name, file_size, file_type, subscription_tiers, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        id,
        name,
        description || null,
        resolvedCategoryName,
        downloadUrl || null,
        fileName || null,
        fileSize || null,
        fileType || null,
        JSON.stringify(subscriptionTiers)
      ]);

      await db.query('DELETE FROM template_category_assignments WHERE template_id = ?', [id]);
      await db.query(
        `INSERT INTO template_category_assignments (template_id, category_id, type_id, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      , [id, resolvedCategoryId, resolvedTypeId ?? null]);

      res.status(201).json({
        success: true,
        data: {
          id,
          name,
          description: description || null,
          category: resolvedCategoryName,
          categoryId: resolvedCategoryId,
          typeId: resolvedTypeId,
          downloadUrl: downloadUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          fileType: fileType || null,
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
      const { name, description, category, categoryId, typeId, downloadUrl, fileName, fileSize, fileType, subscriptionTiers, isActive } = req.body as any;

      const db = await getConnection();

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      const hasCategoryId = Object.prototype.hasOwnProperty.call(req.body, 'categoryId');
      const hasTypeId = Object.prototype.hasOwnProperty.call(req.body, 'typeId');
      let assignmentCategoryId: string | null | undefined = undefined;
      let categoryValueForTemplate: string | null | undefined = undefined;
      let assignmentTypeId: string | null | undefined = undefined;

      if (hasCategoryId) {
        if (!categoryId) {
          assignmentCategoryId = DEFAULT_CATEGORY_ID;
          const defaultCategory = await db.query('SELECT name FROM template_categories WHERE id = ?', [DEFAULT_CATEGORY_ID]);
          categoryValueForTemplate = valueFromRow(defaultCategory.rows?.[0] ?? {}, 'name') ?? 'General';
        } else {
          const categoryResult = await db.query('SELECT id, name FROM template_categories WHERE id = ?', [categoryId]);
          if (!categoryResult.rows || categoryResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid categoryId provided' });
          }
          assignmentCategoryId = String(valueFromRow(categoryResult.rows[0], 'id'));
          categoryValueForTemplate = valueFromRow(categoryResult.rows[0], 'name');
        }
      } else if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
        if (typeof category === 'string' && category.trim()) {
          const normalized = category.trim();
          const slug = slugifyValue(normalized);
          const categoryResult = await db.query('SELECT id, name FROM template_categories WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?)', [normalized, slug]);
          if (categoryResult.rows && categoryResult.rows.length > 0) {
            assignmentCategoryId = String(valueFromRow(categoryResult.rows[0], 'id'));
            categoryValueForTemplate = valueFromRow(categoryResult.rows[0], 'name');
          } else {
            categoryValueForTemplate = normalized;
          }
        } else if (category === null) {
          assignmentCategoryId = DEFAULT_CATEGORY_ID;
          const defaultCategory = await db.query('SELECT name FROM template_categories WHERE id = ?', [DEFAULT_CATEGORY_ID]);
          categoryValueForTemplate = valueFromRow(defaultCategory.rows?.[0] ?? {}, 'name') ?? 'General';
        }
      }

      if (hasTypeId) {
        if (!typeId) {
          assignmentTypeId = null;
        } else {
          const typeResult = await db.query('SELECT id, category_id FROM template_types WHERE id = ? AND is_active = 1', [typeId]);
          if (!typeResult.rows || typeResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid template type provided' });
          }
          assignmentTypeId = String(valueFromRow(typeResult.rows[0], 'id'));
          const typeCategoryId = String(valueFromRow(typeResult.rows[0], 'category_id', 'categoryId'));
          if (assignmentCategoryId && String(assignmentCategoryId) !== typeCategoryId) {
            return res.status(400).json({ error: 'Template type does not belong to selected category' });
          }
          if (!assignmentCategoryId) {
            assignmentCategoryId = typeCategoryId;
            const categoryResult = await db.query('SELECT name FROM template_categories WHERE id = ?', [typeCategoryId]);
            categoryValueForTemplate = valueFromRow(categoryResult.rows?.[0] ?? {}, 'name') ?? categoryValueForTemplate;
          }
        }
      }

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (categoryValueForTemplate !== undefined) {
        updates.push('category = ?');
        values.push(categoryValueForTemplate);
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

      if (assignmentCategoryId !== undefined || assignmentTypeId !== undefined) {
        const currentAssignment = await db.query('SELECT template_id FROM template_category_assignments WHERE template_id = ?', [id]);
        if (currentAssignment.rows && currentAssignment.rows.length > 0) {
          await db.query(
            'UPDATE template_category_assignments SET category_id = ?, type_id = ?, updated_at = CURRENT_TIMESTAMP WHERE template_id = ?',
            [assignmentCategoryId ?? DEFAULT_CATEGORY_ID, assignmentTypeId ?? null, id]
          );
        } else {
          await db.query(
            `INSERT INTO template_category_assignments (template_id, category_id, type_id, created_at, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          , [id, assignmentCategoryId ?? DEFAULT_CATEGORY_ID, assignmentTypeId ?? null]);
        }
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

      await db.query('DELETE FROM template_category_assignments WHERE template_id = ?', [id]);

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
      
      const categoryResult = await db.query(
        'SELECT id, name, slug, is_active FROM template_categories ORDER BY name'
      );

      const categories = (categoryResult.rows || []).map((row: any) => ({
        id: valueFromRow(row, 'id'),
        name: valueFromRow(row, 'name'),
        slug: valueFromRow(row, 'slug'),
        isActive: Boolean(valueFromRow(row, 'is_active', 'isActive', 'IS_ACTIVE') ?? 1),
      }));

      const knownSlugs = new Set(categories.map((cat: { slug?: string | null }) => String(cat.slug || '').toLowerCase()));

      const legacyCategories = await db.query(
        `SELECT DISTINCT category FROM templates WHERE category IS NOT NULL AND category <> '' ORDER BY category`
      );

      for (const row of legacyCategories.rows || []) {
        const legacyName = row.category ?? row.CATEGORY ?? null;
        if (!legacyName) continue;
        const legacySlug = slugifyValue(String(legacyName));
        if (!knownSlugs.has(legacySlug.toLowerCase())) {
          categories.push({ id: null, name: legacyName, slug: legacySlug, isActive: true });
          knownSlugs.add(legacySlug.toLowerCase());
        }
      }

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
