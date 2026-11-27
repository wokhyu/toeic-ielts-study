/**
 * Source of truth for both 12-week roadmaps.
 * `npm run generate:roadmap` expands these specs into content/roadmap/<program>/week-XX.json
 * and docs/roadmap-<program>.md. Edit this file, then regenerate; do not edit the JSON by hand.
 */

import type { PracticeLink } from '../src/content/schema.ts';

export type Skill = 'listening' | 'reading' | 'writing' | 'speaking' | 'grammar' | 'vocab' | 'mock';
export type TrackKey = 'A' | 'B' | 'C';

export interface DraftTask {
  skill: Skill;
  track: TrackKey | 'all';
  title: string;
  minutes: number;
  group_activity: boolean;
  /** The question-bank practice the "Làm ngay" button opens; see practiceLinkSchema. */
  practice?: PracticeLink;
}

export interface DraftDay {
  mock_test: boolean;
  tasks: DraftTask[];
}

export const PHASES = {
  foundation: 'Giai đoạn 1: Nền tảng',
  strategy: 'Giai đoạn 2: Chiến thuật theo dạng bài',
  practice: 'Giai đoạn 3: Luyện đề và tăng tốc',
} as const;

export function phaseOf(week: number): string {
  if (week <= 4) return PHASES.foundation;
  if (week <= 8) return PHASES.strategy;
  return PHASES.practice;
}

export const MOCK_WEEKS = [4, 8, 12];

const all = (
  skill: Skill,
  title: string,
  minutes: number,
  group_activity = false,
  practice?: PracticeLink,
): DraftTask => ({ skill, track: 'all', title, minutes, group_activity, ...(practice ? { practice } : {}) });

const tracked = (skill: Skill, byTrack: Record<TrackKey, [string, number, PracticeLink?]>): DraftTask[] =>
  (['A', 'B', 'C'] as const).map((track) => {
    const [title, minutes, practice] = byTrack[track];
    return { skill, track, title, minutes, group_activity: false, ...(practice ? { practice } : {}) };
  });

/**
 * Answer `count` bank questions tagged with any of `tags`, the first tags first.
 * Put the week's narrow tags before a broad one (a Part or a skill), so the
 * set is large enough even when the narrow tags have few questions.
 * No tags: the bank has nothing for this task (e.g. TOEIC Part 1), so no link.
 */
const drill = (tags: string[], count: number): PracticeLink | undefined =>
  tags.length > 0 ? { kind: 'practice', tags: [...new Set(tags)], count } : undefined;

const miniTest = (
  minutes: number,
  parts: [label: string, tags: string[], count: number][],
): PracticeLink => ({
  kind: 'exam',
  minutes,
  parts: parts.map(([label, tags, count]) => ({ label, tags, count })),
});

const MOCK: PracticeLink = { kind: 'mock' };
const WRITE: PracticeLink = { kind: 'writing' };
const SPEAK: PracticeLink = { kind: 'speaking' };
const REVIEW: PracticeLink = { kind: 'review' };

/* ------------------------------------------------------------------ TOEIC */

export interface ToeicWeekSpec {
  grammar: string;
  vocab: string;
  listen: string;
  listenPart: string;
  read: string;
  readPart: string;
  /** Bank tags for the week's grammar point (Part 5 questions). */
  grammarTags: string[];
  /** Bank tags for the week's listening focus, narrow first; empty if the bank has none. */
  listenTags: string[];
  /** Bank tags for the week's reading focus, narrow first. */
  readTags: string[];
}

const TOEIC_LISTENING = ['part2', 'part3', 'part4'];
const TOEIC_READING = ['part5', 'part6', 'part7'];

export const TOEIC_RESOURCE =
  'Đề mẫu chính thức trên ets.org/toeic; sách luyện đề ETS bạn đang có (dùng cho bài thi thử).';

