import { Router } from 'express';
import { ssoController } from '../controllers/ssoController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * SSO Routes - Cross-domain authentication and application management
 */

// Health check - No authentication required for monitoring
router.get('/health', ssoController.healthCheck);

// Authentication Routes
router.post('/authenticate', authenticateToken, ssoController.authenticateMasterToken);
router.post('/token/validate', ssoController.validateDomainToken);
router.post('/validate/:domain', authenticateToken, ssoController.generateDomainToken);

// User Context Routes
router.get('/user/context', ssoController.getUserContext);

// Application Management Routes (Admin only)
router.post('/applications', authenticateToken, ssoController.registerApplication);
router.get('/applications', ssoController.getApplications);

// Admin-only routes
router.get('/metrics', authenticateToken, ssoController.getMetrics);

export default router;
