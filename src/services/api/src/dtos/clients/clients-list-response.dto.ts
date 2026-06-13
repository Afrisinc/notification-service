/**
 * Data Transfer Object for clients list response
 */
import { ClientDTO } from './client.dto';

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface ClientsListResponseDTO {
  data: ClientDTO[];
  meta: PaginationMeta;
}
