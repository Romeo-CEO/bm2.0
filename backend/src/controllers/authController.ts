import { Request, Response } from 'express';

export class AuthController {
  /**
   * Password-based login is disabled in favor of Azure AD B2C.
   */
  async login(req: Request, res: Response): Promise<void> {
    res.status(400).json({
      error: 'Local username/password login is disabled. Start Microsoft sign-in via /api/azure-ad-b2c/login.'
    });
  }

  /**
   * Local registration flow is disabled; onboarding happens through Azure AD B2C.
   */
  async register(req: Request, res: Response): Promise<void> {
    res.status(400).json({
      error: 'Self-service registration is handled by Microsoft sign-in. Start the flow via /api/azure-ad-b2c/login.'
    });
  }

  /**
   * Get current user endpoint
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyId: user.companyId,
          subscriptionTier: user.subscriptionTier,
          companyAdmin: Boolean(user.companyAdmin),
          subscriptionExpiry: user.subscriptionExpiry ?? null
        }
      });

    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }
}
