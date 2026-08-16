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

  /**
   * Scan active mentors with optional DB-level filter expressions.
   * DynamoDB still reads all items (no index on skill/experience), but the
   * filter expressions reduce network transfer compared to in-memory filtering.
   * Values are parameterised via ExpressionAttributeValues — no injection risk.
   */
  async listActive(skill?: string, minExperience?: number): Promise<Mentor[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scan: any = MentorModel.scan('active').eq(true);
    if (skill) scan = scan.filter('skills').contains(skill);
    if (minExperience !== undefined) scan = scan.filter('experience').ge(minExperience);
    const items = await scan.all().exec();
    return items as unknown as Mentor[];
  },

  /** Write many mentors. batchPut caps at 25 items per call, so we chunk. */
  async batchPut(mentors: Mentor[]): Promise<void> {
    for (let i = 0; i < mentors.length; i += 25) {
      await MentorModel.batchPut(mentors.slice(i, i + 25));
    }
  },
};
