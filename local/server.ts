/**
 * Local development server — wraps the Lambda handler in a plain Node.js
 * HTTP server so you can call it with curl / Postman without deploying.
 *
 *   npm run local:dev
 *
 * It reconstructs an APIGatewayProxyEvent from each incoming request,
 * calls the real handler, and writes the result back as an HTTP response.
 *
 * Limitations vs real API Gateway:
 *   - No auth: pass x-student-id as a header directly
 *   - import/export endpoints need S3 (not provided locally)
 *   - No request size limits or timeouts
 */
import * as http from 'node:http';
import * as dynamoose from 'dynamoose';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// ---- Dynamoose local configuration ----------------------------------
// Must happen before the first DynamoDB operation (not before imports —
// model registration is pure JS, no network calls at import time).
dynamoose.aws.ddb.set(
  new DynamoDB({
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
    },
  }),
);

// Import handler AFTER ddb is configured (Dynamoose reads ddb client at
// first operation, not at schema registration, so timing is safe).
import { handler } from '../src/handlers/api';

// ---- Path matching --------------------------------------------------
// Translates a concrete URL path into the route template + extracted
// path parameters that API Gateway would normally provide.

const ROUTE_TEMPLATES = [
  '/students',
  '/mentors',
  '/mentors/{mentorId}/timeslots',
  '/mentors/{mentorId}/bookings',
  '/bookings',
  '/bookings/{bookingId}',
  '/import/mentors',
  '/exports/bookings',
];

interface RouteMatch {
  resource: string;
  pathParameters: Record<string, string>;
}

function matchPath(pathname: string): RouteMatch | null {
  for (const template of ROUTE_TEMPLATES) {
    const paramNames: string[] = [];
    const regexStr = template.replace(/\{([^}]+)\}/g, (_, name: string) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const m = pathname.match(new RegExp(`^${regexStr}$`));
    if (m) {
      const pathParameters: Record<string, string> = {};
      paramNames.forEach((name, i) => {
        pathParameters[name] = m[i + 1]!;
      });
      return { resource: template, pathParameters };
    }
  }
  return null;
}

// ---- HTTP helpers ---------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function flattenHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = Array.isArray(value) ? value.join(', ') : (value ?? '');
  }
  return out;
}

// ---- Server ---------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3001);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const matched = matchPath(url.pathname);

  const body = await readBody(req);

  const queryStringParameters: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
  });

  const event = {
    httpMethod: req.method ?? 'GET',
    resource: matched?.resource ?? url.pathname,
    path: url.pathname,
    pathParameters: matched?.pathParameters ?? null,
    queryStringParameters: Object.keys(queryStringParameters).length ? queryStringParameters : null,
    headers: flattenHeaders(req.headers),
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    body: body || null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
  } satisfies APIGatewayProxyEvent;

  try {
    const result = await handler(event);
    res.writeHead(result.statusCode, {
      'content-type': 'application/json',
      ...result.headers,
    });
    res.end(result.body ?? '');
  } catch (err) {
    console.error('Unhandled server error', err);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`\nLocal server → http://localhost:${PORT}`);
  console.log(`DynamoDB     → ${process.env.DYNAMODB_ENDPOINT}`);
  console.log(`SQS          → ${process.env.SQS_ENDPOINT}`);
  console.log('\nRoutes:');
  ROUTE_TEMPLATES.forEach((r) => console.log(`  ${r}`));
  console.log();
});
