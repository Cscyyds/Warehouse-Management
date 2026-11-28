/**
 * 预置知识库（demo）。每个文档都带正文（source）和入库时的参数快照（config），
 * 分块数、字数由切片引擎算出，与「查看分块」看到的结果一致。
 */
import { chunkDocument, defaultConfig } from './chunker';
import type { DocBlock, KbDocument, ProcessConfig, StoreMode } from './chunker';
import { parsePlainText, rowsToBlocks } from './parsers';
import {
  SAMPLE_CUSTOM_TEXT, SAMPLE_HAZMAT_TEXT, SAMPLE_INSTALL_TEXT, SAMPLE_PDF_TEXT, SAMPLE_STOCKTAKE_TEXT,
  SPEC_HEADER, sampleSpecRows,
} from './samples';

export type DocStatus = 'ready' | 'processing' | 'failed';

export interface KbDocRecord {
  id: string;
  name: string;
  ext: string;
  size: number;
  chunks: number;
  chars: number;
  status: DocStatus;
  progress?: number;
  error?: string;
  storeMode: string;
  updatedAt: number;
  source?: KbDocument;       // 原文（解析后的块）
  config?: ProcessConfig;    // 入库时的参数快照：查看分块按它重算
}

export interface KnowledgeBase {
  id: string;
  name: string;
  desc: string;
  embeddingModel: string;
  docs: KbDocRecord[];
}

export const STORE_MODE_LABEL: Record<StoreMode, string> = { chunk: '分块存储', whole: '整篇存储', qa: '问答对拆分' };

const DAY = 86_400_000;

interface SeedDoc {
  id: string;
  name: string;
  ext: string;
  size: number;
  blocks: DocBlock[];
  ago: number;
  config?: Partial<ProcessConfig>;
  status?: DocStatus;
  progress?: number;
  error?: string;
}

function seedDoc(s: SeedDoc, embeddingModel: string, now: number): KbDocRecord {
  const config: ProcessConfig = { ...defaultConfig(), embeddingModel, ...s.config };
  const source: KbDocument = {
    id: s.id, name: s.name, ext: s.ext, size: s.size, source: s.ext === 'text' ? 'text' : 'file', blocks: s.blocks,
  };
  const status = s.status || 'ready';
  const r = status === 'ready' ? chunkDocument(source, config) : null;
  return {
    id: s.id, name: s.name, ext: s.ext, size: s.size, status, progress: s.progress, error: s.error,
    chunks: r ? r.chunks.length : 0, chars: r ? r.totalChars : 0,
    storeMode: STORE_MODE_LABEL[config.storeMode], updatedAt: now - s.ago, source, config,
  };
}

function kb(id: string, name: string, desc: string, embeddingModel: string, docs: SeedDoc[], now: number): KnowledgeBase {
  return { id, name, desc, embeddingModel, docs: docs.map(d => seedDoc(d, embeddingModel, now)) };
}

export function seedKnowledgeBases(now: number): KnowledgeBase[] {
  return [
    kb('kb_ops', '仓储作业规范', '收发存作业制度、SOP 与岗位职责', 'bge-m3', [
      { id: 'd1', name: '仓库管理制度（2026 版）.pdf', ext: 'pdf', size: 386_000, blocks: parsePlainText(SAMPLE_PDF_TEXT), ago: 2 * DAY },
      {
        id: 'd2', name: '危险品存储操作规程.docx', ext: 'docx', size: 48_600, blocks: parsePlainText(SAMPLE_HAZMAT_TEXT), ago: 5 * DAY,
        config: { precision: 'fine', maxChunkSize: 300, overlap: 30, minChunkSize: 40, autoIndex: true },
      },
      {
        id: 'd3', name: '盘点作业指引.txt', ext: 'txt', size: 1_960, blocks: parsePlainText(SAMPLE_STOCKTAKE_TEXT), ago: 3_600_000,
        status: 'failed', error: '向量化服务超时（3 次重试后失败）',
      },
    ], now),
    kb('kb_product', '产品参数库', '产品规格表、技术参数与安装说明', 'text-embedding-v3', [
      {
        id: 'd4', name: '2026 春季产品规格表.xlsx', ext: 'xlsx', size: 18_400, blocks: rowsToBlocks([SPEC_HEADER, ...sampleSpecRows()]),
        ago: 8 * DAY, config: { precision: 'custom', maxChunkSize: 300, overlap: 0, minChunkSize: 0, maxDepth: 1 },
      },
      {
        id: 'd5', name: '门窗五金安装说明.pdf', ext: 'pdf', size: 2_480_000, blocks: parsePlainText(SAMPLE_INSTALL_TEXT), ago: 120_000,
        status: 'processing', progress: 62,
      },
    ], now),
    kb('kb_faq', '客服问答', '售后、退换货与物流常见问题', 'bge-m3', [
      { id: 'd6', name: '退换货政策 FAQ', ext: 'text', size: 1_120, blocks: parsePlainText(SAMPLE_CUSTOM_TEXT), ago: DAY, config: { storeMode: 'qa' } },
    ], now),
  ];
}
