import ieltsTaxonomy from '../../content/bank/ielts/taxonomy.json';
import toeicTaxonomy from '../../content/bank/toeic/taxonomy.json';
import type { CourseId } from '../lib/types.ts';

// Validated by `npm run validate:content`; only the tag labels are needed in the browser.
const TAGS: Partial<Record<CourseId, Record<string, string>>> = {
  toeic: toeicTaxonomy.tags as Record<string, string>,
  ielts: ieltsTaxonomy.tags as Record<string, string>,
};

/** Vietnamese label of a practice tag, or the tag itself when unknown. */
export function tagLabel(course: CourseId, tag: string): string {
  return TAGS[course]?.[tag] ?? tag;
}
