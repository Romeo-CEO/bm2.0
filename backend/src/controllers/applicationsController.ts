import { Request, Response } from 'express';
import { getConnection } from '../config/database';
import { randomUUID } from 'crypto';

export class ApplicationsController {
  /**
   * Deploy application to marketplace catalog
   */
  async deployToMarketplace(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const db = await getConnection();

      // Get application details
      const appResult = await db.query(
        'SELECT * FROM applications WHERE id = ? AND is_active = 1',
        [id]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const app = appResult.rows[0];

      // Check if already in marketplace catalog
      const marketplaceResult = await db.query(
        'SELECT COUNT(*) as count FROM marketplace_applications WHERE id = ?',
        [id]
      );

      const isInMarketplace = marketplaceResult.rows[0].count > 0;

      if (isInMarketplace) {
        return res.status(400).json({ error: 'Application already deployed to marketplace' });
      }

      // Add to marketplace catalog
      await db.query(`
        INSERT INTO marketplace_applications (
          id, name, slug, short_description, category, subcategory,
          developer, subscription_tiers, starting_price, pricing_model,
          trial_available, icon_url, screenshots, is_featured, is_new,
          rating, total_reviews, order_priority, required_subscription_tier,
          target_platforms, app_url, webhook_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        app.id,
        app.name,
        app.subdomain || app.name.toLowerCase().replace(/\s+/g, '-'),
        app.description || `${app.name} business application`,
        app.category || 'General',
        app.category || 'General',
        app.developer || 'Business Manager',
        app.subscription_tiers || JSON.stringify(['trial']),
        0.00, // starting_price
        'subscription', // pricing_model
        app.subscription_tiers?.includes('trial') || false, // trial_available
        app.icon_url || null,
        app.screenshots ? JSON.stringify(app.screenshots) : null,
        false, // is_featured
        true, // is_new
        5.0, // rating
        0, // total_reviews
        100, // order_priority
        app.subscription_tiers?.includes('trial') ? 'trial' : 'diy',
        JSON.stringify(['web']), // target_platforms
        app.app_url || `https://${app.subdomain || 'app'}.businessmanager.com`,
        null // webhook_url
      ]);

      // Update application deployment status
      await db.query(
        'UPDATE applications SET status = ?, deployed_at = GETDATE() WHERE id = ?',
        ['deployed', id]
      );

      res.json({
        success: true,
        message: 'Application deployed to marketplace successfully',
        deployment: {
          marketplaceId: id,
          status: 'deployed',
          url: app.app_url || `https://${app.subdomain || 'app'}.businessmanager.com`
        }
      });
      return;

    } catch (error) {
      console.error('Error deploying to marketplace:', error);
      res.status(500).json({ error: 'Failed to deploy application' });
      return;
    }
  }

  /**
   * Get application deployment checklist
   */
  async getDeploymentChecklist(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const db = await getConnection();

      // Get application status
      const appResult = await db.query(
        'SELECT * FROM applications WHERE id = ?',
        [id]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const app = appResult.rows[0];

      // Check marketplace deployment status
      const marketplaceResult = await db.query(
        'SELECT COUNT(*) as count FROM marketplace_applications WHERE id = ?',
        [id]
      );

      const deploymentStatus = {
        sslCertificate: app.subdomain ? 'configured' : 'pending',
        subdomainConfigured: app.subdomain ? 'configured' : 'pending',
        marketplaceListed: marketplaceResult.rows[0].count > 0 ? 'configured' : 'pending',
        launcherConfigured: app.app_url ? 'configured' : 'pending',
        metadataComplete: app.description && app.icon_url ? 'configured' : 'pending'
      };

      const checklist = [
        {
          item: 'SSL Certificate Provisioning',
          status: deploymentStatus.sslCertificate,
          description: 'SSL certificate for subdomain must be provisioned',
          automated: true,
          manualSteps: app.subdomain ? [] : ['Configure SSL certificate in Azure Key Vault', 'Add DNS CNAME record for subdomain'],
          docs: 'https://docs.microsoft.com/en-us/azure/key-vault/certificates/tutorial-import-certificate'
        },
        {
          item: 'Subdomain Configuration',
          status: deploymentStatus.subdomainConfigured,
          description: 'Subdomain DNS records configured',
          automated: true,
          manualSteps: app.subdomain ? [] : ['Create CNAME record pointing to main domain', 'Configure Azure App Service custom domain'],
          docs: 'https://docs.microsoft.com/en-us/azure/app-service/app-service-web-tutorial-custom-domain'
        },
        {
          item: 'Marketplace Catalog Listing',
          status: deploymentStatus.marketplaceListed,
          description: 'Application listed in marketplace catalog',
          automated: true,
          manualSteps: ['Application must be approved for marketplace listing'],
          docs: 'Internal marketplace catalog documentation'
        },
        {
          item: 'Application Launcher',
          status: deploymentStatus.launcherConfigured,
          description: 'Application launcher URL configured',
          automated: false,
          manualSteps: app.app_url ? [] : ['Configure application URL in launcher system', 'Test launcher redirection'],
          docs: 'Internal application launcher documentation'
        },
        {
          item: 'Metadata Completeness',
          status: deploymentStatus.metadataComplete,
          description: 'Application metadata (description, icon, screenshots) complete',
          automated: false,
          manualSteps: ['Add application description', 'Upload application icon', 'Add screenshots'],
          docs: 'Internal application metadata guidelines'
        }
      ];

      const completeCount = checklist.filter(item => item.status === 'configured').length;
      const isDeploymentReady = completeCount === checklist.length;

      res.json({
        success: true,
        checklist,
        deploymentStatus: {
          totalItems: checklist.length,
          completedItems: completeCount,
          pendingItems: checklist.length - completeCount,
          deploymentReady: isDeploymentReady
        },
        nextSteps: isDeploymentReady
          ? ['Application ready for deployment']
          : ['Complete all pending checklist items', 'Deploy application infrastructure', 'Test deployment configuration']
      });
      return;

    } catch (error) {
      console.error('Error getting deployment checklist:', error);
      res.status(500).json({ error: 'Failed to get deployment checklist' });
      return;
    }
  }
  /**
   * Get applications with pagination and filtering
   */
  async getApplications(req: Request, res: Response) {
    try {
      const { type = 'application', page = 1, pageSize = 20, search = '', category = '' } = req.query as any;
      
      const db = await getConnection();
      
      // Build WHERE clause
      const whereConditions = ['type = ?', 'is_active = 1'];
      const params: unknown[] = [type];

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
        `SELECT COUNT(*) as total FROM applications WHERE ${whereClause}`,
        params
      );
      const total = Number((countResult.rows[0] as any).total ?? 0);

      // Get paginated results
      const offset = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);
      
      const result = await db.query(
        `SELECT * FROM applications WHERE ${whereClause} ORDER BY created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
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
      console.error('Error getting applications:', error);
      res.status(500).json({ error: 'Failed to get applications' });
      return;
    }
  }

  /**
   * Public: Get applications with pagination (shape expected by frontend)
   * - Accepts q (search), category, type, sortBy, sortDir, page, pageSize
   * - Returns { items, page, pageSize, total, totalPages }
   */
  async getPublicApplicationsPaged(req: Request, res: Response) {
    try {
      const {
        type = 'application',
        page = 1,
        pageSize = 20,
        q = '',
        category = '',
        sortBy = 'date',
        sortDir = 'desc'
      } = req.query as any;

      const db = await getConnection();

      const whereConditions = ['type = ?', 'is_active = 1'];
      const params: unknown[] = [type];

      if (q) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
      }
      if (category) {
        whereConditions.push('category = ?');
        params.push(category);
      }
      const whereClause = whereConditions.join(' AND ');

      // Sorting
      let orderBy = 'created_at';
      if ((sortBy as string) === 'name') orderBy = 'name';
      const direction = (String(sortDir).toLowerCase() === 'asc') ? 'ASC' : 'DESC';

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM applications WHERE ${whereClause}`,
        params
      );
      const total = Number((countResult.rows[0] as any).total ?? 0);

      const offset = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);

      const result = await db.query(
        `SELECT id, name, description, category, type, subscription_tiers as subscriptionTiers, icon_url as iconUrl, app_url as appUrl
         FROM applications
         WHERE ${whereClause}
         ORDER BY ${orderBy} ${direction} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
         [...params, offset, limit]
         );

      // Normalize subscriptionTiers field
      const items = (result.rows as any[]).map(r => ({
        ...r,
        subscriptionTiers: (() => {
          try { return Array.isArray(r.subscriptionTiers) ? r.subscriptionTiers : JSON.parse(r.subscriptionTiers || '[]'); } catch { return []; }
        })()
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
      console.error('Error getting public applications:', error);
      res.status(500).json({ error: 'Failed to get public applications' });
      return;
    }
  }

  /**
   * Get single application by ID
   */
  async getApplication(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const db = await getConnection();
      
      const result = await db.query(
        'SELECT * FROM applications WHERE id = ? AND is_active = 1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
      return;

    } catch (error) {
      console.error('Error getting application:', error);
      res.status(500).json({ error: 'Failed to get application' });
      return;
    }
  }

  /**
   * Create new application (admin only)
   */
  async createApplication(req: Request, res: Response) {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { 
        name, 
        description, 
        category, 
        type, 
        subdomain, 
        appUrl, 
        url, 
        iconUrl, 
        screenshots, 
        subscriptionTiers,
        developer,
        version,
        status
      } = req.body;

      if (!name || !category || !type || !subscriptionTiers) {
        return res.status(400).json({ 
          error: 'Required fields: name, category, type, subscriptionTiers' 
        });
      }

      const db = await getConnection();
      const applicationId = randomUUID();

      await db.query(`
        INSERT INTO applications (
          id, name, description, category, type, subdomain, app_url, icon_url, 
          screenshots, subscription_tiers, developer, version, status, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        applicationId,
        name,
        description || null,
        category,
        type,
        subdomain || name.toLowerCase().replace(/\s+/g, '-'),
        appUrl || url || null,
        iconUrl || null,
        screenshots ? JSON.stringify(screenshots) : null,
        JSON.stringify(subscriptionTiers),
        developer || null,
        version || '1.0.0',
        status || 'active'
      ]);

      res.status(201).json({
        success: true,
        data: {
          id: applicationId,
          name,
          description,
          category,
          type,
          subdomain,
          appUrl,
          iconUrl,
          screenshots,
          subscriptionTiers,
          developer,
          version,
          status,
          isActive: true
        }
      });
      return;

    } catch (error) {
      console.error('Error creating application:', error);
      res.status(500).json({ error: 'Failed to create application' });
      return;
    }
  }

  /**
   * Update application (admin only)
   */
  async updateApplication(req: Request, res: Response) {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { 
        name, 
        description, 
        category, 
        type, 
        subdomain, 
        appUrl, 
        url,
        iconUrl, 
        screenshots, 
        subscriptionTiers, 
        developer,
        version,
        status,
        isActive 
      } = req.body;

      const db = await getConnection();
      
      // Build update query dynamically
      const updates: string[] = [];
      const values: unknown[] = [];

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
      if (type !== undefined) {
        updates.push('type = ?');
        values.push(type);
      }
      if (subdomain !== undefined) {
        updates.push('subdomain = ?');
        values.push(subdomain);
      }
      if (appUrl !== undefined || url !== undefined) {
        updates.push('app_url = ?');
        values.push((appUrl ?? url) as string);
      }
      if (iconUrl !== undefined) {
        updates.push('icon_url = ?');
        values.push(iconUrl);
      }
      if (screenshots !== undefined) {
        updates.push('screenshots = ?');
        values.push(screenshots ? JSON.stringify(screenshots) : null);
      }
      if (developer !== undefined) {
        updates.push('developer = ?');
        values.push(developer);
      }
      if (version !== undefined) {
        updates.push('version = ?');
        values.push(version);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
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
        UPDATE applications 
        SET ${updates.join(', ')}, updated_at = GETDATE()
        WHERE id = ?
      `, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json({
        success: true,
        message: 'Application updated successfully'
      });
      return;

    } catch (error) {
      console.error('Error updating application:', error);
      res.status(500).json({ error: 'Failed to update application' });
      return;
    }
  }

  /**
   * Delete application (admin only)
   */
  async deleteApplication(req: Request, res: Response) {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const db = await getConnection();
      
      const result = await db.query('DELETE FROM applications WHERE id = ?', [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json({
        success: true,
        message: 'Application deleted successfully'
      });
      return;

    } catch (error) {
      console.error('Error deleting application:', error);
      res.status(500).json({ error: 'Failed to delete application' });
      return;
    }
  }

  /**
   * Get application launch URL (redirects to external app)
   */
  async launchApplication(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const db = await getConnection();
      
      const result = await db.query(
      'SELECT subdomain, app_url, status, subscription_tiers FROM applications WHERE id = ? AND is_active = 1',
      [id]
      );
      
      if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
      }
      
      const app = result.rows[0];
      
      if (app.status !== 'active') {
      return res.status(400).json({ error: 'Application is not available' });
      }

      // Subscription tier check (admins bypass)
      if (!req.user || req.user.role !== 'admin') {
        const userTier = req.user?.subscriptionTier || 'trial';
             let tiers: string[] = [];
        try {
        tiers = Array.isArray(app.subscription_tiers)
          ? app.subscription_tiers
        : JSON.parse(app.subscription_tiers || '[]');
      } catch {
      tiers = [];
      }
        const allowed = tiers.includes(userTier);
        if (!allowed) {
          return res.status(403).json({ error: 'Upgrade required', requiredTiers: tiers });
        }
      }
 
      // Construct the full URL for the external application
      const baseDomain = process.env.APP_DOMAIN || 'businessmanager.local';
      const fullUrl = app.app_url || `https://${app.subdomain}.${baseDomain}`;
 
      res.json({
        success: true,
        data: {
          launchUrl: fullUrl,
          subdomain: app.subdomain,
          message: 'Redirect to this URL to launch the application'
        }
      });
      return;

    } catch (error) {
      console.error('Error launching application:', error);
      res.status(500).json({ error: 'Failed to launch application' });
      return;
    }
  }

  /**
   * Get application categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      const db = await getConnection();
      
      const result = await db.query(
        'SELECT DISTINCT category FROM applications WHERE is_active = 1 ORDER BY category'
      );

      const categories = result.rows.map((row: any) => row.category);

      res.json({
        success: true,
        data: categories
      });
      return;

    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({ error: 'Failed to get categories' });
      return;
    }
  }
}
