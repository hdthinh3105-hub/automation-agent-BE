import { PromptLog } from '../../domain/entities/prompt-log.entity';

export const PROMPT_LOG_REPOSITORY = Symbol('PROMPT_LOG_REPOSITORY');

export interface IPromptLogRepository {
  save(promptLog: PromptLog): Promise<void>;
}
