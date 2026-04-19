import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../config/logger';
import { FileAssetResponse } from '../types/template-assets';

/**
 * Asset upload response structure
 * Returned after successful file upload
 */
export interface Asset {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  folder_id?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  url: string; // ✅ Public URL to access the file
}

/**
 * Folder response structure
 */
export interface AssetFolder {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

/**
 * Asset statistics
 */
export interface AssetStats {
  total_count: number;
  total_size_bytes: number;
  by_type: Record<string, number>;
}

/**
 * Upload options for file operations
 */
export interface UploadOptions {
  folderId?: string;
  tags?: string[];
}

/**
 * Allowed MIME types for uploads
 */
export enum AllowedMIMEType {
  // Images
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  GIF = 'image/gif',
  SVG = 'image/svg+xml',

  // Videos
  MP4 = 'video/mp4',
  WEBM = 'video/webm',

  // Documents
  PDF = 'application/pdf',

  // Fonts
  TTF = 'font/ttf',
  OTF = 'font/otf',
  WOFF = 'font/woff',
  WOFF2 = 'font/woff2',
}

export class AssetsClient {
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string;
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 3;

  /**
   * Initialize Assets Client
   *
   * @param baseURL Base URL of the Afrisinc Assets API (e.g., http://localhost:8080)
   * @param apiKey API key for authentication
   * @throws Error if baseURL or apiKey is empty
   *
   * @example
   * ```typescript
   * const client = new AssetsClient(
   *   process.env.ASSETS_API_URL || 'http://localhost:8080',
   *   process.env.ASSETS_API_KEY || 'api-key'
   * );
   * ```
   */
  constructor(baseURL: string, apiKey: string) {
    if (!baseURL?.trim()) {
      throw new Error('AssetsClient: baseURL is required');
    }
    if (!apiKey?.trim()) {
      throw new Error('AssetsClient: apiKey is required');
    }

    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': this.apiKey,
      },
      timeout: this.DEFAULT_TIMEOUT,
    });

    logger.info(`[AssetsClient] Initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Upload a file from the filesystem
   *
   * Supports images (JPEG, PNG, WebP, GIF, SVG), videos (MP4, WebM),
   * PDFs, and fonts (TTF, OTF, WOFF, WOFF2).
   *
   * @param filePath Absolute path to the file to upload
   * @param options Upload options (folderId, tags)
   * @returns Asset object with public URL
   * @throws Error if file not found or upload fails
   *
   * @example
   * ```typescript
   * // Upload image to folder with tags
   * const asset = await assetsClient.uploadFile('/path/to/logo.png', {
   *   folderId: 'folder-uuid-123',
   *   tags: ['branding', 'logo']
   * });
   * console.log(asset.url); // Public accessible URL
   *
   * // Upload document
   * const pdfAsset = await assetsClient.uploadFile('/path/to/invoice.pdf', {
   *   tags: ['invoice', 'finance']
   * });
   * ```
   */
  async uploadFile(filePath: string, options?: UploadOptions): Promise<Asset> {
    // Validation
    if (!filePath?.trim()) {
      throw new Error('AssetsClient.uploadFile: filePath is required');
    }

    const normalizedPath = path.normalize(filePath);
    if (!fs.existsSync(normalizedPath)) {
      const error = new Error(`AssetsClient.uploadFile: File not found: ${normalizedPath}`);
      logger.error(error.message);
      throw error;
    }

    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile()) {
      throw new Error(`AssetsClient.uploadFile: Path is not a file: ${normalizedPath}`);
    }

    logger.debug(`[AssetsClient] Uploading file: ${normalizedPath} (${stats.size} bytes)`);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(normalizedPath));

    if (options?.folderId) {
      this.validateUUID(options.folderId, 'folderId');
      formData.append('folder_id', options.folderId);
    }

    if (options?.tags && options.tags.length > 0) {
      const validatedTags = options.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
      if (validatedTags.length > 0) {
        formData.append('tags', validatedTags.join(','));
      }
    }

    return this.executeWithRetry(
      () =>
        this.client.post<Asset>('/api/v1/assets', formData, {
          headers: formData.getHeaders(),
        }),
      `upload file: ${path.basename(normalizedPath)}`
    );
  }

  /**
   * Upload a file from a Buffer (memory)
   *
   * Useful for uploading dynamically generated content (images, PDFs, etc.)
   * without writing to disk first.
   *
   * @param buffer File content as Buffer
   * @param filename Original filename (required for MIME type detection)
   * @param options Upload options (folderId, tags)
   * @returns Asset object with public URL
   * @throws Error if buffer is empty or upload fails
   *
   * @example
   * ```typescript
   * // Upload generated image
   * const imageBuffer = await generateQRCode('https://example.com');
   * const asset = await assetsClient.uploadBuffer(
   *   imageBuffer,
   *   'qrcode.png',
   *   { tags: ['qr', 'dynamic'] }
   * );
   *
   * // Include in notification
   * await sendEmailWithImage(user.email, asset.url);
   * ```
   */
  async uploadBuffer(buffer: Buffer, filename: string, options?: UploadOptions): Promise<FileAssetResponse> {
    // Validation
    if (!buffer || buffer.length === 0) {
      throw new Error('AssetsClient.uploadBuffer: buffer is required and must not be empty');
    }

    if (!filename?.trim()) {
      throw new Error('AssetsClient.uploadBuffer: filename is required');
    }

    logger.debug(`[AssetsClient] Uploading buffer: ${filename} (${buffer.length} bytes)`);

    const formData = new FormData();
    formData.append('file', buffer, filename);

    if (options?.folderId) {
      this.validateUUID(options.folderId, 'folderId');
      formData.append('folder_id', options.folderId);
    }

    if (options?.tags && options.tags.length > 0) {
      const validatedTags = options.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
      if (validatedTags.length > 0) {
        formData.append('tags', validatedTags.join(','));
      }
    }

    return this.executeWithRetry(
      () =>
        this.client.post<Asset>('/api/v1/assets', formData, {
          headers: formData.getHeaders(),
        }),
      `upload buffer: ${filename}`
    );
  }

  /**
   * Create a folder to organize assets
   *
   * Folders provide logical organization for assets within the service.
   * Use folder IDs when uploading files to organize them.
   *
   * @param name Folder name (required, max 100 characters)
   * @param description Optional folder description (max 500 characters)
   * @returns Folder object with ID
   * @throws Error if name is empty or creation fails
   *
   * @example
   * ```typescript
   * // Create folder for customer assets
   * const folder = await assetsClient.createFolder(
   *   'Customer ABC Assets',
   *   'All assets belonging to customer ABC'
   * );
   *
   * // Upload files to this folder
   * const asset = await assetsClient.uploadFile('/path/to/file.pdf', {
   *   folderId: folder.id,
   *   tags: ['customer']
   * });
   * ```
   */
  async createFolder(name: string, description?: string): Promise<AssetFolder> {
    if (!name?.trim()) {
      throw new Error('AssetsClient.createFolder: name is required');
    }

    if (name.length > 100) {
      throw new Error('AssetsClient.createFolder: name must not exceed 100 characters');
    }

    if (description && description.length > 500) {
      throw new Error('AssetsClient.createFolder: description must not exceed 500 characters');
    }

    logger.debug(`[AssetsClient] Creating folder: ${name}`);

    const payload: any = { name };
    if (description?.trim()) {
      payload.description = description.trim();
    }

    return this.executeWithRetry(
      () => this.client.post<AssetFolder>('/api/v1/folders', payload),
      `create folder: ${name}`
    );
  }

  /**
   * Get asset details by ID
   *
   * @param assetId UUID of the asset
   * @returns Asset object
   * @throws Error if asset not found or request fails
   *
   * @example
   * ```typescript
   * const asset = await assetsClient.getAsset('550e8400-e29b-41d4-a716-446655440000');
   * console.log(asset.url);
   * console.log(asset.size_bytes);
   * ```
   */
  async getAsset(assetId: string): Promise<Asset> {
    if (!assetId?.trim()) {
      throw new Error('AssetsClient.getAsset: assetId is required');
    }

    this.validateUUID(assetId, 'assetId');

    logger.debug(`[AssetsClient] Fetching asset: ${assetId}`);

    return this.executeWithRetry(() => this.client.get<Asset>(`/api/v1/assets/${assetId}`), `get asset: ${assetId}`);
  }

  /**
   * Get folder details by ID
   *
   * @param folderId UUID of the folder
   * @returns Folder object
   * @throws Error if folder not found or request fails
   *
   * @example
   * ```typescript
   * const folder = await assetsClient.getFolder('folder-uuid-123');
   * console.log(folder.name);
   * ```
   */
  async getFolder(folderId: string): Promise<AssetFolder> {
    if (!folderId?.trim()) {
      throw new Error('AssetsClient.getFolder: folderId is required');
    }

    this.validateUUID(folderId, 'folderId');

    logger.debug(`[AssetsClient] Fetching folder: ${folderId}`);

    return this.executeWithRetry(
      () => this.client.get<AssetFolder>(`/api/v1/folders/${folderId}`),
      `get folder: ${folderId}`
    );
  }

  /**
   * List all folders
   *
   * @returns Array of folder objects
   * @throws Error if request fails
   *
   * @example
   * ```typescript
   * const folders = await assetsClient.listFolders();
   * folders.forEach(folder => {
   *   console.log(`${folder.name}: ${folder.id}`);
   * });
   * ```
   */
  async listFolders(): Promise<AssetFolder[]> {
    logger.debug(`[AssetsClient] Listing folders`);

    const response: { folders: AssetFolder[] } = await this.executeWithRetry(
      () => this.client.get<{ folders: AssetFolder[] }>('/api/v1/folders'),
      'list folders'
    );

    return response.folders || [];
  }

  /**
   * List assets with pagination and filtering
   *
   * @param options Query options (folderId, type, search, tags, pagination)
   * @returns Object with assets array and pagination metadata
   *
   * @example
   * ```typescript
   * const result = await assetsClient.listAssets({
   *   folderId: 'folder-uuid',
   *   type: 'image',
   *   page: 1,
   *   page_size: 50
   * });
   * console.log(result.assets);
   * console.log(`Total: ${result.total}, Page: ${result.page}`);
   * ```
   */
  async listAssets(options?: {
    folderId?: string;
    type?: string;
    search?: string;
    tags?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ assets: Asset[]; total: number; page: number; page_size: number }> {
    logger.debug(`[AssetsClient] Listing assets with options:`, options);

    const params = new URLSearchParams();
    if (options?.folderId) {
      params.append('folder_id', options.folderId);
    }
    if (options?.type) {
      params.append('type', options.type);
    }
    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.tags) {
      params.append('tags', options.tags);
    }
    if (options?.page) {
      params.append('page', options.page.toString());
    }
    if (options?.page_size) {
      params.append('page_size', options.page_size.toString());
    }

    return this.executeWithRetry(
      () =>
        this.client.get<{ assets: Asset[]; total: number; page: number; page_size: number }>(
          `/api/v1/assets?${params.toString()}`
        ),
      'list assets'
    );
  }

  /**
   * Get asset statistics
   *
   * Returns aggregate statistics about all assets.
   *
   * @returns Statistics object
   *
   * @example
   * ```typescript
   * const stats = await assetsClient.getStats();
   * console.log(`Total assets: ${stats.total_count}`);
   * console.log(`Total size: ${(stats.total_size_bytes / 1024 / 1024).toFixed(2)} MB`);
   * ```
   */
  async getStats(): Promise<AssetStats> {
    logger.debug(`[AssetsClient] Fetching asset statistics`);

    return this.executeWithRetry(() => this.client.get<AssetStats>('/api/v1/assets/stats'), 'get asset stats');
  }

  /**
   * Delete an asset by ID
   *
   * @param assetId UUID of the asset to delete
   * @throws Error if asset not found or deletion fails
   *
   * @example
   * ```typescript
   * await assetsClient.deleteAsset('550e8400-e29b-41d4-a716-446655440000');
   * console.log('Asset deleted');
   * ```
   */
  async deleteAsset(assetId: string): Promise<void> {
    if (!assetId?.trim()) {
      throw new Error('AssetsClient.deleteAsset: assetId is required');
    }

    this.validateUUID(assetId, 'assetId');

    logger.debug(`[AssetsClient] Deleting asset: ${assetId}`);

    await this.executeWithRetry(() => this.client.delete(`/api/v1/assets/${assetId}`), `delete asset: ${assetId}`);
  }

  /**
   * Delete a folder by ID
   *
   * @param folderId UUID of the folder to delete
   * @throws Error if folder not found or deletion fails
   *
   * @example
   * ```typescript
   * await assetsClient.deleteFolder('folder-uuid-123');
   * console.log('Folder deleted');
   * ```
   */
  async deleteFolder(folderId: string): Promise<void> {
    if (!folderId?.trim()) {
      throw new Error('AssetsClient.deleteFolder: folderId is required');
    }

    this.validateUUID(folderId, 'folderId');

    logger.debug(`[AssetsClient] Deleting folder: ${folderId}`);

    await this.executeWithRetry(() => this.client.delete(`/api/v1/folders/${folderId}`), `delete folder: ${folderId}`);
  }

  /**
   * Health check - verify connection to Assets service
   *
   * Use this to verify the Assets service is accessible before operations.
   *
   * @returns true if service is healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health/live', { timeout: 5000 });
      logger.debug('[AssetsClient] Health check passed');
      return response.status === 200;
    } catch (error) {
      logger.warn('[AssetsClient] Health check failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Execute request with automatic retry logic
   *
   * @private
   * @param request Request executor function
   * @param operationName Operation name for logging
   * @returns Response data
   * @throws Error if all retries fail
   */
  private async executeWithRetry<T>(request: () => Promise<any>, operationName: string): Promise<T> {
    let lastError: AxiosError | Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await request();
        return response.data;
      } catch (error) {
        lastError = error as AxiosError | Error;

        const axiosError = error as AxiosError;
        const statusCode = axiosError?.response?.status;

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          this.handleError(error, operationName);
        }

        logger.warn(
          `[AssetsClient] Attempt ${attempt}/${this.MAX_RETRIES} failed for ${operationName}:`,
          error instanceof Error ? error.message : error
        );

        if (attempt < this.MAX_RETRIES) {
          // Exponential backoff: 100ms, 200ms, 400ms
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        }
      }
    }

    // All retries failed
    this.handleError(lastError, operationName);
  }

  /**
   * Handle and format errors with proper logging
   *
   * @private
   * @param error Error object
   * @param operationName Operation name for context
   * @throws Formatted error
   */
  private handleError(error: unknown, operationName: string): never {
    const axiosError = error as AxiosError;

    if (axiosError?.response?.data) {
      const responseData = axiosError.response.data as any;
      const message = responseData.error || responseData.message || 'Unknown error';
      logger.error(`[AssetsClient] Failed to ${operationName}: ${message}`);
      throw new Error(`AssetsClient: ${operationName} failed - ${message}`);
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[AssetsClient] Failed to ${operationName}: ${message}`);
    throw new Error(`AssetsClient: ${operationName} failed - ${message}`);
  }

  /**
   * Validate UUID format
   *
   * @private
   * @param value UUID string to validate
   * @param fieldName Field name for error messages
   * @throws Error if not valid UUID
   */
  private validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`AssetsClient: ${fieldName} must be a valid UUID`);
    }
  }
}

