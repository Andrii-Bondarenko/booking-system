/**
 * The domain entities, shared by every handler and the repository. These
 * are the shapes we store in DynamoDB. Remember: DynamoDB only enforces
 * the *key* attributes — these interfaces document the full item shape
 * that our code agrees to use.
 */

export type SlotStatus = 'available' | 'booked';

export interface TimeSlot {
  mentorId: string; // partition key
  slotId: string; // sort key
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: SlotStatus;
}

export interface Mentor {
  mentorId: string; // partition key
  name: string;
  email: string;
  skills: string[];
  experience: number;
  active: boolean;
}

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
