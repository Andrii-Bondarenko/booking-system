import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { badRequest, created, ok, parseJson } from '../../lib/http';
import { timeslotService, type SlotInput } from '../../services/timeslot.service';

/** Pull mentorId from the path, or 400. */
function mentorIdOf(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.mentorId;
  if (!id) throw badRequest('mentorId path parameter is required');
  return id;
}

/** Pull slotId from the path, or 400. */
function slotIdOf(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.slotId;
  if (!id) throw badRequest('slotId path parameter is required');
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

/** PUT /mentors/{mentorId}/timeslots/{slotId} */
export async function updateTimeSlot(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJson<SlotInput>(event);
  const timeslot = await timeslotService.update(mentorIdOf(event), slotIdOf(event), body);
  return ok({ timeslot });
}

/** DELETE /mentors/{mentorId}/timeslots/{slotId} */
export async function removeTimeSlot(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const slotId = slotIdOf(event);
  await timeslotService.remove(mentorIdOf(event), slotId);
  return ok({ deleted: true, slotId });
}
