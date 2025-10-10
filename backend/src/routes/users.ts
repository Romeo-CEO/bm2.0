import { Router } from 'express';
import { UsersController } from '../controllers/usersController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const usersController = new UsersController();

// User routes (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => usersController.getUsers(req, res));
router.put('/:id', authenticateToken, requireAdmin, (req, res) => usersController.updateUser(req, res));
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => usersController.deleteUser(req, res));

// Additional helpers for company admin flows
router.post('/:id/assign-company', authenticateToken, (req, res) => usersController.assignCompany(req, res));
router.post('/:id/set-company-admin', authenticateToken, (req, res) => usersController.setCompanyAdmin(req, res));

export default router;