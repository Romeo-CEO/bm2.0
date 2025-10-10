import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';
import { AnalyticsController } from '../controllers/analyticsController';

const router = Router();
const analyticsController = new AnalyticsController();

router.get('/company', authenticateToken, enforceCompanyScoping, (req, res) => analyticsController.getCompanyAnalytics(req, res));
// Alias used by frontend
router.get('/dashboard', authenticateToken, enforceCompanyScoping, (req, res) => analyticsController.getDashboard(req, res));

export default router;