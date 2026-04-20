export interface FileAsset {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  tags: string[]; // adjust type if tags are objects
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
}

// Specific response type
export type FileAssetResponse = ApiResponse<FileAsset>;
