import ieltsTest from '../../content/placement/ielts.json';
import ieltsProductive from '../../content/placement/ielts-productive.json';
import scoringJson from '../../content/placement/scoring.json';
import toeicTest from '../../content/placement/toeic.json';
import ieltsSpeaking from '../../content/prompts/ielts-speaking.json';
import ieltsWriting from '../../content/prompts/ielts-writing.json';
import ieltsVocab from '../../content/vocab/ielts.json';
import toeicVocab from '../../content/vocab/toeic.json';
import type {
  PlacementQuestion,
  ProductiveTest,
  Program,
  Scoring,
  SpeakingSet,
  VocabCard,
  Week,
  WritingPrompt,
} from './schema.ts';

// Content is validated by `npm run validate:content` in CI, so it is only cast here.
const weekFiles = import.meta.glob<Week>('../../content/roadmap/*/week-*.json', { eager: true, import: 'default' });

function weeksOf(program: Program): Week[] {
  return Object.entries(weekFiles)
    .filter(([path]) => path.includes(`/roadmap/${program}/`))
    .map(([, week]) => week)
    .sort((a, b) => a.week - b.week);
}

export const roadmaps: Record<Program, Week[]> = { toeic: weeksOf('toeic'), ielts: weeksOf('ielts') };

export const placementTests: Record<Program, PlacementQuestion[]> = {
  toeic: toeicTest as PlacementQuestion[],
  ielts: ieltsTest as PlacementQuestion[],
};

export const productiveTest = ieltsProductive as ProductiveTest;
export const scoring = scoringJson as Scoring;

export const vocab: Record<Program, VocabCard[]> = {
  toeic: toeicVocab as VocabCard[],
  ielts: ieltsVocab as VocabCard[],
};

/** IELTS Writing prompts and Speaking sets, by week (content/prompts/). */
export const writingPrompts = ieltsWriting as WritingPrompt[];
export const speakingSets = ieltsSpeaking as SpeakingSet[];

export const PROGRAMS: Program[] = ['toeic', 'ielts'];

export function isProgram(course: string | undefined): course is Program {
  return course === 'toeic' || course === 'ielts';
}
