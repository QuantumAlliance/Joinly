export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ServiceResponse<T = unknown> {
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiResponse<T = unknown> extends ServiceResponse<T> {
  success: boolean;
}

export interface JwtPayload {
  sub: string;
  /** Null for an account that registered from a phone number alone. */
  email: string | null;
  role: string;
}

export interface AuthenticatedUser {
  userId: string;
  /** Null for an account that registered from a phone number alone. */
  email: string | null;
  role: string;
}
