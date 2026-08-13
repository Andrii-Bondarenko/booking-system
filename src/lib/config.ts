/**
 * Typed access to the environment variables the CDK stack injects into
 * the Booking API Lambda. Reading them in one place means a missing var
 * is obvious, and handlers never touch `process.env` directly.
 */
export const config = {
  mentorsTable: process.env.MENTORS_TABLE!,
  studentsTable: process.env.STUDENTS_TABLE!,
  timeSlotsTable: process.env.TIME_SLOTS_TABLE!,
  bookingsTable: process.env.BOOKINGS_TABLE!,
  bookingsByStudentIndex: process.env.BOOKINGS_BY_STUDENT_INDEX!,
  bookingsByMentorIndex: process.env.BOOKINGS_BY_MENTOR_INDEX!,
  notificationsQueueUrl: process.env.NOTIFICATIONS_QUEUE_URL!,
  exportsQueueUrl: process.env.EXPORTS_QUEUE_URL!,
  importsBucket: process.env.IMPORTS_BUCKET!,
  exportsBucket: process.env.EXPORTS_BUCKET!,
} as const;
