/**
 * Template Types
 * TypeScript interfaces matching the Prisma Template model
 */

import { Template as PrismaTemplate } from '@prisma/client';

export type Channel = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH' | 'WHATSAPP';
export type TemplateCategory = 'AUTH' | 'TRANSACTIONAL' | 'MARKETING' | 'NOTIFICATION';
export type EditorType = 'visual' | 'code';
export type TemplateVisibility = 'private' | 'account' | 'marketplace';
export type TemplatePricing = 'free' | 'paid';
export type Currency = PrismaTemplate['currency']; // Use Prisma's actual currency type

/**
 * Template Interface
 * Uses Prisma's auto-generated Template type for perfect alignment
 */
export type Template = PrismaTemplate;

/**
 * Template creation request
 */
export interface CreateTemplateRequest {
  code: string;
  channel: Channel;
  category?: TemplateCategory;
  subject?: string;
  content: string;
  language?: string;
  requiredVariables?: Record<string, any>;
  design_json?: Record<string, any>;
  editor_type?: EditorType;
  description?: string;
}

/**
 * Template update request
 */
export interface UpdateTemplateRequest {
  code?: string;
  channel?: Channel;
  category?: TemplateCategory;
  subject?: string;
  content?: string;
  language?: string;
  requiredVariables?: Record<string, any>;
  design_json?: Record<string, any>;
  editor_type?: EditorType;
  description?: string;
  active?: boolean;
}
