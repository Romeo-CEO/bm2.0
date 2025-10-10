import { Router } from 'express';
import { SubscriptionsController } from '../controllers/subscriptionsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';

const router = Router();
const subscriptionsController = new SubscriptionsController();

// Public routes
router.get('/plans', (req, res) => subscriptionsController.getSubscriptionPlans(req, res));

// Authenticated routes
router.get('/status', authenticateToken, enforceCompanyScoping, (req, res) => subscriptionsController.getSubscriptionStatus(req, res));
router.get('/check-access', authenticateToken, enforceCompanyScoping, (req, res) => subscriptionsController.checkFeatureAccess(req, res));

// Admin routes
router.put('/update', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => subscriptionsController.updateSubscription(req, res));

export default router;
