import { logger } from '../config/logger';
import { handlebarsEngine } from './engines/handlebars.engine';
import { validateTemplateVariables } from './validators/template.validator';

/**
 * Result of template rendering
 */
export interface RenderResult {
  subject?: string;
  content: string;
  locale: string;
  version: number;
}

/**
 * Template data structure (from database)
 */
export interface TemplateData {
  id: string;
  code: string;
  channel: string;
  subject?: string;
  content: string;
  language: string;
  version: number;
  active: boolean;
  requiredVariables?: any;
}

/**
 * Template Renderer Service
 * Central service for loading and rendering templates with variable validation
 */
export class TemplateRenderer {
  /**
   * Render a template for a specific tenant
   * Loads the template by code, validates variables, and renders content
   * @param templateData - Template from database
   * @param variables - Variables to inject into template
   * @returns RenderResult with rendered subject and content
   * @throws Error if template is inactive, variables are missing, or rendering fails
   */
  public render(templateData: TemplateData, variables: Record<string, any>): RenderResult {
    try {
      // Validate template is active
      if (!templateData.active) {
        throw new Error(`Template is inactive: ${templateData.code}`);
      }

      // Validate required variables
      const validationResult = validateTemplateVariables(templateData.content, variables);

      if (!validationResult.valid) {
        const missingVars = validationResult.missingVariables || [];
        throw new Error(`Missing required template variables: ${missingVars.join(', ')}`);
      }

      // Render subject if present (EMAIL templates)
      let renderedSubject: string | undefined;
      if (templateData.subject) {
        try {
          renderedSubject = handlebarsEngine.render(templateData.subject, variables);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to render subject: ${errorMessage}`);
        }
      }

      // Render content
      let renderedContent: string;
      try {
        renderedContent = handlebarsEngine.render(templateData.content, variables);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to render content: ${errorMessage}`);
      }

      logger.debug(
        {
          templateCode: templateData.code,
          language: templateData.language,
          version: templateData.version,
        },
        'Template rendered successfully'
      );

      return {
        subject: renderedSubject,
        content: renderedContent,
        locale: templateData.language,
        version: templateData.version,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          error: errorMessage,
          templateCode: templateData.code,
          templateId: templateData.id,
        },
        'Failed to render template'
      );
      throw error;
    }
  }

  /**
   * Render template with safe error handling
   * @param templateData - Template from database
   * @param variables - Variables to inject
   * @returns Object with success status, content, or error
   */
  public renderSafe(
    templateData: TemplateData,
    variables: Record<string, any>
  ): { success: boolean; data?: RenderResult; error?: string } {
    try {
      const result = this.render(templateData, variables);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const templateRenderer = new TemplateRenderer();
