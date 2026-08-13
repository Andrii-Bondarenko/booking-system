import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { ScanCommandInput } from '@aws-sdk/lib-dynamodb';

/**
 * A single, shared DynamoDB Document Client.
 *
 * Why "Document" client? The low-level DynamoDBClient speaks DynamoDB's
 * wire format ({ "S": "abc" }, { "N": "42" }, ...). The DocumentClient
 * wraps it so we work with plain JavaScript objects instead. Much nicer.
 *
 * We create it at module scope (outside the handler) so that when a warm
 * Lambda reuses its container, it reuses this client too — no reconnect
 * cost on every invocation.
 */
const baseClient = new DynamoDBClient({});

export const ddb = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    // Don't write attributes whose value is `undefined`.
    removeUndefinedValues: true,
  },
});

/**
 * Scan a whole table, following pagination. A single Scan returns at most
 * 1MB, so we loop on LastEvaluatedKey until everything is read. Fine at
 * demo scale; large tables should use a Query on a GSI instead.
 */
export async function scanAll(params: ScanCommandInput): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({ ...params, ExclusiveStartKey: startKey }));
    items.push(...(result.Items ?? []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return items;
}
