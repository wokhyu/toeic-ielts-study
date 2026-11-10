# Thiết kế website học nhóm TOEIC & IELTS

## 1. Tham khảo các website đang hoạt động

Thông tin kiểm tra ngày 10/11/2026 bằng cách đọc trực tiếp trang chủ hoặc tìm kiếm web. Chỉ học cách thiết kế tính năng, không sao chép giao diện hay nội dung.

| Website | Tính năng đáng học | Áp dụng cho tính năng | Mức độ chắc chắn |
|---|---|---|---|
| study4.com | Thư viện đề có ghi thời lượng, số part, số câu; flashcard có lặp lại ngắt quãng; theo dõi tiến độ theo ngày và theo dạng câu hỏi; lộ trình theo điểm mục tiêu | 3, 5, 6 | Cao (đọc trực tiếp trang chủ) |
| prepedu.com (prep.vn chuyển hướng về đây) | Bài test đầu vào miễn phí cho IELTS và TOEIC; lộ trình cá nhân hóa; theo dõi tiến độ | 2, 3 | Cao (đọc trực tiếp trang chủ) |
| takeielts.britishcouncil.org | Đề luyện miễn phí cho cả 4 kỹ năng, có đáp án; bài test làm quen mô phỏng màn hình thi máy | Nguồn đề thi thử IELTS cho tính năng 5 | Cao (kết quả tìm kiếm trên domain chính thức) |
| ets.org/toeic | Câu hỏi mẫu và sample test chính thức cho Listening & Reading; bản quyền thuộc ETS nên chỉ dẫn link, không chép lại | Nguồn đề thi thử TOEIC cho tính năng 5 | Cao (kết quả tìm kiếm trên domain chính thức) |
| ieltsliz.com | Bài học chia theo từng kỹ năng; danh sách chủ đề Speaking Part 1–3; 100 đề Writing Task 2 | Gợi ý chủ đề cho lộ trình IELTS (tính năng 3) | Cao (đọc trực tiếp trang chủ) |
| Anki | Lặp lại ngắt quãng: người học tự chấm mức nhớ, hệ thống tính ngày ôn kế tiếp (thuật toán gốc dựa trên SM-2) | 6 | Cao |
| Quizlet | Thẻ hai mặt, chế độ tự kiểm tra | 6 | Cao |
| Duolingo | Streak hằng ngày và bảng xếp hạng theo nhóm để tạo động lực thi đua | 4 | Cao |

Kết luận áp dụng:
- Bài test đầu vào chấm tự động ngay lập tức (giống Prep) và cho phép bỏ qua nếu đã có điểm thi thật.
- Không tự host đề thi thử full test. Trang Điểm thi thử dẫn link tới nguồn chính thức (ETS, British Council), người học tự nhập điểm vào web.
- Flashcard dùng 4 mức chấm Again / Hard / Good / Easy giống Anki.
- Bảng xếp hạng xếp theo streak và % hoàn thành giống Duolingo, nhưng chỉ so sánh trong nhóm, tách riêng TOEIC và IELTS.

## 2. Stack

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Frontend | Vite + React + TypeScript | Build nhanh, bundle tĩnh nên host được trên GitHub Pages. |
| Giao diện | Tailwind CSS | Không cần viết file CSS riêng, dễ làm responsive. |
| Router | React Router với HashRouter | GitHub Pages không hỗ trợ rewrite URL; dùng hash thì tải lại trang không bị 404. |
| Backend | Supabase (Postgres + Auth) | Gói miễn phí đủ cho nhóm nhỏ; schema là file SQL trong repo; RLS phân quyền tới từng dòng; tự host được khi cần mở rộng. |
| Biểu đồ | Recharts | Biểu đồ đường cho điểm thi thử, viết khai báo bằng JSX. |
| Audio Listening | Web Speech API (`speechSynthesis`) | Có sẵn trong trình duyệt, không tốn chi phí file audio. |
| Hosting + CI/CD | GitHub Pages + GitHub Actions | Miễn phí cho repo public, deploy tự động khi merge vào `main`. |

## 3. Luồng người dùng

