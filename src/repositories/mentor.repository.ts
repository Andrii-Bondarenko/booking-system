import { BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, scanAll } from '../lib/dynamo';
import { config } from '../lib/config';
import type { Mentor } from '../lib/models';

/**
 * Mentor data access. Pure DynamoDB — no business rules live here.
 */
export const mentorRepository = {
  async get(mentorId: string): Promise<Mentor | undefined> {
    const result = await ddb.send(
      new GetCommand({ TableName: config.mentorsTable, Key: { mentorId } }),
    );
    return result.Item as Mentor | undefined;
  },

  async listActive(): Promise<Mentor[]> {
    const items = await scanAll({
      TableName: config.mentorsTable,
      FilterExpression: '#active = :true',
      ExpressionAttributeNames: { '#active': 'active' },
      ExpressionAttributeValues: { ':true': true },
    });
    return items as unknown as Mentor[];
  },

  /** Write many mentors. BatchWrite handles at most 25 items per call. */
  async batchPut(mentors: Mentor[]): Promise<void> {
    for (let i = 0; i < mentors.length; i += 25) {
      const chunk = mentors.slice(i, i + 25);
      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [config.mentorsTable]: chunk.map((mentor) => ({ PutRequest: { Item: mentor } })),
          },
        }),
      );
    }
  },
};
