import { Router } from '../lib/router';
import { withErrorHandling, withLogging } from '../lib/middleware';
import { createStudent } from '../student/student.handler';
import { listMentors } from '../mentor/mentor.handler';
import { createTimeSlots, listTimeSlots } from '../timeslot/timeslot.handler';
import { cancelBooking, createBooking, listMentorBookings } from '../booking/booking.handler';
import { exportBookings, importMentors } from '../admin/admin.handler';

const app = new Router();

app.use(withLogging);
app.use(withErrorHandling);

app.post('/students', createStudent);

app.get('/mentors', listMentors);

app.get('/mentors/{mentorId}/timeslots', listTimeSlots);
app.post('/mentors/{mentorId}/timeslots', createTimeSlots);
app.get('/mentors/{mentorId}/bookings', listMentorBookings);

app.post('/bookings', createBooking);
app.delete('/bookings/{bookingId}', cancelBooking);

app.post('/import/mentors', importMentors);
app.post('/exports/bookings', exportBookings);

export const handler = app.dispatch;