/**
 * Singleton instance for convenience
 * Use getAssetsClient() to access the singleton
 */
let singletonInstance: AssetsClient | null = null;

/**
 * Initialize the singleton instance
 *
 * Call this once during application startup (in config or main initialization file)
 *
 * @param baseURL Base URL of the Assets API
 * @param apiKey API key for authentication
 * @returns Initialized AssetsClient instance
 *
 * @example
 * ```typescript
 * // In your app initialization
 * import { initAssetsClient } from './utils/assets-client';
 *
 * export async function bootstrapApp() {
 *   // ... other initialization
 *   initAssetsClient(
 *     process.env.ASSETS_API_URL || 'http://localhost:8080',
 *     process.env.ASSETS_API_KEY || 'your-api-key'
 *   );
 * }
 * ```
 */
export function initAssetsClient(baseURL: string, apiKey: string): AssetsClient {
  singletonInstance = new AssetsClient(baseURL, apiKey);
  logger.info('[AssetsClient] Singleton instance initialized');
  return singletonInstance;
}

/**
 * Get the singleton instance
 *
 * Must call initAssetsClient() first during application bootstrap
 *
 * @returns The AssetsClient singleton instance
 * @throws Error if not initialized
 *
 * @example
 * ```typescript
 * import { getAssetsClient } from './utils/assets-client';
 *
 * // In your service/controller
 * async function handleFileUpload(req, reply) {
 *   const assetsClient = getAssetsClient();
 *   const asset = await assetsClient.uploadBuffer(
 *     req.file.buffer,
 *     req.file.filename
 *   );
 * }
 * ```
 */
export function getAssetsClient(): AssetsClient {
  if (!singletonInstance) {
    throw new Error(
      'AssetsClient not initialized. Call initAssetsClient(baseURL, apiKey) during application bootstrap.'
    );
  }
  return singletonInstance;
}

export default AssetsClient;
