import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

/**
 * MessagingConstruct — the async backbone.
 *
 * - Notifications queue (+ DLQ): booking/import/export events -> emails.
 * - Exports queue (+ DLQ): export jobs.
 * - Notifications SNS topic: the Notification Lambda publishes emails here.
 *
 * Each working queue has a dead-letter queue so a message that fails 3
 * times is parked for inspection instead of retrying forever.
 */
export class MessagingConstruct extends Construct {
  public readonly notificationsQueue: Queue;
  public readonly exportsQueue: Queue;
  public readonly notificationsTopic: Topic;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const notificationsDlq = new Queue(this, 'NotificationsDlq', {
      retentionPeriod: Duration.days(14),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.notificationsQueue = new Queue(this, 'NotificationsQueue', {
      // Visibility timeout >= the consuming Lambda's timeout.
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: notificationsDlq, maxReceiveCount: 3 },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const exportsDlq = new Queue(this, 'ExportsDlq', {
      retentionPeriod: Duration.days(14),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.exportsQueue = new Queue(this, 'ExportsQueue', {
      // Exports are slower than emails, so give them more headroom.
      visibilityTimeout: Duration.seconds(300),
      deadLetterQueue: { queue: exportsDlq, maxReceiveCount: 3 },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.notificationsTopic = new Topic(this, 'NotificationsTopic', {
      displayName: 'MentorBooking notifications',
    });
  }
}
