/**
 * 知识库数据中台 demo —— 切片引擎（纯前端实现，只服务「处理前预览」与参数调试）。
 * 正式处理以后端为准；这里的参数语义即前后端约定的目标契约（见 ProcessConfig 注释）。
 */

export type BlockKind = 'heading' | 'para' | 'table';
/**
 * 文档块。表格按「一行一块」展开：text 为「列名：值；列名：值」便于检索，
 * cells/header 只给原文预览还原表格用（相邻且 header 相同的行合并成一张表）。
 */
export interface DocBlock { kind: BlockKind; text: string; level?: number; cells?: string[]; header?: string[] }

export interface KbDocument {
  id: string;
  name: string;
  ext: string;               // pdf / docx / txt / md / xlsx / csv / text
  size: number;              // 字节；自定义文本按 UTF-8 估算
  source: 'file' | 'text';
  blocks: DocBlock[];
  note?: string;             // 解析提示（如 PDF 为模拟提取）
}

export type StoreMode = 'chunk' | 'whole' | 'qa';
export type ChunkTrigger = 'force' | 'length';
export type SplitBy = 'paragraph' | 'length' | 'separator';
export type Precision = 'coarse' | 'standard' | 'fine' | 'custom';

export interface ProcessConfig {
  storeMode: StoreMode;      // 处理方式：分块存储 / 整篇存储 / 问答对拆分
  trigger: ChunkTrigger;     // 分块条件：强制分块 / 原文长度大于 triggerLength 才分块
  triggerLength: number;
  splitBy: SplitBy;          // 分块方式：按段落 / 按长度 / 按分隔符
  separators: string[];      // 按分隔符时的优先级列表（逐级回退）
  keepSeparator: boolean;
  precision: Precision;      // 切片精度预设，选定后回填下面三个数
  maxChunkSize: number;      // 最大分块大小（字）
  overlap: number;           // 相邻分块重叠（字）
  minChunkSize: number;      // 过短分块并入前一块（字）
  maxDepth: number;          // 最大段落深度：标题层级 ≤ 该值才切节；0 = 不按标题分节
  titleToIndex: boolean;     // 索引增强：标题路径写入索引
  autoIndex: boolean;        // 索引增强：自动生成关键词 + 摘要
  indexSize: number;         // 索引大小（字），超出截断
  cleanWhitespace: boolean;
  removeUrls: boolean;
  dedupe: boolean;
  embeddingModel: string;
}

export interface KbChunk {
  id: string;
  seq: number;
  text: string;
  headingPath: string[];
  overlapHead: number;       // 开头多少字是与上一块的重叠（预览高亮用）
  indexText: string;
  indexPrefixLen: number;    // indexText 开头多少字是增强内容（预览高亮用）
  keywords: string[];
  chars: number;
  tokens: number;
  qa?: { q: string; a: string };
}

export interface ChunkResult {
  chunks: KbChunk[];
  totalChars: number;
  mode: 'chunked' | 'whole' | 'qa';
  reason: string;            // 为什么是这个结果（如「原文 320 字 ≤ 500，未触发分块」）
}

export const PRECISION_PRESETS = {
  coarse: { label: '粗粒度', hint: '长上下文，适合制度/手册', maxChunkSize: 1200, overlap: 120, minChunkSize: 200 },
  standard: { label: '标准', hint: '通用问答', maxChunkSize: 600, overlap: 60, minChunkSize: 80 },
  fine: { label: '精细', hint: '短事实、参数检索', maxChunkSize: 300, overlap: 30, minChunkSize: 40 },
} as const;

export const SEPARATOR_PRESETS = [
  { value: '\n\n', label: '空行', code: '\\n\\n' },
  { value: '\n', label: '换行', code: '\\n' },
  { value: '。', label: '句号', code: '。' },
  { value: '；', label: '分号', code: '；' },
  { value: '！', label: '感叹号', code: '！' },
  { value: '？', label: '问号', code: '？' },
];

