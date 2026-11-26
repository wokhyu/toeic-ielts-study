import { ProgressPage } from '../../features/progress/ProgressPage.tsx';
import { useRoadmap } from './context.ts';

export function ProgressTab() {
  const { program, track } = useRoadmap();
  return <ProgressPage course={program} track={track} />;
}
