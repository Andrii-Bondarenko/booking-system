import { Duration } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import * as path from 'node:path';
import type { DataConstruct } from './data.construct';
import type { MessagingConstruct } from './messaging.construct';
import type { StorageConstruct } from './storage.construct';

export interface ComputeConstructProps {
  data: DataConstruct;
  messaging: MessagingConstruct;
  storage: StorageConstruct;
}

/** Resolve a handler entry file relative to the project root. */
const handlerEntry = (file: string): string =>
  path.join(__dirname, '..', '..', 'src', 'handlers', file);

/** Defaults shared by all our Lambdas. */
const commonFnProps = {
  handler: 'handler',
  runtime: Runtime.NODEJS_20_X,
  memorySize: 256,
} as const;

/**
 * ComputeConstruct — the Lambdas and everything that triggers them:
 * API Gateway (Booking API), the SQS event sources (Notification +
 * Export), and the S3 event notification (CSV import). It also wires the
 * least-privilege IAM grants against the data/messaging/storage layers.
 */
export class ComputeConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ComputeConstructProps) {
    super(scope, id);
    const { data, messaging, storage } = props;

    // ---- Booking API Lambda + API Gateway --------------------------
    const bookingApiFn = new NodejsFunction(this, 'BookingApiFn', {
      ...commonFnProps,
      entry: handlerEntry('api.ts'),
      timeout: Duration.seconds(15),
      environment: {
        MENTORS_TABLE: data.mentorsTable.tableName,
        STUDENTS_TABLE: data.studentsTable.tableName,
        TIME_SLOTS_TABLE: data.timeSlotsTable.tableName,
        BOOKINGS_TABLE: data.bookingsTable.tableName,
        NOTIFICATIONS_QUEUE_URL: messaging.notificationsQueue.queueUrl,
        EXPORTS_QUEUE_URL: messaging.exportsQueue.queueUrl,
        IMPORTS_BUCKET: storage.importsBucket.bucketName,
      },
    });

    // Least-privilege for the API: read mentors/students; read+write
    // slots/bookings; send (not consume) to queues; put the import CSV.
    data.mentorsTable.grantReadData(bookingApiFn);
    data.studentsTable.grantReadWriteData(bookingApiFn);
    data.timeSlotsTable.grantReadWriteData(bookingApiFn);
    data.bookingsTable.grantReadWriteData(bookingApiFn);
    messaging.notificationsQueue.grantSendMessages(bookingApiFn);
    messaging.exportsQueue.grantSendMessages(bookingApiFn);
    storage.importsBucket.grantPut(bookingApiFn);

    this.buildApi(bookingApiFn);

    // ---- Notification Lambda (SQS -> SNS) --------------------------
    const notificationFn = new NodejsFunction(this, 'NotificationFn', {
      ...commonFnProps,
      entry: handlerEntry('notifications.ts'),
      timeout: Duration.seconds(30),
      environment: {
        NOTIFICATIONS_TOPIC_ARN: messaging.notificationsTopic.topicArn,
      },
    });
    messaging.notificationsTopic.grantPublish(notificationFn);
    notificationFn.addEventSource(
      new SqsEventSource(messaging.notificationsQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );

    // ---- CSV Import Processor (S3 -> DynamoDB + SQS) ---------------
    const csvProcessorFn = new NodejsFunction(this, 'CsvProcessorFn', {
      ...commonFnProps,
      entry: handlerEntry('csv-processor.ts'),
      timeout: Duration.seconds(60),
      environment: {
        MENTORS_TABLE: data.mentorsTable.tableName,
        NOTIFICATIONS_QUEUE_URL: messaging.notificationsQueue.queueUrl,
      },
    });
    storage.importsBucket.grantRead(csvProcessorFn);
    data.mentorsTable.grantWriteData(csvProcessorFn);
    messaging.notificationsQueue.grantSendMessages(csvProcessorFn);
    storage.importsBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(csvProcessorFn),
      { prefix: 'mentors-import/' },
    );

    // ---- Bookings Export (SQS -> DynamoDB -> S3) -------------------
    const exportFn = new NodejsFunction(this, 'ExportFn', {
      ...commonFnProps,
      entry: handlerEntry('export.ts'),
      memorySize: 512, // building a big CSV in memory wants more room
      timeout: Duration.seconds(120), // must stay below the queue's 300s
      environment: {
        BOOKINGS_TABLE: data.bookingsTable.tableName,
        EXPORTS_BUCKET: storage.exportsBucket.bucketName,
        NOTIFICATIONS_QUEUE_URL: messaging.notificationsQueue.queueUrl,
      },
    });
    data.bookingsTable.grantReadData(exportFn);
    storage.exportsBucket.grantPut(exportFn);
    messaging.notificationsQueue.grantSendMessages(exportFn);
    exportFn.addEventSource(
      new SqsEventSource(messaging.exportsQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      }),
    );
  }

  /**
   * Build the REST API resource tree. Every route points at the same
   * Lambda (proxy integration); the function's internal router dispatches
   * on the route template (event.resource).
   */
  private buildApi(fn: NodejsFunction): void {
    const api = new RestApi(this, 'BookingApi', {
      restApiName: 'MentorBooking API',
      description: 'HTTP API for the MentorBooking system.',
    });
    const lambda = new LambdaIntegration(fn);

    const students = api.root.addResource('students');
    students.addMethod('POST', lambda); // POST /students

    const mentors = api.root.addResource('mentors');
    mentors.addMethod('GET', lambda); // GET /mentors

    const mentor = mentors.addResource('{mentorId}');

    const timeslots = mentor.addResource('timeslots');
    timeslots.addMethod('GET', lambda);
    timeslots.addMethod('POST', lambda);

    mentor.addResource('bookings').addMethod('GET', lambda);

    const bookings = api.root.addResource('bookings');
    bookings.addMethod('POST', lambda);
    bookings.addResource('{bookingId}').addMethod('DELETE', lambda);

    api.root.addResource('import').addResource('mentors').addMethod('POST', lambda);
    api.root.addResource('exports').addResource('bookings').addMethod('POST', lambda);
  }
}
