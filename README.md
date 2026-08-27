# Automation Agent — Hệ thống Tự động hoá Hỗ trợ Khách hàng bằng AI
**Link Demo: https://automation-agent-fhbl.onrender.com**

**Link Postman: https://www.postman.com/hdthinh3105/workspace/automationagent**

[![CI](https://github.com/hdthinh3105-hub/automation-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/hdthinh3105-hub/automation-agent/actions/workflows/ci.yml)
[![Docker (GHCR)](https://img.shields.io/badge/Docker-GHCR-2496ed?logo=docker&logoColor=white)](https://github.com/hdthinh3105-hub/automation-agent/pkgs/container/automation-agent)
[![Node](https://img.shields.io/badge/Node-%3E%3D%2020-339933?logo=node.js&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)]()
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)]()

Backend API cho hệ thống Automation/Agent tiếp nhận yêu cầu từ **nhiều kênh** (Web Chat, Telegram, Gmail/Email), tự động phân loại — phát hiện spam/trùng lặp/thiếu thông tin — trả lời bằng **RAG** (Retrieval-Augmented Generation) có trích dẫn nguồn, và **tự chuyển cho nhân viên (escalate)** khi độ tin cậy thấp hoặc vượt ngoài phạm vi tri thức đã nạp.

> Dự án không phải 1 chatbot demo đơn thuần — mỗi quyết định kiến trúc (Clean Architecture, Channel Adapter Pattern, Hybrid Search + RRF, Confidence Scoring đa tín hiệu, Saga đơn giản cho AI pipeline) đều xuất phát từ yêu cầu thật của bài toán Automation/Agent, được ghi chú trực tiếp trong code và trong `TDD-Track-D-AI-Customer-Support.md`.

---

## Mục lục

- [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
- [Sơ đồ dữ liệu (ERD)](#sơ-đồ-dữ-liệu-erd)
- [Tech Stack](#tech-stack)
- [Tính năng chính](#tính-năng-chính)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cài đặt & Chạy thử](#cài-đặt--chạy-thử)
- [Biến môi trường](#biến-môi-trường)
- [Gửi email qua Gmail REST API (thay SMTP)](#gửi-email-qua-gmail-rest-api-thay-smtp)
- [Testing](#testing)
- [CI/CD & Docker](#cicd--docker)
- [Monitoring](#monitoring)
- [Giới hạn đã biết](#giới-hạn-đã-biết)
- [Tài liệu liên quan](#tài-liệu-liên-quan)

---

## Kiến trúc tổng quan

```
                Web Chat / Telegram Bot / Gmail (IMAP) / Mailgun Webhook
                                    │
                                    ▼  (Channel Adapter Pattern — 1 Use Case duy nhất)
┌──────────────────────────────────────────────────────────────────────┐
│                  NestJS Modular Monolith (apps/api)                  │
│  Presentation → Application (Use Case/CQRS) → Domain → Infrastructure│
│                                                                      │
│  Identity | Customer | Ticket | Conversation | KnowledgeBase | RAG   │
│  AI (Orchestrator) | Routing | Escalation | Notification | Audit     │
│  Dashboard | Monitoring | Analytics | Settings | Shared              │
└───────────┬───────────────────────────────────────┬──────────────────┘
            │                                        │
            ▼                                        ▼
   ┌─────────────────┐                     ┌───────────────────────┐
   │   PostgreSQL    │                     │   Redis (BullMQ)      │
   │  (+ pgvector)   │                     │  Queues + Cache       │
   └─────────────────┘                     └──────────┬────────────┘
                                                        │
                                                        ▼
                                         ┌──────────────────────────────┐
                                         │  apps/worker (process riêng, │
                                         │  cùng codebase libs/)        │
                                         │  Document Parser / Embedding │
                                         │  / Email / Notification /    │
                                         │  Analytics cron / SLA Watcher│
                                         └──────────┬───────────────────┘
                                                     │
                          ┌──────────────────────────┼─────────────────────────┐
                          ▼                          ▼                         ▼
                 ┌─────────────────┐      ┌────────────────────┐      ┌────────────────────┐
                 │ Groq / Gemini   │      │ Local Embedding    │      │ Cloudinary / Local │
                 │ (LLM, fallback) │      │ (multilingual,384)│      │ File Storage       │
                 └─────────────────┘      └────────────────────┘      └────────────────────┘
```

**Nguyên tắc kiến trúc:**
- **Clean Architecture 4 lớp** (Presentation → Application → Domain → Infrastructure), luật phụ thuộc luôn hướng vào trong; Domain không import gì từ Infrastructure.
- **Modular Monolith / feature-first**: mỗi bounded context (Ticket, RAG, AI, Escalation...) là 1 module tự chứa, giao tiếp liên module chỉ qua Facade export tường minh hoặc Domain Event (`EventEmitter2`) — sẵn sàng tách Microservices sau này mà không phải viết lại business logic.
- **API và Worker dùng chung 1 codebase** (`libs/`), khác nhau chỉ ở entrypoint (`apps/api/main.ts` vs `apps/worker/worker.main.ts`) — tránh trùng lặp logic, scale độc lập từng process.
- **Channel Adapter Pattern**: mọi kênh tiếp nhận (Web/Telegram/Gmail/Email webhook) hội tụ về đúng 1 `CreateTicketUseCase`, không rẽ nhánh business logic theo kênh.
- **Port/Adapter cho LLM & Embedding**: `ILlmProvider`/`IEmbeddingProvider` do Application/Domain định nghĩa, Infrastructure implement (Groq/Gemini/Local) — đổi provider không sửa business logic.

---

## Sơ đồ dữ liệu (ERD)

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN : so_huu
    USER ||--o{ TICKET : duoc_gan_agent
    USER ||--o{ ESCALATION : duoc_gan_agent

    CUSTOMER ||--o{ TICKET : gui_yeu_cau

    TICKET ||--o{ TICKET_MESSAGE : gom
    TICKET ||--o{ TICKET_STATUS_HISTORY : lich_su_chuyen_trang_thai
    TICKET ||--|| CONVERSATION : ngu_canh_hoi_thoai
    TICKET ||--o{ ESCALATION : co_the_escalate
    TICKET ||--o{ TICKET : trung_lap_voi

    CONVERSATION ||--o{ CONVERSATION_TURN : gom

    KNOWLEDGE_DOCUMENT ||--o{ KNOWLEDGE_CHUNK : duoc_chunk
    KNOWLEDGE_CHUNK ||--|| CHUNK_EMBEDDING : co_vector

    USER {
        string id PK
        string email
        string role
        boolean isActive
    }
    CUSTOMER {
        string id PK
        string email
        string name
    }
    TICKET {
        string id PK
        string customerId FK
        string channel
        string status
        string category
        string priority
        float confidenceScore
        boolean isSpam
        string isDuplicateOf FK
    }
    TICKET_MESSAGE {
        string id PK
        string ticketId FK
        string sender
        string content
    }
    CONVERSATION {
        string id PK
        string ticketId FK
        string summary
        int turnCount
    }
    KNOWLEDGE_DOCUMENT {
        string id PK
        string title
        string status
        int version
    }
    KNOWLEDGE_CHUNK {
        string id PK
        string documentId FK
        string content
        int chunkIndex
        string section
    }
    CHUNK_EMBEDDING {
        string chunkId PK
        string embeddingModel
        int dimensions
    }
    ESCALATION {
        string id PK
        string ticketId FK
        string reason
        datetime slaDeadline
        string status
    }
```

17 bảng nghiệp vụ, chia nhóm: Identity, Customer/Ticket/Conversation, Knowledge Base/RAG, AI (PromptLog), Routing/Escalation, Vận hành (Notification/Audit/Analytics). Chi tiết đầy đủ và lý do thiết kế từng bảng xem `prisma/schema.prisma` và Mục 10 của `TDD-Track-D-AI-Customer-Support.md`.

---

## Tech Stack

| Nhóm | Công nghệ | Vai trò |
|---|---|---|
| Backend Framework | NestJS + TypeScript (strict) | DI container, module system khớp Clean Architecture |
| Database | PostgreSQL + **pgvector** | Dữ liệu quan hệ + vector cùng 1 instance, transaction nhất quán |
| ORM | Prisma | Type-safe, migration, raw SQL cho phần vector/full-text search |
| Queue | BullMQ + Redis (ioredis) | Background job: parse tài liệu, embedding, gửi email, notification |
| LLM | Groq (Llama 3.3, primary) + Google Gemini (fallback) | `LlmOrchestratorProvider` tự chuyển provider khi rate-limit/lỗi |
| Embedding | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 chiều, 50+ ngôn ngữ, chạy local qua `@xenova/transformers` — mặc định) hoặc Gemini `gemini-embedding-001` | Không phụ thuộc rate-limit ngoài, tiết kiệm quota cho phần generation; đổi model qua `EMBEDDING_MODEL` |
| Auth | JWT (access 15p + refresh token rotation, opaque `id.secret`) | RBAC 3 role: ADMIN / AGENT / VIEWER |
| File Storage | Cloudinary (`resource_type: raw`) hoặc Local Filesystem | Lưu tài liệu Knowledge Base gốc (PDF/DOCX/TXT/MD) |
| Kênh tiếp nhận | Web REST, Telegram Bot API, Gmail (IMAP polling + SMTP), Mailgun Inbound Webhook | Channel Adapter Pattern — cùng hội tụ 1 Use Case |
| Observability | Prometheus (`prom-client`) + Grafana, `nestjs-pino` (structured JSON log) | `/health`, `/health/ready`, `/metrics` |
| Testing | Jest, ts-jest | Unit test cho Domain Entity + Use Case (mock port) |
| Containerization | Docker Compose (Postgres + pgvector, Redis) | Chuẩn hoá môi trường dev |

---

## Tính năng chính

### Đa kênh (Multi-channel)
- **Web** (Must-have): REST API + Web Chat Widget, khách hàng không cần đăng nhập.
- **Telegram** (Should-have): nhận/gửi tin nhắn qua Bot API — 2 chế độ: **webhook** (khi có URL public, deploy lên Render) hoặc **long-polling `getUpdates`** (khi chạy local/Docker sau NAT, không cần URL, bật qua `TELEGRAM_POLLING_ENABLED=true`).
- **Gmail** (Could-have): polling IMAP mỗi 2 phút, lọc email tự động/hệ thống, trả lời qua email được gửi bất đồng bộ qua Email Worker để không tranh CPU với AI pipeline.
- **Mailgun Inbound Webhook** (Could-have): nhận email qua route forward.

### AI Processing Pipeline (`ProcessIncomingMessageUseCase`)
Classification → Spam Detection → Duplicate Detection (Jaccard similarity trong 30 ngày) → Missing Info Detection → Priority Detection → RAG Answer Generation → Confidence Evaluation → Routing Decision → Auto-answer hoặc Escalate. Toàn bộ chạy như 1 "Saga đơn giản, đồng bộ trong request"; ghi `PromptLog` bất đồng bộ để không chặn response time.

### RAG Pipeline (Enterprise-grade)
- **Chunking**: Recursive Character Splitting, ưu tiên ranh giới đoạn văn → câu → từ, giữ heading Markdown làm metadata `section`.
- **Hybrid Search**: kết hợp Vector Similarity (pgvector cosine) + Full-text Search (Postgres `tsvector` **OR-tokens** — tránh mất câu hỏi khi 1 token lạc quan hệ) bằng **Reciprocal Rank Fusion (RRF)**.
- **Re-ranking**: LLM chấm điểm relevance 0-10 cho top-N candidate, blend với vector similarity (`0.6×llmScore/10 + 0.4×vectorSimilarity`), tự fallback về thứ tự RRF nếu LLM lỗi (không chặn pipeline).
- **Confidence Scoring đa tín hiệu**: `0.5×avgTopSimilarity + 0.3×retrievalCoverage + 0.2×llmSelfScore` — không tin tuyệt đối vào LLM tự chấm điểm.
- **Chống hallucination**: nếu không tìm được chunk liên quan, trả thẳng "không tìm thấy thông tin" thay vì để LLM tự bịa, đồng thời escalate.

### Routing & Escalation
- Rule engine config-driven (ngưỡng confidence qua env `AI_CONFIDENCE_ESCALATION_THRESHOLD`).
- `Escalation` có SLA riêng (mặc định 24h), `SlaWatcherService` quét mỗi 5 phút để phát cảnh báo quá hạn.
- Agent Acknowledge → `IN_PROGRESS`; Resolve → đồng bộ cả Ticket sang `RESOLVED`.

### Vận hành & Quan sát
- **Audit Log** append-only, subscribe toàn bộ Domain Event qua wildcard listener (`@OnEvent('**')`).
- **Dashboard**: tổng quan ticket theo status/priority, xu hướng theo ngày (Analytics Worker materialize sẵn), tỷ lệ AI tự trả lời vs escalate.
- **Notification**: email cho Agent/Admin khi có Escalation mới, tài liệu xử lý lỗi, hoặc SLA breach — gửi bất đồng bộ qua Queue.
- **Monitoring**: `/metrics` (Prometheus) — `http_request_duration_seconds`, `queue_length`, `llm_call_duration_seconds`, `ai_confidence_score`, `tickets_created_total`, `tickets_escalated_total`.

---

## Cấu trúc thư mục

```
automation-agent/
├── apps/
│   ├── api/            # HTTP entrypoint (NestJS)
│   └── worker/          # Worker process (BullMQ processors + cron)
├── libs/
│   ├── modules/         # 17 module nghiệp vụ, mỗi module đủ 4 lớp Clean Architecture
│   ├── shared/           # Base Entity/VO, Result type, error codes, exception filter
│   ├── config/           # Zod env validation, config namespaces
│   └── infrastructure/   # PrismaService, Redis/Queue, LLM adapters, Storage adapters
├── workers/               # BullMQ Processor (adapter kích hoạt Use Case, không chứa business logic)
├── prisma/               # schema.prisma, migrations, seed.ts
├── docker/                # docker-compose.yml, init-extensions.sql (pgvector)
├── storage/               # Tài liệu KB mẫu (seed demo)
└── test/unit/             # Unit test theo module (mock port)
```

Chi tiết lý do tổ chức từng thư mục xem Mục 6 của `TDD-Track-D-AI-Customer-Support.md`.

---

## Cài đặt & Chạy thử

### Yêu cầu
- Node.js ≥ 20
- Docker Desktop (chạy Postgres + Redis local)
- API key free: [Groq](https://console.groq.com), [Google AI Studio](https://aistudio.google.com) (Gemini fallback + embedding tuỳ chọn)

### Chạy local (dev)
```bash
git clone <repo-url> automation-agent
cd automation-agent
npm install

cp .env.example .env
# → điền JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (chuỗi ngẫu nhiên ≥32 ký tự, vd: openssl rand -base64 48)
# → điền GROQ_API_KEY / GEMINI_API_KEY nếu muốn chạy AI pipeline thật

npm run prisma:generate
npm run prisma:migrate:deploy   # hoặc prisma:migrate:dev khi phát triển thêm
npm run seed                    # tạo admin@example.com / ChangeMe123!

npm run start:dev               # API tại http://localhost:3000/api
npm run start:worker:dev        # Worker process (queue: document-parser, embedding, email, notification)
```

> **Docker đầy đủ:** nếu dùng toàn bộ stack (Postgres+Redis+API+Worker+Frontend) chạy từ workspace root, dùng `docker compose up -d --build` ở repo gốc (xem mục [CI/CD](#cicd--docker)). Muốn chỉ cài hạ tầng Postgres/Redis local: `docker compose -f docker/docker-compose.infra.yml up -d`.

### Thử nhanh bằng curl hoặc postman ( link postman https://go.postman.co/workspace/8f65c004-6c33-45cb-8e29-6e5558d375be Nếu sài Postman bằng link nhớ phải vào thêm vào Enviroment URL: base_url: http://localhost:3000 , url_main: https://automation-agent-fhbl.onrender.com )
```bash
# Đăng nhập
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'

# Tạo ticket qua kênh Web (public, không cần token)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"customerEmail":"khach@example.com","subject":"Hỏi về đổi trả","content":"Tôi muốn đổi trả đơn hàng SV-20260415"}'
```

Mọi response bọc trong envelope chuẩn `{ success, data, error, meta }`. Mã lỗi tập trung tại `libs/shared/exceptions/error-codes.ts`, map 1-1 sang HTTP status qua Global Exception Filter.

---

## Biến môi trường

| Nhóm | Biến quan trọng | Ghi chú |
|---|---|---|
| App | `PORT`, `API_PREFIX`, `CORS_ORIGIN` | |
| Database | `DATABASE_URL` | Postgres có extension `vector` |
| Redis | `REDIS_HOST`/`REDIS_PORT` hoặc `REDIS_URL` | Dùng cho BullMQ |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Bắt buộc ≥32 ký tự, khác nhau |
| LLM | `GROQ_API_KEY`, `GEMINI_API_KEY`, `GROQ_MODEL`, `GEMINI_MODEL` | Optional lúc boot, throw rõ khi thực sự gọi mà thiếu key |
| Embedding | `EMBEDDING_PROVIDER` (`local`/`gemini`), `EMBEDDING_MODEL` (mặc định `Xenova/paraphrase-multilingual-MiniLM-L12-v2`), `EMBEDDING_DIMENSIONS` | Chạy `npm run prefetch:model` để tải model trước (tránh giật lần embed đầu) |
| RAG | `CHUNK_SIZE_TOKENS`, `RAG_TOP_K_RETRIEVAL` (mặc định 25), `RAG_TOP_K_FINAL` (mặc định 8), `AI_CONFIDENCE_ESCALATION_THRESHOLD`, `SPAM_SCORE_THRESHOLD` | Config-driven, không hard-code |
| Kênh | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_POLLING_ENABLED` (true = long-poll getUpdates không cần URL public; false = webhook), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `EMAIL_POLLING_ENABLED` | `GMAIL_APP_PASSWORD` dùng cho IMAP polling; bộ 3 `GMAIL_CLIENT_*` dùng để gửi qua REST API |
| Storage | `STORAGE_DRIVER` (`local`/`cloudinary`), `CLOUDINARY_*` | |
| Notification | `ADMIN_NOTIFICATION_EMAIL`, `SMTP_*` | Kênh thông báo nội bộ, tách khỏi kênh trả lời khách |

Xem đầy đủ + validate bằng Zod tại `libs/config/env.validation.ts` (fail-fast khi thiếu biến bắt buộc).

---

## Gửi email qua Gmail REST API (thay SMTP)

Từ ngày **26/09/2025**, Render **chặn outbound tới các port SMTP** (`25`, `465`, `587`) trên free tier (https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports) — khiến mọi lần gửi Gmail SMTP đều `Connection timeout` giữa chừng. Để gửi mail trên Render free tier, hệ thống đã chuyển `GmailChannelAdapter.sendMailDirect()` sang **Gmail REST API** (HTTPS port 443, không bị chặn).

**Cách hoạt động:** vẫn giữ luồng cũ — API enqueue job → Worker `EmailProcessor` gửi thật. Chỉ khác cơ chế gửi:

| Bộ cấu hình | Cơ chế dùng |
|---|---|
| Đủ `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` + `GMAIL_REFRESH_TOKEN` | **Gmail REST API** (`POST gmail.googleapis.com/gmail/v1/users/me/messages/send`, OAuth2 refresh token, tự cache access token) |
| Chỉ có `GMAIL_USER` + `GMAIL_APP_PASSWORD` | Fallback SMTP cũ (thường chỉ chạy được local) |

**Cấu hình 1 lần (lấy token):**

1. **Google Cloud Console** (https://console.cloud.google.com) → tạo project → **APIs & Services → Library** → bật **Gmail API**.
2. **OAuth consent screen** → External → thêm scope `https://www.googleapis.com/auth/gmail.send` → thêm email tài khoản Gmail của bạn vào **Test users**.
3. **Credentials** → Create Credentials → **OAuth client ID**:
   - Loại **Web application**: thêm redirect URI `https://developers.google.com/oauthplayground` để dùng OAuth Playground; hoặc
   - Loại **Desktop app**: không cần redirect URI, dùng [get-gmail-token.js](https://developers.google.com/oauthplayground) dạng loopback cho chắc chắn.
4. Lấy **refresh token** (OAuth Playground hoặc script loopback `localhost`) → điền vào 3 biến `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN` (của **cùng 1 client** đã sinh token, đúng account `GMAIL_USER`).
5. Thêm 3 biến này vào môi trường Render của **cả 2 service** (API + Worker) → Redeploy.

Kiểm tra: Worker logs sẽ có `Gmail API đã chấp nhận email, messageId=...` thay cho `Connection timeout`. Lỗi thường gặp: `invalid_grant` (token lệch scope/account), `403` (thiếu scope).

---

## Testing

```bash
npm run lint:ci      # ESLint (fail ngay cả khi có warning) — CI dùng lệnh này
npm run typecheck    # tsc --noEmit — CI dùng lệnh này
npm run test         # chạy Jest
npm run test:ci      # Jest --ci + coverage — CI dùng lệnh này
```

Unit test tập trung vào phần khó nhất: `TicketStateMachine`/`Ticket` entity (transition hợp lệ/không hợp lệ), `LoginUseCase` (mock toàn bộ Repository/Port), `ProcessIncomingMessageUseCase` (mock toàn bộ providers qua Port), `MissingInfoDetectionService`. Chưa phủ 100% — xem `test/unit/`.

> Lưu ý: trước khi chạy `typecheck` hoặc `nest build` cần `npm run prisma:generate` (Prisma client generate theo schema hiện tại).

---

## CI/CD & Docker

GitHub Actions tự chạy mỗi lần push/PR vào `main`/`develop` (xem `.github/workflows/ci.yml`):

| Bước | Lệnh | Vai trò |
|---|---|---|
| `lint` | `npm run lint:ci` | ESLint + Prettier rule, fail ở mức warning |
| `typecheck` | `npm run typecheck` | TypeScript strict, đảm bảo không lọt type lỗi |
| `test` | `npm run test:ci` | Jest + coverage, upload artifact report |
| `build` | `npm run build` + `npm run build:worker` | Build Nest API + Worker, smoke-build Docker image |
| `publish-docker` | Docker Buildx | Merge vào `main`: build & push `ghcr.io/<owner>/automation-agent` + `automation-agent-worker` (tag `sha-*` + `latest`) |

Router ví dụ khi chạy full stack Docker từ workspace root:

```
Docker Compose: postgres (pgvector) + redis + api :3000 + worker + frontend :3001
```

Dependabot tự động gộp cập nhật theo nhóm (nestjs/prisma/typescript/eslint..., Docker base image, GitHub Actions) — thứ 7 hằng tuần, xem `.github/dependabot.yml`.

Muốn cập nhật dependency có chủ đích: để Dependabot tạo PR (nhóm nhỏ), build thử qua CI là gate an toàn trước khi merge.

---

## Monitoring

`GET /metrics` (Prometheus text format) expose:
- `http_requests_total{method,route,status}`, `http_request_duration_seconds{route}`
- `queue_length{queue}`, `queue_jobs_failed_total{queue}`
- `llm_call_duration_seconds{provider,useCase}`, `ai_confidence_score` (histogram)
- `tickets_created_total{category}`, `tickets_escalated_total{reason}`, `tickets_auto_resolved_total`

`GET /health/ready` kiểm tra kết nối DB + Redis. Import dashboard Grafana mẫu tại `docker/grafana/dashboards` (System Health / AI Performance / Business).

---

## Giới hạn đã biết

Trung thực về phạm vi — hệ thống được thiết kế theo nguyên tắc *"Architecture-complete, Scope-lean"* cho khung thời gian giới hạn, không phải mọi nhánh đều đã implement đầy đủ ở mức Should/Could-have:

- **Gửi Mail** dùng Gmail REST API (OAuth2) để không bị Render free tier chặn SMTP — chỉ cần cấu hình đủ bộ `GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN` cho đúng account `GMAIL_USER`. Nếu chưa cấu hình OAuth, mailer fallback về SMTP (chỉ chạy được local, Render sẽ `Connection timeout`).
- **Duplicate Detection** dùng Jaccard similarity trên tập từ (đơn giản hoá), chưa dùng vector similarity qua RAG Module như thiết kế đầy đủ.
- **SLA Watcher** chưa có cờ "đã thông báo" — nếu Escalation vẫn `PENDING` qua nhiều chu kỳ quét (5 phút), thông báo có thể lặp lại tới khi Agent Acknowledge.
- **Telegram long-polling** chỉ nên chạy đúng **1 instance** duy nhất (Telegram cấm nhiều nguồn update đồng thời) — Docker local chỉ có 1 container API nên an toàn; nếu scale ngang API thành nhiều replica cần dùng webhook thay vì polling.
- **Kênh Email/Mailgun** mỗi email tạo 1 ticket mới, chưa gộp email cùng chuỗi (`In-Reply-To`) vào 1 ticket cũ.
- **Re-ranking bằng LLM** tiêu tốn thêm 1 lượt gọi LLM cho mỗi câu hỏi — có thể tắt bằng cách để `topKRetrieval ≤ topKFinal` nếu cần tiết kiệm quota free-tier.
- **Free tier LLM (Groq/Gemini)** có thể bị rate-limit ở lượng truy cập cao — đã có fallback chain + escalate tự động khi cả 2 provider cùng lỗi, không để ticket kẹt trạng thái.
- **Worker health-check** trên các nền tảng chỉ hỗ trợ "Web Service" (không có Background Worker miễn phí) cần mở kèm 1 HTTP server tối giản chỉ để pass health-check — không phục vụ nghiệp vụ.

Chi tiết đầy đủ và các quyết định đánh đổi khác xem Mục 15 và Mục 17 (Nhật ký quyết định) của `TDD-Track-D-AI-Customer-Support.md`.

---

## Tài liệu liên quan

- [`TDD-Track-D-AI-Customer-Support.md`] — https://docs.google.com/document/d/1oIeRXqzTY-ehi3EKFmMDApNStNUflb6mWudEdIbrFOU/edit?usp=sharing (tài liệu thiết kế kiến trúc đầy đủ (Clean Architecture, RAG Pipeline, AI Workflow, State Machine, Database, REST API, Background Jobs, Observability, Kế hoạch triển khai theo Phase).
- Frontend Dashboard (project riêng `automation-agent-FE`) — Next.js App Router, xem README của project đó để biết cách kết nối.
