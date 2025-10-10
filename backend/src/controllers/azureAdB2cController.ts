import { Request, Response } from 'express';
import { AzureADB2CService } from '../services/azureAdB2cService';
import { AUTH_TYPE } from '../config/azure-ad-b2c';

export class AzureADB2CController {
  private azureAdB2cService: AzureADB2CService;

  constructor() {
    this.azureAdB2cService = new AzureADB2CService();
  }

  /**
   * Initiate Azure AD B2C login
   */
  async initiateLogin(req: Request, res: Response) {
    try {
      if (AUTH_TYPE !== 'azure_ad_b2c') {
        return res.status(400).json({ 
          error: 'Azure AD B2C authentication is not enabled' 
        });
      }

      const state = (req.query.state as string) || 'default-state';
      const authUrl = await this.azureAdB2cService.getAuthUrl(state);

      res.json({
        success: true,
        authUrl,
        message: 'Redirect to this URL to start authentication'
      });
      return;

    } catch (error) {
      console.error('Error initiating login:', error);
      res.status(500).json({ 
        error: 'Failed to initiate authentication' 
      });
      return;
    }
  }

  /**
   * Handle Azure AD B2C callback
   */
  async handleCallback(req: Request, res: Response) {
    try {
      const { code, state, error, error_description } = req.query as any;

      if (error) {
        console.error('Azure AD B2C error:', error, error_description);
        return res.status(400).json({
          error: 'Authentication failed',
          details: error_description
        });
      }

      if (!code) {
        return res.status(400).json({
          error: 'Authorization code is required'
        });
      }

      const result = await this.azureAdB2cService.handleCallback(
        code as string, 
        state as string
      );

      if (!result.success) {
        return res.status(401).json({
          error: result.error || 'Authentication failed'
        });
      }

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${result.token}&success=true`;

      res.redirect(redirectUrl);
      return;

    } catch (error) {
      console.error('Error handling callback:', error);
      res.status(500).json({ 
        error: 'Failed to process authentication callback' 
      });
      return;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(req: Request, res: Response) {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
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
          authProvider: 'azure_ad_b2c'
        }
      });
      return;

    } catch (error) {
      console.error('Error getting current user:', error);
      res.status(500).json({ 
        error: 'Failed to get user information' 
      });
      return;
    }
  }

  /**
   * Logout
   */
  async logout(req: Request, res: Response) {
    try {
      const logoutUrl = this.azureAdB2cService.getLogoutUrl();
      
      res.json({
        success: true,
        logoutUrl,
        message: 'Redirect to this URL to complete logout'
      });
      return;

    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ 
        error: 'Failed to initiate logout' 
      });
      return;
    }
  }

  /**
   * Get authentication status
   */
  async getAuthStatus(req: Request, res: Response) {
    try {
      res.json({
        success: true,
        authType: AUTH_TYPE,
        isAzureADB2C: AUTH_TYPE === 'azure_ad_b2c',
        features: {
          socialLogin: AUTH_TYPE === 'azure_ad_b2c',
          mfa: AUTH_TYPE === 'azure_ad_b2c',
          passwordReset: AUTH_TYPE === 'azure_ad_b2c',
          selfService: AUTH_TYPE === 'azure_ad_b2c'
        }
      });
      return;

    } catch (error) {
      console.error('Error getting auth status:', error);
      res.status(500).json({ 
        error: 'Failed to get authentication status' 
      });
      return;
    }
  }
}
