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
- Bảng xếp hạng xếp theo streak và % hoàn thành giống Duolingo, nhưng chỉ so sánh giữa những người cùng khóa, tách riêng TOEIC và IELTS.

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

1. Mở web, xem danh sách khóa học (TOEIC, IELTS, Ôn tập 11). Có thể xem trước lộ trình và làm thử bài test mà không cần tài khoản.
2. Đăng ký bằng email + mật khẩu và tên hiển thị, xác nhận email.
3. Bấm "Đăng ký khóa này". Yêu cầu ở trạng thái chờ duyệt cho tới khi admin duyệt.
4. Admin duyệt (có thể gán luôn nhánh A/B/C và ngày bắt đầu). Người học thấy nút "Vào học".
5. Khóa TOEIC/IELTS chưa có nhánh: nhập điểm thi thật hoặc làm bài test đầu vào (Listening đọc bằng TTS). Hệ thống xếp nhánh theo `scoring.json`, ngày bắt đầu là thứ Hai gần nhất.
6. Hằng ngày vào trang Hôm nay, tick nhiệm vụ đã làm; ôn flashcard; nhập điểm thi thử ở tuần 4, 8, 12.
7. Khóa Ôn tập 11: luyện từng chủ đề (chấm ngay, xem lời giải), thi thử có bấm giờ, ôn lại câu sai và câu đã đánh dấu.
8. Admin xem tiến độ từng người: % hoàn thành, streak, tiến độ theo tuần, kết quả test, điểm thi thử, flashcard, kết quả Ôn tập 11 theo môn.

## 4. Các trang

Đường dẫn dùng hash (`#/...`).

- **Khóa học** (`/khoa-hoc`): thẻ từng khóa, trạng thái đăng ký, nút vào học hoặc xem trước.
- **Đăng nhập / Đăng ký / Đổi mật khẩu** (`/dang-nhap`, `/dang-ky`, `/doi-mat-khau`).
- **TOEIC, IELTS** (`/c/toeic/...`, `/c/ielts/...`): Hôm nay, Lộ trình 12 tuần, Bài test, Flashcard, Điểm thi thử (biểu đồ + link đề chính thức), Xếp hạng trong khóa.
- **Xem trước** (`/xem-truoc/:program/...`): lộ trình và bài test, không lưu kết quả.
- **Ôn tập 11** (`/c/on-tap-11/...`): cây chủ đề kèm tiến độ, luyện tập theo chủ đề, thi thử (chọn chủ đề, số câu, thời gian, dạng câu), kết quả và xem lại bài, ôn lại câu sai.
- **Admin** (`/admin`): yêu cầu đang chờ duyệt, danh sách người dùng; `/admin/nguoi-dung/:id`: quyền, trạng thái từng khóa, tiến độ chi tiết; `/admin/duyet-dap-an`: gán đáp án cho câu Ôn tập 11 còn thiếu.

## 5. Phân quyền và database

Chi tiết trong `supabase/migrations/`.

- `courses`: toeic, ielts, on-tap-11 (`kind` roadmap hoặc question_bank).
- `profiles`: tên hiển thị, `role` learner hoặc admin. Người dùng chỉ sửa được `display_name`.
- `enrollments`: (user, course) với trạng thái pending / approved / rejected / revoked, nhánh, ngày bắt đầu. Người học chỉ tự gửi yêu cầu (`request_enrollment`) và chỉnh nhánh/ngày bắt đầu của mình; duyệt chỉ qua `admin_set_enrollment`.
- `task_progress`, `placement_results`, `mock_scores`, `flashcard_reviews`: dữ liệu của từng người, gắn với khóa.
- `ot_*`: ngân hàng câu hỏi Ôn tập 11. Đáp án và lời giải nằm ở `ot_question_keys`, chỉ admin đọc trực tiếp. Người học chấm bài, xem lời giải, thi thử qua các hàm `security definer` (`ot_answer_practice`, `ot_start_exam`, `ot_submit_exam`, ...). Trong lúc có bài thi đang mở, không xem được đáp án bằng chế độ luyện tập.
- Hàm admin: `admin_list_users`, `admin_set_enrollment`, `admin_set_role` (không tự hạ quyền chính mình), `ot_admin_set_key`.
- `get_leaderboard(course)`: số nhiệm vụ đã xong, số ngày có học và streak (theo giờ Việt Nam) của những người cùng khóa.

Nội dung TOEIC/IELTS là file JSON tĩnh bundle cùng frontend; database chỉ lưu id nhiệm vụ và id thẻ. Câu hỏi Ôn tập 11 KHÔNG nằm trong repo: chúng được nạp vào Supabase bằng `scripts/import-on-tap-11.ts`.

## 6. Giới hạn của gói miễn phí

- **Supabase Free:** project bị tạm dừng sau khoảng 1 tuần không có truy cập; vào dashboard bấm khôi phục là chạy lại. Giới hạn cụ thể về dung lượng DB, Storage và số email Auth mỗi giờ thay đổi theo thời gian `[không chắc về con số hiện tại]`; xem trang Pricing của Supabase. Email xác nhận mặc định bị giới hạn tần suất; nhóm lớn nên cấu hình SMTP riêng.
- **GitHub Pages:** chỉ host trang tĩnh; có giới hạn băng thông mềm hằng tháng, nhóm nhỏ không chạm tới.
- **Web Speech API:** chất lượng và giọng đọc phụ thuộc trình duyệt và hệ điều hành; Chrome và Edge có nhiều giọng nhất.
- **Rủi ro:** anon key của Supabase lộ trong bundle là bình thường, vì quyền truy cập được chặn bằng RLS. Mọi bảng mới PHẢI bật RLS trước khi dùng. Service role key chỉ dùng trên máy cá nhân khi import, không bao giờ đưa vào repo hay biến `VITE_*`.
