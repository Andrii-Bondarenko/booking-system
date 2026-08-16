import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { badRequest, ok } from '../lib/http';
import { mentorService } from './mentor.service';

/**
 * GET /mentors  (optionally ?skill=aws&minExperience=3)
 * Thin handler: read query params, delegate to the service, respond.
 */
export async function listMentors(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const query = event.queryStringParameters ?? {};

  let minExperience: number | undefined;
  if (query.minExperience !== undefined) {
    minExperience = Number(query.minExperience);
    if (!Number.isFinite(minExperience) || minExperience < 0) {
      throw badRequest('minExperience must be a non-negative number');
    }
  }

  const mentors = await mentorService.list({
    skill: query.skill?.trim() || undefined,
    minExperience,
  });
  return ok({ mentors });
}
