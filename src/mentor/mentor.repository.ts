import { MentorModel } from './mentor.model';
import type { Mentor } from './mentor.model';

/**
 * Mentor data access. Pure DynamoDB (via Dynamoose) — no business rules
 * live here. Dynamoose handles marshalling and reserved-word aliasing, so
 * these methods stay short.
 */
export const mentorRepository = {
  async get(mentorId: string): Promise<Mentor | undefined> {
    const item = await MentorModel.get(mentorId);
    return item as unknown as Mentor | undefined;
  },

  async listActive(): Promise<Mentor[]> {
    // `.all()` makes Dynamoose follow pagination until the whole (filtered)
    // table has been read. Fine at demo scale; a GSI + Query would scale.
    const items = await MentorModel.scan('active').eq(true).all().exec();
    return items as unknown as Mentor[];
  },

  /** Write many mentors. batchPut caps at 25 items per call, so we chunk. */
  async batchPut(mentors: Mentor[]): Promise<void> {
    for (let i = 0; i < mentors.length; i += 25) {
      await MentorModel.batchPut(mentors.slice(i, i + 25));
    }
  },
};
