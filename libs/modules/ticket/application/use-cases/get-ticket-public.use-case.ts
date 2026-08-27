import { Inject, Injectable } from '@nestjs/common';
import { ITicketRepository, TICKET_REPOSITORY } from '../ports/repository.ports';
import { TicketNotFoundException } from '../../domain/exceptions/ticket.exception';
import { TicketPublicResponseDto } from '../dto/ticket.dto';

/**
 * 🎯 Use Case — Public, dùng cho Web Chat Widget (TDD Mục 5.3,
 * WebChannelAdapter). Khách hàng tạo ticket qua `POST /tickets` (Public)
 * không có JWT, nên KHÔNG thể gọi `GET /tickets/:id` (yêu cầu Bearer
 * AGENT/ADMIN) để xem câu trả lời — use case này lấp khoảng trống đó,
 * chỉ trả field an toàn (status + messages), không lộ dữ liệu nội bộ.
 *
 * Bảo mật dựa trên `id` là UUID không đoán được — không phải xác thực
 * thật, đủ dùng cho phạm vi Assessment. Giới hạn đã biết, ghi vào Nhật
 * ký quyết định (TDD Mục 17): ai có link (ticketId) đều xem được hội
 * thoại của ticket đó.
 */
@Injectable()
export class GetTicketPublicUseCase {
  constructor(@Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository) {}

  async execute(ticketId: string): Promise<TicketPublicResponseDto> {
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new TicketNotFoundException(ticketId);
    }
    const messages = await this.ticketRepository.findMessages(ticketId);
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }
}
