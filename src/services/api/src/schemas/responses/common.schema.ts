export const SuccessResponseSchema = <T>(dataSchema: T) =>
  ({
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true,
        description: 'Indicates if the request was successful',
      },
      resp_msg: {
        type: 'string',
        description: 'Success message describing the operation',
      },
      resp_code: {
        type: 'number',
        example: 1000,
        description: 'Afrisinc response code (1xxx for success)',
      },
      data: dataSchema,
    },
    required: ['success', 'resp_msg', 'resp_code'],
  }) as const;

export const ErrorResponseSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      example: false,
      description: 'Indicates that the request failed',
    },
    resp_msg: {
      type: 'string',
      description: 'Error message describing what went wrong',
    },
    resp_code: {
      type: 'number',
      example: 2000,
      description: 'Afrisinc response code (2xxx/3xxx/4xxx/5xxx for errors)',
    },
  },
  required: ['success', 'resp_msg', 'resp_code'],
} as const;

export const HealthResponseSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      example: 'ok',
      description: 'Server status indicator',
    },
    message: {
      type: 'string',
      example: 'Server is running',
      description: 'Server status message',
    },
  },
  required: ['status', 'message'],
} as const;
