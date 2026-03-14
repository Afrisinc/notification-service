export const UserEntitySchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the user',
    },
    firstName: {
      type: 'string',
      description: 'User first name',
    },
    lastName: {
      type: 'string',
      description: 'User last name',
    },
    phone: {
      type: 'string',
      description: 'User phone number',
    },
    location: {
      type: 'string',
      description: 'User location/address (optional)',
    },
    email: {
      type: 'string',
      description: 'User email address',
    },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'INACTIVE', 'DORMANT', 'CLOSED', 'SUSPENDED'],
      description: 'User account status',
    },
    lastLogin: {
      type: 'string',
      format: 'date-time',
      description: 'Last login timestamp (optional)',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Account creation timestamp',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Account update timestamp',
    },
  },
  required: ['id', 'email', 'createdAt'],
} as const;

export const UserPublicSchema = {
  type: 'object',
  properties: {
    id: UserEntitySchema.properties.id,
    email: UserEntitySchema.properties.email,
    firstName: UserEntitySchema.properties.firstName,
    lastName: UserEntitySchema.properties.lastName,
    phone: UserEntitySchema.properties.phone,
    location: UserEntitySchema.properties.location,
    status: UserEntitySchema.properties.status,
    lastLogin: UserEntitySchema.properties.lastLogin,
    createdAt: UserEntitySchema.properties.createdAt,
    updatedAt: UserEntitySchema.properties.updatedAt,
  },
  required: ['id', 'email', 'createdAt'],
} as const;
