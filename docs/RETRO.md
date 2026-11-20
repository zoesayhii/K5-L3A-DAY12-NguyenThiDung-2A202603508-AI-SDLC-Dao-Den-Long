# Retro (Phase 1–4)

Làm cùng Claude Code (agent), cá nhân, 4 phase trong buổi lab. Retro này do agent soạn từ lịch sử làm việc; tác giả cần đọc lại và bổ sung phần số token.

## Evaluation theo phase
| Phase | Đạt | Chưa đạt / hạn chế | AI sai ở đâu |
|---|---|---|---|
| 1 PRD-0 | Lõi tất định + headless + 38 kiểm tra; bản Three.js | Chưa tự chơi thử; tham số tự chọn (sau bị thay) | Hai kiểm tra viết quá lỏng (luôn đúng), phát hiện sau khi đọc lại kết quả |
| 2 Ba hòn đảo | Viết lại lõi theo số chuẩn, 145 kiểm tra, UI đủ màn | UI không có test tự động; vài giả định (điểm xuất phát Đêm 3, `spawning` 1 tick) | `|| true` trong hai kiểm tra; recoil Bóng Mực thiếu 1 tick; một test "thua nhưng vừa thắng" không thể xảy ra theo luật |
| 3 Đèn cạn dầu | Mô hình nhiên liệu số nguyên 1/60, luật thắng mới, ADR + changelog, 177 kiểm tra | Giả định về tốc độ `wander`, `fuel_drain` | Toàn bộ test mới đạt ngay lần đầu: đáng ngờ, nên soát lại các giá trị cụ thể |
| 4 Phát hành | Soak, bench, bảng xếp hạng, trợ năng, tài liệu | Video, đo trên máy chấm, test UI | Bộ nhớ soak ban đầu fail (49→89 MB do JIT): xử lý bằng làm nóng có ghi minh bạch, không cắt ngưỡng |

## Điều gì hiệu quả
- **Headless trước, đồ họa sau.** Lõi tách khỏi Three.js nên mọi luật kiểm chứng được bằng JSONL; 197 kiểm tra chạy dưới vài chục giây và bắt được lỗi thật.
- **Ghi tiêu chí và giả định trước khi code**, rồi viết scenario nhỏ cho từng tính năng.
- **Khi yêu cầu đổi** (Phase 3): ADR + changelog + sửa test cũ có nhãn lý do, không tắt âm thầm.
- **Cảnh cố định (`?demo=...`)** để chụp ảnh kiểm tra giao diện mà không cần chơi tay.

## Điều gì không hiệu quả
- Không có cách tự động thao tác giao diện: nhiều mục UI chỉ dừng ở "có ảnh". Nên đưa một bộ test trình duyệt (Playwright) vào sớm hơn.
- Test mới đạt 100% ngay lần chạy đầu không đủ để tin; phải tự soát độ chặt.
- Bắt đầu Phase 4 với nhiều việc song song nên video/Release bị đẩy về cuối.

## Những lần AI sai và cách phát hiện
1. Kiểm tra vô hiệu (`|| true`) → phát hiện khi đọc lại mã test sau khi tất cả đều PASS.
2. Recoil thiếu 1 tick → test đo quãng đường 2 m fail.
3. Test "thắng và hết Ngọn Lửa cùng tick" bất khả thi (Bóng Mực sát đèn vừa sáng luôn bị đẩy ra, không gây sát thương) → fail, hiểu lại luật, bỏ test.
4. Đổi tốc độ Bóng Mực trong lõi theo yêu cầu người dùng → sai số chuẩn của Ticket; đã nêu rủi ro, người dùng chọn đổi, sau đó yêu cầu hoàn tác theo đề; `git revert`.
5. Test hiện trạng bộ nhớ soak fail ở lần chạy đầu → đo từng Đêm, thấy tăng rồi ngang (không rò rỉ), xử lý bằng làm nóng.
6. Lệnh `pkill` làm chết chính shell của agent (khớp nhầm chuỗi) → dùng PID cụ thể.

## Harness nào giúp nhiều nhất
- `AGENTS.md` ngắn: ép "lõi `sim/` không import đồ họa, không `Math.random`, số chuẩn chỉ từ contract", và quy tắc khi yêu cầu thay luật.
- `scripts/verify.sh` + log trong `evidence/phase-N/` làm bằng chứng lặp lại được. Chưa dùng hook hay skill riêng.

## Token và chi phí
**Chưa có số liệu chính xác:** agent không có số token thực tế của phiên. Tác giả cần điền từ `/cost` hoặc trang usage: ______.
Cách tiết kiệm đã dùng: ngữ cảnh gọn (AGENTS.md vài chục dòng), kiểm chứng headless thay vì chạy lại giao diện, chụp ảnh cảnh cố định thay vì quay nhiều lần, không dùng subagent, đọc từng đoạn file thay vì cả repo.

## Nếu làm lại
- Đưa Playwright (hoặc tương đương) vào từ Phase 2 để có test UI.
- Hỏi trợ giảng 2 câu giả định (tham số mặc định, vị trí `score`) ngay từ Phase 1.
- Quay video demo song song ở cuối mỗi phase thay vì dồn cuối.
- Viết test theo bảng yêu cầu trước (tiêu chí nghiệm thu) rồi mới code lõi.
