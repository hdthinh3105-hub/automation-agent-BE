import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';

export class ConversationNotFoundException extends DomainException {
  constructor(ticketId: string) {
    super(ErrorCode.CONVERSATION_NOT_FOUND, `No conversation found for ticket "${ticketId}"`, {
      ticketId,
    });
  }
}