export const EMBEDDING_MODELS = [
  { value: 'bge-m3', label: 'BGE-M3（多语言）', dims: 1024 },
  { value: 'text-embedding-v3', label: '通义 text-embedding-v3', dims: 1024 },
  { value: 'doubao-embedding', label: '豆包 Embedding', dims: 2048 },
  { value: 'm3e-base', label: 'M3E-Base（轻量）', dims: 768 },
];

export function defaultConfig(): ProcessConfig {
  return {
    storeMode: 'chunk',
    trigger: 'force',
    triggerLength: 800,
    splitBy: 'paragraph',
    separators: ['\n\n', '。'],
    keepSeparator: true,
    precision: 'standard',
    maxChunkSize: 600,
    overlap: 60,
    minChunkSize: 80,
    maxDepth: 3,
    titleToIndex: true,
    autoIndex: false,
    indexSize: 400,
    cleanWhitespace: true,
    removeUrls: false,
    dedupe: true,
    embeddingModel: 'bge-m3',
  };
}

/** 分隔符显示码：换行类转义成 \n，其余原样 */
export function separatorCode(sep: string): string {
  return sep.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}
/** 用户输入的分隔符码还原成真实字符 */
export function parseSeparatorCode(code: string): string {
  return code.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

// ── 工具 ──

export function docChars(doc: KbDocument): number {
  return doc.blocks.reduce((n, b) => n + b.text.length, 0);
}

export function estimateTokens(text: string): number {
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  return Math.ceil(cjk * 0.7 + (text.length - cjk) / 4);
}

const STOP = new Set(('我们 你们 他们 以及 或者 并且 如果 可以 进行 需要 应当 应该 其中 对于 相关 通过 包括 按照 根据 '
  + '一个 这个 那个 没有 已经 以上 以下 之后 之前 时候 必须 不得 由于 因此 所以 同时 每个 所有 以便 要求 情况').split(' '));

let segmenter: Intl.Segmenter | null = null;
export function extractKeywords(text: string, n = 5): string[] {
  let words: string[];
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    segmenter ||= new Intl.Segmenter('zh', { granularity: 'word' });
    words = Array.from(segmenter.segment(text)).filter(s => s.isWordLike).map(s => s.segment);
  } else {
    words = text.split(/[^\p{L}\p{N}]+/u);
  }
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 2 || STOP.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, n)
    .map(e => e[0]);
}

function firstSentence(text: string, max = 60): string {
  const m = text.replace(/\s+/g, ' ').match(/^.*?[。！？!?]/);
  const s = (m ? m[0] : text).trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

const SENTENCE_END = /[。！？；!?;\n]/;
/** 超长文本硬切：优先在 [60%, 100%] 区间内最后一个句末标点处断开 */
function hardCut(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = -1;
    for (let i = max; i >= Math.floor(max * 0.6); i--) {
      if (SENTENCE_END.test(rest[i - 1])) { cut = i; break; }
    }
    if (cut < 0) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) out.push(rest);
  return out;
}

/** 把小片段贪心装箱到 max 以内；单片超长先硬切 */
function pack(pieces: string[], max: number, joiner: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const p of pieces) {
    for (const part of (p.length > max ? hardCut(p, max) : [p])) {
      if (!buf) buf = part;
      else if (buf.length + joiner.length + part.length <= max) buf += joiner + part;
      else { out.push(buf); buf = part; }
    }
  }
  if (buf) out.push(buf);
  return out;
}

/** 按分隔符逐级拆：先用第一个分隔符，仍超长的片段再用下一个，全部用完则硬切 */
function splitBySeparators(text: string, seps: string[], keep: boolean, max: number): string[] {
  if (!seps.length) return hardCut(text, max);
  const [sep, ...rest] = seps;
  const raw = text.split(sep);
  const pieces = raw
    .map((s, i) => (keep && i < raw.length - 1 ? s + sep : s))
    .filter(s => s.trim());
  return pieces.flatMap(p => (p.length > max ? splitBySeparators(p, rest, keep, max) : [p]));
}

