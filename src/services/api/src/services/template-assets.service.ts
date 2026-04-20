/**
 * Template Assets Service
 * Professional management of template files for marketplace
 * Organizes thumbnails, previews, and other media assets using folder hierarchy
 */

import { getAssetsClient, UploadOptions } from '../utils/assets-client';
import { logger } from '../config/logger';

/**
 * Professional folder structure for marketplace templates:
 *
 * marketplace/
 *   ├── {accountId}/
 *   │   ├── templates/
 *   │   │   ├── {templateId}/
 *   │   │   │   ├── thumbnail.jpg
 *   │   │   │   └── preview.jpg
 *   │   │   └── {templateId2}/
 *   │   │       ├── thumbnail.jpg
 *   │   │       └── preview.jpg
 *   │   └── ...
 *   └── shared/
 *       └── (default templates folder)
 */

export interface TemplateAssetUpload {
  thumbnail?: Buffer;
  previewImage?: Buffer;
  accountId: string;
  templateId: string;
  templateCode: string;
}

export interface TemplateAssetURLs {
  thumbnail?: string;
  previewImage?: string;
}

interface FolderCache {
  [key: string]: string; // path -> folderId mapping
}

export class TemplateAssetsService {
  private readonly MARKETPLACE_ROOT = 'marketplace';
  private folderCache: FolderCache = {};

  /**
   * Get AssetsClient lazily (only when needed, after initialization)
   */
  private getClient() {
    return getAssetsClient();
  }

  /**
   * Ensure folder hierarchy exists, using cache to avoid redundant API calls
   *
   * @param accountId Account ID
   * @param templateId Template ID
   * @returns Folder ID for the template
   */
  private async ensureFolderStructure(accountId: string, templateId: string): Promise<string> {
    const templateFolderPath = `${this.MARKETPLACE_ROOT}/${accountId}/templates/${templateId}`;

    // Return cached folder ID if available
    if (this.folderCache[templateFolderPath]) {
      logger.debug({ templateFolderPath, folderId: this.folderCache[templateFolderPath] }, 'Using cached folder ID');
      return this.folderCache[templateFolderPath];
    }

    try {
      // Create marketplace folder if needed
      const marketplaceFolderId = await this.getOrCreateFolder(
        this.MARKETPLACE_ROOT,
        'Marketplace assets and templates'
      );

      // Create account folder
      const accountFolderId = await this.getOrCreateFolder(
        `${accountId}`,
        `Assets for account ${accountId}`,
        marketplaceFolderId
      );

      // Create templates folder
      const templatesFolderId = await this.getOrCreateFolder('templates', 'Template library', accountFolderId);

      // Create template-specific folder
      const templateFolderId = await this.getOrCreateFolder(templateId, `Template ${templateId}`, templatesFolderId);

      // Cache the folder ID
      this.folderCache[templateFolderPath] = templateFolderId;

      logger.debug({ templateFolderPath, templateFolderId }, 'Folder structure created and cached');

      return templateFolderId;
    } catch (error) {
      logger.error(
        {
          templateFolderPath,
          error: error instanceof Error ? error.message : error,
        },
        'Failed to ensure folder structure'
      );
      throw error;
    }
  }

  /**
   * Get or create a folder by name (simple caching mechanism)
   *
   * @param name Folder name
   * @param description Folder description
   * @param parentFolderId Optional parent folder ID for nested structure
   * @returns Folder ID
   */
  private async getOrCreateFolder(name: string, description: string, parentFolderId?: string): Promise<string> {
    const client = this.getClient();

    try {
      // Try to create the folder (will succeed if it doesn't exist)
      const folder = await client.createFolder(name, description);
      logger.debug({ folderName: name, folderId: folder.id, parentFolderId }, 'Folder created');
      return folder.id;
    } catch (error) {
      // If folder already exists, try to find it from the list
      if (error instanceof Error && error.message.includes('already exists')) {
        logger.debug({ folderName: name }, 'Folder already exists, retrieving...');
        const folders = await client.listFolders();
        const existingFolder = folders.find((f) => f.name === name);
        if (existingFolder) {
          return existingFolder.id;
        }
      }

      logger.error(
        {
          folderName: name,
          error: error instanceof Error ? error.message : error,
        },
        'Failed to get or create folder'
      );
      throw error;
    }
  }

