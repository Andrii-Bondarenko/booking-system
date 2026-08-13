import { mentorRepository } from '../repositories/mentor.repository';
import type { Mentor } from '../lib/models';

/** Optional refinements for the mentor listing. */
export interface MentorFilters {
  skill?: string | undefined;
  minExperience?: number | undefined;
}

/**
 * Mentor business logic. Today that's just "list active mentors, then
 * apply optional in-memory filters" — but keeping it in a service means
 * the handler stays trivial and this is unit-testable without HTTP.
 */
export const mentorService = {
  async list(filters: MentorFilters): Promise<Mentor[]> {
    let mentors = await mentorRepository.listActive();

    const { skill, minExperience } = filters;
    if (skill) {
      mentors = mentors.filter((m) => m.skills?.includes(skill));
    }
    if (minExperience !== undefined && !Number.isNaN(minExperience)) {
      mentors = mentors.filter((m) => m.experience >= minExperience);
    }

    return mentors;
  },
};
