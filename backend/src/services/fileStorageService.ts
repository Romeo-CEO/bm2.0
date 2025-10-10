import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { getBlobServiceClient, getContainerName, STORAGE_TYPE, StorageType } from '../config/azure-storage';
import { getDatabaseConnection } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface FileUploadResult {
  success: boolean;
  fileId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  url?: string;
  error?: string;
}

export interface FileDownloadResult {
  success: boolean;
  filename: string;
  fileType: string;
  fileSize: number;
  data?: Buffer;
  url?: string;
  error?: string;
}

export class FileStorageService {
  private containerName: string;

  constructor() {
    this.containerName = getContainerName();
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    fileData: Buffer,
    filename: string,
    fileType: string,
    uploadedBy: string
  ): Promise<FileUploadResult> {
    try {
      const fileId = this.generateFileId();
      const fileSize = fileData.length;

      if (STORAGE_TYPE === StorageType.AZURE_BLOB) {
        return await this.uploadToAzureBlob(fileData, filename, fileType, fileId, uploadedBy);
      } else {
        return await this.uploadToDatabase(fileData, filename, fileType, fileId, uploadedBy);
      }
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        fileId: '',
        filename,
        fileType,
        fileSize: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(fileId: string): Promise<FileDownloadResult> {
    try {
      if (STORAGE_TYPE === StorageType.AZURE_BLOB) {
        return await this.downloadFromAzureBlob(fileId);
      } else {
        return await this.downloadFromDatabase(fileId);
      }
    } catch (error) {
      console.error('File download error:', error);
      return {
        success: false,
        filename: '',
        fileType: '',
        fileSize: 0,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      if (STORAGE_TYPE === StorageType.AZURE_BLOB) {
        return await this.deleteFromAzureBlob(fileId);
      } else {
        return await this.deleteFromDatabase(fileId);
      }
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  /**
   * Upload to Azure Blob Storage
   */
  private async uploadToAzureBlob(
    fileData: Buffer,
    filename: string,
    fileType: string,
    fileId: string,
    uploadedBy: string
  ): Promise<FileUploadResult> {
    const client = getBlobServiceClient();
    if (!client) {
      throw new Error('Azure Blob Storage client not available');
    }

    const containerClient = client.getContainerClient(this.containerName);
    const blobName = `${fileId}/${filename}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file to blob storage
    await blockBlobClient.upload(fileData, fileData.length, {
      blobHTTPHeaders: {
        blobContentType: fileType
      },
      metadata: {
        originalFilename: filename,
        uploadedBy,
        uploadedAt: new Date().toISOString()
      }
    });

    // Store metadata in database
    const db = await getDatabaseConnection();
    await db.query(`
      INSERT INTO file_uploads (id, filename, file_type, file_size, uploaded_by, blob_url, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, GETDATE())
    `, [
      fileId,
      filename,
      fileType,
      fileData.length,
      uploadedBy,
      blockBlobClient.url
    ]);

    return {
      success: true,
      fileId,
      filename,
      fileType,
      fileSize: fileData.length,
      url: blockBlobClient.url
    };
  }

  /**
   * Upload to database (current system)
   */
  private async uploadToDatabase(
    fileData: Buffer,
    filename: string,
    fileType: string,
    fileId: string,
    uploadedBy: string
  ): Promise<FileUploadResult> {
    const db = await getDatabaseConnection();
    
    await db.query(`
      INSERT INTO file_uploads (id, filename, file_type, file_size, file_data, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, GETDATE())
    `, [
      fileId,
      filename,
      fileType,
      fileData.length,
      fileData,
      uploadedBy
    ]);

    return {
      success: true,
      fileId,
      filename,
      fileType,
      fileSize: fileData.length,
      url: `/api/files/download?id=${fileId}`
    };
  }

  /**
   * Download from Azure Blob Storage
   */
  private async downloadFromAzureBlob(fileId: string): Promise<FileDownloadResult> {
    const db = await getDatabaseConnection();
    const result = await db.query(`
      SELECT filename, file_type, file_size, blob_url FROM file_uploads WHERE id = ?
    `, [fileId]);

    if (result.rows.length === 0) {
      throw new Error('File not found');
    }

    const file = result.rows[0];
    
    // For Azure Blob Storage, we return the URL for direct access
    return {
      success: true,
      filename: file.filename,
      fileType: file.file_type,
      fileSize: file.file_size,
      url: file.blob_url
    };
  }

  /**
   * Download from database
   */
  private async downloadFromDatabase(fileId: string): Promise<FileDownloadResult> {
    const db = await getDatabaseConnection();
    const result = await db.query(`
      SELECT filename, file_type, file_size, file_data FROM file_uploads WHERE id = ?
    `, [fileId]);

    if (result.rows.length === 0) {
      throw new Error('File not found');
    }

    const file = result.rows[0];
    return {
      success: true,
      filename: file.filename,
      fileType: file.file_type,
      fileSize: file.file_size,
      data: file.file_data
    };
  }

  /**
   * Delete from Azure Blob Storage
   */
  private async deleteFromAzureBlob(fileId: string): Promise<boolean> {
    const db = await getDatabaseConnection();
    const result = await db.query(`
      SELECT blob_url FROM file_uploads WHERE id = ?
    `, [fileId]);

    if (result.rows.length === 0) {
      return false;
    }

    const file = result.rows[0];
    const client = getBlobServiceClient();
    if (!client) {
      return false;
    }

    // Extract blob name from URL
    const url = new URL(file.blob_url);
    const blobName = url.pathname.split('/').slice(2).join('/'); // Remove container name
    
    const containerClient = client.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.delete();
    
    // Remove from database
    await db.query(`DELETE FROM file_uploads WHERE id = ?`, [fileId]);
    
    return true;
  }

  /**
   * Delete from database
   */
  private async deleteFromDatabase(fileId: string): Promise<boolean> {
    const db = await getDatabaseConnection();
    const result = await db.query(`DELETE FROM file_uploads WHERE id = ?`, [fileId]);
    return result.rowCount > 0;
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return `file_${uuidv4()}`;
  }

  /**
   * Validate file type
   */
  static validateFileType(fileType: string, filename: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed'
    ];

    const allowedExtensions = [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 
      'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'zip'
    ];

    const fileExtension = filename.split('.').pop()?.toLowerCase();
    
    return allowedTypes.includes(fileType) && 
           Boolean(fileExtension) && 
           allowedExtensions.includes(fileExtension as string);
  }
}
