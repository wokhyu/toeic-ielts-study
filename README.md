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
   Từ lúc đó, admin có thể cấp quyền admin cho người khác ngay trên trang Quản trị.
6. Nạp câu hỏi Ôn tập 11: làm theo [courses/on-tap-11/README.md](courses/on-tap-11/README.md). Script chạy trên máy cá nhân và dùng service role key.

> Anon key được phép công khai, vì quyền truy cập đã được RLS chặn. Service role key thì tuyệt đối không commit và không đặt vào biến `VITE_*`.

## Quy trình làm việc

- Nhánh `main` được bảo vệ: chỉ thay đổi qua Pull Request và CI phải xanh.
- Tạo nhánh `feat/*`, `fix/*`, `docs/*` hoặc `ci/*`, mở PR, chờ CI xanh rồi **Squash and merge**.
- Commit theo [Conventional Commits](https://www.conventionalcommits.org/), ví dụ `feat(ot): ...`, `fix(auth): ...`.
- Cách sửa từng loại nội dung:
  - Lộ trình: sửa `scripts/roadmap-specs.ts`, chạy `npm run generate:roadmap`, rồi commit cả file JSON lẫn file Markdown sinh ra.
  - Database: tạo file migration mới trong `supabase/migrations/` (không sửa file đã chạy) và viết test trong `supabase/tests/`.

## CI/CD

| Workflow         | Khi nào chạy                                                              | Việc                                                                             |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ci.yml`         | Mỗi PR, và mỗi lần push lên nhánh khác `main`                             | lint, format, typecheck, test kèm coverage, validate content, build              |
| `deploy.yml`     | Push lên `main`, hoặc chạy tay                                            | Chạy lại các bước kiểm tra, build với secret Supabase, deploy lên GitHub Pages   |
| `db-migrate.yml` | Push lên `main` có thay đổi trong `supabase/migrations/**`, hoặc chạy tay | Chạy `supabase db push` (dry-run trước, rồi push) trong environment `production` |

Dependabot cập nhật dependency npm và GitHub Actions mỗi tuần.

## Cấu trúc thư mục

```
content/            nội dung tĩnh: bài test, lộ trình 12 tuần, flashcard (JSON)
courses/on-tap-11/  pipeline dựng ngân hàng câu hỏi (câu hỏi không nằm trong repo)
docs/               thiết kế, bảng tổng quan lộ trình
scripts/            sinh lộ trình, kiểm tra nội dung, import Ôn tập 11
src/                ứng dụng React (lib/ chứa logic thuần, có test)
supabase/           migrations và test database
```
