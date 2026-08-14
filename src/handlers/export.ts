import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { putObject } from '../lib/storage';
import { publishNotification } from '../lib/messaging';
import { bookingRepository } from '../booking/booking.repository';
import { config } from '../lib/config';
import type { Booking } from '../booking/booking.model';

/**
 * Bookings Export Lambda — triggered by jobs on the Exports queue. For
 * each job it reads all bookings via the repository, builds a CSV, uploads
 * it to the exports bucket, and enqueues a `bookings.exported` event with
 * a download link. Returns `batchItemFailures` so only failed jobs retry.
 */
const COLUMNS = ['bookingId', 'studentId', 'mentorId', 'startTime'] as const;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const bookings = await bookingRepository.listAll();
      const csv = toCsv(bookings);

      // Use the message's send timestamp for a unique, stable key.
      const timestamp = record.attributes.SentTimestamp;
      const key = `booking-exports/${timestamp}/bookings.csv`;

      await putObject(config.exportsBucket, key, csv, 'text/csv');

      await publishNotification({
        type: 'bookings.exported',
        adminEmail: ADMIN_EMAIL,
        recordCount: bookings.length,
        // s3:// URI is enough for the demo; a real system would issue a
        // time-limited presigned HTTPS URL here.
        downloadUrl: `s3://${config.exportsBucket}/${key}`,
      });

      console.log(`Exported ${bookings.length} bookings to ${key}`);
    } catch (err) {
      console.error(`Failed export job ${record.messageId}`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

/** Turn booking records into CSV text (header + one row each). */
function toCsv(bookings: Booking[]): string {
  const header = COLUMNS.join(',');
  const rows = bookings.map((b) => COLUMNS.map((col) => String(b[col] ?? '')).join(','));
  return [header, ...rows].join('\n');
}
