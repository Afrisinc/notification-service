import { logger } from '../../config/logger';

/**
 * Template Variable Validation
 * Validates that all required variables are provided before rendering
 */

export interface ValidationResult {
  valid: boolean;
  missingVariables?: string[];
  errors?: string[];
}

/**
 * Extract required variables from Handlebars template content
 * Matches {{variable}} and {{#section}} patterns
 * @param template - Template string with {{variable}} placeholders
 * @returns Array of required variable names
 */
export function extractRequiredVariables(template: string): string[] {
  try {
    // Match both simple variables {{var}} and block helpers {{#section}}
    // Pattern: {{ followed by optional # or /, variable name/path, then }}
    const variablePattern = /\{\{#?\/?([a-zA-Z_$][a-zA-Z0-9_$.@\[\]]*)/g;
    const matches = new Set<string>();

    let match;
    while ((match = variablePattern.exec(template)) !== null) {
      let varName = match[1];

      // Handle array access like items.[0].name -> items
      varName = varName.replace(/\.\[[0-9]+\]/g, '');

      // Extract the root variable (before first dot or bracket)
      const rootVar = varName.split(/[\.\[]/).pop() || varName;

      // Skip built-in helpers
      if (!['if', 'else', 'each', 'unless', 'with', 'is', 'and', 'or', 'not'].includes(rootVar)) {
        matches.add(varName);
      }
    }

    return Array.from(matches);
  } catch (error) {
    logger.warn({ error }, 'Failed to extract required variables');
    return [];
  }
}

/**
 * Check if a nested path exists in an object
 * Supports dot notation (user.name) and array notation (items.[0].name)
 * @param obj - Object to check
 * @param path - Dot notation path (e.g., "user.profile.name")
 * @returns true if path exists and has a value, false otherwise
 */
export function checkNestedPath(obj: any, path: string): boolean {
  try {
    // Handle array access notation
    const parts = path.replace(/\.\[/g, '.').replace(/\]/g, '').split('.');

    let current = obj;
    for (const part of parts) {
      if (part === '' || part === undefined) {
        continue;
      }

      if (current === null || current === undefined) {
        return false;
      }

      current = current[part];
    }

    // Check if final value is not null, undefined, or empty string
    return current !== null && current !== undefined && current !== '';
  } catch (error) {
    logger.warn({ error, path }, 'Error checking nested path');
    return false;
  }
}

/**
 * Validate that all required variables are provided
 * @param required - Array of required variable names (e.g., ["user.name", "email"])
 * @param provided - Object containing provided variables
 * @returns ValidationResult with valid status and any missing variables
 */
export function validateVariables(required: string[], provided: Record<string, any>): ValidationResult {
  try {
    const missingVariables: string[] = [];
    const errors: string[] = [];

    // Check if provided is an object
    if (!provided || typeof provided !== 'object') {
      return {
        valid: false,
        missingVariables: required,
        errors: ['Provided variables must be an object'],
      };
    }

    // Check each required variable
    for (const varName of required) {
      const exists = checkNestedPath(provided, varName);

      if (!exists) {
        missingVariables.push(varName);
      }
    }

    return {
      valid: missingVariables.length === 0,
      missingVariables: missingVariables.length > 0 ? missingVariables : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Failed to validate variables');

    return {
      valid: false,
      errors: [errorMessage],
    };
  }
}

/**
 * Parse required variables from template and validate against provided variables
 * Convenience function that combines extraction and validation
 * @param template - Template string
 * @param provided - Provided variables object
 * @returns ValidationResult
 */
export function validateTemplateVariables(
  template: string,
  provided: Record<string, any>,
): ValidationResult {
  try {
    const required = extractRequiredVariables(template);
    return validateVariables(required, provided);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Failed to validate template variables');

    return {
      valid: false,
      errors: [errorMessage],
    };
  }
}
