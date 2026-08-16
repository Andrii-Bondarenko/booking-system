import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { NotificationEvent } from '../lib/events';

/**
 * Notification Lambda — consumes booking/import/export events from the
 * Notifications SQS queue and publishes an email message to the SNS
 * topic. AWS polls the queue and invokes this function with a BATCH of
 * messages (event.Records).
 *
 * We return `batchItemFailures` so that if some messages fail, ONLY
 * those are retried by SQS — the successful ones are not re-sent (which
 * would produce duplicate emails). The CDK event source must enable
 * `reportBatchItemFailures` for this to take effect.
 */
const sns = new SNSClient({});
const TOPIC_ARN = process.env.NOTIFICATIONS_TOPIC_ARN!;

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as NotificationEvent;
      const { subject, body } = renderEmail(message);

      await sns.send(new PublishCommand({ TopicArn: TOPIC_ARN, Subject: subject, Message: body }));
    } catch (err) {
      // Log and mark THIS message for retry; keep processing the rest.
      console.error(`Failed to process message ${record.messageId}`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

/** Turn a typed event into an email subject + body. */
function renderEmail(event: NotificationEvent): { subject: string; body: string } {
  switch (event.type) {
    case 'booking.created':
      return {
        subject: 'Your mentorship session is confirmed',
        body: `Booking ${event.bookingId} is confirmed for ${event.startTime}.`,
      };
    case 'booking.cancelled':
      return {
        subject: 'Your mentorship session was cancelled',
        body: `Booking ${event.bookingId} for ${event.startTime} has been cancelled.`,
      };
    case 'mentors.imported':
      return {
        subject: 'Mentor import complete',
        body:
          `Import finished. Processed ${event.processed}, ` + `succeeded ${event.succeeded}, failed ${event.failed}.`,
      };
    case 'bookings.exported':
      return {
        subject: 'Your bookings export is ready',
        body: `Exported ${event.recordCount} bookings. Download: ${event.downloadUrl}`,
      };
  }
}
