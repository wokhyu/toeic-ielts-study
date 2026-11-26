import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccuracyBars } from './AccuracyBars.tsx';
import { Heatmap } from './Heatmap.tsx';

describe('Heatmap', () => {
  const data = [
    { day: '2026-11-26', answers: 12, tasks: 2, cards: 0 },
    { day: '2026-11-20', answers: 0, tasks: 1, cards: 3 },
  ];

  it('summarises the period and reads out a day on hover', () => {
    render(<Heatmap data={data} today="2026-11-26" days={28} />);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(/2 ngày có học/);
    fireEvent.mouseEnter(screen.getByTitle('26/11/2026: 12 câu, 2 nhiệm vụ'));
    expect(
      screen.getByText('26/11/2026: 12 câu, 2 nhiệm vụ', { selector: 'span[aria-live]' }),
    ).toBeInTheDocument();
  });
});

describe('AccuracyBars', () => {
  it('shows percentages with the interval, and holds back thin data', () => {
    render(
      <AccuracyBars
        rows={[
          { key: 'passive', label: 'Bị động', n: 10, correct: 8 },
          { key: 'tense', label: 'Thì', n: 2, correct: 2 },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: /Bị động: đúng 80%, khoảng tin cậy 49–94%/ })).toBeInTheDocument();
    expect(screen.getByText(/2 câu · chưa đủ dữ liệu/)).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
  });
});
