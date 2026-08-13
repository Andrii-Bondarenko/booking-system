import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { badRequest, created, ok, parseJson, requireStudentId } from '../../lib/http';
import {
  bookingService,
  type BookingWhen,
  type CreateBookingInput,
} from '../../services/booking.service';

/** Read the optional ?when=upcoming|past filter (defaults to all). */
function whenOf(event: APIGatewayProxyEvent): BookingWhen {
  const when = event.queryStringParameters?.when;
  return when === 'upcoming' || when === 'past' ? when : 'all';
}

/** POST /bookings — body: { mentorId, slotId, studentId, studentEmail } */
export async function createBooking(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseJson<Partial<CreateBookingInput>>(event);
  const booking = await bookingService.create({
    mentorId: body.mentorId ?? '',
    slotId: body.slotId ?? '',
    studentId: body.studentId ?? '',
    studentEmail: body.studentEmail ?? '',
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

/** GET /bookings — the calling student's own bookings. */
export async function listStudentBookings(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const bookings = await bookingService.listForStudent(requireStudentId(event), whenOf(event));
  return ok({ bookings });
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
