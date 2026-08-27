import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { Ticket } from '../../domain/entities/ticket.entity';
import { TicketMessage } from '../../domain/entities/ticket-message.entity';
import { MessageSender } from '../../domain/value-objects/message-sender.vo';
import { Channel } from '../../domain/value-objects/channel.vo';
import { ITicketRepository, TICKET_REPOSITORY } from '../ports/repository.ports';
import { CreateTicketCommand } from '../ports/channel-adapter.port';
import { FindOrCreateCustomerUseCase } from '@app/modules/customer';
import { TicketResponseDto } from '../dto/ticket.dto';
import { AppendTurnUseCase, TurnRole } from '@app/modules/conversation';
import { AI_PIPELINE_TRIGGER, IAiPipelineTrigger } from '../ports/ai-pipeline-trigger.port';

/**
 * 🎯 Use Case — điểm hội tụ của mọi Channel Adapter (TDD Mục 5.3).
 *
 * Ngày 4: sau khi tạo ticket + ghi message đầu tiên, tự động gọi AI
 * pipeline qua port `IAiPipelineTrigger` (KHÔNG import trực tiếp
 * `AiModule`/`ProcessIncomingMessageUseCase` — làm vậy sẽ tạo circular
 * dependency vì AiModule đã import TicketModule). `@Optional()` vì
 * TicketModule tự đứng độc lập được (test unit, hoặc trường hợp AiModule
 * chưa được đăng ký ở app.module.ts) — khi đó AI pipeline đơn giản
 * không chạy, ticket vẫn ở `status=NEW` như hành vi Phase 3+4 cũ.
 */
@Injectable()
export class CreateTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly ticketRepository: ITicketRepository,
    private readonly findOrCreateCustomer: FindOrCreateCustomerUseCase,
    private readonly appendTurn: AppendTurnUseCase,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @Inject(AI_PIPELINE_TRIGGER)
    private readonly aiPipelineTrigger?: IAiPipelineTrigger,
  ) {}

  async execute(command: CreateTicketCommand): Promise<TicketResponseDto> {
    const customer = await this.findOrCreateCustomer.execute({
      email: command.customerEmail,
      name: command.customerName,
    });

    const ticket = Ticket.create({
      id: uuid(),
      customerId: customer.id,
      channel: Channel[command.channel],
      subject: command.subject,
    });
    await this.ticketRepository.save(ticket);

    const firstMessage = TicketMessage.create({
      id: uuid(),
      ticketId: ticket.id,
      sender: MessageSender.CUSTOMER,
      content: command.content,
      channelMetadata: command.channelMetadata,
    });
    await this.ticketRepository.saveMessage(firstMessage);

    // tạo Conversation (nếu chưa có) + ghi turn đầu tiên
    await this.appendTurn.execute(ticket.id, TurnRole.USER, command.content);

    // Dispatch domain events (TicketCreatedEvent) SAU khi ghi DB thành công,
    // rồi clear — đúng pattern của LoginUseCase (Identity Module).
    for (const event of ticket.domainEvents) {
      this.eventEmitter.emit(event.eventName, event);
    }
    ticket.clearDomainEvents();

    // Phase 6 (Ngày 4): trigger AI Workflow ngay sau khi tạo ticket
    // (TDD Mục 8). Chạy đồng bộ trong request để kết quả trả về API đã
    // phản ánh trạng thái mới nhất (CLASSIFIED/ANSWERED/WAITING_CUSTOMER/
    // ESCALATED) — chấp nhận đánh đổi latency cho phạm vi Assessment;
    // hướng cải tiến (chạy qua BullMQ để không chặn response time) ghi
    // vào Nhật ký quyết định (TDD Mục 17).
    let latestTicket = ticket;
    if (this.aiPipelineTrigger) {
      try {
        await this.aiPipelineTrigger.process(ticket.id);
        const refreshed = await this.ticketRepository.findById(ticket.id);
        if (refreshed) latestTicket = refreshed;
      } catch {
        // Lỗi AI pipeline không được làm fail request tạo ticket — ticket
        // vẫn tồn tại ở status hiện có, Agent có thể xử lý thủ công.
      }
    }

    return {
      id: latestTicket.id,
      customerId: latestTicket.customerId,
      channel: latestTicket.channel,
      subject: latestTicket.subject,
      status: latestTicket.status,
      category: latestTicket.category,
      priority: latestTicket.priority,
      assignedAgentId: latestTicket.assignedAgentId,
      createdAt: latestTicket.createdAt,
      updatedAt: latestTicket.updatedAt,
    };
  }
}
