import { ServiceResponse } from '../interfaces/service-response.interface';

/**
 * Wraps controller/service output in the project's standard response
 * envelope. `data` is always an array — singular endpoints wrap a single
 * entity as a one-element array (`buildResponse(200, 'ok', [entity])`).
 */
export function buildResponse<T>(
  statusCode: number,
  message: string,
  data: T[],
  metaData?: Record<string, unknown>,
): ServiceResponse<T> {
  return { statusCode, message, data, metaData };
}