/** 过短片段并入前一块（合并后不超过 max 才并，保证最大分块大小是硬上限） */
function mergeShort(pieces: string[], min: number, joiner: string, max: number): string[] {
  const out: string[] = [];
  const fits = (a: string, b: string) => a.length + joiner.length + b.length <= max;
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last !== undefined && p.length < min && fits(last, p)) out[out.length - 1] = last + joiner + p;
    else out.push(p);
  }
  // 首块过短：并入第二块
  if (out.length > 1 && out[0].length < min && fits(out[0], out[1])) out.splice(0, 2, out[0] + joiner + out[1]);
  return out;
}

function preprocess(blocks: DocBlock[], cfg: ProcessConfig): DocBlock[] {
  const seen = new Set<string>();
  const out: DocBlock[] = [];
  for (const b of blocks) {
    let t = b.text;
    if (cfg.removeUrls) t = t.replace(/https?:\/\/\S+|www\.\S+/g, '');
    if (cfg.cleanWhitespace) t = t.replace(/[ \t　]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!t.trim()) continue;
    if (cfg.dedupe && b.kind !== 'heading') {
      if (seen.has(t)) continue;
      seen.add(t);
    }
    out.push({ ...b, text: t });
  }
  return out;
}

interface Section { path: string[]; paras: string[] }

/** 按标题切节：层级 ≤ maxDepth 的标题开新节，更深的标题按普通段落处理 */
function buildSections(blocks: DocBlock[], maxDepth: number): Section[] {
  const sections: Section[] = [];
  const stack: string[] = [];
  let cur: Section = { path: [], paras: [] };
  for (const b of blocks) {
    const lv = b.level ?? 1;
    if (b.kind === 'heading' && lv <= maxDepth) {
      if (cur.paras.length) sections.push(cur);
      stack.length = Math.min(stack.length, lv - 1);
      stack[lv - 1] = b.text;
      cur = { path: stack.filter(Boolean), paras: [] };
    } else {
      cur.paras.push(b.text);
    }
  }
  if (cur.paras.length) sections.push(cur);
  return sections;
}

interface Draft { text: string; path: string[]; overlapHead: number; qa?: { q: string; a: string } }

function sectionDrafts(sec: Section, cfg: ProcessConfig): Draft[] {
  const max = Math.max(50, cfg.maxChunkSize);
  const overlap = Math.min(cfg.overlap, Math.floor(max / 2));
  if (cfg.splitBy === 'length') {
    const text = sec.paras.join('\n');
    const step = Math.max(1, max - overlap);
    const out: Draft[] = [];
    for (let i = 0; i < text.length; i += step) {
      out.push({ text: text.slice(i, i + max), path: sec.path, overlapHead: i === 0 ? 0 : overlap });
      if (i + max >= text.length) break;
    }
    return out;
  }
  // 最大分块大小含重叠：正文装箱上限 = max - overlap，拼上前一块尾部后总长 ≤ max
  const body = Math.max(30, max - overlap);
  let pieces: string[];
  let joiner = '\n';
  if (cfg.splitBy === 'separator') {
    const seps = cfg.separators.filter(Boolean);
    pieces = splitBySeparators(sec.paras.join('\n'), seps, cfg.keepSeparator, body);
    joiner = cfg.keepSeparator ? '' : '\n';
  } else {
    pieces = sec.paras;
  }
  const packed = mergeShort(pack(pieces, body, joiner), cfg.minChunkSize, joiner, body);
  return packed.map((text, i) => {
    if (i === 0 || overlap <= 0) return { text, path: sec.path, overlapHead: 0 };
    const tail = packed[i - 1].slice(-overlap);
    return { text: tail + text, path: sec.path, overlapHead: tail.length };
  });
}

function qaDrafts(sec: Section, cfg: ProcessConfig): Draft[] {
  const title = sec.path[sec.path.length - 1];
  const q = title
    ? (/[？?]$/.test(title) ? title : `关于「${sec.path.join(' / ')}」有哪些规定？`)
    : firstSentence(sec.paras[0] || '', 40).replace(/[。！!]$/, '') + '？';
  const parts = pack(sec.paras, Math.max(50, cfg.maxChunkSize), '\n');
  return parts.map((a, i) => {
    const qq = parts.length > 1 ? `${q}（${i + 1}/${parts.length}）` : q;
    return { text: `问：${qq}\n答：${a}`, path: sec.path, overlapHead: 0, qa: { q: qq, a } };
  });
}

