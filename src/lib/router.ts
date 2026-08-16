import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { json } from './http';

export type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

/**
 * A middleware wraps a handler: it receives the next handler in the chain
 * and returns a new handler. This lets you add logic before and after
 * the inner call without touching the handler itself.
 *
 * Example:
 *   const withTiming: Middleware = (next) => async (event) => {
 *     const t = Date.now();
 *     const result = await next(event);
 *     console.log(`${Date.now() - t}ms`);
 *     return result;
 *   };
 */
export type Middleware = (next: Handler) => Handler;

/**
 * Compose middlewares left-to-right so the first argument is the outermost
 * wrapper (runs first on the way in, last on the way out).
 *
 *   compose(withLogging, withErrorHandling)(router.dispatch)
 *   // → withLogging wraps withErrorHandling wraps router.dispatch
 */
export function compose(...middlewares: Middleware[]): Middleware {
  return (handler) => middlewares.reduceRight((h, m) => m(h), handler);
}

/**
 * Mini router — register routes with method helpers, then pass
 * `router.dispatch` as the handler (optionally wrapped in middlewares).
 *
 * Matching uses API Gateway's `event.resource` (the route template, e.g.
 * `/mentors/{mentorId}`), so path parameters stay as-is in the key and
 * the real values are still available in `event.pathParameters`.
 */
export class Router {
  private readonly middlewares: Middleware[] = [];
  private readonly routes = new Map<string, Handler>();

  /** Register a global middleware. Runs for every request in order of registration. */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  get(path: string, handler: Handler): this {
    return this.register('GET', path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.register('POST', path, handler);
  }

  put(path: string, handler: Handler): this {
    return this.register('PUT', path, handler);
  }

  delete(path: string, handler: Handler): this {
    return this.register('DELETE', path, handler);
  }

  private register(method: string, path: string, handler: Handler): this {
    this.routes.set(`${method} ${path}`, handler);
    return this;
  }

  readonly dispatch: Handler = (event) => {
    const key = `${event.httpMethod} ${event.resource}`;
    const routeHandler = this.routes.get(key) ?? (() => Promise.resolve(json(404, { message: `No route for ${key}` })));
    return compose(...this.middlewares)(routeHandler)(event);
  };
}