1. Mở web, đăng nhập bằng magic link gửi qua email.
2. Lần đầu đăng nhập: nhập tên hiển thị và mã mời nhóm.
3. Chọn chương trình TOEIC hoặc IELTS.
4. Đã có điểm thi thật: nhập điểm, hệ thống xếp nhánh theo `scoring.json`. Chưa có: làm bài test đầu vào (khoảng 40 phút), Listening phát bằng TTS.
5. Xem kết quả: số câu đúng, nhánh A/B/C và điểm mục tiêu. Ngày bắt đầu lộ trình là thứ Hai gần nhất.
6. Vào trang Hôm nay, tick từng nhiệm vụ khi làm xong.
7. Ôn flashcard theo chủ đề của tuần.

## 4. Các trang

- **Đăng nhập** (`/login`): ô email, nút gửi magic link, dòng trạng thái đã gửi.
- **Onboarding** (`/onboarding`): bước 1 nhập tên và mã mời; bước 2 chọn chương trình; bước 3 nhập điểm thật hoặc chuyển sang làm bài test.
- **Bài test** (`/placement/:program`): từng câu kèm nút phát audio, thanh tiến độ; với IELTS có thêm bước tự chấm Writing/Speaking theo bảng 4 tiêu chí; cuối bài hiện kết quả và giải thích từng câu.
- **Hôm nay** (`/today`): tuần, ngày, tổng phút; danh sách nhiệm vụ có checkbox; đánh dấu nhiệm vụ nhóm; trọng tâm tuần.
- **Lộ trình** (`/roadmap`): 12 tuần dạng accordion, % hoàn thành từng tuần, lọc theo nhánh.
- **Nhóm** (`/group`): bảng xếp hạng theo chương trình (streak, % hoàn thành, số nhiệm vụ đã xong), mã mời để chia sẻ.
- **Điểm thi thử** (`/scores`): form nhập điểm theo kỹ năng, biểu đồ đường qua các lần thi, link tới đề chính thức.
- **Flashcard** (`/flashcards`): chọn tuần, lật thẻ, 4 nút chấm, số thẻ đến hạn hôm nay.

## 5. Schema database

Chi tiết trong `supabase/migrations/0001_init.sql`.

- `groups` (id uuid PK, name text, invite_code text unique, created_at)
- `profiles` (id uuid PK → auth.users, display_name text, group_id → groups, program text, track text, start_date date, created_at)
- `task_progress` (user_id → profiles, task_id text, program text, completed_at timestamptz; PK là cặp user_id + task_id)
- `placement_results` (id, user_id, program, answers jsonb, correct_count int, track text, taken_at)
- `mock_scores` (id, user_id, program, week int, listening, reading, writing, speaking, total numeric, taken_at)
- `flashcard_reviews` (user_id, card_id text, ease numeric, interval_days int, reps int, due_date date; PK là cặp user_id + card_id)
- RPC `join_group(code)`: gắn người dùng vào nhóm có mã mời tương ứng.
- RPC `get_leaderboard(program)`: trả về tên hiển thị, số nhiệm vụ đã xong, số ngày có học và streak của các thành viên cùng nhóm.

Nội dung học (đề, lộ trình, từ vựng) là file JSON tĩnh bundle cùng frontend. Database chỉ lưu id nhiệm vụ và id thẻ, nên cập nhật nội dung không cần migrate dữ liệu.

## 6. Giới hạn của gói miễn phí

- **Supabase Free:** project bị tạm dừng sau khoảng 1 tuần không có truy cập; vào dashboard bấm khôi phục là chạy lại. Giới hạn cụ thể về dung lượng DB và số email Auth mỗi giờ thay đổi theo thời gian `[không chắc về con số hiện tại]`; xem trang Pricing của Supabase. Email magic link mặc định bị giới hạn tần suất; nhóm lớn nên cấu hình SMTP riêng.
- **GitHub Pages:** chỉ host trang tĩnh, repo public; có giới hạn băng thông mềm hằng tháng, nhóm nhỏ không chạm tới.
- **Web Speech API:** chất lượng và giọng đọc phụ thuộc trình duyệt và hệ điều hành; Chrome và Edge có nhiều giọng nhất.
- **Rủi ro:** anon key của Supabase lộ trong bundle là bình thường, vì quyền truy cập được chặn bằng RLS. Mọi bảng mới PHẢI bật RLS trước khi dùng.
