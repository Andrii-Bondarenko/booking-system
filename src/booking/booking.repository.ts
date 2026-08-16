import { BookingModel, BY_STUDENT_INDEX, BY_MENTOR_INDEX } from './booking.model';
import type { Booking } from './booking.model';

/**
 * Optional time-range applied as a sort-key condition on the byMentor/byStudent
 * GSIs (startTime is the sort key). Only one of gt / le should be set at a time.
 */
export interface TimeRange {
  gt?: string;
  le?: string;
}

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

  /** Transaction item: atomically inserts a new booking record. */
  putTx(booking: Booking) {
    return BookingModel.transaction.create(booking);
  },

  /** Transaction item: atomically deletes a booking record. */
  deleteTx(bookingId: string) {
    return BookingModel.transaction.delete(bookingId);
  },

  async listForStudent(studentId: string): Promise<Booking[]> {
    const items = await BookingModel.query('studentId').eq(studentId).using(BY_STUDENT_INDEX).exec();
    return items as unknown as Booking[];
  },

  /**
   * Query by mentor GSI. When `timeRange` is provided the sort-key condition
   * is pushed to DynamoDB so only matching rows are returned — no in-memory
   * filter needed. Results are returned in ascending startTime order (GSI
   * sort key).
   */
  async listForMentor(mentorId: string, timeRange?: TimeRange): Promise<Booking[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = BookingModel.query('mentorId').eq(mentorId).using(BY_MENTOR_INDEX);
    if (timeRange?.gt) query = query.where('startTime').gt(timeRange.gt);
    else if (timeRange?.le) query = query.where('startTime').le(timeRange.le);
    const items = await query.exec();
    return items as unknown as Booking[];
  },

  /** Every booking in the table (used by the export job). Scans + paginates. */
  async listAll(): Promise<Booking[]> {
    const items = await BookingModel.scan().all().exec();
    return items as unknown as Booking[];
  },
};
