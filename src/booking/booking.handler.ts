import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { badRequest, created, ok, parseJson, requireStudentId } from '../lib/http';
import {
  bookingService,
  type BookingWhen,
  type CreateBookingInput,
} from './booking.service';

/** Read the optional ?when=upcoming|past filter (defaults to all). */
function whenOf(event: APIGatewayProxyEvent): BookingWhen {
  const when = event.queryStringParameters?.when;
  return when === 'upcoming' || when === 'past' ? when : 'all';
}

/** POST /bookings — body: { mentorId, slotId, studentId } */
export async function createBooking(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJson<Partial<CreateBookingInput>>(event);
  const booking = await bookingService.create({
    mentorId: body.mentorId ?? '',
    slotId: body.slotId ?? '',
    studentId: body.studentId ?? '',
  });
  return created({ booking });
}

/** DELETE /bookings/{bookingId} — caller identified via x-student-id. */
export async function cancelBooking(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const bookingId = event.pathParameters?.bookingId;
  if (!bookingId) throw badRequest('bookingId path parameter is required');

  await bookingService.cancel(bookingId, requireStudentId(event));
  return ok({ cancelled: true, bookingId });
}

/** GET /mentors/{mentorId}/bookings — a mentor's booked sessions. */
export async function listMentorBookings(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const mentorId = event.pathParameters?.mentorId;
  if (!mentorId) throw badRequest('mentorId path parameter is required');

  const bookings = await bookingService.listForMentor(mentorId, whenOf(event));
  return ok({ bookings });
}
