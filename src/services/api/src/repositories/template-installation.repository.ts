import { prismaWrite, prismaRead } from '@shared/database';
import { logger } from '../config/logger';

export class AppTemplateRepository {
  /**
   * Create an app template installation
   */
  async create(data: { app_id: string; template_id: string; customizations?: any }): Promise<{
    id: string;
    app_id: string;
    template_id: string;
    customizations: any;
    status: string;
    installationDate: Date;
    updatedAt: Date;
  }> {
    try {
      const installation = await prismaWrite.appTemplate.create({
        data: {
          app_id: data.app_id,
          template_id: data.template_id,
          customizations: data.customizations,
        },
      });

      logger.info(
        { installationId: installation.id, templateId: data.template_id },
        'App template installation created'
      );
      return installation;
    } catch (error) {
      logger.error({ error, templateId: data.template_id }, 'Failed to create app template installation');
      throw error;
    }
  }

  /**
   * Find installation by ID
   */
  async findById(id: string): Promise<{
    id: string;
    app_id: string;
    template_id: string;
    customizations: any;
    status: string;
    installationDate: Date;
    updatedAt: Date;
  } | null> {
    try {
      return await prismaRead.appTemplate.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to find app template by ID');
      throw error;
    }
  }

  /**
   * Find installations for an app
   */
  async findByAppId(app_id: string): Promise<
    Array<{
      id: string;
      app_id: string;
      template_id: string;
      customizations: any;
      status: string;
      installationDate: Date;
      updatedAt: Date;
    }>
  > {
    try {
      return await prismaRead.appTemplate.findMany({
        where: { app_id },
        orderBy: { installationDate: 'desc' },
      });
    } catch (error) {
      logger.error({ error, app_id }, 'Failed to find templates for app');
      throw error;
    }
  }

  /**
   * Check if template is installed in app
   */
  async findByAppAndTemplate(
    app_id: string,
    template_id: string
  ): Promise<{
    id: string;
    app_id: string;
    template_id: string;
    customizations: any;
    status: string;
    installationDate: Date;
    updatedAt: Date;
  } | null> {
    try {
      return await prismaRead.appTemplate.findUnique({
        where: {
          app_id_template_id: {
            app_id,
            template_id,
          },
        },
      });
    } catch (error) {
      logger.error({ error, app_id, template_id }, 'Failed to find template for app');
      throw error;
    }
  }

  /**
   * Find all app installations by template ID
   */
  async findByTemplateId(template_id: string): Promise<
    Array<{
      id: string;
      app_id: string;
      template_id: string;
      customizations: any;
      status: string;
      installationDate: Date;
      updatedAt: Date;
    }>
  > {
    try {
      return await prismaRead.appTemplate.findMany({
        where: { template_id },
        orderBy: { installationDate: 'desc' },
      });
    } catch (error) {
      logger.error({ error, template_id }, 'Failed to find app installations for template');
      throw error;
    }
  }

  /**
   * Update app template installation
   */
  async update(
    id: string,
    data: { customizations?: any; status?: string }
  ): Promise<{
    id: string;
    app_id: string;
    template_id: string;
    customizations: any;
    status: string;
    installationDate: Date;
    updatedAt: Date;
  }> {
    try {
      const installation = await prismaWrite.appTemplate.update({
        where: { id },
        data,
      });

      logger.info({ installationId: id }, 'App template installation updated');
      return installation;
    } catch (error) {
      logger.error({ error, id }, 'Failed to update app template');
      throw error;
    }
  }

  /**
   * Delete app template installation
   */
  async delete(id: string): Promise<void> {
    try {
      await prismaWrite.appTemplate.delete({
        where: { id },
      });

      logger.info({ installationId: id }, 'App template installation deleted');
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete app template');
      throw error;
    }
  }

  /**
   * Count installations for a template
   */
  async countByTemplate(template_id: string): Promise<number> {
    try {
      return await prismaRead.appTemplate.count({
        where: { template_id },
      });
    } catch (error) {
      logger.error({ error, template_id }, 'Failed to count template installations');
      throw error;
    }
  }
}

export const appTemplateRepository = new AppTemplateRepository();
