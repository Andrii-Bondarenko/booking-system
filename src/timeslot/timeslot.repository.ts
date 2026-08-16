import * as dynamoose from 'dynamoose';
import { TimeSlotModel } from './timeslot.model';
import type { TimeSlot } from './timeslot.model';

export const timeslotRepository = {
  async listForMentor(mentorId: string): Promise<TimeSlot[]> {
    const items = await TimeSlotModel.query('mentorId').eq(mentorId).exec();
    return items as unknown as TimeSlot[];
  },

  /** Query with DB-level filter expressions — avoids pulling every slot in memory. */
  async listAvailableForMentor(mentorId: string, after: string): Promise<TimeSlot[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await (TimeSlotModel.query('mentorId').eq(mentorId) as any)
      .filter('status')
      .eq('available')
      .filter('startTime')
      .gt(after)
      .exec();
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
   * Transaction item: marks slot booked, conditioned on status still being
   * 'available'. Pass the returned promise into dynamoose.transaction([...]).
   * If the condition fails the whole transaction is cancelled (→ 409).
   */
  claimSlotTx(mentorId: string, slotId: string) {
    return TimeSlotModel.transaction.update(
      { mentorId, slotId },
      { status: 'booked' },
      { condition: new dynamoose.Condition().where('status').eq('available') },
    );
  },

  /** Transaction item: releases a slot back to available. */
  releaseSlotTx(mentorId: string, slotId: string) {
    return TimeSlotModel.transaction.update({ mentorId, slotId }, { status: 'available' });
  },
};
