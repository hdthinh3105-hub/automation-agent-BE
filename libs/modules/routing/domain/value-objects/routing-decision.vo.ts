/**
 * 📦 Value Object — quyết định routing (TDD Mục 5.8). `RoutingAction`
 * gồm cả `ASK_MORE_INFO` để khớp thiết kế đầy đủ ở TDD, dù ở Đợt Ngày 4
 * nhánh ASK_MORE_INFO được `ProcessIncomingMessageUseCase` (AI Module)
 * xử lý trực tiếp TRƯỚC khi gọi tới Routing Module (không đi qua
 * `RoutingPolicyService`) — xem comment ở `routing-policy.service.ts`.
 */
export type RoutingAction = 'AUTO_ANSWER' | 'ASK_MORE_INFO' | 'ESCALATE';

export interface RoutingDecision {
  action: RoutingAction;
  reason: string;
}
