import { BookingModel, BY_STUDENT_INDEX, BY_MENTOR_INDEX } from './booking.model';
import type { Booking } from './booking.model';

/**
 * Booking data access. The two list methods query the GSIs defined on the
 * Bookings table (byStudent / byMentor) via Dynamoose's `.using()`, so
 * looking up a student's or mentor's bookings is a cheap Query, not a Scan.
 */
export const bookingRepository = {
  async get(bookingId: string): Promise<Booking | undefined> {
    const item = await BookingModel.get(bookingId);
    return item as unknown as Booking | undefined;
  },

  async put(booking: Booking): Promise<void> {
    await new BookingModel(booking).save();
  },

  async delete(bookingId: string): Promise<void> {
    await BookingModel.delete(bookingId);
  },

  async listForStudent(studentId: string): Promise<Booking[]> {
    const items = await BookingModel.query('studentId').eq(studentId).using(BY_STUDENT_INDEX).exec();
    return items as unknown as Booking[];
  },

  async listForMentor(mentorId: string): Promise<Booking[]> {
    const items = await BookingModel.query('mentorId').eq(mentorId).using(BY_MENTOR_INDEX).exec();
    return items as unknown as Booking[];
  },

  /** Every booking in the table (used by the export job). Scans + paginates. */
  async listAll(): Promise<Booking[]> {
    const items = await BookingModel.scan().all().exec();
    return items as unknown as Booking[];
  },
};
