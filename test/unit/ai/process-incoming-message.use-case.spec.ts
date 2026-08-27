import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcessIncomingMessageUseCase } from '@app/modules/ai/application/use-cases/process-incoming-message.use-case';
import { Ticket, TicketStatus, TicketMessage, MessageSender } from '@app/modules/ticket';
import { Channel } from '@app/modules/ticket/domain/value-objects/channel.vo';
import { ITicketRepository } from '@app/modules/ticket/application/ports/repository.ports';
import { AppendTurnUseCase, TurnRole } from '@app/modules/conversation';
import { GenerateAnswerUseCase } from '@app/modules/rag';
import { DetermineRoutingUseCase } from '@app/modules/routing';
import { CreateEscalationUseCase } from '@app/modules/escalation';
import { ClassificationService } from '@app/modules/ai/application/services/classification.service';
import { SpamDetectionService } from '@app/modules/ai/application/services/spam-detection.service';
import { DuplicateDetectionService } from '@app/modules/ai/application/services/duplicate-detection.service';
import { MissingInfoDetectionService } from '@app/modules/ai/application/services/missing-info-detection.service';
import { PriorityDetectionService } from '@app/modules/ai/application/services/priority-detection.service';
import { PromptLogService } from '@app/modules/ai/application/services/prompt-log.service';

describe('ProcessIncomingMessageUseCase — missing info branch', () => {
  const ticket = Ticket.create({
    id: 'ticket-1',
    customerId: 'customer-1',
    channel: Channel.WEB,
    subject: 'Yêu cầu thanh toán',
  });

  const customerMessage = TicketMessage.create({
    id: 'msg-1',
    ticketId: 'ticket-1',
    sender: MessageSender.CUSTOMER,
    content: 'Tôi cần được hoàn tiền cho đơn hàng đã giao sai',
  });

  let repo: {
    findById: jest.Mock;
    findMessages: jest.Mock;
    save: jest.Mock;
    saveMessage: jest.Mock;
  };
  let appendTurn: { execute: jest.Mock };
  let useCase: ProcessIncomingMessageUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(ticket),
      findMessages: jest.fn().mockResolvedValue([customerMessage]),
      save: jest.fn().mockResolvedValue(undefined),
      saveMessage: jest.fn().mockResolvedValue(undefined),
    };
    appendTurn = { execute: jest.fn().mockResolvedValue(undefined) };

    useCase = new ProcessIncomingMessageUseCase(
      repo as unknown as ITicketRepository,
      appendTurn as unknown as AppendTurnUseCase,
      { execute: jest.fn() } as unknown as GenerateAnswerUseCase,
      { execute: jest.fn() } as unknown as DetermineRoutingUseCase,
      { execute: jest.fn() } as unknown as CreateEscalationUseCase,
      {
        classify: jest.fn().mockResolvedValue({ category: 'Yêu cầu thanh toán', confidence: 0.9 }),
      } as unknown as ClassificationService,
      {
        detect: jest.fn().mockReturnValue({ isSpam: false, score: 0.1 }),
      } as unknown as SpamDetectionService,
      {
        detect: jest.fn().mockResolvedValue({ isDuplicate: false }),
      } as unknown as DuplicateDetectionService,
      new MissingInfoDetectionService(),
      { detect: jest.fn().mockReturnValue('LOW') } as unknown as PriorityDetectionService,
      { log: jest.fn().mockResolvedValue(undefined) } as unknown as PromptLogService,
      new EventEmitter2(),
    );
  });

  it('tạo tin nhắn AI nhắc khách cung cấp mã đơn khi thiếu thông tin (không im lặng)', async () => {
    const result = await useCase.execute('ticket-1');

    expect(result.missingInfoFlags).toContain('MISSING_ORDER_CODE');
    expect(result.finalStatus).toBe(TicketStatus.WAITING_CUSTOMER);
    expect(result.answer).toContain('mã đơn hàng');

    const savedAiMessage = repo.saveMessage.mock.calls[0][0] as TicketMessage;
    expect(savedAiMessage.sender).toBe(MessageSender.AI);
    expect(savedAiMessage.content).toContain('SV-');

    const appendedTurn = appendTurn.execute.mock.calls[0];
    expect(appendedTurn[1]).toBe(TurnRole.ASSISTANT);
  });
});
