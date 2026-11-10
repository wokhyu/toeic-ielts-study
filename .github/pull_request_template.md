## Thay đổi gì

<!-- Mô tả ngắn: làm gì và vì sao. -->

## Loại thay đổi

- [ ] feat: tính năng mới
- [ ] fix: sửa lỗi
- [ ] content: nội dung lộ trình / bài test / flashcard
- [ ] db: migration Supabase
- [ ] ci / docs / chore

## Kiểm tra

- [ ] `npm run lint && npm run typecheck && npm test && npm run validate:content && npm run build` chạy xanh ở máy
- [ ] Đã thử trên trình duyệt ở chiều rộng điện thoại (375px) và desktop
- [ ] Migration mới là file mới (không sửa file đã chạy), bảng mới đã bật RLS, có test trong `supabase/tests/`
- [ ] Không có key, email, mật khẩu hay câu hỏi Ôn tập 11 trong diff
