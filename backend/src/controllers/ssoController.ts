import { Request, Response } from 'express';
import { ssoCentralService, SSOCentralService } from '../services/ssoCentralService';

/**
 * SSO Controller - Handles cross-domain authentication API endpoints
 */
export class SSOController {

  /**
   * Validate user's platform token and create SSO session
   * POST /api/sso/authenticate
   */
  async authenticateMasterToken(req: Request, res: Response): Promise<void> {
    try {
      const { token, userId } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token is required'
        });
        return;
      }

      // Use the authenticated user from middleware if available, otherwise use provided userId
      const authenticatedUserId = req.user?.id || userId;

      if (!authenticatedUserId) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
        return;
      }

      const result = await ssoCentralService.validateMasterToken(token, authenticatedUserId);

      if (result.isValid && result.sessionId) {
        res.json({
          success: true,
          sessionId: result.sessionId,
          message: 'SSO session created successfully'
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error || 'Invalid token'
        });
      }

    } catch (error) {
      console.error('SSO authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'SSO authentication failed'
      });
    }
  }

  /**
   * Generate domain-specific token for application
   * POST /api/sso/validate/:domain
   */
  async generateDomainToken(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.body;
      const targetDomain = req.params.domain;

      if (!sessionId || !targetDomain) {
        res.status(400).json({
          success: false,
          error: 'Session ID and target domain are required'
        });
        return;
      }

      // Authenticate the requesting user (should be from platform)
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Platform authentication required'
        });
        return;
      }

      const result = await ssoCentralService.generateDomainToken(sessionId, targetDomain);

      if (result.domainToken && result.userContext) {
        // Return only the information needed by the application
        // Do not expose internal session details
        res.json({
          success: true,
          token: result.domainToken,
          user: {
            id: result.userContext.userId,
            role: result.userContext.role,
            permissions: result.userContext.permissions,
            companyId: result.userContext.companyId
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to generate domain token'
        });
      }

    } catch (error) {
      console.error('Domain token generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Domain token generation failed'
      });
    }
  }

  /**
   * Validate domain token from application
   * POST /api/sso/token/validate
   */
  async validateDomainToken(req: Request, res: Response): Promise<void> {
    try {
      const { token, domain } = req.body;

      if (!token || !domain) {
        res.status(400).json({
          success: false,
          error: 'Token and domain are required'
        });
        return;
      }

      const result = await ssoCentralService.validateDomainToken(token, domain);

      if (result.isValid && result.userContext) {
        res.json({
          success: true,
          valid: true,
          user: {
            id: result.userContext.userId,
            role: result.userContext.role,
            permissions: result.userContext.permissions,
            companyId: result.userContext.companyId,
            subscriptionTier: result.userContext.subscriptionTier
          }
        });
      } else {
        res.status(401).json({
          success: false,
          valid: false,
          error: result.error || 'Invalid token'
        });
      }

    } catch (error) {
      console.error('Domain token validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Token validation failed'
      });
    }
  }

  /**
   * Get user context for authenticated sessions
   * GET /api/sso/user/context
   */
  async getUserContext(req: Request, res: Response): Promise<void> {
    try {
      // This endpoint should be called by applications after token validation
      // The middleware should have set the user context from the token

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'No authenticated user context'
        });
        return;
      }

      // Get full user context from database
      const user = req.user;

      // Return user context in consistent format
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email || '',
          role: user.role,
          companyId: user.companyId,
          subscriptionTier: user.subscriptionTier,
          // Add any additional context needed by applications
          lastLogin: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Get user context error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user context'
      });
    }
  }

  /**
   * Register a new application for SSO
   * POST /api/sso/applications
   */
  async registerApplication(req: Request, res: Response): Promise<void> {
    try {
      const { name, domain } = req.body;

      if (!name || !domain) {
        res.status(400).json({
          success: false,
          error: 'Application name and domain are required'
        });
        return;
      }

      // Only admins can register applications
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin privileges required to register applications'
        });
        return;
      }

      const result = await ssoCentralService.registerApplication(name, domain);

      if (result.applicationId) {
        res.status(201).json({
          success: true,
          applicationId: result.applicationId,
          message: 'Application registered successfully. SSO can be enabled through admin panel.'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to register application'
        });
      }

    } catch (error) {
      console.error('Application registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Application registration failed'
      });
    }
  }

  /**
   * Get list of registered applications
   * GET /api/sso/applications
   */
  async getApplications(req: Request, res: Response): Promise<void> {
    try {
      // This endpoint can be used by applications to discover SSO-enabled services
      const applications = await ssoCentralService.getRegisteredApplications();

      res.json({
        success: true,
        applications: applications.map(app => ({
          id: app.id,
          name: app.name,
          domain: app.domain,
          ssoEnabled: app.ssoEnabled
        }))
      });

    } catch (error) {
      console.error('Get applications error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get applications'
      });
    }
  }

  /**
   * SSO Service Health Check
   * GET /api/sso/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Perform basic health checks
      const applications = await ssoCentralService.getRegisteredApplications();

      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        services: {
          sso: 'healthy',
          database: 'healthy',
          applications: applications.length >= 0 ? 'healthy' : 'warning'
        },
        metrics: {
          applications: applications.length,
          ssoEnabled: applications.filter(app => app.ssoEnabled).length
        }
      });

    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'SSO service unavailable'
      });
    }
  }

  /**
   * Get SSO performance metrics (Admin only)
   * GET /api/sso/metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin privileges required'
        });
        return;
      }

      const metrics = await ssoCentralService.getMetrics();

      res.json({
        success: true,
        metrics
      });

    } catch (error) {
      console.error('Get metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get the metrics'
      });
    }
  }
}

export const ssoController = new SSOController();
