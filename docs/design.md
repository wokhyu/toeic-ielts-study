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
- **Luyện đề TOEIC/IELTS** (`/c/:program/luyen/...`): cùng bộ trang với Ôn tập 11, thêm luyện theo tag (`the/:tag`), đề thi thử có quy đổi điểm, bài nghe phát bằng giọng nam/nữ khác nhau và chỉ nghe 1 lần khi thi.
- **Ôn tập 11** (`/c/on-tap-11/...`): cây chủ đề kèm tiến độ, luyện tập theo chủ đề, thi thử (chọn chủ đề, số câu, thời gian, dạng câu), kết quả và xem lại bài, ôn lại câu sai.
- **Admin** (`/admin`): yêu cầu đang chờ duyệt, danh sách người dùng; `/admin/nguoi-dung/:id`: quyền, trạng thái từng khóa, tiến độ chi tiết; `/admin/duyet-dap-an`: gán đáp án cho câu Ôn tập 11 còn thiếu.

## 4b. Giao diện

- Phong cách "ấm áp, có minh họa": nền kem, màu chính teal, màu nhấn coral, font Lexend (Google Fonts, có tiếng Việt).
- Màu chỉ dùng qua token theo vai trò trong `src/index.css` (`canvas`, `surface`, `ink`, `brand`, `accent`, `ok`, `warn`, `bad`, `series-1…5`), không gọi thẳng bậc màu của Tailwind. Chế độ tối là một khối ghi đè token dưới `[data-theme='dark']`.
- Chế độ tối: mặc định theo cài đặt máy, nút mặt trời/mặt trăng trên header lưu lựa chọn vào localStorage (`src/lib/theme.ts`; script trong `index.html` áp dụng trước khi React chạy để không nháy).
- Mascot "Bé Cú" (`src/components/art/Mascot.tsx`) và hình minh họa từng khóa (`CourseArt.tsx`) là SVG tự vẽ, tô bằng token nên tự đổi theo sáng/tối. Icon trong `src/components/icons.tsx` cũng tự vẽ.
- Component dùng chung trong `src/components/ui.tsx`: Button, Card (`plain`/`soft`/`hero`), Badge, Chip, StatTile, ProgressBar, ProgressRing, EmptyState, Skeleton, InfoHint (giải thích thuật ngữ), Spinner có mascot.
- Hiệu ứng: đúng thì có confetti và mascot cổ vũ, sai thì thẻ rung nhẹ và phần giải thích được làm nổi, tích nhiệm vụ có confetti, flashcard lật 3D. Tất cả tắt khi máy bật "giảm chuyển động".
- Độ chính xác luôn đi kèm số câu và khoảng tin cậy Wilson 95%; dưới 5 câu thì ghi "chưa đủ dữ liệu" thay vì vẽ. "Cần luyện thêm" chỉ xét chủ điểm có từ 5 câu, đúng dưới 80%, xếp theo đầu trên của khoảng tin cậy. Heatmap dùng một dải teal 4 bậc đã kiểm tra độ tương phản.
- Biểu đồ: dải màu `series-1…5` theo thứ tự cố định, đã kiểm tra phân biệt được với người mù màu ở cả nền sáng lẫn tối; nét 2px, lưới mảnh, luôn có chú giải và bảng số liệu đi kèm.
- Trạng thái (đúng/sai/cảnh báo) luôn có icon hoặc chữ đi kèm, không chỉ dựa vào màu.

## 5. Phân quyền và database

Chi tiết trong `supabase/migrations/`.

