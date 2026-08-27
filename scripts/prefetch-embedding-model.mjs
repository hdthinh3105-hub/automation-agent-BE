import { pipeline, env } from '@xenova/transformers';

const model = process.env.EMBEDDING_MODEL ?? 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
env.cacheDir = './.transformers-cache';

console.log(`Prefetching embedding model "${model}"...`);
const extractor = await pipeline('feature-extraction', model);
await extractor(['warmup'], { pooling: 'mean', normalize: true });
console.log(`Model "${model}" cached to ./.transformers-cache`);
