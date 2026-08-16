import { HttpError, json } from './http';
import type { Middleware } from './router';

/**
 * Catches any HttpError thrown by a handler and converts it to the right
 * HTTP status. Anything else becomes a 500 without leaking internal details.
 * Place this close to the core so every handler is covered.
 */
export const withErrorHandling: Middleware = (next) => async (event) => {
  try {
    return await next(event);
  } catch (err) {
    if (err instanceof HttpError) {
      return json(err.statusCode, { message: err.message });
    }
    console.error('Unhandled error', err);
    return json(500, { message: 'Internal server error' });
  }
};

/**
 * Logs each request and its outcome: method, resource template, status
 * code, and wall-clock time. Place this outside withErrorHandling so it
 * sees the final status even when an error was caught.
 */
export const withLogging: Middleware = (next) => async (event) => {
  const start = Date.now();
  const result = await next(event);
  console.log(`${event.httpMethod} ${event.resource} → ${result.statusCode} (${Date.now() - start}ms)`);
  return result;
};
