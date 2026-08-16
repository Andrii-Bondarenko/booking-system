import { Readable } from 'node:stream';
import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { putObjectStream } from '../lib/storage';
import { publishNotification } from '../lib/messaging';
import { bookingRepository } from '../booking/booking.repository';
import { config } from '../lib/config';
import type { Booking } from '../booking/booking.model';

/**
 * Bookings Export Lambda — triggered by jobs on the Exports queue. For each
 * job it streams all bookings page-by-page from DynamoDB, pipes them through
 * a CSV generator, and uploads directly to S3 without buffering the whole
 * dataset in memory. Returns `batchItemFailures` so only failed jobs retry.
 */
const COLUMNS = ['bookingId', 'studentId', 'mentorId', 'startTime'] as const;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const timestamp = record.attributes.SentTimestamp;
      const key = `booking-exports/${timestamp}/bookings.csv`;

      let recordCount = 0;
      const csvStream = Readable.from(generateCsv(() => (recordCount++, undefined)));

      await putObjectStream(config.exportsBucket, key, csvStream, 'text/csv');

      await publishNotification({
        type: 'bookings.exported',
        adminEmail: ADMIN_EMAIL,
        recordCount,
        downloadUrl: `s3://${config.exportsBucket}/${key}`,
      });

      console.log(`Exported ${recordCount} bookings to ${key}`);
    } catch (err) {
      console.error(`Failed export job ${record.messageId}`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

/**
 * Async generator that yields CSV lines one at a time. Reads DynamoDB one
 * page at a time via `scanPages()` so the full table is never in memory.
 * `onRow` is called for each data row (used to count records externally).
 */
async function* generateCsv(onRow: () => void): AsyncGenerator<string> {
  yield COLUMNS.join(',') + '\n';
  for await (const page of bookingRepository.scanPages()) {
    for (const booking of page) {
      yield COLUMNS.map((col) => String((booking as Booking)[col] ?? '')).join(',') + '\n';
      onRow();
    }
  }
}
