import { z } from 'zod';

export const programSchema = z.enum(['toeic', 'ielts']);
export type Program = z.infer<typeof programSchema>;

export const trackSchema = z.enum(['A', 'B', 'C']);
export type Track = z.infer<typeof trackSchema>;

export const voiceSchema = z.enum(['en-US', 'en-GB', 'en-AU']);

export const placementQuestionSchema = z.object({
  program: programSchema,
  section: z.enum(['listening', 'reading']),
  part: z.string().min(1),
  id: z.string().regex(/^(toeic|ielts)-[lr]-\d{2}$/),
  audio_script: z.string().min(1).nullable(),
  voice: voiceSchema.nullable(),
  passage: z.string().min(1).nullable(),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  answer: z.enum(['A', 'B', 'C', 'D']),
  explain_vi: z.string().min(1),
});
export type PlacementQuestion = z.infer<typeof placementQuestionSchema>;

export const placementTestSchema = z.array(placementQuestionSchema);

const rubricCriterionSchema = z.object({
  name: z.string().min(1),
  levels: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1) }),
});
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export const productiveTestSchema = z.object({
  writing: z.object({
    prompt: z.string().min(1),
    min_words: z.number().int().positive(),
    minutes: z.number().int().positive(),
    rubric: z.array(rubricCriterionSchema).length(4),
  }),
  speaking: z.object({
    part1: z.array(z.string().min(1)).length(4),
    part2: z.object({
      cue: z.string().min(1),
      bullets: z.array(z.string().min(1)).min(3),
      prep_seconds: z.number().int().positive(),
      talk_seconds: z.number().int().positive(),
    }),
    rubric: z.array(rubricCriterionSchema).length(4),
  }),
});
export type ProductiveTest = z.infer<typeof productiveTestSchema>;

const thresholdSchema = z.object({
  track: trackSchema,
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
  label: z.string().min(1),
  target: z.string().min(1),
});

export const scoringSchema = z.object({
  note: z.string().min(1),
  toeic: z.object({
    total: z.number().int().positive(),
    thresholds: z.array(thresholdSchema).length(3),
    real_score: z.array(z.object({ track: trackSchema, min: z.number(), max: z.number() })).length(3),
  }),
  ielts: z.object({
    total: z.number().int().positive(),
    thresholds: z.array(thresholdSchema).length(3),
    real_score: z.array(z.object({ track: trackSchema, min: z.number(), max: z.number() })).length(3),
  }),
});
export type Scoring = z.infer<typeof scoringSchema>;

export const toeicSkills = ['listening', 'reading', 'grammar', 'vocab', 'mock'] as const;
export const ieltsSkills = [
  'listening',
  'reading',
  'writing',
  'speaking',
  'grammar',
  'vocab',
  'mock',
] as const;

const tagListSchema = z.array(z.string().min(1)).min(1);

/**
 * What a task's "Làm ngay" button opens in the course's question bank:
 * - practice: answer `count` questions tagged with any of `tags` (earlier tags first);
 * - exam: a timed mini test made of `parts`;
 * - mock: the course's mock test for the task's week;
 * - writing / speaking: the week's IELTS Writing prompts or Speaking set;
 * - review: classmates' shared work to review.
 * The site ticks the task once the practice is done, the test or answer is
 * submitted, or the review is posted.
 */
export const practiceLinkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('practice'), tags: tagListSchema, count: z.number().int().min(1).max(100) }),
  z.object({
    kind: z.literal('exam'),
    minutes: z.number().int().min(1).max(240),
    parts: z
      .array(z.object({ label: z.string().min(1), tags: tagListSchema, count: z.number().int().min(1).max(100) }))
      .min(1),
  }),
  z.object({ kind: z.literal('mock') }),
  // IELTS: write an answer to one of the week's Writing prompts (ticks on submit).
  z.object({ kind: z.literal('writing') }),
  // IELTS: record answers to the week's Speaking set (ticks once a recording is saved).
  z.object({ kind: z.literal('speaking') }),
  // IELTS: review a classmate's shared Writing or Speaking (ticks on the first review).
  z.object({ kind: z.literal('review') }),
]);
export type PracticeLink = z.infer<typeof practiceLinkSchema>;

export const taskSchema = z.object({
  id: z.string().regex(/^(toeic|ielts)-w\d{1,2}d\d+t\d+$/),
  skill: z.enum(ieltsSkills),
  track: z.enum(['A', 'B', 'C', 'all']),
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  group_activity: z.boolean(),
  practice: practiceLinkSchema.optional(),
});
export type Task = z.infer<typeof taskSchema>;

