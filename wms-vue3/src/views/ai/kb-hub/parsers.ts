/**
 * 本地文件 → KbDocument（纯前端解析，仅用于 demo 预览）。
 *   txt / md   直接读文本（UTF-8，失败回退 GBK），识别 Markdown 标题与中文章节编号
 *   docx       用 SheetJS 自带的 CFB 解 zip，读 word/document.xml + styles.xml（标题层级、表格）
 *   xlsx / csv SheetJS 读表，一行一块
 *   pdf        demo 未引入 PDF 解析库，返回示例内容并在 note 里注明（正式版由后端解析）
 */
import { CFB, read, utils } from 'xlsx';
import type { DocBlock, KbDocument } from './chunker';
import { SAMPLE_PDF_TEXT } from './samples';

export const ACCEPT_EXTS = ['pdf', 'txt', 'md', 'docx', 'xlsx', 'xls', 'csv'];
export const ACCEPT_ATTR = ACCEPT_EXTS.map(e => `.${e}`).join(',');
export const MAX_FILE_MB = 50;

let seq = 0;
export function newDocId(): string {
  seq += 1;
  return `doc_${Date.now().toString(36)}_${seq}`;
}

export function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

// ── 纯文本 ──

const CN_NUM = '[一二三四五六七八九十百零〇\\d]+';
const HEADING_RULES: Array<[RegExp, number]> = [
  [new RegExp(`^第${CN_NUM}[章篇部]`), 1],
  [new RegExp(`^第${CN_NUM}节`), 2],
  [/^[一二三四五六七八九十]+[、.．]/, 2],
  [/^[（(][一二三四五六七八九十]+[）)]/, 3],
];

function headingLevel(line: string): number {
  const md = /^(#{1,6})\s+/.exec(line);
  if (md) return md[1].length;
  // 标题行：短、不以句末标点结尾
  if (line.length > 40 || /[。；;，,：:]$/.test(line)) return 0;
  for (const [re, lv] of HEADING_RULES) if (re.test(line)) return lv;
  const num = /^(\d+(?:\.\d+){0,4})[\s、.．]/.exec(line);
  if (num && line.length <= 30) return num[1].split('.').length;
  return 0;
}

/** 文本 → 块：标题行单独成块；正文按空行分段，没有空行时一行一段 */
export function parsePlainText(text: string): DocBlock[] {
  const src = text.replace(/\r\n?/g, '\n');
  const hasBlank = /\n\s*\n/.test(src);
  const blocks: DocBlock[] = [];
  let buf: string[] = [];
  const flush = () => {
    const t = buf.join('\n').trim();
    if (t) blocks.push({ kind: 'para', text: t });
    buf = [];
  };
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const lv = headingLevel(line);
    if (lv) {
      flush();
      blocks.push({ kind: 'heading', level: lv, text: line.replace(/^#{1,6}\s+/, '') });
      continue;
    }
    buf.push(line);
    if (!hasBlank) flush();
  }
  flush();
  return blocks;
}

function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('gbk').decode(buf);
  }
}

// ── 表格 ──

export function rowsToBlocks(rows: string[][], title?: string): DocBlock[] {
  const clean = rows
    .map(r => r.map(c => String(c ?? '').trim()))
    .filter(r => r.some(Boolean));
  if (!clean.length) return [];
  const blocks: DocBlock[] = title ? [{ kind: 'heading', level: 1, text: title }] : [];
  const [header, ...body] = clean;
  const cols = header.map((h, i) => h || `列${i + 1}`);
  if (!body.length) {
    blocks.push({ kind: 'para', text: header.filter(Boolean).join(' ') });
    return blocks;
  }
  for (const r of body) {
    const pairs = cols.map((h, i) => (r[i] ? `${h}：${r[i]}` : '')).filter(Boolean);
    if (pairs.length) blocks.push({ kind: 'table', text: pairs.join('；'), cells: cols.map((_, i) => r[i] || ''), header: cols });
  }
  return blocks;
}

function parseSheet(buf: ArrayBuffer): DocBlock[] {
  const wb = read(buf, { type: 'array' });
  const multi = wb.SheetNames.length > 1;
  return wb.SheetNames.flatMap((name) => {
    const rows = utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, defval: '', raw: false });
    return rowsToBlocks(rows, multi ? name : undefined);
  });
}