export const toeicWeeks: ToeicWeekSpec[] = [
  {
    grammar: 'Thì hiện tại đơn, hiện tại tiếp diễn, quá khứ đơn',
    vocab: 'Văn phòng',
    listen: 'Part 1: mô tả tranh',
    listenPart: 'Part 1',
    read: 'Part 5: từ loại (danh, động, tính, trạng từ)',
    readPart: 'Part 5',
    grammarTags: ['tense'],
    listenTags: [],
    readTags: ['word-form', 'part5'],
  },
  {
    grammar: 'Thì hiện tại hoàn thành và tương lai',
    vocab: 'Nhân sự và tuyển dụng',
    listen: 'Part 2: câu hỏi Wh-',
    listenPart: 'Part 2',
    read: 'Part 5: thì của động từ',
    readPart: 'Part 5',
    grammarTags: ['tense'],
    listenTags: ['p2-wh', 'part2'],
    readTags: ['tense', 'part5'],
  },
  {
    grammar: 'Câu bị động',
    vocab: 'Marketing và bán hàng',
    listen: 'Part 2: câu Yes/No, câu hỏi đuôi, câu đề nghị',
    listenPart: 'Part 2',
    read: 'Part 5: chủ động và bị động',
    readPart: 'Part 5',
    grammarTags: ['passive'],
    listenTags: ['p2-yesno', 'p2-request', 'part2'],
    readTags: ['passive', 'part5'],
  },
  {
    grammar: 'Đại từ và hòa hợp chủ ngữ – động từ',
    vocab: 'Mua sắm và đặt hàng',
    listen: 'Part 3: hội thoại ngắn, câu hỏi chủ đề và chi tiết',
    listenPart: 'Part 3',
    read: 'Part 6: điền từ theo ngữ cảnh',
    readPart: 'Part 6',
    grammarTags: ['agreement'],
    listenTags: ['p3-detail', 'part3'],
    readTags: ['p6-context', 'part6'],
  },
  {
    grammar: 'Giới từ và liên từ',
    vocab: 'Du lịch và công tác',
    listen: 'Part 3: câu hỏi ý định và suy luận',
    listenPart: 'Part 3',
    read: 'Part 5: giới từ, liên từ, trạng từ nối',
    readPart: 'Part 5',
    grammarTags: ['prep-conj'],
    listenTags: ['p3-inference', 'part3'],
    readTags: ['prep-conj', 'part5'],
  },
  {
    grammar: 'Mệnh đề quan hệ',
    vocab: 'Tài chính và ngân hàng',
    listen: 'Part 3: hội thoại có bảng biểu',
    listenPart: 'Part 3',
    read: 'Part 7: đoạn đơn (email, thông báo, quảng cáo)',
    readPart: 'Part 7',
    grammarTags: ['relative'],
    listenTags: ['p3-graphic', 'part3'],
    readTags: ['p7-single', 'part7'],
  },
  {
    grammar: 'Câu điều kiện và câu giả định',
    vocab: 'Sản xuất và kho vận',
    listen: 'Part 4: thông báo và tin nhắn thoại',
    listenPart: 'Part 4',
    read: 'Part 7: đoạn kép',
    readPart: 'Part 7',
    grammarTags: ['conditional'],
    listenTags: ['p4-talk', 'part4'],
    readTags: ['p7-multi', 'part7'],
  },
  {
    grammar: 'So sánh, danh động từ và động từ nguyên mẫu',
    vocab: 'Sức khỏe và bảo hiểm',
    listen: 'Part 4: bài nói có bảng biểu',
    listenPart: 'Part 4',
    read: 'Part 7: đoạn ba và chuỗi tin nhắn',
    readPart: 'Part 7',
    grammarTags: ['verb-form'],
    listenTags: ['p4-graphic', 'part4'],
    readTags: ['p7-multi', 'part7'],
  },
  {
    grammar: 'Tổng ôn các bẫy ngữ pháp Part 5',
    vocab: 'Hợp đồng và pháp lý',
    listen: 'Part 1–2: tăng tốc phản xạ',
    listenPart: 'Part 1–2',
    read: 'Part 5–6: làm bài có bấm giờ',
    readPart: 'Part 5–6',
    grammarTags: ['part5'],
    listenTags: ['part2'],
    readTags: ['part5', 'part6'],
  },
  {
    grammar: 'Collocation và từ dễ nhầm',
    vocab: 'Công nghệ và IT',
    listen: 'Part 3–4: đọc trước câu hỏi',
    listenPart: 'Part 3–4',
    read: 'Part 7: quản lý thời gian',
    readPart: 'Part 7',
    grammarTags: ['collocation'],
    listenTags: ['part3', 'part4'],
    readTags: ['part7'],
  },
  {
    grammar: 'Ôn theo sổ lỗi sai cá nhân',
    vocab: 'Sự kiện và hội nghị',
    listen: 'Listening đầy đủ Part 1–4',
    listenPart: 'Part 1–4',
    read: 'Reading đầy đủ Part 5–7',
    readPart: 'Part 5–7',
    grammarTags: ['part5'],
    listenTags: ['part2', 'part3', 'part4'],
    readTags: ['part5', 'part6', 'part7'],
  },
  {
    grammar: 'Tổng ôn toàn bộ chủ điểm',
    vocab: 'Nhà hàng và ẩm thực',
    listen: 'Ôn chiến thuật cả 4 Part',
    listenPart: 'Part 1–4',
    read: 'Ôn chiến thuật cả 3 Part',
    readPart: 'Part 5–7',
    grammarTags: ['part5'],
    listenTags: ['part2', 'part3', 'part4'],
    readTags: ['part5', 'part6', 'part7'],
  },
];

