import { mentorRepository } from './mentor.repository';
import type { Mentor } from './mentor.model';

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
    return mentorRepository.listActive(filters.skill, filters.minExperience);
  },
};
