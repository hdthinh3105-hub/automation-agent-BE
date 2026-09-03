# Automation Agent — Hệ thống Tự động hoá Hỗ trợ Khách hàng bằng AI
**Link Demo: https://automation-agent-052r.onrender.com**

**Link Postman: https://www.postman.com/hdthinh3105/workspace/automationagent**

[![CI](https://github.com/hdthinh3105-hub/automation-agent-BE/actions/workflows/ci.yml/badge.svg)](https://github.com/hdthinh3105-hub/automation-agent-BE/actions/workflows/ci.yml)
[![Deploy Render](https://img.shields.io/badge/Deploy-Render-46e3b7?logo=render&logoColor=white)](https://dashboard.render.com)
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
- [Deploy lên Render](#deploy-lên-render)
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
                                         │  Single Web Service (merged) │
                                         │  apps/api + apps/worker      │
                                         │  cùng codebase libs/ via     │
                                         │  scripts/start-merged.mjs    │
                                         │  API: $PORT (10000)          │
                                         │  Worker: $WORKER_PORT (3001) │
                                         │  Document Parser / Embedding │
                                         │  / Email / Notification /    │
                                         │  Analytics cron / SLA Watcher│
                                         └──────────┬───────────────────┘
                                                     │
                          ┌──────────────────────────┼─────────────────────────┐
                          ▼                          ▼                         ▼
                 ┌─────────────────┐      ┌────────────────────┐      ┌────────────────────┐
                 │ Groq / Gemini   │      │ Gemini Embedding   │      │ Cloudinary / Local │
                 │ (LLM, fallback) │      │ (3072) / Local 384 │      │ File Storage       │
                 └─────────────────┘      └────────────────────┘      └────────────────────┘
```

**Nguyên tắc kiến trúc:**
- **Clean Architecture 4 lớp** (Presentation → Application → Domain → Infrastructure), luật phụ thuộc luôn hướng vào trong; Domain không import gì từ Infrastructure.
- **Modular Monolith / feature-first**: mỗi bounded context (Ticket, RAG, AI, Escalation...) là 1 module tự chứa, giao tiếp liên module chỉ qua Facade export tường minh hoặc Domain Event (`EventEmitter2`) — sẵn sàng tách Microservices sau này mà không phải viết lại business logic.
- **API và Worker dùng chung 1 codebase** (`libs/`), khác nhau chỉ ở entrypoint (`apps/api/main.ts` vs `apps/worker/worker.main.ts`) — tránh trùng lặp logic. Production gộp trong **1 Web Service** qua `scripts/start-merged.mjs` (API `$PORT` + Worker `$WORKER_PORT=3001`) để vừa `750h` free-tier; local vẫn có thể chạy tách `docker compose up api worker` để log riêng.
- **Channel Adapter Pattern**: mọi kênh tiếp nhận (Web/Telegram/Gmail/Email webhook) hội tụ về đúng 1 `CreateTicketUseCase`, không rẽ nhánh business logic theo kênh.
- **Port/Adapter cho LLM & Embedding**: `ILlmProvider`/`IEmbeddingProvider` do Application/Domain định nghĩa, Infrastructure implement (Groq/Gemini/Local) — đổi provider không sửa business logic.

---

## Sơ đồ dữ liệu (ERD)

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN : "so_huu"
    USER ||--o{ TICKET : "duoc_gan"
    USER ||--o{ ESCALATION : "xu_ly"
    CUSTOMER ||--o{ TICKET : "gui_yeu_cau"
    TICKET ||--o{ TICKET_MESSAGE : "gom"
    TICKET ||--o{ TICKET_STATUS_HISTORY : "lich_su"
    TICKET ||--|| CONVERSATION : "co"
    TICKET ||--o{ ESCALATION : "escalate"
    TICKET ||--o{ TICKET : "trung_lap"
    CONVERSATION ||--o{ CONVERSATION_TURN : "gom"
    KNOWLEDGE_DOCUMENT ||--o{ KNOWLEDGE_CHUNK : "chunk"
    KNOWLEDGE_CHUNK ||--|| CHUNK_EMBEDDING : "vector"

    USER {
        string id PK
        string email UK
        string role
        boolean isActive
    }
    REFRESH_TOKEN {
        string id PK
        string userId FK
        datetime expiresAt
    }
    CUSTOMER {
        string id PK
        string email UK
        string name
    }
    TICKET {
        string id PK
        string customerId FK
        string channel
        string status
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
    TICKET_STATUS_HISTORY {
        string id PK
        string ticketId FK
        string fromStatus
        string toStatus
    }
    CONVERSATION {
        string id PK
        string ticketId FK_UK
        int turnCount
    }
    CONVERSATION_TURN {
        string id PK
        string conversationId FK
        string role
        string content
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
    }
    CHUNK_EMBEDDING {
        string chunkId PK_FK
        string embeddingModel
        int dimensions
    }
    ESCALATION {
        string id PK
        string ticketId FK
        string reason
        string status
        datetime slaDeadline
    }
    PROMPT_LOG {
        string id PK
        string ticketId FK
        string useCase
        string provider
    }
    AUDIT_LOG {
        string id PK
        string actorType
        string action
        string resourceType
    }
    NOTIFICATION_LOG {
        string id PK
        string type
        string channel
        string status
    }
    DAILY_METRIC_SNAPSHOT {
        datetime date PK
        int totalTickets
        int escalatedCount
    }
    CATEGORY {
        string id PK
        string name UK
        boolean isActive
    }
    ROUTING_RULE {
        string id PK
        string name
        int priority
        string action
    }
    SYSTEM_SETTING {
        string id PK
        string key UK
        string category
    }
```

19 bảng nghiệp vụ, chia nhóm: Identity (2), Customer/Ticket/Conversation (6), Knowledge Base/RAG (3), AI/Escalation (2), Vận hành Audit/Notification/Analytics (3), Admin Category/RoutingRule/SystemSetting (3). Chi tiết đầy đủ và lý do thiết kế từng bảng xem `prisma/schema.prisma` và Mục 10 của `TDD-Track-D-AI-Customer-Support.md`.

---

## Tech Stack

| Nhóm | Công nghệ | Vai trò |
|---|---|---|
| Backend Framework | NestJS + TypeScript (strict) | DI container, module system khớp Clean Architecture |
| Database | PostgreSQL + **pgvector** | Dữ liệu quan hệ + vector cùng 1 instance, transaction nhất quán |
| ORM | Prisma | Type-safe, migration, raw SQL cho phần vector/full-text search |
| Queue | BullMQ + Redis (ioredis) | Background job: parse tài liệu, embedding, gửi email, notification |
| LLM | Groq (Llama 3.3, primary) + Google Gemini (fallback) | `LlmOrchestratorProvider` tự chuyển provider khi rate-limit/lỗi |
| Embedding | `Gemini gemini-embedding-001` (3072 chiều, production) hoặc `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 chiều, 50+ ngôn ngữ, chạy local qua `@xenova/transformers`) | `EMBEDDING_PROVIDER=gemini` (khuyến nghị production, đã re-index 3072) hoặc `local` (tiết kiệm quota, tốn RAM 470MB); đổi qua `EMBEDDING_PROVIDER`/`EMBEDDING_MODEL` |
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
automation-agent-BE/
├── apps/
│   ├── api/            # HTTP entrypoint (apps/api/src/main.ts)
│   └── worker/          # Worker process (apps/worker/src/worker.main.ts, BullMQ processors + cron)
├── libs/
│   ├── modules/         # 19 module nghiệp vụ, mỗi module đủ 4 lớp Clean Architecture
│   ├── shared/           # Base Entity/VO, error codes, GlobalExceptionFilter
│   ├── config/           # Zod env validation, config namespaces
│   └── infrastructure/   # PrismaService, Redis/Queue, LLM/Embedding/Storage adapters
├── prisma/               # schema.prisma, migrations (19 bảng), seed.ts
├── scripts/              # start-merged.mjs (gộp API+Worker), prefetch-embedding-model.mjs, reindex-embeddings.mjs
├── docker/               # postgres/init-extensions.sql (pgvector)
├── storage/               # Tài liệu KB mẫu (seed demo, *.md)
├── docker-compose.yml    # postgres + redis + api + worker (local tách, prod gộp)
├── Dockerfile            # merged API+Worker (production, prune dev deps)
└── Dockerfile.worker     # worker riêng (local)
```

Chi tiết lý do tổ chức từng thư mục xem Mục 6 của `TDD-Track-D-AI-Customer-Support.md`.

---

## Cài đặt & Chạy thử

### Chạy nhanh bằng Docker (30 giây)

Cách nhanh nhất để chạy toàn bộ backend (Postgres + pgvector + Redis + API + Worker) chỉ với Docker — không cần cài Node.js trên máy:

```bash
git clone https://github.com/hdthinh3105-hub/automation-agent-BE.git be
cd be

cp .env.example .env
# → điền ít nhất JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (chuỗi ngẫu nhiên ≥32 ký tự, vd: openssl rand -base64 48)
# → điền GROQ_API_KEY / GEMINI_API_KEY nếu muốn chạy AI pipeline thật

docker compose up -d --build

# Chạy migration + seed (gắn tạm package.json/tsconfig.json từ host để ts-node chạy được trong container)
docker compose run --rm \
  -v "$PWD/package.json:/app/package.json:ro" \
  -v "$PWD/tsconfig.json:/app/tsconfig.json:ro" \
  api sh -c "npx prisma migrate deploy && npx ts-node --transpile-only prisma/seed.ts"
```

Kiểm tra:
```bash
curl http://localhost:3000/api/health     # → {"status":"ok"}
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'
```

> **Các port khi chạy Docker:** API ở `3000`, Postgres ở `5432`, Redis ở `6379`, Worker không expose port bên ngoài (chỉ nội bộ network của compose).

> **Seed chạy 1 lần duy nhất** để tạo tài khoản admin `admin@example.com` / `ChangeMe123!` (đổi mật khẩu sau lần đăng nhập đầu — xem bảng tài khoản dưới đây). Không chạy seed trong `docker compose up` để tránh trùng dữ liệu mỗi lần khởi động.

| Tài khoản | Vai trò | Mô tả |
|---|---|---|
| `admin@example.com` / `ChangeMe123!` | ADMIN | Toàn quyền: dashboard, KB, settings, xem AI performance |

### Yêu cầu
- Node.js ≥ 20 (nếu chạy dev thay vì Docker)
- Docker Desktop (chạy Postgres + Redis local)
- API key free: [Groq](https://console.groq.com), [Google AI Studio](https://aistudio.google.com) (Gemini fallback + embedding tuỳ chọn)

### Chạy local (dev)
```bash
git clone https://github.com/hdthinh3105-hub/automation-agent-BE.git be
cd be
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

> **Chỉ cài hạ tầng Postgres/Redis local** (không chạy API/Worker qua Docker): `docker compose up -d postgres redis`.

> **Frontend đi kèm**: dashboard Next.js nằm ở repo riêng `automation-agent-FE` (xem README project đó) — chạy độc lập với backend này, kết nối qua `NEXT_PUBLIC_API_BASE_URL`.

### Thử nhanh bằng curl hoặc Postman (https://www.postman.com/hdthinh3105/workspace/automationagent — nhớ tạo Environment với `base_url: http://localhost:3000`, `url_main: https://automation-agent-052r.onrender.com`)
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
| Embedding | `EMBEDDING_PROVIDER` (`gemini`/`local`), `EMBEDDING_MODEL` (`gemini-embedding-001` hoặc `Xenova/paraphrase-multilingual-MiniLM-L12-v2`), `EMBEDDING_DIMENSIONS` (`3072` cho Gemini, `384` cho local) | Gemini là mặc định production (đã re-index 3072); local cần `npm run prefetch:model` và tốn RAM 470MB |
| RAG | `CHUNK_SIZE_TOKENS`, `RAG_TOP_K_RETRIEVAL` (mặc định 25), `RAG_TOP_K_FINAL` (mặc định 8), `AI_CONFIDENCE_ESCALATION_THRESHOLD`, `SPAM_SCORE_THRESHOLD` | Config-driven, không hard-code |
| Kênh | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_POLLING_ENABLED` (true = long-poll `getUpdates` không cần URL public; false = webhook), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `EMAIL_POLLING_ENABLED` | `GMAIL_APP_PASSWORD` dùng cho IMAP polling; bộ 3 `GMAIL_CLIENT_*` dùng để gửi qua Gmail REST API |
| Storage | `STORAGE_DRIVER` (`local`/`cloudinary`), `CLOUDINARY_*`, `STORAGE_LOCAL_PATH` | `cloudinary` bắt buộc trên Render (ephemeral disk) |
| Notification | `ADMIN_NOTIFICATION_EMAIL`, `SMTP_*` | Kênh thông báo nội bộ, tách khỏi kênh trả lời khách |
| Worker | `WORKER_PORT` (mặc định `3001`), `PORT` | Worker health server bind riêng khi gộp |

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

> CI chỉ **chạy kiểm tra** (không publish ảnh). Deploy production thực hiện qua **Render Deploy Hook** (xem mục [Deploy lên Render](#deploy-lên-render)) — không còn push GHCR.

Dependabot tự động gộp cập nhật theo nhóm (nestjs/prisma/typescript/eslint..., Docker base image, GitHub Actions) — thứ 7 hằng tuần, xem `.github/dependabot.yml`.

Muốn cập nhật dependency có chủ đích: để Dependabot tạo PR (nhóm nhỏ), build thử qua CI là gate an toàn trước khi merge.

---

## Deploy lên Render

Backend deploy production lên **Render** (1 Web Service merged API+Worker) qua **Deploy Hook** — push vào `main` sẽ tự trigger redeploy. Không cần GHCR: Render build trực tiếp từ repo (Node native).

### Chuẩn bị 1 lần (Render Dashboard)

1. **Web Service (merged)**: tạo **Web Service** → connect repo `automation-agent-BE` → branch `main` → **Root Directory** để trống → **Runtime** `Node` → **Build Command** = `npm install && npm run build && npm run build:worker` → **Start Command** = `node scripts/start-merged.mjs` (gộp API `$PORT` + Worker `$WORKER_PORT=3001` trong 1 container, tiết kiệm `750h` free-tier — local vẫn có thể `docker compose up api worker` tách log).
2. **Database**: dùng **Neon**/**Render PostgreSQL** (đã bật extension `vector`) hoặc Postgres ngoài; lấy `DATABASE_URL` (Neon cần `?sslmode=require`).
3. **Redis**: dùng Redis ngoài ([Upstash](https://upstash.com)/[Redis Cloud](https://redis.com)), lấy `REDIS_URL` (`rediss://` với TLS) — **không dùng Redis local khi deploy**.
4. Lần đầu: đặt **Pre-deploy Command** = `npx prisma migrate deploy --schema=prisma/schema.prisma` để migration chạy trước mỗi deploy (tránh cold start chạy migrate trong `CMD`).

### Cấu hình biến môi trường (Render → Environment)

Trên **service duy nhất**, copy các biến từ `.env.example` sang Render, chỉnh cho production. Bắt buộc tối thiểu:
- `DATABASE_URL` — Postgres Neon/Render.
- `REDIS_URL` (hoặc `REDIS_HOST`/`REDIS_PORT`/`REDIS_TLS`) — Upstash.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — chuỗi ≥32 ký tự, khác nhau.
- `GROQ_API_KEY`, `GEMINI_API_KEY`, `GROQ_MODEL`, `GEMINI_MODEL` — LLM.
- `EMBEDDING_PROVIDER=gemini`, `EMBEDDING_DIMENSIONS=3072` (production đã re-index) — hoặc `local` nếu muốn tiết kiệm quota.
- `CORS_ORIGIN` — domain FE trên Vercel (`https://automation-agent-fe.vercel.app`).
- Các biến kênh: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_POLLING_ENABLED` (đặt `false` khi có URL public → dùng webhook), bộ Gmail (`GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN`), `CLOUDINARY_*`, `STORAGE_DRIVER=cloudinary`...

### Bật GitHub Actions deploy hook

`be/.github/workflows/deploy.yml` sẽ gọi **Deploy Hook URL** của Render mỗi lần push `main`. Thêm vào **GitHub repo → Settings → Secrets → Actions**:

| Secret | Lấy từ |
|---|---|
| `RENDER_DEPLOY_HOOK_API` | Render → Web Service → Settings → **Deploy Hook** → copy URL |

> Nếu chưa set secret, workflow tự **skip** (không fail) — push vẫn chạy CI bình thường. Không cần `RENDER_DEPLOY_HOOK_WORKER` nữa (đã gộp).

### Migration + seed lần đầu (trên production)

```bash
# Pre-deploy Command đã chạy migrate deploy tự động. Nếu chạy thủ công:
npx prisma migrate deploy --schema=prisma/schema.prisma
# tạo admin tài khoản (chạy 1 lần, từ local trỏ DATABASE_URL production hoặc Render Shell):
npx ts-node --transpile-only prisma/seed.ts
```

Kiểm tra: `https://<your-api>.onrender.com/api/health` → `{"status":"ok"}`; login `admin@example.com` / `ChangeMe123!`.

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
- **Worker health-check** trên Render free (chỉ có Web Service) cần HTTP server tối giản — production gộp API+Worker qua `scripts/start-merged.mjs`, worker bind `WORKER_PORT=3001` riêng để pass health-check nội bộ, không tốn thêm service.

Chi tiết đầy đủ và các quyết định đánh đổi khác xem Mục 15 và Mục 17 (Nhật ký quyết định) của `TDD-Track-D-AI-Customer-Support.md`.

---

## Tài liệu liên quan

- [`TDD-Track-D-AI-Customer-Support.md`] — https://docs.google.com/document/d/1oIeRXqzTY-ehi3EKFmMDApNStNUflb6mWudEdIbrFOU/edit?usp=sharing (tài liệu thiết kế kiến trúc đầy đủ (Clean Architecture, RAG Pipeline, AI Workflow, State Machine, Database, REST API, Background Jobs, Observability, Kế hoạch triển khai theo Phase).
- Frontend Dashboard (project riêng `automation-agent-FE`) — Next.js App Router, xem README của project đó để biết cách kết nối.