function finalize(drafts: Draft[], cfg: ProcessConfig): KbChunk[] {
  return drafts.map((d, i) => {
    const keywords = cfg.autoIndex ? extractKeywords(d.text) : [];
    const prefix: string[] = [];
    if (cfg.titleToIndex && d.path.length) prefix.push(`标题：${d.path.join(' > ')}`);
    if (cfg.autoIndex) {
      if (keywords.length) prefix.push(`关键词：${keywords.join('、')}`);
      prefix.push(`摘要：${firstSentence(d.qa ? d.qa.a : d.text)}`);
    }
    const head = prefix.join('\n');
    let indexText = head ? `${head}\n${d.text}` : d.text;
    if (indexText.length > cfg.indexSize) indexText = indexText.slice(0, cfg.indexSize) + '…';
    return {
      id: `c${i + 1}`,
      seq: i + 1,
      text: d.text,
      headingPath: d.path,
      overlapHead: d.overlapHead,
      indexText,
      indexPrefixLen: Math.min(head.length, indexText.length),
      keywords,
      chars: d.text.length,
      tokens: estimateTokens(d.text),
      qa: d.qa,
    };
  });
}

export function chunkDocument(doc: KbDocument, cfg: ProcessConfig): ChunkResult {
  const blocks = preprocess(doc.blocks, cfg);
  const totalChars = blocks.reduce((n, b) => n + b.text.length, 0);
  if (!blocks.length) return { chunks: [], totalChars: 0, mode: 'whole', reason: '清洗后无有效内容' };

  const whole = (reason: string): ChunkResult => ({
    chunks: finalize([{ text: blocks.map(b => b.text).join('\n'), path: [], overlapHead: 0 }], cfg),
    totalChars,
    mode: 'whole',
    reason,
  });
  if (cfg.storeMode === 'whole') return whole('整篇存储：全文作为 1 个分块');
  if (cfg.trigger === 'length' && totalChars <= cfg.triggerLength) {
    return whole(`原文 ${totalChars} 字 ≤ ${cfg.triggerLength} 字，未触发分块`);
  }

  if (cfg.storeMode === 'qa') {
    const sections = buildSections(blocks, Math.max(1, cfg.maxDepth));
    const chunks = finalize(sections.flatMap(s => qaDrafts(s, cfg)), cfg);
    return { chunks, totalChars, mode: 'qa', reason: `按标题拆出 ${chunks.length} 组问答` };
  }

  const sections = buildSections(blocks, cfg.maxDepth);
  const chunks = finalize(sections.flatMap(s => sectionDrafts(s, cfg)), cfg);
  const how = { paragraph: '按段落', length: '按长度', separator: '按分隔符' }[cfg.splitBy];
  return { chunks, totalChars, mode: 'chunked', reason: `${how}分块，共 ${sections.length} 节 → ${chunks.length} 块` };
}

export interface ChunkStats {
  count: number; avg: number; min: number; max: number; tokens: number; overLimit: number; tooShort: number;
}

export function chunkStats(chunks: KbChunk[], cfg: ProcessConfig): ChunkStats {
  if (!chunks.length) return { count: 0, avg: 0, min: 0, max: 0, tokens: 0, overLimit: 0, tooShort: 0 };
  const lens = chunks.map(c => c.chars);
  return {
    count: chunks.length,
    avg: Math.round(lens.reduce((a, b) => a + b, 0) / lens.length),
    min: Math.min(...lens),
    max: Math.max(...lens),
    tokens: chunks.reduce((n, c) => n + c.tokens, 0),
    overLimit: cfg.storeMode === 'chunk' ? lens.filter(l => l > cfg.maxChunkSize).length : 0,
    tooShort: cfg.storeMode === 'chunk' && chunks.length > 1 ? lens.filter(l => l < cfg.minChunkSize).length : 0,
  };
}
