import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { config } from './config';
import type { BookingsExportJob, NotificationEvent } from './events';

/**
 * Publishing side of the notifications flow. Services call
 * `publishNotification(event)` to drop a typed event on the Notifications
 * SQS queue; the Notification Lambda (Step 6) consumes it and sends email.
 *
 * The client is created once at module scope so warm Lambda invocations
 * reuse it.
 */
const sqs = new SQSClient({});

export async function publishNotification(event: NotificationEvent): Promise<void> {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: config.notificationsQueueUrl,
      MessageBody: JSON.stringify(event),
    }),
  );
}

/** Enqueue a bookings-export job onto the Exports queue. */
export async function publishExportJob(job: BookingsExportJob): Promise<void> {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: config.exportsQueueUrl,
      MessageBody: JSON.stringify(job),
    }),
  );
}
