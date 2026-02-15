/**
 * Data Transfer Object for API Key
 */
export interface ApiKeyDTO {
  id: string;
  name: string;
  key?: string;
  plainKey?: string;
  createdAt: Date;
  revokedAt?: Date | null;
  message?: string;
}
