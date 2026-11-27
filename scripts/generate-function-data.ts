/**
 * Writes supabase/functions/writing-feedback/prompts.json: each Writing prompt as
 * plain text (Task 1 visuals described in words) for the AI feedback function.
 * validate-content fails when the committed file is out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writingPromptsSchema } from '../src/content/schema.ts';
import { describePrompt, type PromptText } from '../supabase/functions/writing-feedback/core.ts';

const root = join(import.meta.dirname, '..');
export const FUNCTION_PROMPTS = 'supabase/functions/writing-feedback/prompts.json';

export function functionPrompts(): string {
  const prompts = writingPromptsSchema.parse(
    JSON.parse(readFileSync(join(root, 'content/prompts/ielts-writing.json'), 'utf8')),
  );
  const out: Record<string, PromptText> = {};
  for (const p of prompts) out[p.id] = describePrompt(p);
  return `${JSON.stringify(out, null, 2)}\n`;
}

if (process.argv[1]?.endsWith('generate-function-data.ts')) {
  writeFileSync(join(root, FUNCTION_PROMPTS), functionPrompts());
  console.log(`Wrote ${FUNCTION_PROMPTS}`);
}
