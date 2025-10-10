import { Router } from 'express';
import { CompaniesController } from '../controllers/companiesController';
import { authenticateToken, requireAdmin, requireCompanyAdmin } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';

const router = Router();
const companiesController = new CompaniesController();

// All company routes require authentication and scoping
router.use(authenticateToken, enforceCompanyScoping);

// Company management routes
router.get('/', requireAdmin, (req, res) => companiesController.getCompanies(req, res));
router.get('/:id', (req, res) => companiesController.getCompany(req, res));
router.get('/:id/users', requireCompanyAdmin, (req, res) => companiesController.getCompanyUsers(req, res));

// Branding routes
router.get('/:id/branding', (req, res) => companiesController.getCompanyBranding(req, res));
router.put('/:id/branding', (req, res) => companiesController.updateCompanyBranding(req, res));

// Admin routes
router.post('/', requireAdmin, (req, res) => companiesController.createCompany(req, res));
router.put('/:id', requireCompanyAdmin, (req, res) => companiesController.updateCompany(req, res));
router.delete('/:id', requireAdmin, (req, res) => companiesController.deleteCompany(req, res));

export default router;
