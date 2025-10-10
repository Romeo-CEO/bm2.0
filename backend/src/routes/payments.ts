import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { enforceCompanyScoping } from '../middleware/companyScope';
import { PaymentsController } from '../controllers/paymentsController';

const router = Router();
const controller = new PaymentsController();

// Public-ish status endpoint (no auth needed for basic poll)
router.get('/status', (req, res) => controller.getPaymentStatus(req, res));

// PayFast integration (auth required to prevent abuse)
router.post('/payfast/checkout', authenticateToken, enforceCompanyScoping, (req, res) => controller.payfastCheckout(req, res));
router.post('/payfast/itn', (req, res) => controller.payfastItn(req, res));

// Mock helpers (admin only)
router.post('/mock/activate', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => controller.mockActivate(req, res));
router.post('/mock/expire', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => controller.mockExpire(req, res));
router.post('/mock/cancel', authenticateToken, enforceCompanyScoping, requireAdmin, (req, res) => controller.mockCancel(req, res));

export default router;
