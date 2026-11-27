# TOEIC & IELTS Study Group

Website tự học theo nhóm, chạy tại <https://wokhyu.github.io/toeic-ielts-study/>.

Có 3 khóa học. Người học tự đăng ký tài khoản, sau đó gửi yêu cầu vào từng khóa. Admin duyệt yêu cầu.

| Khóa                      | Nội dung                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| TOEIC Listening & Reading | Bài test đầu vào. Lộ trình 12 tuần chia 3 nhánh A/B/C. Checklist hằng ngày, flashcard SM-2, điểm thi thử kèm biểu đồ, bảng xếp hạng. |
| IELTS Academic            | Giống TOEIC nhưng luyện cả 4 kỹ năng. Mỗi tuần có chấm chéo Writing và luyện Speaking theo cặp.                                      |
| Ôn tập Toán · Lý · Hóa 11 | Ngân hàng câu hỏi theo chương. Có luyện từng chủ đề, thi thử bấm giờ, ôn lại câu sai.                                                |

Bảng tổng quan lộ trình: [docs/roadmap-toeic.md](docs/roadmap-toeic.md), [docs/roadmap-ielts.md](docs/roadmap-ielts.md). Thiết kế và phân quyền: [docs/design.md](docs/design.md).

## Công nghệ

- Frontend: Vite, React 19, TypeScript, Tailwind CSS v4, React Router (HashRouter), Recharts. Phần nghe dùng Web Speech API.
- Backend: Supabase (Postgres, Auth, Storage). Phân quyền bằng RLS và các hàm `security definer`.
- Kiểm thử: Vitest. Migration được chạy thật trên PGlite để test RLS, quyền và cách chấm điểm.
- Hosting: GitHub Pages. CI/CD chạy bằng GitHub Actions.

## Chạy ở máy cá nhân

Cần Node 24.

