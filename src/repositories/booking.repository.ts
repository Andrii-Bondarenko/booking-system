import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, scanAll } from '../lib/dynamo';
import { config } from '../lib/config';
import type { Booking } from '../lib/models';

/**
 * Booking data access. Note the two list methods use the GSIs we defined
 * on the Bookings table (byStudent / byMentor) — that's why looking up a
 * student's or mentor's bookings is a cheap Query, not a Scan.
 */
export const bookingRepository = {
  async get(bookingId: string): Promise<Booking | undefined> {
    const result = await ddb.send(
      new GetCommand({ TableName: config.bookingsTable, Key: { bookingId } }),
    );
    return result.Item as Booking | undefined;
  },

  async put(booking: Booking): Promise<void> {
    await ddb.send(new PutCommand({ TableName: config.bookingsTable, Item: booking }));
  },

  async delete(bookingId: string): Promise<void> {
    await ddb.send(new DeleteCommand({ TableName: config.bookingsTable, Key: { bookingId } }));
  },

  async listForStudent(studentId: string): Promise<Booking[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: config.bookingsTable,
        IndexName: config.bookingsByStudentIndex,
        KeyConditionExpression: 'studentId = :s',
        ExpressionAttributeValues: { ':s': studentId },
      }),
    );
    return (result.Items ?? []) as Booking[];
  },

  /** Every booking in the table (used by the export job). Scans + paginates. */
  async listAll(): Promise<Booking[]> {
    const items = await scanAll({ TableName: config.bookingsTable });
    return items as unknown as Booking[];
  },

  async listForMentor(mentorId: string): Promise<Booking[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: config.bookingsTable,
        IndexName: config.bookingsByMentorIndex,
        KeyConditionExpression: 'mentorId = :m',
        ExpressionAttributeValues: { ':m': mentorId },
      }),
    );
    return (result.Items ?? []) as Booking[];
  },
};
