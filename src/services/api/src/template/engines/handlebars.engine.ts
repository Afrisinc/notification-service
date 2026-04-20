// eslint-disable-next-line @typescript-eslint/no-require-imports
const Handlebars = require('handlebars');
import { logger } from '../../config/logger';

/**
 * Handlebars Template Rendering Engine
 * Provides safe template compilation and rendering with custom helpers
 */
export class HandlebarsEngine {
  private engine: any;

  constructor() {
    this.engine = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Date helper - formats timestamps with simple formats
    this.engine.registerHelper('date', (timestamp: any, format: string = 'ISO') => {
      try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }

        switch (format.toUpperCase()) {
          case 'ISO':
            return date.toISOString();
          case 'DATE':
            return date.toLocaleDateString();
          case 'TIME':
            return date.toLocaleTimeString();
          case 'DATETIME':
            return date.toLocaleString();
          default:
            return date.toISOString();
        }
      } catch (error) {
        logger.warn({ error, timestamp, format }, 'Date helper failed');
        return '';
      }
    });

    // Uppercase helper
    this.engine.registerHelper('uppercase', (text: any) => {
      return String(text).toUpperCase();
    });

    // Lowercase helper
    this.engine.registerHelper('lowercase', (text: any) => {
      return String(text).toLowerCase();
    });

    // Truncate helper - truncate text with ellipsis
    this.engine.registerHelper('truncate', (text: any, length: number = 50) => {
      const str = String(text);
      if (str.length <= length) {
        return str;
      }
      return str.substring(0, length) + '...';
    });

    // Default helper - provide fallback values
    this.engine.registerHelper('default', (value: any, defaultValue: any) => {
      return value !== null && value !== undefined && value !== '' ? value : defaultValue;
    });
  }

  /**
   * Compile a Handlebars template string
   * @param template - Template string with {{variable}} placeholders
   * @returns Compiled template function
   * @throws Error if template syntax is invalid
   */
  public compile(template: string): any {
    try {
      return this.engine.compile(template, { noEscape: false, strict: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to compile template');
      throw new Error(`Invalid template syntax: ${errorMessage}`);
    }
  }

  /**
   * Render a template string with provided variables
   * @param template - Template string
   * @param variables - Object containing template variables
   * @returns Rendered string
   * @throws Error if template is invalid or rendering fails
   */
  public render(template: string, variables: Record<string, any>): string {
    try {
      const compiled = this.compile(template);
      return compiled(variables);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to render template');
      throw error;
    }
  }

  /**
   * Safe render - catches errors and returns result object
   * @param template - Template string
   * @param variables - Object containing template variables
   * @returns Result object with success status and content or error
   */
  public renderSafe(
    template: string,
    variables: Record<string, any>
  ): { success: boolean; content?: string; error?: string } {
    try {
      const content = this.render(template, variables);
      return { success: true, content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const handlebarsEngine = new HandlebarsEngine();
