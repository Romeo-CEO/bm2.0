import { Request, Response } from 'express';
import { getConnection } from '../config/database';

export class SubscriptionsController {
  /**
   * Get user's subscription status
   */
  async getSubscriptionStatus(req: Request, res: Response) {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const db = await getConnection();
      
      // Get user's current subscription details
      const result = await db.query(
        'SELECT subscription_tier, subscription_expiry, is_active FROM users WHERE id = ?',
        [user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = result.rows[0];
      const now = new Date();
      const expiryDate = userData.subscription_expiry ? new Date(userData.subscription_expiry) : null;
      
      let status = 'active';
      let daysRemaining = null;
      let daysOverdue = null;

      if (userData.subscription_tier === 'trial') {
        status = 'trial';
        if (expiryDate && expiryDate < now) {
          status = 'expired';
          daysOverdue = Math.ceil((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
        } else if (expiryDate) {
          daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
      } else if (expiryDate && expiryDate < now) {
        status = 'expired';
        daysOverdue = Math.ceil((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
      } else if (expiryDate) {
        daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      res.json({
        success: true,
        data: {
          tier: userData.subscription_tier,
          status,
          expiryDate: expiryDate?.toISOString() || null,
          daysRemaining,
          daysOverdue,
          isActive: userData.is_active === 1,
          features: this.getSubscriptionFeatures(userData.subscription_tier)
        }
      });
      return;

    } catch (error) {
      console.error('Error getting subscription status:', error);
      res.status(500).json({ error: 'Failed to get subscription status' });
      return;
    }
  }

  /**
   * Update user subscription (admin only)
   */
  async updateSubscription(req: Request, res: Response) {
    try {
      // Check if user is admin
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { userId, tier, expiryDate } = req.body;

      if (!userId || !tier) {
        return res.status(400).json({ error: 'Required fields: userId, tier' });
      }

      const validTiers = ['trial', 'diy', 'diy_accountant'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier. Must be one of: trial, diy, diy_accountant' });
      }

      const db = await getConnection();
      
      // Update user subscription
      const result = await db.query(
        'UPDATE users SET subscription_tier = ?, subscription_expiry = ?, updated_at = NOW() WHERE id = ?',
        [tier, expiryDate || null, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        message: 'Subscription updated successfully'
      });
      return;

    } catch (error) {
      console.error('Error updating subscription:', error);
      res.status(500).json({ error: 'Failed to update subscription' });
      return;
    }
  }

  /**
   * Get subscription plans
   */
  async getSubscriptionPlans(req: Request, res: Response) {
    try {
      const plans = [
        {
          id: 'trial',
          name: 'Free Trial',
          price: 0,
          duration: '14 days',
          features: [
            'Access to basic templates',
            'Limited file uploads',
            'Basic calculators',
            'Community support'
          ],
          limitations: [
            'Maximum 5 file uploads',
            'Basic templates only',
            'No priority support'
          ]
        },
        {
          id: 'diy',
          name: 'DIY Business',
          price: 29.99,
          duration: 'monthly',
          features: [
            'All business templates',
            'Unlimited file uploads',
            'All calculators',
            'Email support',
            'Business plan generator',
            'Invoice templates'
          ],
          limitations: [
            'No accounting integration',
            'Standard support only'
          ]
        },
        {
          id: 'diy_accountant',
          name: 'DIY + Accountant',
          price: 49.99,
          duration: 'monthly',
          features: [
            'Everything in DIY Business',
            'Accounting software integration',
            'Advanced financial reports',
            'Priority support',
            'Custom template creation',
            'API access'
          ],
          limitations: []
        }
      ];

      res.json({
        success: true,
        data: plans
      });
      return;

    } catch (error) {
      console.error('Error getting subscription plans:', error);
      res.status(500).json({ error: 'Failed to get subscription plans' });
      return;
    }
  }

  /**
   * Check feature access
   */
  async checkFeatureAccess(req: Request, res: Response) {
    try {
      const user = req.user;
      const { feature } = req.query;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!feature) {
        return res.status(400).json({ error: 'Feature parameter is required' });
      }

      const db = await getConnection();
      
      // Get user's subscription details
      const result = await db.query(
        'SELECT subscription_tier, subscription_expiry FROM users WHERE id = ?',
        [user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = result.rows[0];
      const now = new Date();
      const expiryDate = userData.subscription_expiry ? new Date(userData.subscription_expiry) : null;
      
      // Check if subscription is expired
      const isExpired = expiryDate && expiryDate < now;
      const isTrial = userData.subscription_tier === 'trial';
      
      // Check feature access based on tier
      const hasAccess = this.checkFeatureAccessForTier(feature as string, userData.subscription_tier, isExpired || false, isTrial);

      res.json({
        success: true,
        data: {
          feature,
          hasAccess,
          tier: userData.subscription_tier,
          isExpired,
          isTrial,
          message: hasAccess ? 'Access granted' : 'Upgrade required for this feature'
        }
      });
      return;

    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({ error: 'Failed to check feature access' });
      return;
    }
  }

  // Helper methods
  private getSubscriptionFeatures(tier: string): string[] {
    const features = {
      trial: [
        'Basic templates',
        'Limited file uploads',
        'Basic calculators'
      ],
      diy: [
        'All business templates',
        'Unlimited file uploads',
        'All calculators',
        'Email support',
        'Business plan generator'
      ],
      diy_accountant: [
        'Everything in DIY',
        'Accounting integration',
        'Advanced reports',
        'Priority support',
        'API access'
      ]
    };

    return features[tier as keyof typeof features] || features.trial;
  }

  private checkFeatureAccessForTier(feature: string, tier: string, isExpired: boolean, isTrial: boolean): boolean {
    // If subscription is expired and not trial, deny access
    if (isExpired && !isTrial) {
      return false;
    }

    // Feature access matrix
    const featureAccess = {
      'basic_templates': ['trial', 'diy', 'diy_accountant'],
      'premium_templates': ['diy', 'diy_accountant'],
      'file_upload': ['trial', 'diy', 'diy_accountant'],
      'unlimited_uploads': ['diy', 'diy_accountant'],
      'calculators': ['trial', 'diy', 'diy_accountant'],
      'business_plan_generator': ['diy', 'diy_accountant'],
      'accounting_integration': ['diy_accountant'],
      'api_access': ['diy_accountant'],
      'priority_support': ['diy_accountant']
    };

    const allowedTiers = featureAccess[feature as keyof typeof featureAccess];
    return allowedTiers ? allowedTiers.includes(tier) : false;
  }
}
