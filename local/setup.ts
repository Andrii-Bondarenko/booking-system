/**
 * One-time setup script — run after `docker compose up -d`.
 * Creates the four DynamoDB tables and two SQS queues that the local
 * server needs. Safe to re-run: existing tables/queues are skipped.
 *
 *   npm run local:setup
 */
import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  BillingMode,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';
import { SQSClient, CreateQueueCommand, GetQueueUrlCommand } from '@aws-sdk/client-sqs';

const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const SQS_ENDPOINT = process.env.SQS_ENDPOINT ?? 'http://localhost:9324';

const awsConfig = {
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
  },
};

const ddb = new DynamoDBClient({ ...awsConfig, endpoint: DYNAMODB_ENDPOINT });
const sqs = new SQSClient({ ...awsConfig, endpoint: SQS_ENDPOINT });

// ---- Retry ----------------------------------------------------------

async function waitFor(name: string, fn: () => Promise<void>, retries = 15, delayMs = 1000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await fn();
      return;
    } catch {
      if (i === retries) throw new Error(`${name} not ready after ${retries} attempts`);
      process.stdout.write(`  waiting for ${name} (${i}/${retries})...\r`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ---- DynamoDB tables ------------------------------------------------

const TABLES: CreateTableCommandInput[] = [
  {
    TableName: process.env.MENTORS_TABLE ?? 'mentors',
    BillingMode: BillingMode.PAY_PER_REQUEST,
    KeySchema: [{ AttributeName: 'mentorId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'mentorId', AttributeType: 'S' }],
  },
  {
    TableName: process.env.STUDENTS_TABLE ?? 'students',
    BillingMode: BillingMode.PAY_PER_REQUEST,
    KeySchema: [{ AttributeName: 'studentId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'studentId', AttributeType: 'S' }],
  },
  {
    TableName: process.env.TIME_SLOTS_TABLE ?? 'timeslots',
    BillingMode: BillingMode.PAY_PER_REQUEST,
    KeySchema: [
      { AttributeName: 'mentorId', KeyType: 'HASH' },
      { AttributeName: 'slotId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'mentorId', AttributeType: 'S' },
      { AttributeName: 'slotId', AttributeType: 'S' },
    ],
  },
  {
    TableName: process.env.BOOKINGS_TABLE ?? 'bookings',
    BillingMode: BillingMode.PAY_PER_REQUEST,
    KeySchema: [{ AttributeName: 'bookingId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'bookingId', AttributeType: 'S' },
      { AttributeName: 'studentId', AttributeType: 'S' },
      { AttributeName: 'mentorId', AttributeType: 'S' },
      { AttributeName: 'startTime', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'byStudent',
        KeySchema: [
          { AttributeName: 'studentId', KeyType: 'HASH' },
          { AttributeName: 'startTime', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'byMentor',
        KeySchema: [
          { AttributeName: 'mentorId', KeyType: 'HASH' },
          { AttributeName: 'startTime', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
];

async function setupTables() {
  const { TableNames: existing = [] } = await ddb.send(new ListTablesCommand({}));
  for (const table of TABLES) {
    if (existing.includes(table.TableName!)) {
      console.log(`  [skip] table "${table.TableName}" already exists`);
      continue;
    }
    await ddb.send(new CreateTableCommand(table));
    console.log(`  [ok]   table "${table.TableName}" created`);
  }
}

// ---- SQS queues -----------------------------------------------------

const QUEUES = [
  process.env.NOTIFICATIONS_QUEUE_URL?.split('/').pop() ?? 'notifications',
  process.env.EXPORTS_QUEUE_URL?.split('/').pop() ?? 'exports',
];

async function setupQueues() {
  for (const name of QUEUES) {
    try {
      const { QueueUrl } = await sqs.send(new GetQueueUrlCommand({ QueueName: name }));
      console.log(`  [skip] queue "${name}" already exists → ${QueueUrl}`);
    } catch {
      const { QueueUrl } = await sqs.send(new CreateQueueCommand({ QueueName: name }));
      console.log(`  [ok]   queue "${name}" created → ${QueueUrl}`);
    }
  }
}

// ---- Main -----------------------------------------------------------

async function main() {
  console.log('Waiting for DynamoDB Local...');
  await waitFor('DynamoDB', () => ddb.send(new ListTablesCommand({})).then(() => undefined));
  console.log('  ready.\n');

  console.log('Creating DynamoDB tables...');
  await setupTables();

  console.log('\nWaiting for ElasticMQ (SQS)...');
  await waitFor('SQS', () => sqs.send(new CreateQueueCommand({ QueueName: '__healthcheck' })).then(() => undefined));
  console.log('  ready.\n');

  console.log('Creating SQS queues...');
  await setupQueues();

  console.log('\nSetup complete. You can now run: npm run local:dev');
}

main().catch((err) => {
  console.error('\nSetup failed:', err);
  process.exit(1);
});
