import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { SettingsController } from '../controllers/settingsController';

const router = Router();
const controller = new SettingsController();

router.get('/payfast', authenticateToken, requireAdmin, (req, res) => controller.getPayfastSettings(req, res));
router.post('/payfast', authenticateToken, requireAdmin, (req, res) => controller.savePayfastSettings(req, res));

export default router;
