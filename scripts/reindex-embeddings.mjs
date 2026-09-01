/**
 * Re-index toàn bộ embedding của Knowledge Documents bằng model embedding
 * HIỆN TẠI (lấy từ env `EMBEDDING_PROVIDER`/`EMBEDDING_DIMENSIONS`).
 *
 * Vì sao cần: khi đổi embedding model (vd local 384 -> Gemini 3072), các
 * `ChunkEmbedding` cũ vẫn giữ số chiều cũ -> RAG query lỗi
 * "different vector dimensions X and Y". Script này:
 *   1. Xoá toàn bộ `chunk_embeddings` cũ.
 *   2. Đặt các document (PENDING/PROCESSING/READY) về PROCESSING để tạm
 *      ẩn khỏi RAG query (vectorSearch chỉ tìm doc READY), tránh lỗi chiều
 *      giữa chừng.
 *   3. Enqueue 1 job `embed` cho từng document vào queue "embedding".
 *      Worker (EmbeddingProcessor) sẽ embed lại bằng model hiện tại và set
 *      status = READY.
 *
 * Idempotent: chạy lại nhiều lần đều an toàn (chunk đã embed bị bỏ qua bởi
 * EmbedChunksUseCase).
 *
 * Yêu cầu env: REDIS_URL (để đẩy job) + DATABASE_URL. Chạy trong môi trường
 * có node_modules + source (vd local `npm install`, hoặc trong container dev)
 * với env trỏ về đúng production nếu muốn re-index trên server.
 *
 *   npm run reindex:embeddings
 *
 * Lưu ý file .mjs (ESM) giống `prefetch-embedding-model.mjs`: không bị `tsc`
 * quét trong CI typecheck, chạy trực tiếp bằng `node`.
 */
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const EMBEDDING_QUEUE = 'embedding';

async function main() {
  const prisma = new PrismaClient();
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is not set — cannot enqueue embedding jobs.');
  }

  // 1) Xoá toàn bộ embedding cũ (sai chiều/model)
  const deleted = await prisma.$executeRawUnsafe('DELETE FROM chunk_embeddings');
  console.log(`Deleted ${deleted} old chunk_embeddings.`);

  // 2) Tìm các document cần re-embed (loại trừ FAILED + đã xoá mềm)
  const docs = await prisma.knowledgeDocument.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PENDING', 'PROCESSING', 'READY'] },
    },
    select: { id: true, title: true },
  });
  console.log(`Found ${docs.length} document(s) to re-embed.`);

  // 3) Tạm kéo về PROCESSING để khỏi xuất hiện trong RAG query giữa chừng
  if (docs.length > 0) {
    await prisma.knowledgeDocument.updateMany({
      where: { id: { in: docs.map((d) => d.id) } },
      data: { status: 'PROCESSING' },
    });
  }

  // 4) Enqueue job embedding cho từng document
  const queue = new Queue(EMBEDDING_QUEUE, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
  });
  try {
    for (const doc of docs) {
      await queue.add('embed', { documentId: doc.id });
      console.log(`  -> enqueued embed for "${doc.title}" (${doc.id})`);
    }
  } finally {
    await queue.close();
  }

  await prisma.$disconnect();
  console.log(
    '✅ Done. Worker will re-embed using the current model. Check worker logs for progress.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
