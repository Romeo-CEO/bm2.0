import { Router } from 'express';
import { FilesController } from '../controllers/filesController';

const router = Router();
const filesController = new FilesController();

// File upload endpoint
router.post('/upload', ...filesController.uploadFile);

// File download endpoint
router.get('/download', ...filesController.downloadFile);

// File deletion endpoint
router.delete('/:id', ...filesController.deleteFile);

// List files endpoint
router.get('/list', ...filesController.listFiles);

export default router;
