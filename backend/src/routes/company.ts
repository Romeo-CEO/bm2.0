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
router.post('/users/invite', authenticateToken, enforceCompanyScoping, requireCompanyAdmin, (req, res) => controller.inviteCompanyUser(req, res));
router.get('/users/invite/validate', (req, res) => controller.validateCompanyInvitation(req, res));
router.post('/users/invite/accept', (req, res) => controller.acceptCompanyInvitation(req, res));
router.post('/users/:id/resend-invite', authenticateToken, enforceCompanyScoping, requireCompanyAdmin, (req, res) => controller.resendCompanyInvitation(req, res));
router.post('/users/invite/:inviteId/cancel', authenticateToken, enforceCompanyScoping, requireCompanyAdmin, (req, res) => controller.cancelCompanyInvitation(req, res));
router.delete(
  '/users/:id',
  authenticateToken,
  enforceCompanyScoping,
  requireCompanyAdmin,
  (req, res) => controller.removeCompanyUser(req, res)
);

// Admin variants
router.get('/profile/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => controller.getCompanyProfileById(req, res));
router.put('/profile/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => controller.updateCompanyProfileById(req, res));

export default router;
