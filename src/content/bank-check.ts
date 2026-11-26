import type { BankFile, BankMock, BankTaxonomy } from './bank-schema.ts';

/**
 * Checks question bank content beyond what the zod schema can express. Returns
 * human-readable problems; an empty list means the content can be imported.
 */
export function checkBank(
  course: 'toeic' | 'ielts',
  taxonomy: BankTaxonomy,
  files: { path: string; file: BankFile }[],
  mocks: { path: string; mock: BankMock }[] = [],
): string[] {
  const errors: string[] = [];
  const topics = new Set<string>();
  for (const s of taxonomy.sections)
    for (const c of s.chapters) for (const t of c.topics) topics.add(`${s.slug}/${c.slug}/${t.slug}`);

  const ids = new Set<string>();
  const stems = new Map<string, string>();
  const sets = new Map<string, { pool: string; questions: number }>();

  for (const { path, file } of files) {
    for (const set of file.sets) {
      const where = `${path}: ${set.id}`;
      if (!set.id.startsWith(`${course}-`)) errors.push(`${where}: id must start with "${course}-"`);
      if (ids.has(set.id)) errors.push(`${where}: duplicate id`);
      ids.add(set.id);
      sets.set(set.id, { pool: set.pool, questions: set.questions.length });
      if (!topics.has(`${set.section}/${set.chapter}/${set.topic}`)) {
        errors.push(`${where}: unknown topic ${set.section}/${set.chapter}/${set.topic}`);
      }
      if (set.stimulus?.kind === 'audio' && !set.stimulus.audio_script?.trim()) {
        errors.push(`${where}: audio stimulus needs audio_script`);
      }
      if (set.stimulus?.kind === 'passage' && !set.stimulus.html?.trim()) {
        errors.push(`${where}: passage stimulus needs html`);
      }

      for (const q of set.questions) {
        const at = `${path}: ${q.id}`;
        if (!q.id.startsWith(`${set.id}-`)) errors.push(`${at}: question id must start with its set id "${set.id}-"`);
        if (ids.has(q.id)) errors.push(`${at}: duplicate id`);
        ids.add(q.id);
        for (const tag of q.tags) if (!(tag in taxonomy.tags)) errors.push(`${at}: unknown tag "${tag}"`);
        if (q.type === 'mcq') {
          const labels = q.options.map((o) => o.label);
          if (new Set(labels).size !== labels.length) errors.push(`${at}: duplicate option labels`);
          if (!labels.includes(q.answer)) errors.push(`${at}: answer "${q.answer}" is not an option`);
        }
        if (!set.stimulus && !q.stem_html.trim()) errors.push(`${at}: needs a stem or a shared stimulus`);
        // Stand-alone questions (Part 5) must not repeat; questions about a passage often share wording.
        const stem = q.stem_html.trim().toLowerCase();
        if (!set.stimulus && stem.length > 30) {
          const other = stems.get(stem);
          if (other) errors.push(`${at}: same stem as ${other}`);
          stems.set(stem, q.id);
        }
      }
    }
  }

  for (const { path, mock } of mocks) {
    if (ids.has(mock.id)) errors.push(`${path}: ${mock.id}: duplicate id`);
    for (const section of mock.sections) {
      const raws = section.scale.map(([raw]) => raw);
      if (raws.some((r, i) => i > 0 && r <= raws[i - 1])) {
        errors.push(`${path}: ${mock.id}/${section.key}: scale must be sorted by raw score`);
      }
      if (raws[0] !== 0) errors.push(`${path}: ${mock.id}/${section.key}: scale must start at raw 0`);
      for (const setId of section.sets) {
        const set = sets.get(setId);
        if (!set) errors.push(`${path}: ${mock.id}/${section.key}: unknown set ${setId}`);
        else if (set.pool !== 'mock') errors.push(`${path}: ${mock.id}: set ${setId} must be in the mock pool`);
      }
    }
  }

  for (const { path, file } of files) {
    if (!path.includes('content-private') && file.sets.some((s) => s.pool === 'mock')) {
      errors.push(`${path}: mock sets must live in content-private/, never in the public repo`);
    }
  }
  return errors;
}

/** Number of practice questions per tag, used to check roadmap task links. */
export function countByTag(files: { file: BankFile }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { file } of files)
    for (const set of file.sets) {
      if (set.pool !== 'practice') continue;
      for (const q of set.questions) for (const tag of q.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  return counts;
}
