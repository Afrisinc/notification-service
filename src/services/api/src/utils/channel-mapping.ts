import type { Channel } from '@prisma/client';

export type UiChannel = 'email' | 'sms' | 'push' | 'in-app' | 'whatsapp';

const ENUM_TO_UI: Record<Channel, UiChannel> = {
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  IN_APP: 'in-app',
  WHATSAPP: 'whatsapp',
};

const UI_TO_ENUM: Record<UiChannel, Channel> = {
  email: 'EMAIL',
  sms: 'SMS',
  push: 'PUSH',
  'in-app': 'IN_APP',
  whatsapp: 'WHATSAPP',
};

export function normalizeChannel(channel: Channel): UiChannel {
  return ENUM_TO_UI[channel] ?? 'email';
}

export function toEnumChannel(channel?: UiChannel): Channel | undefined {
  return channel ? UI_TO_ENUM[channel] : undefined;
}
