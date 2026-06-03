import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface StorageResult {
  url: string;
  path: string; // The reference path/key stored in DB
}

export interface IStorageService {
  uploadFile(localFilePath: string, destinationKey: string, mimeType: string): Promise<StorageResult>;
  deleteFile(fileKey: string): Promise<void>;
  getDownloadUrl(fileKey: string): Promise<string>;
}

// Local Storage Service Implementation
export class LocalStorageService implements IStorageService {
  private uploadDir: string;
  private serverUrl: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    this.serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    // Ensure directories exist
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(localFilePath: string, destinationKey: string, mimeType: string): Promise<StorageResult> {
    const destPath = path.join(this.uploadDir, destinationKey);
    const destDir = path.dirname(destPath);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // If localFilePath is different from destPath, copy/move it
    if (path.resolve(localFilePath) !== path.resolve(destPath)) {
      fs.copyFileSync(localFilePath, destPath);
      // Clean up original temp upload if needed (done in routes/controllers)
    }

    const relativePath = destinationKey.replace(/\\/g, '/');
    return {
      url: `${this.serverUrl}/uploads/${relativePath}`,
      path: relativePath
    };
  }

  async deleteFile(fileKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, fileKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getDownloadUrl(fileKey: string): Promise<string> {
    const relativePath = fileKey.replace(/\\/g, '/');
    return `${this.serverUrl}/uploads/${relativePath}`;
  }
}

// AWS S3 Storage Service Implementation
export class S3StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET || '';
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    });
  }

  async uploadFile(localFilePath: string, destinationKey: string, mimeType: string): Promise<StorageResult> {
    const fileStream = fs.createReadStream(localFilePath);
    const key = destinationKey.replace(/\\/g, '/');

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileStream,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);

    // Return S3 URL
    const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    return {
      url,
      path: key
    };
  }

  async deleteFile(fileKey: string): Promise<void> {
    const key = fileKey.replace(/\\/g, '/');
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });
    await this.s3Client.send(command);
  }

  async getDownloadUrl(fileKey: string): Promise<string> {
    const key = fileKey.replace(/\\/g, '/');
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

// Factory to export active storage provider
const storageType = process.env.STORAGE_TYPE || 'local';
export const storageService: IStorageService = storageType === 's3' 
  ? new S3StorageService() 
  : new LocalStorageService();
