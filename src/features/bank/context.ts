import { createContext, useContext } from 'react';
import type { CourseId } from '../../lib/types.ts';

export interface BankContextValue {
  course: CourseId;
  /** Route prefix of the bank pages, e.g. "/c/on-tap-11" or "/c/toeic/luyen". */
  base: string;
  /** Language used to read listening scripts aloud. */
  lang: string;
}

export const BankContext = createContext<BankContextValue | null>(null);

export function useBank(): BankContextValue {
  const value = useContext(BankContext);
  if (!value) throw new Error('useBank must be used inside BankLayout');
  return value;
}

export const SPEECH_LANG: Record<CourseId, string> = { toeic: 'en-US', ielts: 'en-GB', 'on-tap-11': 'vi-VN' };
