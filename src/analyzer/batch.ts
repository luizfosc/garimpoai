import { Analyzer } from './analyzer';
import { isLimitReached } from './cost-tracker';
import { GarimpoAIConfig } from '../types/config';

const CHUNK_SIZE = 3;

export interface BatchResult {
  id: string;
  resumo?: string;
  dificuldade?: string;
  proximoPasso?: string;
  cached?: boolean;
  error?: string;
}

export interface BatchAnalysisResult {
  results: BatchResult[];
  completed: number;
  total: number;
  stoppedByLimit: boolean;
}

/** Process a chunk of IDs in parallel */
async function processChunk(
  ids: string[],
  analyzer: Analyzer,
  dataDir: string,
  maxPerDay: number,
  onProgress?: (completed: number, total: number) => void,
  offset: number = 0,
  totalCount: number = 0,
): Promise<{ results: BatchResult[]; limitReached: boolean }> {
  const results: BatchResult[] = [];
  let limitReached = false;

  const promises = ids.map(async (id) => {
    // Check limit before each analysis
    if (isLimitReached(dataDir, maxPerDay)) {
      limitReached = true;
      return { id, error: 'Limite diario atingido' } as BatchResult;
    }

    try {
      const result = await analyzer.analyze(id);
      return {
        id,
        resumo: result.analise.resumo,
        dificuldade: result.analise.dificuldade,
        proximoPasso: result.analise.proximoPasso,
        cached: result.cached,
      } as BatchResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { id, error: msg } as BatchResult;
    }
  });

  const chunkResults = await Promise.all(promises);
  results.push(...chunkResults);

  if (onProgress) {
    onProgress(offset + results.length, totalCount);
  }

  return { results, limitReached };
}

/** Analyze multiple licitacoes in batch */
export async function analyzeBatch(
  ids: string[],
  config: GarimpoAIConfig,
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchAnalysisResult> {
  const analyzer = new Analyzer(config);
  const allResults: BatchResult[] = [];
  let stoppedByLimit = false;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    // Check limit before starting chunk
    if (isLimitReached(config.dataDir, config.ia.maxPerDay)) {
      stoppedByLimit = true;
      break;
    }

    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { results, limitReached } = await processChunk(
      chunk,
      analyzer,
      config.dataDir,
      config.ia.maxPerDay,
      onProgress,
      i,
      ids.length,
    );

    allResults.push(...results);

    if (limitReached) {
      stoppedByLimit = true;
      break;
    }
  }

  return {
    results: allResults,
    completed: allResults.filter(r => !r.error).length,
    total: ids.length,
    stoppedByLimit,
  };
}
