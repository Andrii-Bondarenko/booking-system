import * as dynamoose from 'dynamoose';
import { TimeSlotModel } from './timeslot.model';
import type { TimeSlot } from './timeslot.model';

/**
 * Time-slot data access. The interesting bit is markBooked: its atomic
 * condition (status must still be "available") is what prevents two
 * students double-booking the same slot.
 */
export const timeslotRepository = {
  async listForMentor(mentorId: string): Promise<TimeSlot[]> {
    const items = await TimeSlotModel.query('mentorId').eq(mentorId).exec();
    return items as unknown as TimeSlot[];
  },

  async get(mentorId: string, slotId: string): Promise<TimeSlot | undefined> {
    const item = await TimeSlotModel.get({ mentorId, slotId });
    return item as unknown as TimeSlot | undefined;
  },

  async put(slot: TimeSlot): Promise<void> {
    await new TimeSlotModel(slot).save();
  },

  /**
   * Mark booked ONLY if currently available. If two requests race, exactly
   * one wins; the other's condition fails. We re-throw that failure under
   * the name the booking service checks (`ConditionalCheckFailedException`)
   * so the service layer stays storage-agnostic.
   */
  async markBooked(mentorId: string, slotId: string): Promise<void> {
    try {
      await TimeSlotModel.update(
        { mentorId, slotId },
        { status: 'booked' },
        { condition: new dynamoose.Condition().where('status').eq('available') },
      );
    } catch (err) {
      if (isConditionalCheckFailure(err)) {
        const conflictErr = new Error('Time slot is no longer available');
        conflictErr.name = 'ConditionalCheckFailedException';
        throw conflictErr;
      }
      throw err;
    }
  },

  async markAvailable(mentorId: string, slotId: string): Promise<void> {
    await TimeSlotModel.update({ mentorId, slotId }, { status: 'available' });
  },
};

/** True when an error is DynamoDB's failed-condition error, however wrapped. */
function isConditionalCheckFailure(err: unknown): boolean {
  return err instanceof Error && /ConditionalCheckFailed/.test(`${err.name}${err.message}`);
}
