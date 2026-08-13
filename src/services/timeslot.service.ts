import { randomUUID } from 'node:crypto';
import { badRequest, conflict, notFound } from '../lib/http';
import { isFutureIso, isValidIso, overlaps } from '../lib/time';
import { mentorRepository } from '../repositories/mentor.repository';
import { timeslotRepository } from '../repositories/timeslot.repository';
import { bookingRepository } from '../repositories/booking.repository';
import type { TimeSlot } from '../lib/models';

/** A requested slot's time window (before it becomes a stored TimeSlot). */
export interface SlotInput {
  startTime: string;
  endTime: string;
}

/** Validate a single slot's times: valid, ordered, and in the future. */
function validateSlotTimes(slot: SlotInput): void {
  if (!isValidIso(slot.startTime) || !isValidIso(slot.endTime)) {
    throw badRequest('startTime and endTime must be ISO 8601 timestamps');
  }
  if (!(slot.startTime < slot.endTime)) {
    throw badRequest('startTime must be before endTime');
  }
  if (!isFutureIso(slot.startTime)) {
    throw badRequest('Time slots must be in the future');
  }
}

/**
 * Time-slot business logic: availability listing, creation with overlap
 * protection, rescheduling, and deletion — with the rules the spec asks
 * for (future-only, no overlaps, can't touch booked slots).
 */
export const timeslotService = {
  async listAvailable(mentorId: string): Promise<TimeSlot[]> {
    const slots = await timeslotRepository.listForMentor(mentorId);
    return slots
      .filter((s) => s.status === 'available' && isFutureIso(s.startTime))
      .sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
  },

  async create(mentorId: string, inputs: SlotInput[]): Promise<TimeSlot[]> {
    const mentor = await mentorRepository.get(mentorId);
    if (!mentor) throw notFound(`Mentor ${mentorId} not found`);

    if (inputs.length === 0) {
      throw badRequest('Provide a slot { startTime, endTime } or a non-empty slots[] array');
    }
    inputs.forEach(validateSlotTimes);

    // New slots must not overlap each other.
    for (let i = 0; i < inputs.length; i++) {
      for (let j = i + 1; j < inputs.length; j++) {
        const a = inputs[i]!;
        const b = inputs[j]!;
        if (overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) {
          throw conflict('The provided slots overlap each other');
        }
      }
    }

    // ...nor overlap the mentor's existing slots.
    const existing = await timeslotRepository.listForMentor(mentorId);
    for (const input of inputs) {
      for (const e of existing) {
        if (overlaps(input.startTime, input.endTime, e.startTime, e.endTime)) {
          throw conflict(`Slot starting ${input.startTime} overlaps an existing slot`);
        }
      }
    }

    const newSlots: TimeSlot[] = inputs.map((input) => ({
      mentorId,
      slotId: randomUUID(),
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'available',
    }));
    await Promise.all(newSlots.map((slot) => timeslotRepository.put(slot)));

    return newSlots;
  },

  async update(mentorId: string, slotId: string, input: SlotInput): Promise<TimeSlot> {
    const slot = await timeslotRepository.get(mentorId, slotId);
    if (!slot) throw notFound(`Time slot ${slotId} not found for mentor ${mentorId}`);
    if (slot.status === 'booked') throw conflict('Cannot reschedule a booked time slot');

    validateSlotTimes(input);

    const others = (await timeslotRepository.listForMentor(mentorId)).filter(
      (s) => s.slotId !== slotId,
    );
    for (const other of others) {
      if (overlaps(input.startTime, input.endTime, other.startTime, other.endTime)) {
        throw conflict('Updated time overlaps another of the mentor’s slots');
      }
    }

    const bookings = await bookingRepository.listForMentor(mentorId);
    for (const booking of bookings) {
      if (overlaps(input.startTime, input.endTime, booking.startTime, booking.endTime)) {
        throw conflict('Updated time overlaps an existing booking');
      }
    }

    const updated: TimeSlot = { ...slot, startTime: input.startTime, endTime: input.endTime };
    await timeslotRepository.put(updated);

    return updated;
  },

  async remove(mentorId: string, slotId: string): Promise<void> {
    const slot = await timeslotRepository.get(mentorId, slotId);
    if (!slot) throw notFound(`Time slot ${slotId} not found for mentor ${mentorId}`);
    if (slot.status === 'booked') throw conflict('Cannot delete a booked time slot');

    await timeslotRepository.delete(mentorId, slotId);
  },
};
