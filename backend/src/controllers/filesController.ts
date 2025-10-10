import { Request, Response } from 'express';
import { FileStorageService } from '../services/fileStorageService';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (FileStorageService.validateFileType(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Supported types: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, images, ZIP'));
    }
  }
});

export class FilesController {
  private fileStorageService: FileStorageService;

  constructor() {
    this.fileStorageService = new FileStorageService();
  }

  /**
   * Upload file endpoint
   */
  uploadFile = [
    authenticateToken,
    // Accept either 'file' or 'logo' field names
    (upload.any() as any),
    async (req: Request, res: Response) => {
      try {
        // Check if user is admin (only admins can upload files)
        if (!req.user || req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }

        const uploaded: any = (req as any).file || ((req as any).files && (req as any).files[0]);
        if (!uploaded) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const { buffer, originalname, mimetype, size } = uploaded;
        
        // Validate file size
        if (size > 10 * 1024 * 1024) {
          return res.status(400).json({ error: 'File too large (max 10MB)' });
        }

        // Upload file
        const result = await this.fileStorageService.uploadFile(
          buffer,
          originalname,
          mimetype,
          req.user.id
        );

        if (!result.success) {
          return res.status(500).json({ error: result.error || 'Upload failed' });
        }

        res.json({
          success: true,
          fileId: result.fileId,
          filename: result.filename,
          fileType: result.fileType,
          fileSize: result.fileSize,
          url: result.url
        });
        return;

      } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
        return;
      }
    }
  ];

  /**
   * Download file endpoint
   */
  downloadFile = [
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'File ID required' });
        }

        // Download file
        const result = await this.fileStorageService.downloadFile(id);

        if (!result.success) {
          return res.status(404).json({ error: result.error || 'File not found' });
        }

        // If it's a blob URL, redirect to it
        if (result.url && result.url.startsWith('http')) {
          return res.redirect(result.url);
        }

        // Otherwise, serve the file data
        if (result.data) {
          res.setHeader('Content-Type', result.fileType);
          res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
          res.setHeader('Content-Length', result.fileSize);
          res.send(result.data);
        } else {
          res.status(404).json({ error: 'File data not available' });
        }
        return;

      } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ error: 'Download failed' });
        return;
      }
    }
  ];

  /**
   * Delete file endpoint
   */
  deleteFile = [
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        // Check if user is admin (only admins can delete files)
        if (!req.user || req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;

        if (!id) {
          return res.status(400).json({ error: 'File ID required' });
        }

        // Delete file
        const success = await this.fileStorageService.deleteFile(id);

        if (!success) {
          return res.status(404).json({ error: 'File not found or could not be deleted' });
        }

        res.json({ success: true, message: 'File deleted successfully' });
        return;

      } catch (error) {
        console.error('File deletion error:', error);
        res.status(500).json({ error: 'Deletion failed' });
        return;
      }
    }
  ];

  /**
   * List files endpoint
   */
  listFiles = [
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        // Check if user is admin (only admins can list files)
        if (!req.user || req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }

        const { getDatabaseConnection } = await import('../config/database');
        const db = await getDatabaseConnection();
        
        const result = await db.query(`
          SELECT id, filename, file_type, file_size, uploaded_by, uploaded_at, blob_url
          FROM file_uploads 
          ORDER BY uploaded_at DESC
        `);

        res.json({
          success: true,
          files: result.rows
        });
        return;

      } catch (error) {
        console.error('File listing error:', error);
        res.status(500).json({ error: 'Failed to list files' });
        return;
      }
    }
  ];
}
