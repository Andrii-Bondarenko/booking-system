import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { accepted, getHeader, rawBody } from '../lib/http';
import { adminService } from './admin.service';

/**
 * POST /import/mentors
 * The CSV is sent as the raw request body (Content-Type: text/csv). We
 * store it and return 202 Accepted — processing continues asynchronously
 * via the S3-triggered csv-processor.
 */
export async function importMentors(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { bucket, key } = await adminService.importMentors(rawBody(event));
  return accepted({
    message: 'Mentor import received; processing will begin shortly.',
    bucket,
    key,
  });
}

/**
 * POST /exports/bookings
 * Enqueues an export job and returns 202 Accepted immediately. The admin
 * is emailed a download link once the export Lambda finishes.
 */
export async function exportBookings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { requestedAt } = await adminService.requestBookingsExport(getHeader(event, 'x-admin-id'));
  return accepted({
    message: 'Bookings export started; you will be emailed a download link.',
    requestedAt,
  });
}
