import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { ITicketRepository, TICKET_REPOSITORY } from '../ports/repository.ports';
import { TicketMessage } from '../../domain/entities/ticket-message.entity';
import { MessageSender } from '../../domain/value-objects/message-sender.vo';
import { TicketStatus } from '../../domain/value-objects/ticket-status.vo';
import { TicketStateMachineService } from '../../domain/services/ticket-state-machine.service';
import { TicketNotFoundException } from '../../domain/exceptions/ticket.exception';
import { TicketMessageResponseDto } from '../dto/ticket.dto';
import { AppendTurnUseCase, TurnRole } from '@app/modules/conversation';
import { AI_PIPELINE_TRIGGER, IAiPipelineTrigger } from '../ports/ai-pipeline-trigger.port';

/**
 * 🎯 Use Case — Public, khách hàng gửi thêm tin nhắn vào ticket đã tạo
 * (không cần login — TDD Mục 5.2/5.3). Nếu ticket đang WAITING_CUSTOMER
 * (thiếu thông tin), tự động quay lại CLASSIFIED để re-trigger AI
 * pipeline (TDD Mục 9 — bảng transition).
 *
 * FIX: trước đây use case này KHÔNG gọi lại AI pipeline sau khi khách
 * bổ sung tin nhắn — khách gửi thêm thông tin (vd mã đơn hàng còn
 * thiếu) hoặc chỉ nhắn thêm 1 câu bất kỳ sẽ không bao giờ nhận được
 * phản hồi mới, ticket kẹt mãi ở trạng thái cũ. Giờ gọi `IAiPipelineTrigger`
 * (cùng port `CreateTicketUseCase` dùng, TDD Mục 2.2 — Dependency
 * Inversion, tránh circular dependency với AiModule) SAU khi lưu tin
 * nhắn, bất kể trạng thái hiện tại của ticket (trừ CLOSED — spam/đã
 * đóng thì không xử lý lại). `ProcessIncomingMessageUseCase` luôn đọc
 * tin nhắn CUSTOMER mới nhất nên sẽ tự chạy lại toàn bộ pipeline trên
 * nội dung vừa gửi.
 */
@Injectable()
export class AddCustomerMessageUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository,
    private readonly stateMachine: TicketStateMachineService,
    private readonly eventEmitter: EventEmitter2,
    private readonly appendTurn: AppendTurnUseCase,
    @Optional()
    @Inject(AI_PIPELINE_TRIGGER)
    private readonly aiPipelineTrigger?: IAiPipelineTrigger,
  ) {}

  async execute(ticketId: string, content: string): Promise<TicketMessageResponseDto> {
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new TicketNotFoundException(ticketId);
    }

    const message = TicketMessage.create({
      id: uuid(),
      ticketId,
      sender: MessageSender.CUSTOMER,
      content,
    });
    await this.ticketRepository.saveMessage(message);

    await this.appendTurn.execute(ticketId, TurnRole.USER, content);

    if (ticket.status === TicketStatus.WAITING_CUSTOMER) {
      this.stateMachine.transition(ticket, TicketStatus.CLASSIFIED, 'system:customer_reply');
      await this.ticketRepository.save(ticket);

      for (const event of ticket.domainEvents) {
        this.eventEmitter.emit(event.eventName, event);
      }
      ticket.clearDomainEvents();
    }

    // Re-chạy AI pipeline cho MỌI tin nhắn bổ sung của khách, trừ khi
    // ticket đã CLOSED (spam đã đóng — không xử lý lại). Ticket đang
    // ANSWERED/ESCALATED/IN_PROGRESS/RESOLVED vẫn re-trigger được vì đây
    // là câu hỏi tiếp theo trong cùng hội thoại, không phải chỉ dành
    // riêng cho case "thiếu thông tin".
    if (this.aiPipelineTrigger && ticket.status !== TicketStatus.CLOSED) {
      try {
        await this.aiPipelineTrigger.process(ticketId);
      } catch {
        // Lỗi AI pipeline không được làm fail request gửi tin nhắn —
        // tin nhắn của khách vẫn được lưu, Agent có thể xử lý thủ công.
      }
    }

    return {
      id: message.id,
      ticketId: message.ticketId,
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt,
    };
  }
}
