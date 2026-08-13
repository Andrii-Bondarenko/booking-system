import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { HttpError, json } from '../lib/http';
import { listMentors } from './api/mentors';
import {
  createTimeSlots,
  listTimeSlots,
  removeTimeSlot,
  updateTimeSlot,
} from './api/timeslots';
import {
  cancelBooking,
  createBooking,
  listMentorBookings,
  listStudentBookings,
} from './api/bookings';
import { exportBookings, importMentors } from './api/admin';

/**
 * Booking API Lambda — the SINGLE handler behind API Gateway.
 *
 * API Gateway sends every route here. We dispatch on "METHOD /resource"
 * (the route template, so path ids like {mentorId} stay generic) to the
 * matching domain handler.
 *
 * Error handling lives here ONCE: domain handlers just `throw` an
 * HttpError (badRequest/notFound/conflict/...) and we translate it to the
 * right status. Anything unexpected becomes a 500 without leaking details.
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const key = `${event.httpMethod} ${event.resource}`;

  try {
    switch (key) {
      // ---- Mentors -------------------------------------------------
      case 'GET /mentors':
        return await listMentors(event);

      // ---- Time slots ----------------------------------------------
      case 'GET /mentors/{mentorId}/timeslots':
        return await listTimeSlots(event);
      case 'POST /mentors/{mentorId}/timeslots':
        return await createTimeSlots(event);
      case 'PUT /mentors/{mentorId}/timeslots/{slotId}':
        return await updateTimeSlot(event);
      case 'DELETE /mentors/{mentorId}/timeslots/{slotId}':
        return await removeTimeSlot(event);

      // ---- Bookings ------------------------------------------------
      case 'POST /bookings':
        return await createBooking(event);
      case 'DELETE /bookings/{bookingId}':
        return await cancelBooking(event);
      case 'GET /bookings':
        return await listStudentBookings(event);
      case 'GET /mentors/{mentorId}/bookings':
        return await listMentorBookings(event);

      // ---- Admin ---------------------------------------------------
      case 'POST /import/mentors':
        return await importMentors(event);
      case 'POST /exports/bookings':
        return await exportBookings(event);

      default:
        return json(404, { message: `No route for ${key}` });
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return json(err.statusCode, { message: err.message });
    }
    console.error('Unhandled error', err);
    return json(500, { message: 'Internal server error' });
  }
}
