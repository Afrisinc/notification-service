/**
 * Contact DTOs (Data Transfer Objects)
 */

export interface CreateContactDto {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  subject?: string;
  message?: string;
  status?: string;
  subscribed?: boolean;
  tags?: string[];
  attributes?: Record<string, any>;
  source?: string;
  templateId?: string; // Optional auto-reply template ID (fallback to CONTACT_FORM_AUTOREPLY code)
}

export interface UpdateContactDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  status?: string;
  subscribed?: boolean;
  tags?: string[];
  attributes?: Record<string, any>;
}

export interface ListContactsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  tags?: string;
  subscribed?: string;
}

export interface ContactResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  status: string;
  subscribed: boolean;
  tags: string[];
  attributes: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
