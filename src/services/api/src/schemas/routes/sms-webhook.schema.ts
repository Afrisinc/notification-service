export const AfricasTalkingDeliveryReportSchema = {
  description: "Africa's Talking SMS delivery report webhook (form-urlencoded)",
  tags: ['Webhooks'],
  consumes: ['application/x-www-form-urlencoded'],
  body: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      status: {
        type: 'string',
        enum: ['Sent', 'Submitted', 'Buffered', 'Rejected', 'Success', 'Failed', 'AbsentSubscriber', 'Expired'],
      },
      phoneNumber: { type: 'string' },
      networkCode: { type: 'string' },
      failureReason: { type: 'string' },
      retryCount: { type: 'string' },
    },
    required: ['id', 'status'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
};
