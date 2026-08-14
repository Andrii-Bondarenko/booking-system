import * as dynamoose from 'dynamoose';
import { config } from '../lib/config';

export type SlotStatus = 'available' | 'booked';

export interface TimeSlot {
  mentorId: string; // partition key
  slotId: string; // sort key
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: SlotStatus;
}

const schema = new dynamoose.Schema({
  mentorId: { type: String, hashKey: true },
  slotId: { type: String, rangeKey: true },
  startTime: String,
  endTime: String,
  status: { type: String, enum: ['available', 'booked'] },
});

export const TimeSlotModel = dynamoose.model('TimeSlot', schema);
new dynamoose.Table(config.timeSlotsTable, [TimeSlotModel], { create: false, waitForActive: false });