// ── DOCX ──

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function zipText(zip: unknown, path: string): string {
  const ent = CFB.find(zip, path);
  if (!ent?.content) return '';
  return new TextDecoder('utf-8').decode(ent.content as Uint8Array);
}

function wAttr(el: Element | null | undefined, name: string): string {
  return el?.getAttributeNS(W, name) || el?.getAttribute(`w:${name}`) || '';
}

function child(el: Element, local: string): Element | null {
  for (const c of Array.from(el.children)) if (c.localName === local) return c;
  return null;
}

/** styles.xml：styleId → 标题层级（按样式名 Heading N / 标题 N / Title，或 outlineLvl） */
function headingStyles(xml: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!xml) return map;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  for (const st of Array.from(doc.getElementsByTagNameNS(W, 'style'))) {
    const id = wAttr(st, 'styleId');
    const name = wAttr(child(st, 'name'), 'val');
    const m = /(?:heading|标题)\s*(\d)/i.exec(name);
    const outline = child(st, 'pPr') && child(child(st, 'pPr')!, 'outlineLvl');
    let lv = 0;
    if (m) lv = Number(m[1]);
    else if (/^title$/i.test(name)) lv = 1;
    else if (outline) lv = Number(wAttr(outline, 'val')) + 1;
    if (id && lv > 0 && lv <= 9) map.set(id, lv);
  }
  return map;
}

function runText(p: Element): string {
  let s = '';
  const walk = (el: Element) => {
    for (const c of Array.from(el.children)) {
      if (c.localName === 't') s += c.textContent || '';
      else if (c.localName === 'tab') s += '\t';
      else if (c.localName === 'br' || c.localName === 'cr') s += '\n';
      else walk(c);
    }
  };
  walk(p);
  return s.trim();
}

function parseDocx(buf: ArrayBuffer): DocBlock[] {
  const zip = CFB.read(new Uint8Array(buf), { type: 'array' });
  const xml = zipText(zip, '/word/document.xml');
  if (!xml) throw new Error('不是有效的 DOCX（缺少 word/document.xml）');
  const styles = headingStyles(zipText(zip, '/word/styles.xml'));
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) return [];
  const blocks: DocBlock[] = [];
  for (const el of Array.from(body.children)) {
    if (el.localName === 'p') {
      const text = runText(el);
      if (!text) continue;
      const pPr = child(el, 'pPr');
      const styleId = wAttr(pPr && child(pPr, 'pStyle'), 'val');
      const outline = pPr && child(pPr, 'outlineLvl');
      const lv = styles.get(styleId) || (outline ? Number(wAttr(outline, 'val')) + 1 : 0);
      blocks.push(lv ? { kind: 'heading', level: lv, text } : { kind: 'para', text });
    } else if (el.localName === 'tbl') {
      const rows = Array.from(el.children)
        .filter(r => r.localName === 'tr')
        .map(tr => Array.from(tr.children).filter(c => c.localName === 'tc').map(runText));
      blocks.push(...rowsToBlocks(rows));
    }
  }
  return blocks;
}

// ── 入口 ──

export async function parseFile(file: File): Promise<KbDocument> {
  const ext = fileExt(file.name);
  if (!ACCEPT_EXTS.includes(ext)) throw new Error(`不支持的格式 .${ext || '?'}`);
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`文件超过 ${MAX_FILE_MB} MB`);
  const base = { id: newDocId(), name: file.name, ext, size: file.size, source: 'file' as const };
  if (ext === 'pdf') {
    return {
      ...base,
      blocks: parsePlainText(SAMPLE_PDF_TEXT),
      note: 'demo 未接入 PDF 文本提取，以下为示例内容；正式版由后端解析（含 OCR 与版面识别）',
    };
  }
  const buf = await file.arrayBuffer();
  let blocks: DocBlock[];
  if (ext === 'docx') blocks = parseDocx(buf);
  else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') blocks = parseSheet(buf);
  else blocks = parsePlainText(decodeText(buf));
  if (!blocks.length) throw new Error('未提取到文本内容');
  return { ...base, blocks };
}

export function textDocument(title: string, text: string): KbDocument {
  return {
    id: newDocId(),
    name: title.trim() || '自定义文本',
    ext: 'text',
    size: new TextEncoder().encode(text).length,
    source: 'text',
    blocks: parsePlainText(text),
  };
}
