# ADR-0003: Đèn có nhiên liệu và luật thắng "giữ sáng tới bình minh"

Trạng thái: chấp nhận (Phase 3, Ticket-03, contract v1.2). Ngày: 2026-11-20.

## Bối cảnh
Ticket-02 có mô hình đèn nhị phân (tắt/sáng, sáng thì mãi sáng) và thắng ngay khi tất cả đèn sáng. Playtest cho thấy người giỏi xong sớm, thiếu căng thẳng cuối Đêm. Ticket-03 thay bằng: đèn hao dầu, có thể tắt và thắp lại, thắng khi còn sống tới bình minh với đủ tỉ lệ đèn sáng.

## Quyết định
1. **Trạng thái đèn** mở rộng từ `{lit, deposited}` thành `{lit, deposited, fuel, ever_lit, relit_count}`.
   - `fuel` lưu bằng **số nguyên đơn vị 1/60** (100 fuel = 6000). Hao 1 đơn vị/tick, bị hút 5 đơn vị/tick/Bóng Mực. Chỉ làm tròn 1 chữ số thập phân khi xuất snapshot/event. Lý do: Ticket yêu cầu tránh sai số số thực, và so sánh `fuel < 30` / `fuel == 30` phải chính xác.
   - `deposited` chỉ còn là tiến độ thắp khi đèn đang tắt (về 0 khi đèn tắt, theo Ticket).
2. **Tương tác với đèn** thành một luật hai nhánh trên cùng phím: đèn tắt thì nạp để thắp (10 lần đầu, 5 khi `ever_lit`), đèn sáng chưa đầy thì châm dầu. Đèn đầy dầu không được chọn. Chọn gần nhất rồi `id` nhỏ.
3. **Vùng an toàn** không còn gắn với `lit` mà với `lit && fuel >= 30`. Cờ `zone` của đèn đổi chiều sang "có" (thắp hoặc châm dầu lên ≥ 30) thì Bóng Mực đang trong 6 m bị đẩy ra tối đa 30 tick và không gây sát thương, dùng lại cơ chế `evict` của Ticket-02.
4. **Bóng Mực** thêm trạng thái `drain` và chọn mục tiêu ở `wander`: đèn sáng yếu gần nhất, không có thì đèn tắt gần nhất. Vì Ticket nói "như trước" mà bản trước tôi làm wander ngẫu nhiên, tôi coi mục tiêu đèn tắt là luật chung của `wander`; chỉ khi không còn đèn tắt hay yếu mới đi ngẫu nhiên. Tốc độ wander khi có mục tiêu = `shade_speed`.
5. **Thắng/thua** chỉ xét ở cuối tick: hết Ngọn Lửa (`no_flames`) luôn thắng thế, rồi hết giờ thì so số đèn sáng với `ceil(0.6 × tổng)` (`dawn_survived` / `dawn`). `all_lit` không còn dùng. Điểm bình minh: mỗi đèn sáng `50 + floor(fuel)`, mỗi Ngọn Lửa `+50`. Thưởng thời gian bỏ (`per_second_left = 0`).
6. **Sức chứa** `min(20, 10 + 2 × successful_lights)`, đếm trong lõi, đặt lại mỗi Đêm vì mỗi Đêm tạo lại mô phỏng.

## Hệ quả
- Test cũ phụ thuộc thắng sớm, công thức điểm, thời gian Đêm bị cập nhật (xem `CHANGELOG.md`).
- Đèn vừa thắp bị hao dầu ngay trong tick đầu, nên `fuel` đầy đúng 100 chỉ xuất hiện ở snapshot ngay sau khi thắp/châm.
- Một Đêm headless vẫn rất nhanh (< 1 giây).

## Giả định cần xác nhận
- `wander` hướng tới đèn tắt dùng `shade_speed`; random wander (không còn đèn tắt/yếu) dùng 2 m/s.
- `fuel_drain` phát ở tick thứ 60, 120, … tính từ tick đầu tiên Bóng Mực thật sự hút (không tính tick chuyển sang `drain`).
- `drain -> chase` khi Mây trong 6 m **của Bóng Mực** (XZ). `drain -> wander` được xét trước `wander -> chase` trong cùng tick.
