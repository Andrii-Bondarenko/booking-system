import { randomUUID } from 'node:crypto';
import { badRequest } from '../lib/http';
import { config } from '../lib/config';
import { putObject } from '../lib/storage';
import { publishExportJob } from '../lib/messaging';
import { nowIso } from '../lib/time';

/**
 * Admin business logic.
 *
 * importMentors just PARKS the CSV in S3 and returns — the heavy lifting
 * (parse, validate, write, notify) happens asynchronously in the
 * S3-triggered csv-processor Lambda. This keeps the HTTP request fast.
 *
 * requestBookingsExport just ENQUEUES a job — the export Lambda does the
 * scan + CSV generation off the request path.
 */
export const adminService = {
  async importMentors(csv: string): Promise<{ bucket: string; key: string }> {
    if (!csv.trim()) throw badRequest('CSV content is required in the request body');

    // The mentors-import/ prefix is what the S3 event notification filters
    // on, so uploading here is what triggers processing.
    const key = `mentors-import/${Date.now()}-${randomUUID()}/mentors.csv`;
    await putObject(config.importsBucket, key, csv, 'text/csv');

    return { bucket: config.importsBucket, key };
  },

  async requestBookingsExport(requestedBy?: string): Promise<{ requestedAt: string }> {
    const requestedAt = nowIso();
    await publishExportJob({ type: 'bookings.export.requested', requestedAt, requestedBy });
    return { requestedAt };
  },
};
