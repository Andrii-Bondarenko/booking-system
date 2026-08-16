import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse';
import type { S3Event } from 'aws-lambda';
import { getObjectStream } from '../lib/storage';
import { publishNotification } from '../lib/messaging';
import { mentorRepository } from '../mentor/mentor.repository';
import type { Mentor } from '../mentor/mentor.model';

/**
 * CSV Processor Lambda — triggered when a mentor CSV is uploaded to the
 * imports bucket (prefix mentors-import/). It streams the file line by line,
 * writes valid mentors in batches of 25 (DynamoDB batchPut limit), and
 * enqueues a `mentors.imported` summary event for the admin email.
 *
 * Expected CSV columns: name,email,skills,experience
 *   - skills is a ";"-separated list, e.g. "aws;typescript"
 *   - experience is a whole number of years
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const BATCH_SIZE = 25;

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // S3 URL-encodes keys in the event; decode before using.
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const stream = await getObjectStream(bucket, key);
    // csv-parse handles RFC 4180: quoted fields, commas in values, CRLF/LF.
    const parser = stream.pipe(parse({ columns: true, trim: true, skip_empty_lines: true }));

    const batch: Mentor[] = [];
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for await (const row of parser) {
      processed++;
      const mentor = parseMentor(row);
      if (!mentor) {
        failed++;
        continue;
      }

      batch.push(mentor);

      if (batch.length === BATCH_SIZE) {
        const flushed = batch.splice(0);
        await mentorRepository.batchPut(flushed);
        succeeded += flushed.length;
      }
    }

    if (batch.length > 0) {
      await mentorRepository.batchPut(batch);
      succeeded += batch.length;
    }

    await publishNotification({
      type: 'mentors.imported',
      adminEmail: ADMIN_EMAIL,
      processed,
      succeeded,
      failed,
    });

    console.log(`Imported ${succeeded}/${processed} mentors from ${key}`);
  }
}

interface MentorRow {
  name?: string;
  email?: string;
  skills?: string;
  experience?: string;
}

/** Map a parsed CSV row to a Mentor, or return null if required fields are missing. */
function parseMentor(row: MentorRow): Mentor | null {
  const { name, email, skills, experience } = row;
  if (!name || !email) return null;

  return {
    mentorId: randomUUID(),
    name,
    email,
    skills: skills ? skills.split(';').map((s) => s.trim()) : [],
    experience: Number(experience) || 0,
    active: true,
  };
}
