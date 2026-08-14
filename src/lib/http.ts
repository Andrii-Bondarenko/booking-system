import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * HTTP helpers shared by every Booking API endpoint.
 *
 * The key idea: endpoints THROW an HttpError (e.g. `throw notFound(...)`)
 * instead of building error responses by hand. The router's single
 * try/catch turns any HttpError into the right status code, and anything
 * unexpected into a 500. This keeps each handler focused on the happy path.
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Build a JSON HTTP response. */
export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const ok = (body: unknown) => json(200, body);
export const created = (body: unknown) => json(201, body);
export const accepted = (body: unknown) => json(202, body);

/** Return the request body as a decoded string (handles base64). */
export function rawBody(event: APIGatewayProxyEvent): string {
  if (!event.body) return '';

  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
}

/** Parse the request body as JSON, or throw a 400. */
export function parseJson<T>(event: APIGatewayProxyEvent): T {
  const raw = rawBody(event);
  if (!raw) throw badRequest('Request body is required');
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
}

/** Case-insensitive header lookup (API Gateway preserves client casing). */
export function getHeader(event: APIGatewayProxyEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) return headers[key] ?? undefined;
  }
  return undefined;
}

/**
 * Resolve the calling student's id. We have no real auth in this learning
 * project, so we accept it via the `x-student-id` header or a `studentId`
 * query parameter. A production system would read it from an authorizer.
 */
export function requireStudentId(event: APIGatewayProxyEvent): string {
  const id = getHeader(event, 'x-student-id') ?? event.queryStringParameters?.studentId;
  if (!id) {
    throw badRequest('Missing student identity (x-student-id header or studentId query param)');
  }
  return id;
}
