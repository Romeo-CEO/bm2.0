import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { ssoApplicationsController } from '../controllers/ssoApplicationsController';
import { templateCatalogAdminController } from '../controllers/templateCatalogAdminController';
import { auditLogsController } from '../controllers/auditLogsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';

const router = Router();
const adminController = new AdminController();

// All admin routes require authentication and admin role
router.use(authenticateToken, enforceCompanyScoping);
router.use(requireAdmin);

// User Management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Company Management
router.get('/companies', adminController.getAllCompanies);
router.put('/companies/:id', adminController.updateCompany);

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Platform Settings
router.get('/settings', adminController.getPlatformSettings);
router.put('/settings', adminController.updatePlatformSettings);

// System Health
router.get('/health', adminController.getSystemHealth);

// SSO Application Registry
router.get('/sso-applications', (req, res) => ssoApplicationsController.list(req, res));
router.get('/sso-applications/:id', (req, res) => ssoApplicationsController.getById(req, res));
router.post('/sso-applications', (req, res) => ssoApplicationsController.create(req, res));
router.put('/sso-applications/:id', (req, res) => ssoApplicationsController.update(req, res));
router.delete('/sso-applications/:id', (req, res) => ssoApplicationsController.remove(req, res));

// Template catalog administration
router.get('/template-catalog/categories', (req, res) => templateCatalogAdminController.listCategories(req, res));
router.post('/template-catalog/categories', (req, res) => templateCatalogAdminController.createCategory(req, res));
router.put('/template-catalog/categories/:id', (req, res) => templateCatalogAdminController.updateCategory(req, res));
router.delete('/template-catalog/categories/:id', (req, res) => templateCatalogAdminController.deleteCategory(req, res));
router.post('/template-catalog/types', (req, res) => templateCatalogAdminController.createType(req, res));
router.put('/template-catalog/types/:id', (req, res) => templateCatalogAdminController.updateType(req, res));
router.delete('/template-catalog/types/:id', (req, res) => templateCatalogAdminController.deleteType(req, res));
router.put('/template-catalog/templates/:templateId/assignment', (req, res) => templateCatalogAdminController.assignTemplate(req, res));

// Audit logs
router.get('/audit/logs', (req, res) => auditLogsController.list(req, res));

export default router;