export const weekSchema = z.object({
  program: programSchema,
  week: z.number().int().min(1).max(12),
  phase: z.string().min(1),
  focus: z.record(z.string(), z.string()),
  days: z
    .array(
      z.object({
        day: z.number().int().min(1).max(6),
        mock_test: z.boolean(),
        tasks: z.array(taskSchema).min(1),
      }),
    )
    .length(6),
});
export type Week = z.infer<typeof weekSchema>;

export const vocabCardSchema = z.object({
  id: z.string().regex(/^(toeic|ielts)-v\d{3}$/),
  program: programSchema,
  week: z.number().int().min(1).max(12),
  word: z.string().min(1),
  ipa: z.string().min(1),
  pos: z.string().min(1),
  meaning_vi: z.string().min(1),
  example: z.string().min(1),
});
export type VocabCard = z.infer<typeof vocabCardSchema>;

export const vocabDeckSchema = z.array(vocabCardSchema);

/* ------------------------------------------------------------ IELTS Writing and Speaking prompts */

const seriesSchema = z.object({ name: z.string().min(1), values: z.array(z.number()) });

/** A Task 1 visual, drawn by the site from data (no images). */
export const writingVisualSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('line'),
    title: z.string().min(1),
    unit: z.string().min(1),
    categories: z.array(z.string().min(1)).min(2),
    series: z.array(seriesSchema).min(1).max(5),
  }),
  z.object({
    type: z.literal('bar'),
    title: z.string().min(1),
    unit: z.string().min(1),
    categories: z.array(z.string().min(1)).min(2),
    series: z.array(seriesSchema).min(1).max(5),
  }),
  z.object({
    type: z.literal('pie'),
    title: z.string().min(1),
    unit: z.literal('%'),
    pies: z
      .array(
        z.object({
          caption: z.string().min(1),
          slices: z.array(z.object({ label: z.string().min(1), value: z.number().positive() })).min(2).max(5),
        }),
      )
      .min(1)
      .max(3),
  }),
  z.object({
    type: z.literal('table'),
    title: z.string().min(1),
    unit: z.string().min(1),
    columns: z.array(z.string().min(1)).min(1),
    rows: z.array(z.object({ label: z.string().min(1), values: z.array(z.number()) })).min(2),
  }),
  z.object({ type: z.literal('process'), title: z.string().min(1), steps: z.array(z.string().min(1)).min(3) }),
  z.object({
    type: z.literal('map'),
    title: z.string().min(1),
    maps: z
      .array(
        z.object({
          caption: z.string().min(1),
          // Positions on a 100 × 60 grid.
          features: z
            .array(
              z.object({
                label: z.string().min(1),
                kind: z.enum(['building', 'green', 'water', 'road', 'other']),
                x: z.number().min(0).max(100),
                y: z.number().min(0).max(60),
                w: z.number().positive().max(100),
                h: z.number().positive().max(60),
              }),
            )
            .min(2),
        }),
      )
      .min(1)
      .max(2),
  }),
]);
export type WritingVisual = z.infer<typeof writingVisualSchema>;

export const writingPromptSchema = z.object({
  id: z.string().regex(/^w\d{2}-[a-z]$/),
  week: z.number().int().min(1).max(12),
  task: z.union([z.literal(1), z.literal(2)]),
  genre: z.string().min(1),
  title_vi: z.string().min(1),
  minutes: z.number().int().positive(),
  min_words: z.number().int().positive(),
  prompt: z.string().min(1),
  visuals: z.array(writingVisualSchema).min(1).optional(),
});
export type WritingPrompt = z.infer<typeof writingPromptSchema>;
export const writingPromptsSchema = z.array(writingPromptSchema);

export const speakingSetSchema = z.object({
  id: z.string().regex(/^s\d{2}$/),
  week: z.number().int().min(1).max(12),
  topic_vi: z.string().min(1),
  part1: z.array(z.string().min(1)).min(3),
  part2: z.object({
    cue: z.string().min(1),
    bullets: z.array(z.string().min(1)).min(3),
    prep_seconds: z.number().int().positive(),
    talk_seconds: z.number().int().positive(),
  }),
  part3: z.array(z.string().min(1)).min(3),
});
export type SpeakingSet = z.infer<typeof speakingSetSchema>;
export const speakingSetsSchema = z.array(speakingSetSchema);
