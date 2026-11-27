import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { roadmaps, speakingSets, writingPrompts } from '../../content/index.ts';
import { findTask, taskHref } from '../../lib/roadmap.ts';
import { clearDraft, promptTitle, readDraft, saveDraft } from './data.ts';
import { fileTypeOf, pickMimeType } from './recorder.ts';
import { WritingVisual } from './WritingVisual.tsx';

describe('Writing and Speaking content', () => {
  it('has prompts for every week and titles for lists', () => {
    for (let week = 1; week <= 12; week++) {
      expect(writingPrompts.some((p) => p.week === week)).toBe(true);
      expect(speakingSets.some((s) => s.week === week)).toBe(true);
    }
    expect(promptTitle('writing', 'w01-a')).toBe('Task 1 · Biểu đồ đường: giờ học online và ở thư viện');
    expect(promptTitle('speaking', 's03')).toBe('Speaking · Công nghệ');
    expect(promptTitle('writing', 'nope')).toBe('nope');
  });

  it('sends Writing, Speaking and review tasks to the Viết & Nói pages', () => {
    const writing = findTask(roadmaps.ielts, 'ielts-w2d2t3')!.task;
    expect(writing.practice).toEqual({ kind: 'writing' });
    expect(taskHref('ielts', writing)).toBe('/c/ielts/viet-noi/nv/ielts-w2d2t3');
    const bank = findTask(roadmaps.ielts, 'ielts-w1d1t3')!.task;
    expect(taskHref('ielts', bank)).toBe('/c/ielts/luyen/nv/ielts-w1d1t3');
    const kinds = new Set(
      roadmaps.ielts.flatMap((w) => w.days.flatMap((d) => d.tasks.map((t) => t.practice?.kind))),
    );
    expect([...kinds].filter(Boolean).sort()).toEqual([
      'exam',
      'mock',
      'practice',
      'review',
      'speaking',
      'writing',
    ]);
  });
});

describe('writing drafts', () => {
  it('keeps a draft per prompt and drops empty ones', () => {
    saveDraft('w01-a', 'The graph shows', 42);
    expect(readDraft('w01-a')).toEqual({ text: 'The graph shows', seconds: 42 });
    saveDraft('w01-a', '   ', 50);
    expect(readDraft('w01-a')).toBeNull();
    saveDraft('w01-b', 'Draft', 1);
    clearDraft('w01-b');
    expect(readDraft('w01-b')).toBeNull();
  });
});

describe('recording formats', () => {
  it('picks a format the browser supports and names the file after it', () => {
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBe('');
    expect(fileTypeOf('audio/webm;codecs=opus')).toEqual({ ext: 'webm', contentType: 'audio/webm' });
    expect(fileTypeOf('audio/mp4')).toEqual({ ext: 'm4a', contentType: 'audio/mp4' });
    expect(fileTypeOf('')).toEqual({ ext: 'webm', contentType: 'audio/webm' });
  });
});

describe('WritingVisual', () => {
  it('draws every Task 1 visual in the bank without errors', () => {
    for (const p of writingPrompts) {
      for (const v of p.visuals ?? []) {
        const { unmount } = render(<WritingVisual visual={v} />);
        expect(screen.getByText(v.title)).toBeInTheDocument();
        unmount();
      }
    }
  });

  it('shows the numbers behind a chart as a table', () => {
    const line = writingPrompts.find((p) => p.id === 'w01-a')!.visuals![0];
    render(<WritingVisual visual={line} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem bảng số liệu' }));
    expect(screen.getByRole('columnheader', { name: 'Online' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: '2020 19 3' })).toBeInTheDocument();
  });

  it('labels map features for screen readers', () => {
    const map = writingPrompts.find((p) => p.id === 'w09-a')!.visuals![0];
    render(<WritingVisual visual={map} />);
    expect(screen.getByRole('img', { name: /Riverton village, Today: .*Supermarket/ })).toBeInTheDocument();
  });
});