- `courses`: toeic, ielts, on-tap-11 (`kind` roadmap hoặc question_bank).
- `profiles`: tên hiển thị, `role` learner hoặc admin. Người dùng chỉ sửa được `display_name`.
- `enrollments`: (user, course) với trạng thái pending / approved / rejected / revoked, nhánh, ngày bắt đầu. Người học chỉ tự gửi yêu cầu (`request_enrollment`) và chỉnh nhánh/ngày bắt đầu của mình; duyệt chỉ qua `admin_set_enrollment`.
- `task_progress`, `placement_results`, `mock_scores`, `flashcard_reviews`: dữ liệu của từng người, gắn với khóa.
- `roadmap_tasks`: lộ trình dạng bảng tham chiếu (tuần, ngày, kỹ năng, nhánh, số phút), nạp từ `content/roadmap/**` bởi `bank-sync`. `task_progress.task_id` tham chiếu bảng này; nếu người học tích một nhiệm vụ trước khi sync kịp chạy, trigger tự thêm dòng tạm.
- `mock_scores.source`: `self` (người học tự nhập, tự xóa được) hoặc `mock_test` (web chấm, gắn `attempt_id`, người học không sửa được).
- `ot_*`: engine ngân hàng câu hỏi dùng chung cho mọi khóa (prefix giữ từ Ôn tập 11, đọc là "question bank"). Mỗi dòng thuộc một khóa (`course_id`); người học chỉ thấy câu của khóa mình đã được duyệt. Đáp án và giải thích nằm ở `ot_question_keys`, chỉ admin đọc trực tiếp. Người học chấm bài, xem lời giải, thi thử qua các hàm `security definer` (`ot_answer_practice`, `ot_tag_question_ids`, `ot_start_exam`, `ot_start_mock`, `ot_submit_exam`, ...). Trong lúc có bài thi đang mở, không xem được đáp án bằng chế độ luyện tập.
- `ot_stimuli`: đoạn văn hoặc script bài nghe dùng chung cho nhiều câu (TOEIC Part 3/4/6/7, IELTS). `ot_questions.tags` dùng để luyện theo chủ điểm.
- Thi thử: câu thuộc `pool = 'mock'` không xuất hiện khi luyện tập và chỉ hiện với người đang làm hoặc đã làm đề đó. `ot_mock_tests.sections` chứa bảng quy đổi điểm (ước lượng); khi nộp bài, điểm quy đổi tự ghi vào `mock_scores`. Script nghe vẫn đọc được trong lúc thi (trình duyệt cần nó để đọc), nên đây là chống gian lận ở mức nhóm tự học, không phải phòng thi.
- Nhật ký học tập: `ot_responses` ghi mỗi lần trả lời (luyện tập, ôn lại, thi, thi thử) gồm câu trả lời, đúng/sai, điểm và thời gian làm. Đây là nguồn cho trang Tiến bộ và phân tích của admin; `ot_question_stats` chỉ là bảng tóm tắt, kèm lịch ôn câu sai (`next_due`: sau 1 ngày, rồi 3 và 7 ngày; đúng 3 lần liền thì ra khỏi danh sách ôn). `flashcard_review_log` ghi mỗi lần ôn thẻ. View `learner_activity` gộp tất cả theo ngày giờ Việt Nam. Không ai ghi trực tiếp vào các bảng này: chỉ các hàm và trigger ghi.
- Tiến bộ của học viên: `learner_progress(course, user)` trả về một JSON cho tab Tiến bộ (lịch học 140 ngày, độ chính xác theo Part và theo chủ điểm trong 30 ngày và từ trước tới nay, thời gian trung vị mỗi câu, số câu sai đến hạn ôn, điểm thi thử, huy hiệu). Học viên chỉ xem của mình; admin truyền `user` để xem người khác. `learner_streak` tính chuỗi ngày từ mọi hoạt động (câu hỏi, nhiệm vụ, flashcard) theo giờ Việt Nam; bảng xếp hạng dùng chung cách tính này.
- Huy hiệu: `learner_achievements(course)` kiểm tra điều kiện, ghi huy hiệu mới vào `achievements` và báo huy hiệu nào vừa đạt. Tên và mô tả nằm ở `src/content/badges.ts`; test kiểm tra hai danh sách id khớp nhau.
- Sổ câu sai: `ot_due_review_ids(course)` lấy các câu đến hạn ôn (`next_due` ≤ hôm nay), làm lại ở chế độ `review`; `ot_dismiss_review(question)` là nút "Đã hiểu".
- Phân tích cho admin (không tính tài khoản admin để việc thử web không làm lệch số liệu):
  - `admin_overview(course, from, to)`: học viên hoạt động 7/30 ngày, số câu và độ chính xác, nhiệm vụ, lượt ôn thẻ, thời gian học ước tính, hoạt động theo ngày, phễu (gửi yêu cầu → được duyệt → bắt đầu học → học trong 7 ngày), phân bố nhánh.
  - `admin_learners(course)`: mỗi học viên một dòng với hoạt động 14 ngày, số câu và độ chính xác 30 ngày, tiến độ lộ trình theo nhánh, điểm thi thử gần nhất, chủ điểm yếu nhất.
  - `admin_item_analysis(course, min)`: thống kê từng câu trên lần trả lời đầu tiên của mỗi học viên: độ khó p, độ phân biệt (tương quan điểm-nhị phân đã hiệu chỉnh), thời gian trung vị, số người chọn từng phương án. Gắn cờ quá dễ (p > 0,9), quá khó (p < 0,2), phân biệt âm, phương án nhiễu không ai chọn, chỉ khi có từ `min` người làm.
  - Trang Quản trị có các tab Tổng quan, Học viên, Chất lượng câu hỏi, Tài khoản & duyệt, Đáp án Ôn tập 11; trang từng học viên dùng lại tab Tiến bộ, thêm lưới tuần × kỹ năng và 40 lần trả lời gần nhất. Mọi bảng xuất được CSV (UTF-8 có BOM, số thập phân theo ngôn ngữ máy).
