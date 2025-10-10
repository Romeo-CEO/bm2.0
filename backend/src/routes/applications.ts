import { Router } from 'express';
import { ApplicationsController } from '../controllers/applicationsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';

const router = Router();
const applicationsController = new ApplicationsController();

// Public routes (no authentication required for browsing)
// Important: define '/public' before '/:id' so 'public' is not treated as an ID
router.get('/public', (req, res) => applicationsController.getPublicApplicationsPaged(req, res));
router.get('/', authenticateToken, enforceCompanyScoping, (req, res) => applicationsController.getApplications(req, res));
router.get('/categories', authenticateToken, enforceCompanyScoping, (req, res) => applicationsController.getCategories(req, res));
router.get('/:id', authenticateToken, enforceCompanyScoping, (req, res) => applicationsController.getApplication(req, res));
router.get('/:id/launch', authenticateToken, enforceCompanyScoping, (req, res) => applicationsController.launchApplication(req, res));

// Admin routes (authentication and admin role required)
router.post('/', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => applicationsController.createApplication(req, res));
router.put('/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => applicationsController.updateApplication(req, res));
router.delete('/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => applicationsController.deleteApplication(req, res));

// Deployment routes (authentication and admin role required)
router.post(
  '/:id/deploy-to-marketplace',
  authenticateToken,
  enforceCompanyScoping,
  requireAdmin,
  (req, res) => applicationsController.deployToMarketplace(req, res)
);
router.post(
  '/:id/deploy',
  authenticateToken,
  enforceCompanyScoping,
  requireAdmin,
  (req, res) => applicationsController.deployApplication(req, res)
);
router.get(
  '/:id/deployment-checklist',
  authenticateToken,
  enforceCompanyScoping,
  requireAdmin,
  (req, res) => applicationsController.getDeploymentChecklist(req, res)
);

export default router;
