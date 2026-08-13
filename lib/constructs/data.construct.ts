import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * DataConstruct — all DynamoDB tables for MentorBooking.
 *
 * Tables are exposed as `public readonly` so the compute layer can
 * reference them (for env vars) and grant least-privilege access.
 *
 * Shared table settings:
 * - PAY_PER_REQUEST: no capacity planning; pay per request.
 * - RemovalPolicy.DESTROY: table dies with the stack (fine for learning;
 *   use RETAIN in production).
 */
export class DataConstruct extends Construct {
  public readonly mentorsTable: Table;
  public readonly studentsTable: Table;
  public readonly timeSlotsTable: Table;
  public readonly bookingsTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const commonTableProps = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    } as const;

    // Mentors — get by id / list all.
    this.mentorsTable = new Table(this, 'MentorsTable', {
      partitionKey: { name: 'mentorId', type: AttributeType.STRING },
      ...commonTableProps,
    });

    // Students — get by id.
    this.studentsTable = new Table(this, 'StudentsTable', {
      partitionKey: { name: 'studentId', type: AttributeType.STRING },
      ...commonTableProps,
    });

    // TimeSlots — composite key so we can Query all of a mentor's slots.
    this.timeSlotsTable = new Table(this, 'TimeSlotsTable', {
      partitionKey: { name: 'mentorId', type: AttributeType.STRING },
      sortKey: { name: 'slotId', type: AttributeType.STRING },
      ...commonTableProps,
    });

    // Bookings — primary key bookingId, plus two GSIs for the by-student
    // and by-mentor listings (each sorted by startTime).
    this.bookingsTable = new Table(this, 'BookingsTable', {
      partitionKey: { name: 'bookingId', type: AttributeType.STRING },
      ...commonTableProps,
    });

    this.bookingsTable.addGlobalSecondaryIndex({
      indexName: 'byStudent',
      partitionKey: { name: 'studentId', type: AttributeType.STRING },
      sortKey: { name: 'startTime', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    this.bookingsTable.addGlobalSecondaryIndex({
      indexName: 'byMentor',
      partitionKey: { name: 'mentorId', type: AttributeType.STRING },
      sortKey: { name: 'startTime', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
  }
}
