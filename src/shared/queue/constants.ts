export const RABBIT_CONSTANTS = {
  EXCHANGES: {
    MAIN: 'notifications',
    DLX: 'notifications.dlx',
  },
  QUEUES: {
    REQUEST: {
      SEND: 'notifications.request',
      DLQ: 'notifications.request.dlq',
    },
    EMAIL: {
      SEND: 'notifications.email',
      DLQ: 'notifications.email.dlq',
    },
    SMS: {
      SEND: 'notifications.sms',
      DLQ: 'notifications.sms.dlq',
    },
    IN_APP: {
      SEND: 'notifications.inapp',
      DLQ: 'notifications.inapp.dlq',
    },
  },
  ROUTING_KEYS: {
    REQUEST: {
      SEND: 'notification.request',
      DLQ: 'dlq.request',
    },
    EMAIL: {
      SEND: 'send_message.email',
      DLQ: 'dlq.email',
    },
    SMS: {
      SEND: 'send_message.sms',
      DLQ: 'dlq.sms',
    },
    IN_APP: {
      SEND: 'send_message.inapp',
      DLQ: 'dlq.inapp',
    },
  },
  MAX_RETRIES: {
    REQUEST: 3,
    EMAIL: 5,
    SMS: 3,
    IN_APP: 3,
  },
} as const;
