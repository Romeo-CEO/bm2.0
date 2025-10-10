import { Router } from 'express';
import { authenticateToken, requireAdmin, requireCompanyAdmin } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';
import { CompanyProfileController } from '../controllers/companyProfileController';

const router = Router();
const controller = new CompanyProfileController();

// Current company profile (for authenticated user)
router.get('/profile', authenticateToken, enforceCompanyScoping, (req, res) => controller.getMyCompanyProfile(req, res));
router.put('/profile', authenticateToken, enforceCompanyScoping, requireCompanyAdmin, (req, res) => controller.updateMyCompanyProfile(req, res));

// Company users for current company
router.get('/users', authenticateToken, enforceCompanyScoping, requireCompanyAdmin, (req, res) => controller.getMyCompanyUsers(req, res));
router.post('/users', authenticateToken, enforceCompanyScoping, requireCompanyAdmin, (req, res) => controller.addCompanyUser(req, res));

// Admin variants
router.get('/profile/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => controller.getCompanyProfileById(req, res));
router.put('/profile/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => controller.updateCompanyProfileById(req, res));

export default router;
