/**
 * Data Transfer Object for clients list filters (internal use in repository)
 */
export interface ClientsListFiltersDTO {
  limit: number;
  offset: number;
  search?: string;
  status?: string;
  plan?: string;
}
