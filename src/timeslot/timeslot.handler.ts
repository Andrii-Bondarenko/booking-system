import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { badRequest, created, ok, parseJson } from '../lib/http';
import { timeslotService, type SlotInput } from './timeslot.service';

/** Pull mentorId from the path, or 400. */
function mentorIdOf(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.mentorId;
  if (!id) throw badRequest('mentorId path parameter is required');
  return id;
}

/** GET /mentors/{mentorId}/timeslots */
export async function listTimeSlots(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const timeslots = await timeslotService.listAvailable(mentorIdOf(event));
  return ok({ timeslots });
}

/** POST /mentors/{mentorId}/timeslots — accepts one slot or a slots[] array. */
export async function createTimeSlots(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const mentorId = mentorIdOf(event);
  const body = parseJson<{ startTime?: string; endTime?: string; slots?: SlotInput[] }>(event);

  const inputs: SlotInput[] =
    body.slots ??
    (body.startTime && body.endTime
      ? [{ startTime: body.startTime, endTime: body.endTime }]
      : []);

  const timeslots = await timeslotService.create(mentorId, inputs);
  return created({ timeslots });
}
