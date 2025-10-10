import { Router } from 'express';
import { TemplatesController } from '../controllers/templatesController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const templatesController = new TemplatesController();

// Public routes (no authentication required for browsing)
// Define '/public' before '/:id' so 'public' is not treated as an ID
router.get('/public', (req, res) => templatesController.getPublicTemplatesPaged(req, res));
router.get('/', authenticateToken, (req, res) => templatesController.getTemplates(req, res));
router.get('/categories', authenticateToken, (req, res) => templatesController.getCategories(req, res));
router.get('/:id', authenticateToken, (req, res) => templatesController.getTemplate(req, res));

router.get('/download/:id', authenticateToken, (req, res) => templatesController.downloadTemplate(req, res));

// Admin routes (authentication and admin role required)
router.post('/', authenticateToken, requireAdmin, (req, res) => templatesController.createTemplate(req, res));
router.put('/:id', authenticateToken, requireAdmin, (req, res) => templatesController.updateTemplate(req, res));
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => templatesController.deleteTemplate(req, res));

export default router;
