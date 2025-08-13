/**
 * Error response interfaces and types
 * Requirements: 4.4
 */

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Success response interface
 */
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Generic API response type
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Error codes for different types of errors
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DISCORD_API_ERROR = 'DISCORD_API_ERROR'
}

/**
 * Creates a standardized error response
 * @param error The error message
 * @param code Optional error code
 * @returns ErrorResponse object
 */
export function createErrorResponse(error: string, code?: ErrorCode): ErrorResponse {
  const result: ErrorResponse = {
    success: false,
    error
  };

  if (code !== undefined) {
    result.code = code;
  }

  return result;
}

/**
 * Creates a standardized success response
 * @param data Optional data to include
 * @param message Optional success message
 * @returns SuccessResponse object
 */
export function createSuccessResponse<T>(data?: T, message?: string): SuccessResponse<T> {
  const result: SuccessResponse<T> = {
    success: true
  };

  if (data !== undefined) {
    result.data = data;
  }

  if (message !== undefined) {
    result.message = message;
  }

  return result;
}

/**
 * Type guard to check if a response is an error response
 * @param response The response to check
 * @returns True if the response is an error response
 */
export function isErrorResponse(response: ApiResponse): response is ErrorResponse {
  return response.success === false;
}

/**
 * Type guard to check if a response is a success response
 * @param response The response to check
 * @returns True if the response is a success response
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}