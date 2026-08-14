import * as dynamoose from 'dynamoose';
import { config } from '../lib/config';

export type BookingStatus = 'confirmed';

export interface Booking {
  bookingId: string; // partition key
  studentId: string; // GSI byStudent partition key
  studentEmail: string;
  mentorId: string; // GSI byMentor partition key
  mentorEmail: string;
  slotId: string;
  startTime: string; // GSI sort key on both indexes
  endTime: string;
  status: BookingStatus;
  createdAt: string; // ISO 8601
}

export const BY_STUDENT_INDEX = 'byStudent';
export const BY_MENTOR_INDEX = 'byMentor';

const schema = new dynamoose.Schema({
  bookingId: { type: String, hashKey: true },
  studentId: {
    type: String,
    index: { name: BY_STUDENT_INDEX, type: 'global', rangeKey: 'startTime' },
  },
  studentEmail: String,
  mentorId: {
    type: String,
    index: { name: BY_MENTOR_INDEX, type: 'global', rangeKey: 'startTime' },
  },
  mentorEmail: String,
  slotId: String,
  startTime: String,
  endTime: String,
  status: { type: String, enum: ['confirmed'] },
  createdAt: String,
});

export const BookingModel = dynamoose.model('Booking', schema);
new dynamoose.Table(config.bookingsTable, [BookingModel], { create: false, waitForActive: false });
