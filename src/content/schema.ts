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

export const taskSchema = z.object({
  id: z.string().regex(/^(toeic|ielts)-w\d{1,2}d\d+t\d+$/),
  skill: z.enum(ieltsSkills),
  track: z.enum(['A', 'B', 'C', 'all']),
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  group_activity: z.boolean(),
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
