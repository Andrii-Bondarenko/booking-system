import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ok } from '../../lib/http';
import { mentorService } from '../../services/mentor.service';

/**
 * GET /mentors  (optionally ?skill=aws&minExperience=3)
 * Thin handler: read query params, delegate to the service, respond.
 */
export async function listMentors(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const query = event.queryStringParameters ?? {};
  const mentors = await mentorService.list({
    skill: query.skill?.trim(),
    minExperience: query.minExperience ? Number(query.minExperience) : undefined,
  });
  return ok({ mentors });
}
