import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
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

export default router;