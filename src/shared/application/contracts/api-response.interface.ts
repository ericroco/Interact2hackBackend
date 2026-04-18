export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: PaginationMeta;
}

export function buildSuccess<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return { success: true, data, error: null, ...(meta && { meta }) };
}

export function buildError(error: string): ApiResponse<null> {
  return { success: false, data: null, error };
}

export function buildPaginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): ApiResponse<T[]> {
  return buildSuccess(data, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
