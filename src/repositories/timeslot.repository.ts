import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/dynamo';
import { config } from '../lib/config';
import type { TimeSlot } from '../lib/models';

/**
 * Time-slot data access. The interesting bit is markBooked: its atomic
 * ConditionExpression is what prevents two students double-booking the
 * same slot (see the booking service in Step 10).
 */
export const timeslotRepository = {
  async listForMentor(mentorId: string): Promise<TimeSlot[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: config.timeSlotsTable,
        KeyConditionExpression: 'mentorId = :m',
        ExpressionAttributeValues: { ':m': mentorId },
      }),
    );
    return (result.Items ?? []) as TimeSlot[];
  },

  async get(mentorId: string, slotId: string): Promise<TimeSlot | undefined> {
    const result = await ddb.send(
      new GetCommand({ TableName: config.timeSlotsTable, Key: { mentorId, slotId } }),
    );
    return result.Item as TimeSlot | undefined;
  },

  async put(slot: TimeSlot): Promise<void> {
    await ddb.send(new PutCommand({ TableName: config.timeSlotsTable, Item: slot }));
  },

  async delete(mentorId: string, slotId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({ TableName: config.timeSlotsTable, Key: { mentorId, slotId } }),
    );
  },

  /**
   * Mark booked ONLY if currently available. If two requests race, exactly
   * one succeeds; the other throws ConditionalCheckFailedException.
   */
  async markBooked(mentorId: string, slotId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: config.timeSlotsTable,
        Key: { mentorId, slotId },
        UpdateExpression: 'SET #status = :booked',
        ConditionExpression: '#status = :available',
        // `status` is a DynamoDB reserved word, so it must be aliased.
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':booked': 'booked', ':available': 'available' },
      }),
    );
  },

  async markAvailable(mentorId: string, slotId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: config.timeSlotsTable,
        Key: { mentorId, slotId },
        UpdateExpression: 'SET #status = :available',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':available': 'available' },
      }),
    );
  },
};