```bash
npm ci
cp .env.example .env.local   # điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

Có thể chạy khi chưa có Supabase, nhưng chỉ xem trước được lộ trình và làm thử bài test (không lưu kết quả).

| Lệnh                                    | Việc                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                                                                  |
| `npm run typecheck`                     | TypeScript                                                                         |
| `npm test` / `npm run test:coverage`    | Unit test và test database (PGlite)                                                |
| `npm run validate:content`              | Kiểm tra schema, id, thời lượng mỗi ngày, ngưỡng xếp nhánh                         |
| `npm run generate:roadmap`              | Sinh lại `content/roadmap/**` và `docs/roadmap-*.md` từ `scripts/roadmap-specs.ts` |
| `npm run build`                         | Build vào `dist/`                                                                  |

## Cài Supabase (làm một lần)

1. Tạo project trên [supabase.com](https://supabase.com).
2. Vào **Authentication → URL Configuration**:
   - Site URL: `https://wokhyu.github.io/toeic-ielts-study/`
   - Redirect URLs: thêm URL trên và `http://localhost:5173/`
3. Đặt secret cho repo. Lệnh `gh secret set` sẽ hỏi giá trị, nên key không hiện trên màn hình hay trong lịch sử lệnh.
   ```bash
   gh secret set VITE_SUPABASE_URL        # https://<ref>.supabase.co
   gh secret set VITE_SUPABASE_ANON_KEY   # Project Settings → API → anon public
   gh secret set SUPABASE_DB_URL --env production
   ```
   `SUPABASE_DB_URL` là chuỗi kết nối **Session pooler**, lấy ở nút Connect → Session pooler, có dạng `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. Phải dùng pooler vì máy chạy GitHub Actions chỉ có IPv4.
4. Chạy migration: vào tab Actions → **db-migrate** → Run workflow. Sau này, mỗi lần merge thay đổi trong `supabase/**` vào `main`, migration sẽ tự chạy.
5. Tạo admin đầu tiên. Đăng ký tài khoản trên web, rồi chạy câu sau trong **SQL Editor** của Supabase, thay email của bạn vào. Email chỉ nằm trong database, không nằm trong repo.
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '<email-cua-ban>');
   ```
   Từ lúc đó, admin có thể cấp quyền admin cho người khác ở Quản trị → Tài khoản & duyệt.
6. Nạp câu hỏi Ôn tập 11: làm theo [courses/on-tap-11/README.md](courses/on-tap-11/README.md). Script chạy trên máy cá nhân và dùng service role key.
7. Cho phép tự nạp câu hỏi TOEIC/IELTS: đặt service role key làm secret của environment `production`. Khi lệnh hỏi giá trị, dán key vào:
   ```bash
   gh secret set SUPABASE_SERVICE_ROLE_KEY --env production   # Project Settings → API Keys → secret / service_role
   ```
   Sau đó vào Actions → **bank-sync** → Run workflow để nạp lần đầu.

> Anon key được phép công khai, vì quyền truy cập đã được RLS chặn. Service role key bỏ qua RLS: chỉ lưu nó trong `.env.local` trên máy bạn hoặc trong secret của environment `production`, không bao giờ commit và không đặt vào biến `VITE_*`.

## Ngân hàng câu hỏi TOEIC/IELTS

Mọi câu hỏi đều là câu tự soạn, không chép đề ETS hay Cambridge. Mỗi câu đều có giải thích bằng tiếng Việt.

- `content/bank/<course>/taxonomy.json`: các phần, chương, chủ đề, và danh sách tag kèm nhãn tiếng Việt.
- `content/bank/<course>/*.json`: các bộ câu luyện tập (`sets`). Một bộ là một câu đơn (Part 5), hoặc một đoạn văn hay bài nghe (`stimulus`) đi kèm nhiều câu hỏi. Schema nằm trong `src/content/bank-schema.ts`.
- Đề thi thử **không** nằm trong repo, để học viên không xem trước được đáp án. Đề đặt trong `content-private/bank/<course>/*.json` (các bộ câu có `"pool": "mock"`) và `content-private/mocks/<course>-*.json` (đề, bảng quy đổi điểm, danh sách bộ câu). Thư mục `content-private/` đã nằm trong `.gitignore`; nên sao lưu nó vào một repo private. Chạy `npm run import:bank` trên máy cá nhân (có `.env.local`) để nạp lên.
- Thêm hoặc sửa câu hỏi: tạo PR. CI kiểm tra schema, đáp án có nằm trong các lựa chọn không, tag có hợp lệ không, và chạy thử việc import bằng đúng các hàm SQL. Sau khi merge, workflow `bank-sync` tự nạp lên Supabase.
- Part 1 của TOEIC (mô tả tranh) chưa có, vì cần ảnh.
- Nhiệm vụ lộ trình nối với ngân hàng câu hỏi qua trường `practice` trong `scripts/roadmap-specs.ts` (chạy `npm run generate:roadmap` sau khi sửa). Trên trang Hôm nay, nhiệm vụ đó có nút **Làm ngay**; làm đủ số câu hoặc nộp bài mini test/thi thử thì nhiệm vụ tự được tích. Nếu thêm hoặc bớt câu hỏi khiến một tag không còn đủ câu, `validate-content` sẽ báo lỗi.

## IELTS Writing và Speaking

- Đề tự soạn nằm ở `content/prompts/`: `ielts-writing.json` (2 đề mỗi tuần; Task 1 khai báo số liệu biểu đồ trong `visuals`) và `ielts-speaking.json` (1 bộ Part 1–3 mỗi tuần). `validate-content` kiểm tra schema, số liệu biểu đồ (biểu đồ tròn cộng đủ 100%, bản đồ nằm trong khung) và mỗi tuần có đề.
- Học viên nộp bài viết hoặc ghi âm ở tab **Viết & Nói**, bật chia sẻ để bạn cùng khóa chấm chéo theo 4 tiêu chí IELTS. Bản ghi lưu ở Supabase Storage (bucket riêng tư `speaking`, tạo bằng migration).
- Dự định: AI nhận xét bài Writing (ước lượng band, gợi ý sửa). Nhận xét Speaking bằng AI (chuyển giọng nói thành chữ rồi chấm) để làm sau.

## Theo dõi kết quả học viên

Mọi lần trả lời (luyện tập, ôn lại, thi, thi thử), mọi nhiệm vụ đã tích và mọi lượt ôn flashcard đều được lưu. Học viên xem tiến bộ của mình ở tab **Tiến bộ**. Admin vào **Quản trị** để xem:

- **Tổng quan**: số học viên hoạt động, hoạt động theo ngày, phễu từ lúc đăng ký đến lúc học đều, phân bố nhánh.
- **Học viên**: bảng từng người (hoạt động 14 ngày, độ chính xác, tiến độ, chủ điểm yếu), cảnh báo người nghỉ học hơn 5 ngày, bấm vào tên để xem chi tiết.
- **Chất lượng câu hỏi**: độ khó, độ phân biệt và số người chọn từng phương án của mỗi câu, gắn cờ câu cần xem lại.

Các bảng đều có nút **Xuất CSV** (mở được bằng Excel). Tài khoản admin không được tính vào số liệu.

## Quy trình làm việc

- Nhánh `main` được bảo vệ: chỉ thay đổi qua Pull Request và CI phải xanh.
- Tạo nhánh `feat/*`, `fix/*`, `docs/*` hoặc `ci/*`, mở PR, chờ CI xanh rồi **Squash and merge**.
- Commit theo [Conventional Commits](https://www.conventionalcommits.org/), ví dụ `feat(ot): ...`, `fix(auth): ...`.
- Cách sửa từng loại nội dung:
  - Lộ trình: sửa `scripts/roadmap-specs.ts`, chạy `npm run generate:roadmap`, rồi commit cả file JSON lẫn file Markdown sinh ra.
  - Database: tạo file migration mới trong `supabase/migrations/` (không sửa file đã chạy) và viết test trong `supabase/tests/`.

## CI/CD

| Workflow         | Khi nào chạy                                                                                                                      | Việc                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ci.yml`         | Mỗi PR, và mỗi lần push lên nhánh khác `main`                                                                                     | lint, format, typecheck, test kèm coverage, validate content, build                                   |
| `deploy.yml`     | Push lên `main`, hoặc chạy tay                                                                                                    | Chạy lại các bước kiểm tra, build với secret Supabase, deploy lên GitHub Pages                        |
| `db-migrate.yml` | Push lên `main` có thay đổi trong `supabase/migrations/**`, hoặc chạy tay                                                         | Chạy `supabase db push` (dry-run trước, rồi push) trong environment `production`                      |
| `keep-alive.yml` | 2 ngày một lần, hoặc chạy tay                                                                                                     | Đọc danh sách khóa học để Supabase gói miễn phí không tự tạm dừng; báo lỗi nếu project đã bị dừng     |
| `bank-sync.yml`  | Push lên `main` có thay đổi trong `content/bank/**` hoặc `content/roadmap/**`, sau mỗi lần `db-migrate` thành công, hoặc chạy tay | Nạp câu hỏi luyện tập TOEIC/IELTS và danh sách nhiệm vụ lộ trình lên Supabase (upsert, chạy lại được) |

Dependabot cập nhật dependency npm và GitHub Actions mỗi tuần. TypeScript bản major được bỏ qua cho tới khi `typescript-eslint` hỗ trợ.

Nếu web báo không kết nối được và workflow `keep-alive` đỏ: vào Supabase Dashboard, mở project và bấm **Restore**. Project gói miễn phí vẫn có thể bị dừng dù có ping.

## Cấu trúc thư mục

```
content/            nội dung: bài test, lộ trình 12 tuần, flashcard, ngân hàng câu luyện tập (JSON)
courses/on-tap-11/  pipeline dựng ngân hàng câu hỏi (câu hỏi không nằm trong repo)
docs/               thiết kế, bảng tổng quan lộ trình
scripts/            sinh lộ trình, kiểm tra nội dung, import ngân hàng câu hỏi
src/                ứng dụng React (lib/ chứa logic thuần, có test)
supabase/           migrations và test database
```
