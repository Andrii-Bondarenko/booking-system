/**
 * Seed script — inserts test mentors and students into DynamoDB Local.
 * Run after `npm run local:setup` (tables must exist first).
 *
 *   npm run local:seed
 *
 * Safe to re-run: Dynamoose `save()` overwrites existing items by primary key,
 * so the same seed data can be applied multiple times without duplicates.
 */
import * as dynamoose from 'dynamoose';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { MentorModel } from '../src/mentor/mentor.model';
import { StudentModel } from '../src/student/student.model';
import { TimeSlotModel } from '../src/timeslot/timeslot.model';
import { BookingModel } from '../src/booking/booking.model';
import type { Mentor } from '../src/mentor/mentor.model';
import type { Student } from '../src/student/student.model';
import type { TimeSlot } from '../src/timeslot/timeslot.model';
import type { Booking } from '../src/booking/booking.model';

dynamoose.aws.ddb.set(
  new DynamoDB({
    endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
    },
  }),
);

// ---- Seed data ------------------------------------------------------

const MENTORS: Mentor[] = [
  {
    mentorId: 'mentor-1',
    name: 'Bob Jones',
    email: 'bob@example.com',
    skills: ['aws', 'typescript', 'node'],
    experience: 5,
    active: true,
  },
  {
    mentorId: 'mentor-2',
    name: 'Carol White',
    email: 'carol@example.com',
    skills: ['docker', 'kubernetes', 'node'],
    experience: 8,
    active: true,
  },
  {
    mentorId: 'mentor-3',
    name: 'Dan Brown',
    email: 'dan@example.com',
    skills: ['aws', 'python'],
    experience: 3,
    active: false,
  },
];

const STUDENTS: Student[] = [
  {
    studentId: 'student-1',
    name: 'Alice Smith',
    email: 'alice@example.com',
    phone: '+1-555-0100',
  },
  {
    studentId: 'student-2',
    name: 'Eve Davis',
    email: 'eve@example.com',
    phone: '+1-555-0200',
  },
];

const TIMESLOTS: TimeSlot[] = [
  // Bob Jones — mentor-1
  {
    mentorId: 'mentor-1',
    slotId: 'slot-1-1',
    startTime: '2026-08-18T09:00:00Z',
    endTime: '2026-08-18T10:00:00Z',
    status: 'booked',
  },
  {
    mentorId: 'mentor-1',
    slotId: 'slot-1-2',
    startTime: '2026-08-18T11:00:00Z',
    endTime: '2026-08-18T12:00:00Z',
    status: 'available',
  },
  {
    mentorId: 'mentor-1',
    slotId: 'slot-1-3',
    startTime: '2026-08-19T14:00:00Z',
    endTime: '2026-08-19T15:00:00Z',
    status: 'booked',
  },
  {
    mentorId: 'mentor-1',
    slotId: 'slot-1-4',
    startTime: '2026-08-20T09:00:00Z',
    endTime: '2026-08-20T10:00:00Z',
    status: 'available',
  },
  {
    mentorId: 'mentor-1',
    slotId: 'slot-1-5',
    startTime: '2026-08-21T10:00:00Z',
    endTime: '2026-08-21T11:00:00Z',
    status: 'available',
  },

  // Carol White — mentor-2
  {
    mentorId: 'mentor-2',
    slotId: 'slot-2-1',
    startTime: '2026-08-18T13:00:00Z',
    endTime: '2026-08-18T14:00:00Z',
    status: 'booked',
  },
  {
    mentorId: 'mentor-2',
    slotId: 'slot-2-2',
    startTime: '2026-08-19T09:00:00Z',
    endTime: '2026-08-19T10:00:00Z',
    status: 'available',
  },
  {
    mentorId: 'mentor-2',
    slotId: 'slot-2-3',
    startTime: '2026-08-20T15:00:00Z',
    endTime: '2026-08-20T16:00:00Z',
    status: 'available',
  },
  {
    mentorId: 'mentor-2',
    slotId: 'slot-2-4',
    startTime: '2026-08-22T11:00:00Z',
    endTime: '2026-08-22T12:00:00Z',
    status: 'available',
  },

  // Dan Brown — mentor-3 (inactive mentor, but slots may still exist)
  {
    mentorId: 'mentor-3',
    slotId: 'slot-3-1',
    startTime: '2026-08-19T10:00:00Z',
    endTime: '2026-08-19T11:00:00Z',
    status: 'available',
  },
  {
    mentorId: 'mentor-3',
    slotId: 'slot-3-2',
    startTime: '2026-08-21T14:00:00Z',
    endTime: '2026-08-21T15:00:00Z',
    status: 'available',
  },
];

const BOOKINGS: Booking[] = [
  {
    bookingId: 'booking-1',
    studentId: 'student-1',
    studentEmail: 'alice@example.com',
    mentorId: 'mentor-1',
    mentorEmail: 'bob@example.com',
    slotId: 'slot-1-1',
    startTime: '2026-08-18T09:00:00Z',
    endTime: '2026-08-18T10:00:00Z',
    status: 'confirmed',
    createdAt: '2026-08-16T08:00:00Z',
  },
  {
    bookingId: 'booking-2',
    studentId: 'student-2',
    studentEmail: 'eve@example.com',
    mentorId: 'mentor-1',
    mentorEmail: 'bob@example.com',
    slotId: 'slot-1-3',
    startTime: '2026-08-19T14:00:00Z',
    endTime: '2026-08-19T15:00:00Z',
    status: 'confirmed',
    createdAt: '2026-08-16T08:05:00Z',
  },
  {
    bookingId: 'booking-3',
    studentId: 'student-1',
    studentEmail: 'alice@example.com',
    mentorId: 'mentor-2',
    mentorEmail: 'carol@example.com',
    slotId: 'slot-2-1',
    startTime: '2026-08-18T13:00:00Z',
    endTime: '2026-08-18T14:00:00Z',
    status: 'confirmed',
    createdAt: '2026-08-16T09:00:00Z',
  },
];

// ---- Runner ---------------------------------------------------------

async function seedAll<T extends object>(
  label: string,
  items: T[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Model: new (item: T) => { save(): Promise<void> },
): Promise<void> {
  for (const item of items) {
    await new Model(item).save();
    const id = Object.values(item)[0];
    console.log(`  [ok] ${label} ${id}`);
  }
}

async function main() {
  console.log(`Seeding against ${process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000'}\n`);

  console.log('Mentors:');
  await seedAll('mentor', MENTORS, MentorModel as never);

  console.log('\nStudents:');
  await seedAll('student', STUDENTS, StudentModel as never);

  console.log('\nTimeslots:');
  await seedAll('timeslot', TIMESLOTS, TimeSlotModel as never);

  console.log('\nBookings:');
  await seedAll('booking', BOOKINGS, BookingModel as never);

  console.log('\nDone. Run `npm run local:dev` and import the Postman collection to test.');
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