- `admin_audit_log`: thao tác của admin (duyệt khóa, đổi quyền, sửa đáp án). `achievements`: huy hiệu.
- Chuẩn database được kiểm tra trong CI (`supabase/tests/standards.test.ts`): mọi foreign key có index, policy RLS gọi `auth.uid()` và `is_admin()` qua `(select …)`, mọi bảng bật RLS và có comment, hàm `security definer` cố định `search_path`, và API chỉ gọi được đúng danh sách hàm cho phép.
- Nhập nội dung: `ot_bank_upsert_taxonomy`, `ot_bank_upsert_set`, `ot_bank_upsert_mock` chỉ gọi được bằng service role và upsert theo `ext_id`, nên chạy lại bao nhiêu lần cũng được.
- Hàm admin: `admin_list_users`, `admin_set_enrollment`, `admin_set_role` (không tự hạ quyền chính mình), `ot_admin_set_key`.
- `get_leaderboard(course)`: số nhiệm vụ đã xong, số ngày có học và streak (theo giờ Việt Nam) của những người cùng khóa.

Nội dung TOEIC/IELTS là file JSON tĩnh bundle cùng frontend; database lưu id thẻ, còn nhiệm vụ lộ trình có bản sao ở `roadmap_tasks` để phân tích. Câu hỏi Ôn tập 11 KHÔNG nằm trong repo: chúng được nạp vào Supabase bằng `scripts/import-on-tap-11.ts`.

## 6. Giới hạn của gói miễn phí

- **Supabase Free:** project bị tạm dừng sau khoảng 1 tuần không có truy cập; vào dashboard bấm khôi phục là chạy lại. Giới hạn cụ thể về dung lượng DB, Storage và số email Auth mỗi giờ thay đổi theo thời gian `[không chắc về con số hiện tại]`; xem trang Pricing của Supabase. Email xác nhận mặc định bị giới hạn tần suất; nhóm lớn nên cấu hình SMTP riêng.
- **GitHub Pages:** chỉ host trang tĩnh; có giới hạn băng thông mềm hằng tháng, nhóm nhỏ không chạm tới.
- **Web Speech API:** chất lượng và giọng đọc phụ thuộc trình duyệt và hệ điều hành; Chrome và Edge có nhiều giọng nhất.
- **Rủi ro:** anon key của Supabase lộ trong bundle là bình thường, vì quyền truy cập được chặn bằng RLS. Mọi bảng mới PHẢI bật RLS trước khi dùng. Service role key chỉ dùng trên máy cá nhân khi import, không bao giờ đưa vào repo hay biến `VITE_*`.
