import { Router } from 'express';
import { UsersController } from '../controllers/usersController';
import { authenticateToken, requireAdmin, requireCompanyAdmin } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';

const router = Router();
const usersController = new UsersController();

// User routes (admin only)
router.get('/', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => usersController.getUsers(req, res));
router.put('/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => usersController.updateUser(req, res));
router.delete('/:id', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => usersController.deleteUser(req, res));

// Additional helpers for company admin flows
router.post(
  '/:id/assign-company',
  authenticateToken,
  enforceCompanyScoping,
  requireCompanyAdmin,
  (req, res) => usersController.assignCompany(req, res)
);
router.post(
  '/:id/set-company-admin',
  authenticateToken,
  enforceCompanyScoping,
  requireCompanyAdmin,
  (req, res) => usersController.setCompanyAdmin(req, res)
);

export default router;