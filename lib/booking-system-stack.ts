import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { DataConstruct } from './constructs/data.construct';
import { MessagingConstruct } from './constructs/messaging.construct';
import { StorageConstruct } from './constructs/storage.construct';
import { ComputeConstruct } from './constructs/compute.construct';

/**
 * BookingSystemStack — the whole MentorBooking system, composed from four
 * focused constructs:
 *
 *   Data       DynamoDB tables + GSIs
 *   Messaging  SQS queues (+ DLQs) + SNS topic
 *   Storage    S3 buckets
 *   Compute    Lambdas + API Gateway + triggers + IAM grants
 *
 * Compute depends on the other three, so it receives them as props and
 * wires the triggers and least-privilege grants against them.
 */
export class BookingSystemStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const data = new DataConstruct(this, 'Data');
    const messaging = new MessagingConstruct(this, 'Messaging');
    const storage = new StorageConstruct(this, 'Storage');

    new ComputeConstruct(this, 'Compute', { data, messaging, storage });
  }
}
