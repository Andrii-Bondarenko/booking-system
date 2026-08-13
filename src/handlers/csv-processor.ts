import type { S3Event } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { getObject } from '../lib/storage';
import { publishNotification } from '../lib/messaging';
import { mentorRepository } from '../repositories/mentor.repository';
import type { Mentor } from '../lib/models';

/**
 * CSV Processor Lambda — triggered when a mentor CSV is uploaded to the
 * imports bucket (prefix mentors-import/). It downloads the file, parses
 * + validates rows, writes valid mentors via the repository, and enqueues
 * a `mentors.imported` summary event for the admin email.
 *
 * Expected CSV columns: name,email,skills,experience
 *   - skills is a ";"-separated list, e.g. "aws;typescript"
 *   - experience is a whole number of years
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // S3 URL-encodes keys in the event; decode before using.
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const csv = await getObject(bucket, key);
    const { mentors, processed, failed } = parseMentors(csv);

    await mentorRepository.batchPut(mentors);
    await publishNotification({
      type: 'mentors.imported',
      adminEmail: ADMIN_EMAIL,
      processed,
      succeeded: mentors.length,
      failed,
    });

    console.log(`Imported ${mentors.length}/${processed} mentors from ${key}`);
  }
}

/**
 * Parse CSV text into Mentor records. Intentionally minimal: splits on
 * newlines and commas. Good enough for a learning demo — a production
 * parser would handle quoted fields, embedded commas, etc.
 */
function parseMentors(csv: string): { mentors: Mentor[]; processed: number; failed: number } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // First line is the header; skip it.
  const rows = lines.slice(1);
  const mentors: Mentor[] = [];
  let failed = 0;

  for (const row of rows) {
    const [name, email, skills, experience] = row.split(',').map((c) => c.trim());

    // Validate the required fields.
    if (!name || !email) {
      failed++;
      continue;
    }

    mentors.push({
      mentorId: randomUUID(),
      name,
      email,
      skills: skills ? skills.split(';').map((s) => s.trim()) : [],
      experience: Number(experience) || 0,
      active: true,
    });
  }

  return { mentors, processed: rows.length, failed };
}
