import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  IELTS_RESOURCE,
  MOCK_WEEKS,
  TOEIC_RESOURCE,
  ieltsDays,
  ieltsWeeks,
  phaseOf,
  toeicDays,
  toeicWeeks,
  type DraftDay,
} from './roadmap-specs.ts';

type Program = 'toeic' | 'ielts';

const root = process.cwd();

function buildWeek(
  program: Program,
  week: number,
  focus: Record<string, string>,
  drafts: DraftDay[],
) {
  return {
    program,
    week,
    phase: phaseOf(week),
    focus,
    days: drafts.map((d, i) => ({
      day: i + 1,
      mock_test: d.mock_test,
      tasks: d.tasks.map((t, j) => ({
        id: `${program}-w${week}d${i + 1}t${j + 1}`,
        skill: t.skill,
        track: t.track,
        title: t.title,
        minutes: t.minutes,
        group_activity: t.group_activity,
      })),
    })),
  };
}

function write(program: Program, weeks: ReturnType<typeof buildWeek>[]) {
  const dir = join(root, 'content', 'roadmap', program);
  mkdirSync(dir, { recursive: true });
  for (const w of weeks) {
    const file = join(dir, `week-${String(w.week).padStart(2, '0')}.json`);
    writeFileSync(file, JSON.stringify(w, null, 2) + '\n');
  }
}

function minutesFor(week: ReturnType<typeof buildWeek>, track: 'A' | 'B' | 'C'): string {
  const per = week.days.map((d) =>
    d.tasks.filter((t) => t.track === 'all' || t.track === track).reduce((s, t) => s + t.minutes, 0),
  );
  const study = per.slice(0, 5);
  return `${Math.min(...study)}–${Math.max(...study)}`;
}

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function markdown(
  title: string,
  intro: string,
  resource: string,
  columns: [string, string][],
  weeks: ReturnType<typeof buildWeek>[],
): string {
  const lines: string[] = [];
  lines.push(`# ${title}`, '');
  lines.push('> File này được sinh tự động bởi `npm run generate:roadmap` từ `scripts/roadmap-specs.ts`. Không sửa tay.', '');
  lines.push(intro, '');
  lines.push(`**Tài liệu:** ${resource}`, '');
  lines.push(
    `**Thời lượng:** 5 ngày học chính mỗi tuần, 120–180 phút/ngày. ${DAY_NAMES[5]} là buổi hoạt động nhóm, có thể bỏ qua. Chủ nhật nghỉ. Thi thử full test vào ${DAY_NAMES[5]} của tuần ${MOCK_WEEKS.join(', ')}.`,
    '',
  );
  lines.push('## Tổng quan 12 tuần', '');
  lines.push(`| Tuần | Giai đoạn | ${columns.map((c) => c[1]).join(' | ')} | Thi thử |`);
  lines.push(`|---|---|${columns.map(() => '---').join('|')}|---|`);
  for (const w of weeks) {
    lines.push(
      `| ${w.week} | ${w.phase.replace(/^Giai đoạn \d: /, '')} | ${columns.map((c) => w.focus[c[0]]).join(' | ')} | ${MOCK_WEEKS.includes(w.week) ? 'Có' : ''} |`,
    );
  }
  lines.push('');
  lines.push('## Chi tiết từng tuần', '');
  for (const w of weeks) {
    lines.push(
      `### Tuần ${w.week}`,
      '',
      `Phút học mỗi ngày (Thứ 2–Thứ 6): nhánh A ${minutesFor(w, 'A')}, nhánh B ${minutesFor(w, 'B')}, nhánh C ${minutesFor(w, 'C')}.`,
      '',
    );
    lines.push('| Ngày | Nhánh | Nhiệm vụ | Phút |', '|---|---|---|---|');
    for (const d of w.days) {
      for (const t of d.tasks) {
        const group = t.group_activity ? ' (nhóm)' : '';
        lines.push(
          `| ${DAY_NAMES[d.day - 1]} | ${t.track === 'all' ? 'Tất cả' : t.track} | ${t.title}${group} | ${t.minutes} |`,
        );
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

const toeic = toeicWeeks.map((s, i) =>
  buildWeek(
    'toeic',
    i + 1,
    { grammar: s.grammar, vocab: s.vocab, listening: s.listen, reading: s.read },
    toeicDays(i + 1, s),
  ),
);

const ielts = ieltsWeeks.map((s, i) =>
  buildWeek(
    'ielts',
    i + 1,
    {
      listening: s.listen,
      reading: s.read,
      writing: s.writing,
      speaking: s.speaking,
      vocab: s.vocab,
      grammar: s.grammar,
    },
    ieltsDays(i + 1, s),
  ),
);

write('toeic', toeic);
write('ielts', ielts);

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(
  join(root, 'docs', 'roadmap-toeic.md'),
  markdown(
    'Lộ trình TOEIC Listening & Reading – 12 tuần',
    'Ba nhánh dùng chung khung tuần: A (dưới 400, mục tiêu 550), B (400–600, mục tiêu 750), C (trên 600, mục tiêu 850+). Các nhánh chỉ khác nhau ở độ khó và khối lượng bài.',
    TOEIC_RESOURCE,
    [
      ['listening', 'Listening'],
      ['reading', 'Reading'],
      ['grammar', 'Ngữ pháp'],
      ['vocab', 'Chủ đề từ vựng'],
    ],
    toeic,
  ) + '\n',
);
writeFileSync(
  join(root, 'docs', 'roadmap-ielts.md'),
  markdown(
    'Lộ trình IELTS Academic – 12 tuần',
    'Ba nhánh dùng chung khung tuần: A (dưới 4.5, mục tiêu 5.5), B (4.5–5.5, mục tiêu 6.5), C (6.0+, mục tiêu 7.0+). Mỗi tuần có 1 buổi chấm chéo Writing và 1 buổi luyện Speaking theo cặp, vì nhóm tự học không có giáo viên chấm.',
    IELTS_RESOURCE,
    [
      ['listening', 'Listening'],
      ['reading', 'Reading'],
      ['writing', 'Writing'],
      ['speaking', 'Speaking'],
      ['vocab', 'Từ vựng'],
    ],
    ielts,
  ) + '\n',
);

console.log(`Generated ${toeic.length} TOEIC weeks and ${ielts.length} IELTS weeks.`);