const toeicMini = (minutes: number, listening: number, reading: number) =>
  miniTest(minutes, [
    ['Listening', TOEIC_LISTENING, listening],
    ['Reading', TOEIC_READING, reading],
  ]);

export function toeicDays(week: number, s: ToeicWeekSpec): DraftDay[] {
  const mock = MOCK_WEEKS.includes(week);
  const practicePhase = week >= 9;
  const grammar = [...s.grammarTags, 'part5'];
  const listenMix = s.listenTags.length > 0 ? [...s.listenTags, ...TOEIC_LISTENING] : TOEIC_LISTENING;
  const readMix = [...s.readTags, ...TOEIC_READING];

  const day1: DraftTask[] = [
    ...(week === 1
      ? [all('reading', 'Đọc cấu trúc đề TOEIC (7 Part, 200 câu, 120 phút), ghi mục tiêu điểm của bạn', 20)]
      : []),
    all('vocab', `Học 20 từ mới chủ đề "${s.vocab}" trên trang Flashcard, đặt câu với 5 từ`, 25),
    all('grammar', `Học chủ điểm "${s.grammar}": ghi công thức và 10 câu ví dụ vào sổ`, 35),
    ...tracked('grammar', {
      A: [`Làm 20 câu Part 5 về "${s.grammar}", chữa và ghi lỗi sai vào sổ`, 30, drill(grammar, 20)],
      B: [`Làm 30 câu Part 5 về "${s.grammar}", chữa và ghi lỗi sai vào sổ`, 35, drill(grammar, 30)],
      C: [`Làm 40 câu Part 5 về "${s.grammar}" trong 20 phút, chữa và ghi lỗi sai`, 35, drill(grammar, 40)],
    }),
    all('listening', `Nghe chép chính tả 10 câu ${s.listenPart}, so với script và đánh dấu chỗ nghe sai`, 30),
    all('grammar', 'Ôn sổ lỗi sai: viết lại đúng 5 câu sai gần nhất', 15),
  ];

  const day2: DraftTask[] = [
    all('vocab', 'Ôn từ vựng tuần này trên Flashcard (chế độ lặp lại ngắt quãng)', 15),
    all('listening', `Học chiến thuật ${s.listen}: ghi 3 mẹo và 3 bẫy thường gặp`, 30),
    ...tracked('listening', {
      A: [`Làm 12 câu ${s.listenPart}, nghe lại câu sai 2 lần có script`, 40, drill(s.listenTags, 12)],
      B: [`Làm 20 câu ${s.listenPart}, nghe lại câu sai có script`, 40, drill(s.listenTags, 20)],
      C: [`Làm 30 câu ${s.listenPart}, lần đầu không xem script, sau đó chữa`, 45, drill(s.listenTags, 30)],
    }),
    all('listening', `Shadowing 1 đoạn ${s.listenPart} (khoảng 1 phút): nói theo 5 lần, ghi âm lần cuối`, 20),
    all('reading', 'Đọc 1 email hoặc thông báo tiếng Anh, gạch chân 10 cụm từ hay và chép vào sổ', 20),
  ];

  const day3: DraftTask[] = [
    all('vocab', 'Ôn từ vựng tuần này trên Flashcard', 15),
    all('reading', `Học chiến thuật ${s.read}: đọc câu hỏi trước, xác định từ khóa`, 30),
    ...tracked('reading', {
      A: [`Làm 10 câu ${s.readPart}, tra từ mới sau khi làm xong`, 40, drill(s.readTags, 10)],
      B: [`Làm 16 câu ${s.readPart}, ghi lý do chọn đáp án`, 40, drill(s.readTags, 16)],
      C: [`Làm 24 câu ${s.readPart} có bấm giờ, chữa kỹ câu sai`, 45, drill(s.readTags, 24)],
    }),
    ...tracked('grammar', {
      A: ['Làm 15 câu Part 5 tổng hợp', 20, drill(['part5'], 15)],
      B: ['Làm 20 câu Part 5 tổng hợp', 20, drill(['part5'], 20)],
      C: ['Làm 30 câu Part 5 tổng hợp trong 15 phút', 20, drill(['part5'], 30)],
    }),
    all('listening', 'Nghe lại đoạn shadowing hôm qua, nói theo mà không nhìn script', 20),
  ];

  const day4: DraftTask[] = [
    all('vocab', 'Ôn từ vựng tuần này trên Flashcard', 15),
    ...tracked('listening', {
      A: [`Làm 15 câu nghe tổng hợp (ưu tiên ${s.listenPart})`, 35, drill(listenMix, 15)],
      B: [`Làm 25 câu nghe tổng hợp (ưu tiên ${s.listenPart})`, 40, drill(listenMix, 25)],
      C: [`Làm 35 câu nghe tổng hợp (ưu tiên ${s.listenPart})`, 45, drill(listenMix, 35)],
    }),
    ...tracked('reading', {
      A: [`Làm 15 câu đọc tổng hợp (ưu tiên ${s.readPart})`, 35, drill(readMix, 15)],
      B: [`Làm 25 câu đọc tổng hợp (ưu tiên ${s.readPart})`, 40, drill(readMix, 25)],
      C: [`Làm 35 câu đọc tổng hợp (ưu tiên ${s.readPart})`, 45, drill(readMix, 35)],
    }),
    all('grammar', 'Ghi lỗi sai hôm nay vào sổ, phân loại theo chủ điểm', 20),
    all('listening', `Shadowing 1 đoạn ${s.listenPart} mới`, 15),
  ];

  const day5: DraftTask[] = [
    ...(practicePhase
      ? [
          all(
            'mock',
            'Làm nửa đề (50 câu Listening + 50 câu Reading), bấm giờ 60 phút',
            65,
            false,
            toeicMini(60, 50, 50),
          ),
        ]
      : tracked('mock', {
          A: ['Làm mini test 30 câu (15 nghe + 15 đọc) trong 30 phút', 40, toeicMini(30, 15, 15)],
          B: ['Làm mini test 50 câu (25 nghe + 25 đọc) trong 40 phút', 45, toeicMini(40, 25, 25)],
          C: ['Làm mini test 60 câu (30 nghe + 30 đọc) trong 45 phút', 50, toeicMini(45, 30, 30)],
        })),
    all('mock', 'Chữa bài: ghi lý do sai từng câu (thiếu từ, sai ngữ pháp, nghe nhầm, hết giờ)', 40),
    all('vocab', 'Tự kiểm tra từ vựng tuần này, đánh dấu từ chưa thuộc', 20),
    all('grammar', 'Ôn lại chủ điểm ngữ pháp sai nhiều nhất trong bài test', 25),
  ];

  const day6: DraftTask[] = mock
    ? [
        all(
          'mock',
          `Thi thử full test TOEIC lần ${MOCK_WEEKS.indexOf(week) + 1} (200 câu, 120 phút) cùng giờ với cả nhóm, nhập điểm vào trang Điểm thi thử`,
          120,
          true,
          MOCK,
        ),
        all('mock', 'Chữa nhanh: liệt kê các câu sai, đếm lỗi theo từng Part', 30),
      ]
    : [
        all('vocab', `Thi đua từ vựng cùng nhóm: quiz 20 từ chủ đề "${s.vocab}"`, 30, true),
        all('reading', 'Chữa đề chung qua video call: mỗi người trình bày 3 câu sai khó nhất tuần', 45, true),
        all('listening', 'Tự nghe tự do 45 phút: podcast hoặc video tiếng Anh về công việc, có phụ đề', 45),
      ];

  return [
    { mock_test: false, tasks: day1 },
    { mock_test: false, tasks: day2 },
    { mock_test: false, tasks: day3 },
    { mock_test: false, tasks: day4 },
    { mock_test: false, tasks: day5 },
    { mock_test: mock, tasks: day6 },
  ];
}

