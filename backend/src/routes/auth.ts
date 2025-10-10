import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { AzureADB2CController } from '../controllers/azureAdB2cController';
import { authenticateToken } from '../middleware/auth';
import { forgotPasswordRateLimitMiddleware, loginRateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();
const authController = new AuthController();

// Auth routes
router.post('/login', loginRateLimitMiddleware, (req, res) => authController.login(req, res));
router.post('/register', (req, res) => authController.register(req, res));
router.post('/logout', authenticateToken, (req, res) => authController.logout(req, res));
router.post('/password/forgot', forgotPasswordRateLimitMiddleware, (req, res) => authController.forgotPassword(req, res));
router.post('/password/reset', (req, res) => authController.resetPassword(req, res));
router.get('/me', authenticateToken, (req, res) => authController.getCurrentUser(req, res));

// Azure AD B2C callback alias (so we can register /api/auth/callback)
const azureAdB2cController = new AzureADB2CController();
router.get('/callback', (req, res) => azureAdB2cController.handleCallback(req, res));
// Optional convenience aliases
router.get('/login/oauth', (req, res) => azureAdB2cController.initiateLogin(req, res));
router.get('/status', (req, res) => azureAdB2cController.getAuthStatus(req, res));

export default router;