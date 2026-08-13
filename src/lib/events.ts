/**
 * Notification event contract.
 *
 * These are the message shapes that PRODUCERS (the Booking API, the CSV
 * processor, the export Lambda) put onto the Notifications SQS queue, and
 * that the CONSUMER (the Notification Lambda) reads back out.
 *
 * Keeping the shape in one shared file means producer and consumer can
 * never silently drift apart — TypeScript enforces the contract on both
 * sides. The `type` field is the discriminator used to render the right
 * email.
 */
export type NotificationEvent =
  | {
      type: 'booking.created';
      bookingId: string;
      studentEmail: string;
      mentorEmail: string;
      startTime: string;
    }
  | {
      type: 'booking.cancelled';
      bookingId: string;
      studentEmail: string;
      mentorEmail: string;
      startTime: string;
    }
  | {
      type: 'mentors.imported';
      adminEmail: string;
      processed: number;
      succeeded: number;
      failed: number;
    }
  | {
      type: 'bookings.exported';
      adminEmail: string;
      recordCount: number;
      downloadUrl: string;
    };

/**
 * Job message put on the Exports queue by POST /exports/bookings and read
 * by the Export Lambda. Separate from NotificationEvent because it lives
 * on a different queue and represents work-to-do, not something-happened.
 */
export interface BookingsExportJob {
  type: 'bookings.export.requested';
  requestedAt: string;
  requestedBy?: string | undefined;
}
