import { ProgressPage } from '../progress/ProgressPage.tsx';
import { useBank } from './context.ts';

export function BankProgressPage() {
  const { course } = useBank();
  return <ProgressPage course={course} />;
}
