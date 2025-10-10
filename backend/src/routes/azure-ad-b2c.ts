import { Router } from 'express';
import { AzureADB2CController } from '../controllers/azureAdB2cController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const azureAdB2cController = new AzureADB2CController();

// Azure AD B2C authentication routes
router.get('/login', (req, res) => azureAdB2cController.initiateLogin(req, res));
router.get('/callback', (req, res) => azureAdB2cController.handleCallback(req, res));
router.get('/me', authenticateToken, (req, res) => azureAdB2cController.getCurrentUser(req, res));
router.post('/logout', authenticateToken, (req, res) => azureAdB2cController.logout(req, res));
router.get('/status', (req, res) => azureAdB2cController.getAuthStatus(req, res));

export default router;
