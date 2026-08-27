import { Entity } from '@app/shared/base/entity.base';

export interface PromptLogProps {
  id: string;
  ticketId: string | null;
  useCase: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  requestPayloadRedacted: string | null;
  responseRaw: string | null;
  createdAt: Date;
}

/**
 * 📦 Entity — 1 lần gọi LLM (TDD Mục 5.7, "PromptLog... phục vụ
 * audit/cost-tracking"). `requestPayloadRedacted` KHÔNG lưu PII khách
 * hàng thô — nơi tạo entity này chịu trách nhiệm redact trước khi
 * truyền vào (TDD Mục 10.3).
 */
export class PromptLog extends Entity<string> {
  private props: PromptLogProps;

  private constructor(props: PromptLogProps) {
    super(props.id);
    this.props = props;
  }

  public static create(params: {
    id: string;
    ticketId?: string | null;
    useCase: string;
    provider: string;
    model: string;
    promptTokens?: number | null;
    completionTokens?: number | null;
    latencyMs: number;
    requestPayloadRedacted?: string | null;
    responseRaw?: string | null;
  }): PromptLog {
    return new PromptLog({
      id: params.id,
      ticketId: params.ticketId ?? null,
      useCase: params.useCase,
      provider: params.provider,
      model: params.model,
      promptTokens: params.promptTokens ?? null,
      completionTokens: params.completionTokens ?? null,
      latencyMs: params.latencyMs,
      requestPayloadRedacted: params.requestPayloadRedacted ?? null,
      responseRaw: params.responseRaw ?? null,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: PromptLogProps): PromptLog {
    return new PromptLog(props);
  }

  public get ticketId(): string | null {
    return this.props.ticketId;
  }

  public get useCase(): string {
    return this.props.useCase;
  }

  public get provider(): string {
    return this.props.provider;
  }

  public get model(): string {
    return this.props.model;
  }

  public get promptTokens(): number | null {
    return this.props.promptTokens;
  }

  public get completionTokens(): number | null {
    return this.props.completionTokens;
  }

  public get latencyMs(): number {
    return this.props.latencyMs;
  }

  public get requestPayloadRedacted(): string | null {
    return this.props.requestPayloadRedacted;
  }

  public get responseRaw(): string | null {
    return this.props.responseRaw;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
