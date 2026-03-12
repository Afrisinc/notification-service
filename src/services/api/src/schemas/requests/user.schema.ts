export const CreateUserRequestSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
    },
    password: {
      type: 'string',
      minLength: 6,
      description: 'User password (minimum 6 characters)',
    },
    firstName: {
      type: 'string',
      minLength: 1,
      description: 'User first name',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      description: 'User last name',
    },
    phone: {
      type: 'string',
      minLength: 10,
      description: 'User phone number',
    },
    location: {
      type: 'string',
      description: 'User location/address (optional)',
    },
    tin: {
      type: 'string',
      description: 'Tax Identification Number (optional)',
    },
    companyName: {
      type: 'string',
      description: 'Company name (optional)',
    },
    role: {
      type: 'string',
      enum: ['ADMIN', 'SUPPORT', 'SELLER', 'BUYER'],
      description: 'User role (default: BUYER)',
    },
  },
  required: ['email', 'password', 'firstName', 'lastName', 'phone'],
  additionalProperties: false,
} as const;

export const UpdateUserRequestSchema = {
  type: 'object',
  properties: {
    firstName: {
      type: 'string',
      minLength: 1,
      description: 'User first name',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      description: 'User last name',
    },
    phone: {
      type: 'string',
      minLength: 10,
      description: 'User phone number',
    },
    location: {
      type: 'string',
      description: 'User location/address (optional)',
    },
  },
  additionalProperties: false,
} as const;

export const UserParamsSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'User unique identifier',
    },
  },
  required: ['id'],
} as const;
