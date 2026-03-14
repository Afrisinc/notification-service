export const CreateAppRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Application name' },
    environment: {
      type: 'string',
      enum: ['production', 'staging', 'development'],
      description: 'Application environment',
    },
    description: { type: 'string', description: 'Application description (optional)' },
  },
  required: ['name', 'environment'],
} as const;

export const UpdateAppRequestSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Application name' },
    environment: {
      type: 'string',
      enum: ['production', 'staging', 'development'],
      description: 'Application environment',
    },
    status: { type: 'string', description: 'Application status (active, inactive)' },
  },
} as const;