  /**
   * Upload and organize template assets to marketplace structure
   * Creates professional folder hierarchy and uses folder IDs for organization
   *
   * @param upload Asset upload configuration
   * @param uploadedUrls Optional existing URLs to preserve
   * @returns URLs for uploaded assets
   *
   * @example
   * ```typescript
   * const urls = await templateAssetsService.uploadTemplateAssets({
   *   thumbnail: fileBuffer,
   *   previewImage: previewBuffer,
   *   accountId: 'acc-123',
   *   templateId: 'tpl-456',
   *   templateCode: 'WELCOME_EMAIL'
   * });
   * // Returns: { thumbnail: 'https://...', previewImage: 'https://...' }
   * ```
   */
  async uploadTemplateAssets(
    upload: TemplateAssetUpload,
    uploadedUrls?: Partial<TemplateAssetURLs>
  ): Promise<TemplateAssetURLs> {
    const results: TemplateAssetURLs = {};

    logger.info(
      {
        accountId: upload.accountId,
        templateId: upload.templateId,
        templateCode: upload.templateCode,
        hasThumbnail: !!upload.thumbnail,
        hasPreview: !!upload.previewImage,
      },
      'Uploading template assets to marketplace'
    );

    try {
      // Ensure folder structure exists
      const templateFolderId = await this.ensureFolderStructure(upload.accountId, upload.templateId);

      const uploadOptions: UploadOptions = {
        folderId: templateFolderId,
        tags: ['marketplace', 'template', upload.templateCode.toLowerCase(), `account:${upload.accountId}`],
      };

      // Upload thumbnail if provided
      if (upload.thumbnail && !uploadedUrls?.thumbnail) {
        try {
          const assetThumbnail = await this.getClient().uploadBuffer(
            upload.thumbnail,
            `${upload.templateCode}_thumbnail.jpg`,
            { ...uploadOptions, tags: [...(uploadOptions.tags || []), 'thumbnail'] }
          );

          results.thumbnail = assetThumbnail.data.url;
          logger.info(
            {
              assetId: assetThumbnail.data.id,
              templateCode: upload.templateCode,
              folderId: templateFolderId,
            },
            'Thumbnail uploaded successfully'
          );
        } catch (error) {
          logger.warn(
            {
              templateCode: upload.templateCode,
              error: error instanceof Error ? error.message : error,
            },
            'Failed to upload thumbnail, continuing without it'
          );
        }
      } else if (uploadedUrls?.thumbnail) {
        results.thumbnail = uploadedUrls.thumbnail;
      }

      // Upload preview image if provided
      if (upload.previewImage && !uploadedUrls?.previewImage) {
        try {
          const assetPreview = await this.getClient().uploadBuffer(
            upload.previewImage,
            `${upload.templateCode}_preview.jpg`,
            { ...uploadOptions, tags: [...(uploadOptions.tags || []), 'preview'] }
          );

          results.previewImage = assetPreview.data.url;
          logger.info(
            {
              assetId: assetPreview.data.id,
              templateCode: upload.templateCode,
              folderId: templateFolderId,
            },
            'Preview image uploaded successfully'
          );
        } catch (error) {
          logger.warn(
            {
              templateCode: upload.templateCode,
              error: error instanceof Error ? error.message : error,
            },
            'Failed to upload preview image, continuing without it'
          );
        }
      } else if (uploadedUrls?.previewImage) {
        results.previewImage = uploadedUrls.previewImage;
      }

      logger.info(
        {
          accountId: upload.accountId,
          templateId: upload.templateId,
          folderId: templateFolderId,
          uploadedCount: Object.keys(results).filter((k) => results[k as keyof TemplateAssetURLs]).length,
        },
        'Template assets uploaded successfully'
      );

      return results;
    } catch (error) {
      logger.error(
        {
          accountId: upload.accountId,
          templateId: upload.templateId,
          templateCode: upload.templateCode,
          error: error instanceof Error ? error.message : error,
        },
        'Unexpected error uploading template assets'
      );

      throw error;
    }
  }

  /**
   * Delete template assets from marketplace
   * Cleans up thumbnail and preview files when template is unpublished/deleted
   *
   * @param templateId Template ID
   * @param assetIds Array of asset IDs to delete
   *
   * @example
   * ```typescript
   * await templateAssetsService.deleteTemplateAssets(
   *   'tpl-456',
   *   ['asset-id-1', 'asset-id-2']
   * );
   * ```
   */
  async deleteTemplateAssets(templateId: string, assetIds: string[]): Promise<void> {
    if (!assetIds || assetIds.length === 0) {
      logger.debug({ templateId }, 'No assets to delete');
      return;
    }

    logger.info({ templateId, assetCount: assetIds.length }, 'Deleting template assets');

    const deletePromises = assetIds.map((assetId) =>
      this.getClient()
        .deleteAsset(assetId)
        .then(() => logger.debug({ assetId, templateId }, 'Asset deleted'))
        .catch((error) =>
          logger.warn(
            { assetId, templateId, error: error instanceof Error ? error.message : error },
            'Failed to delete asset'
          )
        )
    );

    await Promise.all(deletePromises);

    logger.info({ templateId, assetCount: assetIds.length }, 'All template assets deleted');
  }

  /**
   * Get marketplace folder structure information
   * Returns folder hierarchy details for organizing assets professionally
   *
   * @param accountId Account ID
   * @returns Folder structure information
   */
  async getMarketplaceStructure(accountId: string): Promise<{
    marketplaceFolder: string;
    accountFolder: string;
    templatesFolder: string;
  }> {
    return {
      marketplaceFolder: this.MARKETPLACE_ROOT,
      accountFolder: `${this.MARKETPLACE_ROOT}/${accountId}`,
      templatesFolder: `${this.MARKETPLACE_ROOT}/${accountId}/templates`,
    };
  }

  /**
   * Clear folder cache (useful for testing or when folder structure changes)
   */
  clearFolderCache(): void {
    this.folderCache = {};
    logger.debug('Folder cache cleared');
  }

  /**
   * Get current folder cache state (for debugging)
   */
  getFolderCacheState(): FolderCache {
    return { ...this.folderCache };
  }
}

export const templateAssetsService = new TemplateAssetsService();
