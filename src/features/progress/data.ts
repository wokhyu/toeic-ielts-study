import type { DayActivity } from '../../components/charts/Heatmap.tsx';
import type { ScorePoint } from '../../components/charts/ScoreTrend.tsx';

/** Shape of learner_progress() (see supabase/migrations/20261128000001_learner_progress.sql). */
export interface Progress {
  today: string;
  streak: { current_streak: number; longest_streak: number; active_days: number; last_day: string | null };
  heatmap: DayActivity[];
  totals: {
    answers: number;
    correct: number;
    answers_30d: number;
    correct_30d: number;
    median_time_ms: number | null;
    tasks: number;
    task_minutes: number;
    cards: number;
    due_reviews: number;
  };
  by_chapter: {
    id: number;
    name: string;
    section: string;
    n: number;
    correct: number;
    n_30d: number;
    correct_30d: number;
  }[];
  by_tag: { tag: string; n: number; correct: number; n_30d: number; correct_30d: number }[];
  mock_scores: (ScorePoint & { week: number | null; source: 'self' | 'mock_test' })[];
  badges: { id: string; awarded_at: string }[];
}

export interface Achievement {
  badge_id: string;
  awarded_at: string;
  is_new: boolean;
}
