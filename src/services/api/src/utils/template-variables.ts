/**
 * Template Variable Extraction Utilities
 * Extracts and validates variables from template content and subject
 */

/**
 * Extract all variables from template content/subject
 * Variables are in the format: {{variableName}}
 */
export function extractVariablesFromTemplate(
  content: string,
  subject?: string
): Array<{
  name: string;
  type: string;
  required: boolean;
}> {
  const variableSet = new Set<string>();

  // Regex to find all {{variableName}} patterns
  const regex = /\{\{(\w+)\}\}/g;

  // Extract from content
  let match;
  while ((match = regex.exec(content)) !== null) {
    variableSet.add(match[1]);
  }

  // Extract from subject if provided
  if (subject) {
    const subjectRegex = /\{\{(\w+)\}\}/g;
    while ((match = subjectRegex.exec(subject)) !== null) {
      variableSet.add(match[1]);
    }
  }

  // Convert to array of variable objects
  return Array.from(variableSet)
    .sort()
    .map((name) => ({
      name,
      type: 'string', // Default type, can be enhanced based on naming conventions
      required: true, // All found variables are required
    }));
}

/**
 * Validate that all required variables are present in content
 */
export function validateTemplateVariables(
  requiredVars: string[],
  content: string,
  subject?: string
): { valid: boolean; missing: string[] } {
  const contentStr = subject ? `${subject} ${content}` : content;
  const foundVars = new Set<string>();

  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(contentStr)) !== null) {
    foundVars.add(match[1]);
  }

  const missing = requiredVars.filter((v) => !foundVars.has(v));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Format variables for display
 */
export function formatVariablesForDisplay(variables: Array<{ name: string; type: string; required: boolean }>): string {
  return variables.map((v) => `{{${v.name}}}`).join(', ');
}
