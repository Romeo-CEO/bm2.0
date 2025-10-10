import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AnalyticsController } from '../controllers/analyticsController';

const router = Router();
const analyticsController = new AnalyticsController();

router.get('/company', authenticateToken, (req, res) => analyticsController.getCompanyAnalytics(req, res));
// Alias used by frontend
router.get('/dashboard', authenticateToken, (req, res) => analyticsController.getDashboard(req, res));

export default router;