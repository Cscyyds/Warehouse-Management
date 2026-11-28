type PartRow = {
  id: string;
  marker: string;
  name: string;
  model: string;
  applies_to: string[];
  common: boolean;
  source_id: string;
};

type PartReference = {
  slot: string;
  name: string;
  exact_row_ids: string[];
  candidate_row_ids: string[];
};

type InstallationItem = {
  text: string;
  source_ids: string[];
  template?: string;
  part_refs?: PartReference[];
};

type PartReview = { key: string; name: string; options: PartRow[]; message: string };
type RenderedItem = InstallationItem & { partReviews: PartReview[] };

type InstallationDraft = {
  installation_notes: InstallationItem[];
  steps: InstallationItem[];
  alternatives: InstallationItem[];
};

type InstallationResult = InstallationDraft & { parts?: PartRow[] };
type InstallationPreview = Record<keyof InstallationDraft, RenderedItem[]>;

export const INSTALLATION_GROUPS = [
  ['installation_notes', '安装要点'],
  ['steps', '安装步骤'],
  ['alternatives', '可选安装方案'],
] as const;

export const INSTALLATION_REGION_TYPES = {
  installation: '安装图（自动判断）',
  view: '安装视图',
  steps: '安装步骤图',
  parts: '配件表',
} as const;

export const KEEP_PART_NAME = 'name-only';
const GROUP_HEADINGS = new Set<string>(INSTALLATION_GROUPS.map(([, heading]) => heading));
const STEP_PREFIX = /^([0-9０-９]+)(?:[、)）]\s*|[.．](?![0-9０-９])\s*)/;

function normalize(line: string): string {
  return line.normalize('NFKC').trim();
}

function comparable(line: string): string {
  return normalize(line).replace(STEP_PREFIX, '')
    .replace(/\s+/g, '').replace(/[。.;；]+$/, '');
}

function modelKey(model: string): string {
  return normalize(model).replace(/\s+/g, '').toLowerCase();
}

export function renderInstallationForProduct(
  result: InstallationResult, productModel: string, choices: Record<string, string> = {},
): InstallationPreview {
  const model = modelKey(productModel);
  const rows = (result.parts ?? []).map(row => ({
    ...row,
    matchesModel: row.common || Boolean(model && row.applies_to.some(value => modelKey(value) === model)),
  })).filter(row => row.matchesModel || !model || !row.applies_to.length);
  const preview: InstallationPreview = { installation_notes: [], steps: [], alternatives: [] };

  for (const [group] of INSTALLATION_GROUPS) {
    preview[group] = result[group].map((item, index) => {
      const partReviews: PartReview[] = [];
      const sourceIds = new Set(item.source_ids);
      const replacements = new Map<string, string>();
      for (const ref of item.template ? item.part_refs ?? [] : []) {
        const key = `${group}-${index}-${ref.slot}`;
        const exact = rows.filter(row => ref.exact_row_ids.includes(row.id));
        const automatic = exact.length === 1 && exact[0].matchesModel && exact[0].model ? exact[0] : undefined;
        const candidates = rows.filter(row => ref.candidate_row_ids.includes(row.id));
        const options = candidates.filter(row => row.model);
        const choice = choices[key];
        const selected = automatic ?? options.find(row => row.id === choice);
        if (!automatic) {
          partReviews.push({ key, name: ref.name, options, message: candidates.length
            ? '配件表未标清型号，已保留配件名称' : '配件表中未找到适用型号，已保留配件名称' });
        }
        if (selected) sourceIds.add(selected.source_id);
        replacements.set(ref.slot, selected ? `${selected.name || ref.name}（${selected.model}）` : ref.name);
      }
      const text = replacements.size && item.template
        ? item.template.replace(/\[\[P[1-9][0-9]*\]\]/g, slot => replacements.get(slot) ?? slot)
        : item.text;
      return { ...item, text, source_ids: [...sourceIds], partReviews };
    });
  }

  return preview;
}

export function mergeInstallationText(currentText: string, draft: InstallationDraft): string {
  const existing = currentText.trim();
  const lines = existing ? existing.split(/\r?\n/) : [];
  const originalLineCount = lines.length;
  const seen = new Set(lines.map(comparable));
  let step = lines.reduce((last, line) => Math.max(last, Number(normalize(line).match(STEP_PREFIX)?.[1] || 0)), 0);

  for (const [group, heading] of INSTALLATION_GROUPS) {
    const additions: string[] = [];
    for (const item of draft[group]) {
      const text = item.text.trim();
      const key = comparable(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      additions.push(group === 'steps' ? `${++step}. ${text.replace(STEP_PREFIX, '')}` : text);
    }
    if (!additions.length) continue;

    const headingIndex = lines.findIndex(line => normalize(line) === heading);
    if (headingIndex === -1) {
      lines.push(heading, ...additions);
    } else {
      const nextHeading = lines.findIndex((line, index) => index > headingIndex && GROUP_HEADINGS.has(normalize(line)));
      let insertAt = nextHeading === -1 ? lines.length : nextHeading;
      while (insertAt > headingIndex + 1 && !lines[insertAt - 1].trim()) insertAt--;
      lines.splice(insertAt, 0, ...additions);
    }
  }

  return lines.length === originalLineCount ? existing : lines.join(existing.includes('\r\n') ? '\r\n' : '\n');
}
