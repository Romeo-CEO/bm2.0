import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getConnection } from '../config/database';
import { DEFAULT_CATEGORY_ID } from '../services/schemaService';
import { logAuditEvent } from '../services/auditService';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);

export class TemplateCatalogAdminController {
  async listCategories(req: Request, res: Response): Promise<void> {
    const connection = await getConnection();
    try {
      const categoriesResult = await connection.query(
        `SELECT c.id, c.name, c.slug, c.description, c.is_active as isActive,
                c.created_at as createdAt, c.updated_at as updatedAt
         FROM template_categories c
         ORDER BY c.name`
      );

      const categoryIds = (categoriesResult.rows || []).map((row: any) => row.id);
      let typesResult = { rows: [] as any[] };
      if (categoryIds.length > 0) {
        const placeholders = categoryIds.map(() => '?').join(', ');
        typesResult = await connection.query(
          `SELECT t.id, t.category_id as categoryId, t.name, t.slug, t.description,
                  t.is_active as isActive, t.created_at as createdAt, t.updated_at as updatedAt
           FROM template_types t
           WHERE t.category_id IN (${placeholders})
           ORDER BY t.name`,
          categoryIds
        );
      }

      const typesByCategory = new Map<string, any[]>();
      for (const type of typesResult.rows || []) {
        if (!typesByCategory.has(type.categoryId)) {
          typesByCategory.set(type.categoryId, []);
        }
        typesByCategory.get(type.categoryId)!.push(type);
      }

      const data = (categoriesResult.rows || []).map((category: any) => ({
        ...category,
        types: typesByCategory.get(category.id) || [],
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('Failed to list template categories', error);
      res.status(500).json({ success: false, error: 'Failed to list template categories' });
    } finally {
      connection.release?.();
    }
  }

  async createCategory(req: Request, res: Response): Promise<void> {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Category name is required' });
      return;
    }

    const normalizedName = name.trim();
    const slug = slugify(normalizedName);
    const connection = await getConnection();

    try {
      const existing = await connection.query(
        'SELECT id FROM template_categories WHERE LOWER(name) = LOWER(?) OR slug = ?',
        [normalizedName, slug]
      );

      if (existing.rows && existing.rows.length > 0) {
        res.status(409).json({ success: false, error: 'Category with the same name already exists' });
        return;
      }

      const id = uuidv4();
      await connection.query(
        `INSERT INTO template_categories (id, name, slug, description, is_active)
         VALUES (?, ?, ?, ?, 1)`
      , [id, normalizedName, slug, description || null]);

      await logAuditEvent({
        eventType: 'ADMIN_TEMPLATE_CATEGORY_CREATED',
        success: true,
        userId: req.user?.id,
        metadata: { id, name: normalizedName },
      });

      res.status(201).json({
        success: true,
        data: { id, name: normalizedName, slug, description: description || null, isActive: true },
      });
    } catch (error) {
      console.error('Failed to create template category', error);
      res.status(500).json({ success: false, error: 'Failed to create template category' });
    } finally {
      connection.release?.();
    }
  }

  async updateCategory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, description, isActive } = req.body as {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    };

    if (!id) {
      res.status(400).json({ success: false, error: 'Category id is required' });
      return;
    }

    const connection = await getConnection();

    try {
      const categoryResult = await connection.query(
        'SELECT id, name, slug FROM template_categories WHERE id = ?',
        [id]
      );

      if (!categoryResult.rows || categoryResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (typeof name === 'string' && name.trim()) {
        const normalizedName = name.trim();
        const newSlug = slugify(normalizedName);

        const existing = await connection.query(
          'SELECT id FROM template_categories WHERE (LOWER(name) = LOWER(?) OR slug = ?) AND id <> ?',
          [normalizedName, newSlug, id]
        );

        if (existing.rows && existing.rows.length > 0) {
          res.status(409).json({ success: false, error: 'Another category with the same name exists' });
          return;
        }

        updates.push('name = ?', 'slug = ?');
        params.push(normalizedName, newSlug);
      }

      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description ?? null);
      }

      if (isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(isActive ? 1 : 0);
      }

      if (updates.length === 0) {
        res.status(400).json({ success: false, error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');

      params.push(id);
      await connection.query(
        `UPDATE template_categories SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      res.json({ success: true, message: 'Category updated successfully' });
    } catch (error) {
      console.error('Failed to update template category', error);
      res.status(500).json({ success: false, error: 'Failed to update template category' });
    } finally {
      connection.release?.();
    }
  }

  async deleteCategory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Category id is required' });
      return;
    }

    if (id === DEFAULT_CATEGORY_ID) {
      res.status(400).json({ success: false, error: 'Default category cannot be deleted' });
      return;
    }

    const connection = await getConnection();

    try {
      const categoryResult = await connection.query(
        'SELECT id FROM template_categories WHERE id = ?',
        [id]
      );

      if (!categoryResult.rows || categoryResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      const defaultCategoryLookup = await connection.query(
        'SELECT name FROM template_categories WHERE id = ?',
        [DEFAULT_CATEGORY_ID]
      );
      const defaultCategoryName = defaultCategoryLookup.rows?.[0]?.name ?? defaultCategoryLookup.rows?.[0]?.NAME ?? 'General';

      await connection.query(
        'UPDATE template_category_assignments SET category_id = ?, type_id = NULL WHERE category_id = ?',
        [DEFAULT_CATEGORY_ID, id]
      );

      await connection.query(
        'UPDATE templates SET category = ? WHERE id IN (SELECT template_id FROM template_category_assignments WHERE category_id = ?)',
        [defaultCategoryName, DEFAULT_CATEGORY_ID]
      );

      await connection.query(
        'UPDATE template_categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      await logAuditEvent({
        eventType: 'ADMIN_TEMPLATE_CATEGORY_DELETED',
        success: true,
        userId: req.user?.id,
        metadata: { id },
      });

      res.json({ success: true, message: 'Category archived and templates reassigned to default' });
    } catch (error) {
      console.error('Failed to delete template category', error);
      res.status(500).json({ success: false, error: 'Failed to delete template category' });
    } finally {
      connection.release?.();
    }
  }

  async createType(req: Request, res: Response): Promise<void> {
    const { categoryId, name, description } = req.body as {
      categoryId?: string;
      name?: string;
      description?: string;
    };

    if (!categoryId) {
      res.status(400).json({ success: false, error: 'categoryId is required' });
      return;
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Type name is required' });
      return;
    }

    const connection = await getConnection();

    try {
      const category = await connection.query('SELECT id FROM template_categories WHERE id = ?', [categoryId]);
      if (!category.rows || category.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      const normalizedName = name.trim();
      const slug = slugify(normalizedName);

      const existing = await connection.query(
        'SELECT id FROM template_types WHERE category_id = ? AND (LOWER(name) = LOWER(?) OR slug = ?)',
        [categoryId, normalizedName, slug]
      );

      if (existing.rows && existing.rows.length > 0) {
        res.status(409).json({ success: false, error: 'Type already exists for this category' });
        return;
      }

      const id = uuidv4();
      await connection.query(
        `INSERT INTO template_types (id, category_id, name, slug, description, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`
      , [id, categoryId, normalizedName, slug, description || null]);

      res.status(201).json({
        success: true,
        data: { id, categoryId, name: normalizedName, slug, description: description || null, isActive: true },
      });
    } catch (error) {
      console.error('Failed to create template type', error);
      res.status(500).json({ success: false, error: 'Failed to create template type' });
    } finally {
      connection.release?.();
    }
  }

  async updateType(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, description, isActive } = req.body as {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    };

    if (!id) {
      res.status(400).json({ success: false, error: 'Type id is required' });
      return;
    }

    const connection = await getConnection();

    try {
      const typeResult = await connection.query(
        'SELECT id, category_id FROM template_types WHERE id = ?',
        [id]
      );

      if (!typeResult.rows || typeResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Type not found' });
        return;
      }

      const categoryId = typeResult.rows[0].category_id || typeResult.rows[0].categoryId;

      const updates: string[] = [];
      const params: any[] = [];

      if (typeof name === 'string' && name.trim()) {
        const normalizedName = name.trim();
        const slug = slugify(normalizedName);

        const existing = await connection.query(
          'SELECT id FROM template_types WHERE category_id = ? AND (LOWER(name) = LOWER(?) OR slug = ?) AND id <> ?',
          [categoryId, normalizedName, slug, id]
        );

        if (existing.rows && existing.rows.length > 0) {
          res.status(409).json({ success: false, error: 'Another type with the same name exists for this category' });
          return;
        }

        updates.push('name = ?', 'slug = ?');
        params.push(normalizedName, slug);
      }

      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description ?? null);
      }

      if (isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(isActive ? 1 : 0);
      }

      if (updates.length === 0) {
        res.status(400).json({ success: false, error: 'No updates provided' });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      await connection.query(
        `UPDATE template_types SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      res.json({ success: true, message: 'Type updated successfully' });
    } catch (error) {
      console.error('Failed to update template type', error);
      res.status(500).json({ success: false, error: 'Failed to update template type' });
    } finally {
      connection.release?.();
    }
  }

  async deleteType(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Type id is required' });
      return;
    }

    const connection = await getConnection();
    try {
      const typeResult = await connection.query(
        'SELECT id FROM template_types WHERE id = ?',
        [id]
      );

      if (!typeResult.rows || typeResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Type not found' });
        return;
      }

      await connection.query(
        'UPDATE template_category_assignments SET type_id = NULL WHERE type_id = ?',
        [id]
      );

      await connection.query(
        'UPDATE template_types SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      res.json({ success: true, message: 'Type archived successfully' });
    } catch (error) {
      console.error('Failed to delete template type', error);
      res.status(500).json({ success: false, error: 'Failed to delete template type' });
    } finally {
      connection.release?.();
    }
  }

  async assignTemplate(req: Request, res: Response): Promise<void> {
    const { templateId } = req.params;
    const { categoryId, typeId } = req.body as { categoryId?: string; typeId?: string | null };

    if (!templateId) {
      res.status(400).json({ success: false, error: 'templateId is required' });
      return;
    }
    if (!categoryId) {
      res.status(400).json({ success: false, error: 'categoryId is required' });
      return;
    }

    const connection = await getConnection();

    try {
      const templateResult = await connection.query('SELECT id FROM templates WHERE id = ?', [templateId]);
      if (!templateResult.rows || templateResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Template not found' });
        return;
      }

      const categoryResult = await connection.query('SELECT name FROM template_categories WHERE id = ? AND is_active = 1', [categoryId]);
      if (!categoryResult.rows || categoryResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Category not found or inactive' });
        return;
      }

      const categoryName = categoryResult.rows?.[0]?.name ?? categoryResult.rows?.[0]?.NAME;

      let typeSlug: string | null = null;
      if (typeId) {
        const typeResult = await connection.query(
          'SELECT id, slug FROM template_types WHERE id = ? AND is_active = 1',
          [typeId]
        );
        if (!typeResult.rows || typeResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Type not found or inactive' });
          return;
        }
        typeSlug = typeResult.rows[0].slug ?? typeResult.rows[0].SLUG ?? null;
      }

      const existingAssignment = await connection.query(
        'SELECT template_id FROM template_category_assignments WHERE template_id = ?',
        [templateId]
      );

      if (existingAssignment.rows && existingAssignment.rows.length > 0) {
        await connection.query(
          'UPDATE template_category_assignments SET category_id = ?, type_id = ?, updated_at = CURRENT_TIMESTAMP WHERE template_id = ?',
          [categoryId, typeId ?? null, templateId]
        );
      } else {
        await connection.query(
          `INSERT INTO template_category_assignments (template_id, category_id, type_id, created_at, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        , [templateId, categoryId, typeId ?? null]);
      }

      if (categoryName) {
        await connection.query(
          'UPDATE templates SET category = ? WHERE id = ?',
          [categoryName, templateId]
        );
      }

      res.json({
        success: true,
        data: {
          templateId,
          categoryId,
          typeId: typeId ?? null,
          typeSlug,
        },
      });
    } catch (error) {
      console.error('Failed to assign template to category/type', error);
      res.status(500).json({ success: false, error: 'Failed to assign template to category/type' });
    } finally {
      connection.release?.();
    }
  }
}

export const templateCatalogAdminController = new TemplateCatalogAdminController();

