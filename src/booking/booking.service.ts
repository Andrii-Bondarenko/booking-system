import * as dynamoose from 'dynamoose';
import { randomUUID } from 'node:crypto';
import { badRequest, conflict, forbidden, notFound } from '../lib/http';
import { nowIso, overlaps } from '../lib/time';
import { publishNotification } from '../lib/messaging';
import { mentorRepository } from '../mentor/mentor.repository';
import { timeslotRepository } from '../timeslot/timeslot.repository';
import { bookingRepository } from './booking.repository';
import { studentRepository } from '../student/student.repository';
import type { Booking } from './booking.model';

export interface CreateBookingInput {
  mentorId: string;
  slotId: string;
  studentId: string;
}

/** Which slice of a person's bookings to return. */
export type BookingWhen = 'upcoming' | 'past' | 'all';

export const bookingService = {
  /**
   * Book a session. The ordering matters:
   *   1. Validate the slot + mentor exist and the slot is free.
   *   2. Reject if the student already has an overlapping booking.
   *   3. ATOMICALLY claim the slot (conditional write) — this is the race
   *      guard. If two requests reach here at once, only one wins.
   *   4. Only after winning the claim do we write the booking + emit the
   *      booking.created event.
   */
  async create(input: CreateBookingInput): Promise<Booking> {
    const { mentorId, slotId, studentId } = input;
    if (!mentorId || !slotId || !studentId) {
      throw badRequest('mentorId, slotId and studentId are required');
    }

    const slot = await timeslotRepository.get(mentorId, slotId);
    if (!slot) throw notFound(`Time slot ${slotId} not found for mentor ${mentorId}`);
    if (slot.status !== 'available') throw conflict('That time slot is no longer available');

    const mentor = await mentorRepository.get(mentorId);
    if (!mentor) throw notFound(`Mentor ${mentorId} not found`);

    const student = await studentRepository.get(studentId);
    if (!student) throw notFound(`Student ${studentId} not found`);

    // No overlapping booking for the same student.
    const studentBookings = await bookingRepository.listForStudent(studentId);
    for (const existing of studentBookings) {
      if (overlaps(slot.startTime, slot.endTime, existing.startTime, existing.endTime)) {
        throw conflict('You already have a booking that overlaps this time');
      }
    }

    const booking: Booking = {
      bookingId: randomUUID(),
      studentId,
      studentEmail: student.email,
      mentorId,
      mentorEmail: mentor.email,
      slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'confirmed',
      createdAt: nowIso(),
    };

    // Atomically claim the slot AND write the booking in one transaction.
    // If the slot was booked by a concurrent request the condition fails and
    // DynamoDB cancels the whole transaction (→ TransactionCanceledException).
    try {
      await dynamoose.transaction([timeslotRepository.claimSlot(mentorId, slotId), bookingRepository.put(booking)]);
    } catch (err) {
      if (isTransactionCancelled(err)) {
        throw conflict('That time slot was just booked by someone else');
      }
      throw err;
    }

    await publishNotification({
      type: 'booking.created',
      bookingId: booking.bookingId,
      studentEmail: booking.studentEmail,
      mentorEmail: booking.mentorEmail,
      startTime: booking.startTime,
    });

    return booking;
  },

  /**
   * Cancel a booking. Only the owning student may cancel. We delete the
   * booking, free the slot, and emit booking.cancelled.
   */
  async cancel(bookingId: string, studentId: string): Promise<void> {
    const booking = await bookingRepository.get(bookingId);
    if (!booking) throw notFound(`Booking ${bookingId} not found`);
    if (booking.studentId !== studentId) {
      throw forbidden('You can only cancel your own bookings');
    }

    await dynamoose.transaction([
      bookingRepository.delete(bookingId),
      timeslotRepository.releaseSlot(booking.mentorId, booking.slotId),
    ]);

    await publishNotification({
      type: 'booking.cancelled',
      bookingId: booking.bookingId,
      studentEmail: booking.studentEmail,
      mentorEmail: booking.mentorEmail,
      startTime: booking.startTime,
    });
  },

  async listForMentor(mentorId: string, when: BookingWhen): Promise<Booking[]> {
    const mentor = await mentorRepository.get(mentorId);
    if (!mentor) throw notFound(`Mentor ${mentorId} not found`);

    const now = nowIso();
    const timeRange = when === 'upcoming' ? { gt: now } : when === 'past' ? { le: now } : undefined;

    return bookingRepository.listForMentor(mentorId, timeRange);
  },
};

/** True when DynamoDB cancelled a transaction (e.g. a condition check failed). */
function isTransactionCancelled(err: unknown): boolean {
  return err instanceof Error && /TransactionCanceled/.test(`${err.name}${err.message}`);
}
