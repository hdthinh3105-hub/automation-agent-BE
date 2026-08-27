import { DomainException } from '@app/shared/exceptions/domain.exception';
import { ErrorCode } from '@app/shared/exceptions/error-codes';

export class EscalationNotFoundException extends DomainException {
  constructor(id: string) {
    super(ErrorCode.ESCALATION_NOT_FOUND, `Escalation with id "${id}" was not found`, { id });
  }
}

export class InvalidEscalationTransitionException extends DomainException {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      ErrorCode.INVALID_ESCALATION_TRANSITION,
      `Cannot transition escalation from ${currentStatus} to ${targetStatus}`,
      { currentStatus, targetStatus },
    );
  }
}
