import { logger } from '../config/logger';

/**
 * Template data request structure
 */
export interface TemplateRequestData {
  code: string;
  channel: string;
  subject?: string;
  content: string;
  language: string;
  description?: string;
  design_json?: any;
  editor_type?: 'visual' | 'code';
  is_public?: boolean;
  visibility?: 'private' | 'public';
}

/**
 * Parsed template data for storage
 */
export interface ParsedTemplateData {
  code: string;
  channel: string;
  subject?: string;
  content: string;
  language: string;
  description?: string;
  design_json?: any;
  editor_type: 'visual' | 'code';
  requiredVariables: string[];
}

/**
 * Extract variables from HTML template content
 * Matches {{variableName}} patterns
 *
 * @param content HTML template content
 * @returns Array of variable names
 */
export function extractVariablesFromContent(content: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = variablePattern.exec(content)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables).sort();
}

/**
 * Validate editor type
 * Ensures editor_type is one of: 'visual' or 'code'
 *
 * @param editorType Editor type to validate
 * @returns Valid editor type, defaults to 'visual'
 */
export function normalizeEditorType(editorType?: string): 'visual' | 'code' {
  if (editorType === 'code') {
    return 'code';
  }
  return 'visual'; // default
}

/**
 * Validate design JSON structure
 * Ensures design_json is a valid object if provided
 *
 * @param designJson Design JSON to validate
 * @returns Valid design JSON or null
 */
export function validateDesignJson(designJson?: any): any | null {
  if (!designJson) {
    return null;
  }

  // If it's a string, try to parse it
  if (typeof designJson === 'string') {
    try {
      return JSON.parse(designJson);
    } catch (error) {
      logger.warn('Failed to parse design_json as JSON string', { designJson, error });
      return null;
    }
  }

  // If it's an object, return as-is
  if (typeof designJson === 'object') {
    return designJson;
  }

  return null;
}

/**
 * Extract design JSON from embedded HTML comment (legacy format)
 * Handles base64-encoded JSON in HTML comment: <!-- emailbuilder-json:base64 -->
 *
 * @param content Template content that may include embedded JSON
 * @returns Parsed design JSON object or null if not found
 */
function extractEmbeddedDesignJson(content: string): any | null {
  try {
    const match = content.match(/<!-- emailbuilder-json:([A-Za-z0-9+/=]+) -->/i);

    if (!match) {
      return null;
    }

    const base64Json = match[1];
    const jsonString = Buffer.from(base64Json, 'base64').toString('utf-8');
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('Failed to extract embedded design JSON', { error });
    return null;
  }
}

/**
 * Parse template request data into structured template data
 * Extracts and normalizes all fields for database storage
 * Handles both separate fields and legacy embedded JSON format
 *
 * @param requestData Raw template request data
 * @returns Parsed template data ready for storage
 */
export function parseTemplateRequest(requestData: TemplateRequestData): ParsedTemplateData {
  try {
    // Clean content (remove embedded JSON comment) and extract variables
    const cleanContent = extractHtmlContent(requestData.content);
    const requiredVariables = extractVariablesFromContent(cleanContent);

    // Handle design_json: use provided value or extract from embedded comment
    let designJson = validateDesignJson(requestData.design_json);
    if (!designJson) {
      designJson = extractEmbeddedDesignJson(requestData.content);
    }

    const editorType = normalizeEditorType(requestData.editor_type);

    return {
      code: requestData.code,
      channel: requestData.channel,
      subject: requestData.subject,
      content: cleanContent, // Store clean HTML without embedded JSON
      language: requestData.language,
      description: requestData.description,
      design_json: designJson,
      editor_type: editorType,
      requiredVariables,
    };
  } catch (error) {
    logger.error('Failed to parse template request', {
      error,
      data: requestData,
    });
    throw error;
  }
}

/**
 * Extract HTML content from template (removes any embedded data)
 * Useful when sending templates to email providers
 *
 * @param content Template content that may include embedded data
 * @returns Pure HTML content
 */
export function extractHtmlContent(content: string): string {
  // Remove any embedded JSON comments at the end
  return content.replace(/\n?<!-- emailbuilder-json:.*-->$/i, '').trim();
}

/**
 * Validate template content is valid HTML
 *
 * @param content Content to validate
 * @returns true if content appears to be HTML
 */
export function isValidHtmlContent(content: string): boolean {
  const htmlPattern = /^<!DOCTYPE|^<html|^<div|^<p|^<table/i;
  return htmlPattern.test(content.trim());
}

/**
 * Prepare template data for response
 * Ensures all fields are properly formatted for API response
 *
 * @param templateData Template data from database
 * @returns Formatted response data
 */
export function formatTemplateResponse(templateData: any): any {
  return {
    id: templateData.id,
    code: templateData.code,
    channel: templateData.channel,
    category: templateData.category,
    subject: templateData.subject,
    content: templateData.content,
    language: templateData.language,
    version: templateData.version,
    active: templateData.active,
    requiredVariables: templateData.requiredVariables || [],
    design_json: templateData.design_json,
    editor_type: templateData.editor_type || 'visual',
    description: templateData.description,
    createdAt: templateData.createdAt,
    updatedAt: templateData.updatedAt,
  };
}
