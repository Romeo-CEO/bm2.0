import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import dotenv from 'dotenv';

dotenv.config();

// Azure Storage configuration
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'business-manager-files';

// Storage type enum
export enum StorageType {
  DATABASE = 'database',
  AZURE_BLOB = 'azure_blob',
  VERCEL_BLOB = 'vercel_blob'
}

// Get storage type from environment
export const STORAGE_TYPE = (process.env.STORAGE_TYPE || 'database') as StorageType;

// Azure Blob Storage client
let blobServiceClient: BlobServiceClient | null = null;

// Initialize Azure Blob Storage client
export const initializeAzureStorage = (): BlobServiceClient | null => {
  if (STORAGE_TYPE !== StorageType.AZURE_BLOB) {
    return null;
  }

  try {
    if (AZURE_STORAGE_CONNECTION_STRING) {
      // Use connection string (for development/testing)
      blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    } else if (AZURE_STORAGE_ACCOUNT_NAME && AZURE_STORAGE_ACCOUNT_KEY) {
      // Use account name and key
      const credential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
      blobServiceClient = new BlobServiceClient(
        `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
        credential
      );
    } else {
      // Use Azure AD authentication (for production)
      const credential = new DefaultAzureCredential();
      blobServiceClient = new BlobServiceClient(
        `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
        credential
      );
    }

    console.log('✅ Azure Blob Storage client initialized');
    return blobServiceClient;
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Storage:', error);
    return null;
  }
};

// Get blob service client
export const getBlobServiceClient = (): BlobServiceClient | null => {
  if (!blobServiceClient) {
    blobServiceClient = initializeAzureStorage();
  }
  return blobServiceClient;
};

// Test Azure Blob Storage connection
export const testAzureStorageConnection = async (): Promise<boolean> => {
  if (STORAGE_TYPE !== StorageType.AZURE_BLOB) {
    return true; // Not using Azure storage
  }

  try {
    const client = getBlobServiceClient();
    if (!client) {
      console.error('❌ Azure Blob Storage client not initialized');
      return false;
    }

    // Test connection by listing containers
    const containers = client.listContainers();
    await containers.next();
    console.log('✅ Azure Blob Storage connection successful');
    return true;
  } catch (error) {
    console.error('❌ Azure Blob Storage connection failed:', error);
    return false;
  }
};

// Ensure container exists
export const ensureContainerExists = async (containerName: string = AZURE_STORAGE_CONTAINER_NAME): Promise<boolean> => {
  try {
    const client = getBlobServiceClient();
    if (!client) {
      return false;
    }

    const containerClient = client.getContainerClient(containerName);
    await containerClient.createIfNotExists({
      access: 'blob' // Allow public read access to blobs
    });

    console.log(`✅ Container '${containerName}' ready`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to ensure container '${containerName}' exists:`, error);
    return false;
  }
};

// Get container name
export const getContainerName = (): string => {
  return AZURE_STORAGE_CONTAINER_NAME;
};
