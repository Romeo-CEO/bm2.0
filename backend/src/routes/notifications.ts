import { Router } from 'express';
import { notificationsController } from '../controllers/notificationsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res) => notificationsController.listForUser(req, res));
router.get('/preferences', (req, res) => notificationsController.getPreferences(req, res));
router.put('/preferences', (req, res) => notificationsController.updatePreferences(req, res));
router.post('/', requireAdmin, (req, res) => notificationsController.create(req, res));

export default router;
