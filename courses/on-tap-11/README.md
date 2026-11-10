# Khóa học: Ôn tập Toán · Lý · Hóa 11

Ngân hàng câu hỏi lớp 11, chuyển từ app `on-tap-11` cũ (Next.js + SQLite, commit gốc `672f946`) sang website này.

Câu hỏi, đáp án và lời giải **không** nằm trong repo. Chúng nằm trong Supabase (bảng `ot_*`), chỉ người được admin duyệt vào khóa mới đọc được câu hỏi. Đáp án và lời giải nằm ở bảng `ot_question_keys`, người học không đọc trực tiếp được; họ chỉ thấy đáp án sau khi trả lời câu luyện tập hoặc sau khi nộp bài thi thử.

## Có gì trong thư mục này

```
de-on/INDEX.md       danh mục file đề gốc theo mã bài (file Word/PDF không commit)
de-on/manifest.json  nguồn tải của từng file
pipeline/            Python: Word -> HTML -> JSON -> SQLite (build/quiz.db, build/media)
```

## Dựng lại dữ liệu từ file Word

Cần Windows + Microsoft Word (công thức trong đề là MS Equation 3.0, chỉ Word mới kết xuất được). Đặt các file đề vào `de-on/toan`, `de-on/ly`, `de-on/hoa` theo `INDEX.md`.

```bash
cd courses/on-tap-11
pip install -r pipeline/requirements.txt
python pipeline/01_word_to_html.py     # Word -> build/html (~25 phút)
python pipeline/02_parse_html.py       # HTML -> build/questions/*.json + build/media
python pipeline/03_import_db.py --reset  # JSON -> build/quiz.db
```

Đọc `build/report.md` sau mỗi lần chạy để xem file nào không parse được hoặc thiếu đáp án. Cách parser tìm đáp án và cách gán chủ đề (`pipeline/taxonomy.yaml`) giữ nguyên như app cũ.

## Đưa dữ liệu lên Supabase

Chạy trên máy của bạn, với service role key lấy ở Supabase Dashboard → Project Settings → API. Key này bỏ qua RLS: KHÔNG commit, KHÔNG đặt vào biến `VITE_*`.

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
OT11_SQLITE_PATH=courses/on-tap-11/build/quiz.db \
OT11_MEDIA_DIR=courses/on-tap-11/build/media \
npx tsx scripts/import-on-tap-11.ts
```

Chạy lại bao nhiêu lần cũng được: các dòng được upsert theo id, ảnh đã có thì bỏ qua. `--skip-media` chỉ đẩy câu hỏi, `--only-media` chỉ đẩy ảnh. Khi chưa có thư mục `build/media`, đặt `OT11_MEDIA_BASE` là địa chỉ web cũ để tải ảnh qua `/media/...`.

## Chấm điểm

Giữ nguyên quy tắc của app cũ, viết lại thành hàm Postgres `ot_grade` (`supabase/migrations/20261111000002_on_tap_11.sql`), có test ở `supabase/tests/on-tap-11.test.ts`:

- Trắc nghiệm: đúng 1 điểm
- Đúng/Sai 4 ý: 1 ý đúng 0,1 · 2 ý 0,25 · 3 ý 0,5 · 4 ý 1,0
- Trả lời ngắn: so khớp số, chấp nhận dấu phẩy thập phân và phân số
- Tự luận: không chấm tự động

Câu chưa có đáp án mang trạng thái `needs_review` và không xuất hiện với người học. Admin gán đáp án ở trang Quản trị → Duyệt đáp án.