/* ------------------------------------------------------------------ IELTS */

export interface IeltsWeekSpec {
  listen: string;
  read: string;
  writing: string;
  speaking: string;
  vocab: string;
  grammar: string;
  /** Bank tags for the week's listening focus, narrow first, ending with 'listening'. */
  listenTags: string[];
  /** Bank tags for the week's reading focus, narrow first, ending with 'reading'. */
  readTags: string[];
}

export const IELTS_RESOURCE =
  'Cambridge IELTS Academic (chọn 1 bộ từ cuốn 15 trở lên); bài luyện miễn phí trên takeielts.britishcouncil.org; band descriptor công khai trên ielts.org.';

export const ieltsWeeks: IeltsWeekSpec[] = [
  {
    listen: 'Section 1: điền form và ghi chú',
    read: 'Skimming, scanning và True/False/Not Given',
    writing: 'Task 1: biểu đồ đường (mở bài và overview)',
    speaking: 'Part 1: bản thân và quê hương',
    vocab: 'Giáo dục',
    grammar: 'Câu đơn, câu ghép, câu phức',
    listenTags: ['form-completion', 'spelling', 'listening'],
    readTags: ['tfng', 'reading'],
  },
  {
    listen: 'Section 1–2: bản đồ và trắc nghiệm',
    read: 'Matching Headings',
    writing: 'Task 2: dạng Opinion (đồng ý/không đồng ý)',
    speaking: 'Part 1: công việc và học tập',
    vocab: 'Công việc và nghề nghiệp',
    grammar: 'Mệnh đề quan hệ',
    listenTags: ['map', 'mcq-listening', 'listening'],
    readTags: ['headings', 'reading'],
  },
  {
    listen: 'Section 2: trắc nghiệm nhiều lựa chọn',
    read: 'Sentence và Summary Completion',
    writing: 'Task 1: biểu đồ cột',
    speaking: 'Part 2: tả một người',
    vocab: 'Công nghệ',
    grammar: 'Câu so sánh và cách mô tả số liệu',
    listenTags: ['mcq-listening', 'listening'],
    readTags: ['sentence-completion', 'summary-completion', 'reading'],
  },
  {
    listen: 'Section 3: thảo luận học thuật',
    read: 'Yes/No/Not Given',
    writing: 'Task 2: dạng Discussion (bàn hai quan điểm)',
    speaking: 'Part 2: tả một địa điểm',
    vocab: 'Môi trường',
    grammar: 'Mạo từ và danh từ đếm được/không đếm được',
    listenTags: ['mcq-listening', 'matching-listening', 'listening'],
    readTags: ['ynng', 'reading'],
  },
  {
    listen: 'Section 3: matching',
    read: 'Matching Information',
    writing: 'Task 1: biểu đồ tròn và bảng số liệu',
    speaking: 'Part 3: câu hỏi trừu tượng',
    vocab: 'Sức khỏe',
    grammar: 'Câu điều kiện',
    listenTags: ['matching-listening', 'listening'],
    readTags: ['matching-info', 'reading'],
  },
  {
    listen: 'Section 4: điền ghi chú bài giảng',
    read: 'Multiple Choice',
    writing: 'Task 2: dạng Problem–Solution',
    speaking: 'Part 2: kể một sự kiện hoặc trải nghiệm',
    vocab: 'Đô thị hóa',
    grammar: 'Câu bị động',
    listenTags: ['note-completion', 'listening'],
    readTags: ['mcq-reading', 'reading'],
  },
  {
    listen: 'Section 4: theo kịp tốc độ bài giảng',
    read: 'Matching Features',
    writing: 'Task 1: sơ đồ quy trình (process)',
    speaking: 'Part 3: xã hội và chính phủ',
    vocab: 'Chính phủ và xã hội',
    grammar: 'Mệnh đề danh từ',
    listenTags: ['note-completion', 'listening'],
    readTags: ['matching-features', 'reading'],
  },
  {
    listen: 'Kết hợp Section 1–4',
    read: 'Diagram và Flow-chart Labelling',
    writing: 'Task 2: dạng Advantages–Disadvantages',
    speaking: 'Part 2: tả một đồ vật',
    vocab: 'Truyền thông',
    grammar: 'Thì hoàn thành trong mô tả xu hướng',
    listenTags: ['listening'],
    readTags: ['diagram', 'reading'],
  },
  {
    listen: 'Đề Listening đầy đủ có bấm giờ',
    read: 'Passage đầy đủ có bấm giờ',
    writing: 'Task 1: bản đồ (map)',
    speaking: 'Part 1–3 thi thử theo cặp',
    vocab: 'Kinh tế và toàn cầu hóa',
    grammar: 'Ôn câu phức và cách nối ý',
    listenTags: ['listening'],
    readTags: ['reading'],
  },
  {
    listen: 'Đề Listening đầy đủ: tập trung lỗi chính tả',
    read: 'Chiến lược phân bổ 60 phút cho 3 passage',
    writing: 'Task 2: dạng Two-part question',
    speaking: 'Part 3: khoa học và tương lai',
    vocab: 'Khoa học',
    grammar: 'Ôn lỗi ngữ pháp hay gặp trong Writing',
    listenTags: ['spelling', 'form-completion', 'listening'],
    readTags: ['reading'],
  },
  {
    listen: 'Đề Listening đầy đủ: chữa theo sổ lỗi',
    read: 'Đề Reading đầy đủ: chữa theo dạng câu hỏi',
    writing: 'Task 1: biểu đồ kết hợp (mixed)',
    speaking: 'Part 2–3: văn hóa và nghệ thuật',
    vocab: 'Văn hóa và nghệ thuật',
    grammar: 'Ôn theo sổ lỗi sai cá nhân',
    listenTags: ['listening'],
    readTags: ['reading'],
  },
  {
    listen: 'Tổng ôn chiến thuật 4 Section',
    read: 'Tổng ôn các dạng câu hỏi',
    writing: 'Task 1 và Task 2: viết đủ bài trong 60 phút',
    speaking: 'Part 1–3: thi thử hoàn chỉnh',
    vocab: 'Du lịch',
    grammar: 'Tổng ôn toàn bộ chủ điểm',
    listenTags: ['listening'],
    readTags: ['reading'],
  },
];

