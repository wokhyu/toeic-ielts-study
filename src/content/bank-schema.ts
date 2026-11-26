import { z } from 'zod';

/**
 * Question bank content (content/bank/<course>/*.json for practice, kept in
 * the repo; content-private/bank/<course>/*.json for mock tests, never
 * committed). Imported into the ot_* tables by scripts/import-bank.ts.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const extId = z.string().regex(/^(toeic|ielts)-[a-z0-9]+(-[a-z0-9]+)*$/);

export const bankTaxonomySchema = z.object({
  sections: z
    .array(
      z.object({
        slug,
        name: z.string().min(1),
        sort: z.number().int().default(0),
        chapters: z
          .array(
            z.object({
              slug,
              name: z.string().min(1),
              sort: z.number().int().default(0),
              topics: z
                .array(z.object({ slug, name: z.string().min(1), sort: z.number().int().default(0) }))
                .min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  /** Tag -> Vietnamese label shown to learners. */
  tags: z.record(slug, z.string().min(1)),
});
export type BankTaxonomy = z.infer<typeof bankTaxonomySchema>;

const optionSchema = z.object({ label: z.string().min(1), html: z.string() });

export const bankQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    id: extId,
    type: z.literal('mcq'),
    stem_html: z.string(),
    options: z.array(optionSchema).min(2).max(8),
    answer: z.string().min(1),
    explain_html: z.string().min(1),
    tags: z.array(slug).default([]),
    difficulty: z.number().int().min(1).max(3).optional(),
  }),
  z.object({
    id: extId,
    type: z.literal('short'),
    stem_html: z.string().min(1),
    /** Every accepted answer; compared without case and spaces. */
    answer: z.array(z.string().min(1)).min(1),
    explain_html: z.string().min(1),
    tags: z.array(slug).default([]),
    difficulty: z.number().int().min(1).max(3).optional(),
  }),
]);
export type BankQuestionContent = z.infer<typeof bankQuestionSchema>;

export const bankSetSchema = z.object({
  id: extId,
  section: slug,
  chapter: slug,
  topic: slug,
  pool: z.enum(['practice', 'mock']).default('practice'),
  stimulus: z
    .object({
      kind: z.enum(['passage', 'audio']),
      title: z.string().optional(),
      html: z.string().optional(),
      audio_script: z.string().optional(),
    })
    .optional(),
  questions: z.array(bankQuestionSchema).min(1),
});
export type BankSet = z.infer<typeof bankSetSchema>;

export const bankFileSchema = z.object({ sets: z.array(bankSetSchema).min(1) });
export type BankFile = z.infer<typeof bankFileSchema>;

export const bankMockSchema = z.object({
  id: extId,
  title: z.string().min(1),
  minutes: z.number().int().min(1).max(240),
  week: z.number().int().min(1).max(12).optional(),
  sections: z
    .array(
      z.object({
        key: z.enum(['listening', 'reading']),
        label: z.string().min(1),
        /** [raw correct answers, converted score], sorted by raw. */
        scale: z.array(z.tuple([z.number().int().min(0), z.number()])).min(1),
        sets: z.array(extId).min(1),
      }),
    )
    .min(1),
});
export type BankMock = z.infer<typeof bankMockSchema>;
