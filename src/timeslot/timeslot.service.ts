import { randomUUID } from 'node:crypto';
import { badRequest, conflict, notFound } from '../lib/http';
import { isFutureIso, isValidIso, nowIso, overlaps } from '../lib/time';
import { mentorRepository } from '../mentor/mentor.repository';
import { timeslotRepository } from './timeslot.repository';
import type { TimeSlot } from './timeslot.model';

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
 * Time-slot business logic: availability listing and creation with overlap
 * protection — with the rules the spec asks for (future-only, no overlaps).
 */
export const timeslotService = {
  async listAvailable(mentorId: string): Promise<TimeSlot[]> {
    const mentor = await mentorRepository.get(mentorId);
    if (!mentor) throw notFound(`Mentor ${mentorId} not found`);

    // status and startTime filters applied by DynamoDB — no in-memory filtering needed.
    const slots = await timeslotRepository.listAvailableForMentor(mentorId, nowIso());
    return slots.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
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
};