const IELTS_SECTION = 10;
const IELTS_PASSAGE = 13;
const ieltsMini = (minutes: number, listening: number, reading: number) =>
  miniTest(minutes, [
    ['Listening', ['listening'], listening],
    ['Reading', ['reading'], reading],
  ]);

export function ieltsDays(week: number, s: IeltsWeekSpec): DraftDay[] {
  const mock = MOCK_WEEKS.includes(week);
  const practicePhase = week >= 9;

  const day1: DraftTask[] = [
    ...(week === 1
      ? [
          all(
            'reading',
            'Đọc cấu trúc đề IELTS Academic (4 kỹ năng) và band descriptor, ghi band mục tiêu',
            20,
          ),
        ]
      : []),
    all('vocab', `Học 20 từ mới chủ đề "${s.vocab}" trên Flashcard, viết 5 câu ví dụ học thuật`, 20),
    all('listening', `Học chiến thuật ${s.listen}: đọc trước câu hỏi, đoán loại từ cần điền`, 25),
    ...tracked('listening', {
      A: [`Làm 1 section ${s.listen} (10 câu), nghe lại câu sai có script`, 35, drill(s.listenTags, 10)],
      B: [`Làm 2 section ${s.listen} (20 câu), nghe lại câu sai có script`, 35, drill(s.listenTags, 20)],
      C: [`Làm 3 section ${s.listen} (30 câu), không dừng audio`, 40, drill(s.listenTags, 30)],
    }),
    all('reading', `Học chiến thuật ${s.read}`, 20),
    ...tracked('reading', {
      A: [`Làm 1 bài ${s.read} (6–8 câu), không giới hạn thời gian`, 30, drill(s.readTags, 8)],
      B: [`Làm 2 bài ${s.read} (khoảng 13 câu)`, 30, drill(s.readTags, 13)],
      C: [`Làm 1 passage có dạng ${s.read} trong 20 phút`, 35, drill(s.readTags, IELTS_PASSAGE)],
    }),
  ];

  const day2: DraftTask[] = [
    all('vocab', 'Ôn từ vựng tuần này trên Flashcard (chế độ lặp lại ngắt quãng)', 15),
    all('writing', `Học cấu trúc ${s.writing}: phân tích 1 bài mẫu, ghi dàn ý`, 30),
    ...tracked('writing', {
      A: [`Viết mở bài và 1 đoạn thân bài cho ${s.writing}`, 40, WRITE],
      B: [`Viết bài hoàn chỉnh ${s.writing}, không giới hạn thời gian`, 40, WRITE],
      C: [`Viết bài ${s.writing} trong thời gian thi (Task 1: 20 phút, Task 2: 40 phút)`, 40, WRITE],
    }),
    all('speaking', `Luyện ${s.speaking}: trả lời 5 câu, ghi âm, nghe lại và ghi 3 lỗi`, 35, false, SPEAK),
  ];

  const day3: DraftTask[] = [
    all('vocab', 'Ôn từ vựng tuần này trên Flashcard', 15),
    ...tracked('reading', {
      A: ['Làm 1 passage mức dễ (13 câu), không giới hạn thời gian', 40, drill(['reading'], IELTS_PASSAGE)],
      B: ['Làm 1 passage trong 20 phút, chữa kỹ câu sai', 40, drill(['reading'], IELTS_PASSAGE)],
      C: ['Làm 2 passage, mỗi passage 20 phút', 45, drill(['reading'], 2 * IELTS_PASSAGE)],
    }),
    all('reading', 'Paraphrase: tìm 10 cặp từ đồng nghĩa giữa câu hỏi và bài đọc', 20),
    ...tracked('listening', {
      A: [`Nghe chép chính tả 1 đoạn ${s.listen} (khoảng 2 phút)`, 30],
      B: [`Làm 1 section ${s.listen}, chép chính tả các câu sai`, 30, drill(s.listenTags, IELTS_SECTION)],
      C: [`Làm 2 section ${s.listen}, ghi lại lỗi chính tả`, 30, drill(s.listenTags, 2 * IELTS_SECTION)],
    }),
    all('grammar', `Học "${s.grammar}", viết 8 câu áp dụng cho chủ đề "${s.vocab}"`, 25),
  ];

  const day4: DraftTask[] = [
    all('vocab', 'Ôn từ vựng tuần này trên Flashcard', 15),
    all(
      'writing',
      'Chấm chéo bài viết thứ 2 của 1 bạn trong nhóm theo checklist 4 tiêu chí, ghi 3 nhận xét',
      30,
      true,
      REVIEW,
    ),
    all('writing', 'Sửa bài của mình theo nhận xét được chấm chéo, viết lại 2 đoạn', 30),
    all(
      'speaking',
      `Luyện nói theo cặp qua video call: đổi vai giám khảo, hỏi ${s.speaking}, chấm theo 4 tiêu chí`,
      30,
      true,
    ),
    all('listening', `Shadowing 1 đoạn ${s.listen} (khoảng 1 phút), nói theo 5 lần`, 20),
  ];

  const day5: DraftTask[] = [
    ...(practicePhase
      ? [
          all(
            'mock',
            'Làm 1 đề Listening đầy đủ (40 câu, 30 phút) và 1 passage Reading (20 phút)',
            55,
            false,
            ieltsMini(50, 4 * IELTS_SECTION, IELTS_PASSAGE),
          ),
        ]
      : tracked('mock', {
          A: [
            'Mini test: 1 section Listening + 1 bài Reading, bấm giờ',
            45,
            ieltsMini(30, IELTS_SECTION, IELTS_PASSAGE),
          ],
          B: [
            'Mini test: 2 section Listening + 1 passage Reading, bấm giờ',
            50,
            ieltsMini(35, 2 * IELTS_SECTION, IELTS_PASSAGE),
          ],
          C: [
            'Mini test: 2 section Listening + 2 passage Reading, bấm giờ',
            60,
            ieltsMini(55, 2 * IELTS_SECTION, 2 * IELTS_PASSAGE),
          ],
        })),
    all('mock', 'Chữa mini test, ghi lỗi theo dạng câu hỏi', 30),
    all('writing', `Lập dàn ý cho 2 đề ${s.writing} mới (mỗi đề 10 phút), viết 1 đoạn`, 30, false, WRITE),
    all('vocab', 'Tự kiểm tra từ vựng tuần này, đánh dấu từ chưa thuộc', 15),
  ];

  const day6: DraftTask[] = mock
    ? [
        all(
          'mock',
          `Thi thử IELTS lần ${MOCK_WEEKS.indexOf(week) + 1}: Listening 30 phút, Reading 60 phút, Writing 60 phút. Nhập điểm vào trang Điểm thi thử`,
          150,
          true,
          MOCK,
        ),
        all('speaking', 'Thi Speaking với 1 bạn trong nhóm (15 phút), chấm chéo theo 4 tiêu chí', 20, true),
      ]
    : [
        all(
          'speaking',
          'Mock Speaking nhóm: mỗi người thi Part 1–3 trong 12 phút, các bạn còn lại chấm',
          60,
          true,
        ),
        all('writing', 'Ôn sổ lỗi Writing và từ vựng tuần, viết lại 3 câu hay nhất', 30),
      ];

  return [
    { mock_test: false, tasks: day1 },
    { mock_test: false, tasks: day2 },
    { mock_test: false, tasks: day3 },
    { mock_test: false, tasks: day4 },
    { mock_test: false, tasks: day5 },
    { mock_test: mock, tasks: day6 },
  ];
}
