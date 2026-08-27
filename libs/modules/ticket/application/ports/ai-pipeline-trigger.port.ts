export const AI_PIPELINE_TRIGGER = Symbol('AI_PIPELINE_TRIGGER');

/**
 * 🔌 Port — TicketModule định nghĩa (không biết gì về AiModule cụ thể),
 * AiModule sẽ bind implementation này ở `app.module.ts` (Composition
 * Root) để tránh circular dependency: TicketModule không import
 * AiModule, nhưng vẫn "gọi" được AI pipeline qua interface trừu tượng
 * (Dependency Inversion, TDD Mục 2.2).
 */
export interface IAiPipelineTrigger {
  process(ticketId: string): Promise<unknown>;
}
