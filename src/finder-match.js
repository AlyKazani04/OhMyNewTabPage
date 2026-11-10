// Pure matching helpers for the Ctrl+K finder. No imports, no DOM.

const SEP = ' › ';
const BOUNDARY = ' /-_.›:';

// Bookmark tree -> flat list of entries
export function buildIndex(roots) {
  const out = [];
  const walk = (node, ancestors, titles) => {
    if (node.description === 'separator') return;
    const isRoot = node.id === '0';
    if (!isRoot) {
      out.push({
        node,
        isFolder: !node.url,
        title: node.title || node.url || '',
        path: titles.join(SEP),
        ancestors,
        urlText: node.url ? node.url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '') : '',
      });
    }
    const nextA = isRoot ? ancestors : [...ancestors, node.id];
    const nextT = isRoot ? titles : [...titles, node.title || ''];
    for (const child of node.children || []) walk(child, nextA, nextT);
  };
  for (const root of roots) walk(root, [], []);
  return out;
}

// Single-term, case-insensitive, in-order match (fzf v1 style)
export function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return null;
  let qi = 0;
  let end = -1;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { qi++; end = i; }
  }
  if (qi < q.length) return null;

  // Backward pass: tightest start for the match that ends at `end`
  qi = q.length - 1;
  let start = end;
  for (let i = end; i >= 0 && qi >= 0; i--) {
    if (t[i] === q[qi]) { qi--; start = i; }
  }

  const positions = [];
  let score = 0;
  let prev = -2;
  qi = 0;
  for (let i = start; i <= end && qi < q.length; i++) {
    if (t[i] !== q[qi]) continue;
    const before = text[i - 1];
    const boundary = i === 0 || BOUNDARY.includes(before)
      || (before !== before.toUpperCase() && text[i] !== text[i].toLowerCase());
    score += 16 + (boundary ? 8 : 0);
    if (i === prev + 1) score += 4;
    else if (prev >= 0) score -= Math.min(i - prev - 1, 6);
    positions.push(i);
    prev = i;
    qi++;
  }
  return { score, positions };
}

// Best of title / path x0.7 / urlText x0.5 for one term
function bestField(term, entry) {
  const a = fuzzyMatch(term, entry.title);
  const b = entry.path ? fuzzyMatch(term, entry.path) : null;
  const c = entry.urlText ? fuzzyMatch(term, entry.urlText) : null;
  let best = null;
  if (a) best = { score: a.score, field: 'title', positions: a.positions };
  if (b && (!best || b.score * 0.7 > best.score)) best = { score: b.score * 0.7, field: 'path', positions: b.positions };
  if (c && (!best || c.score * 0.5 > best.score)) best = { score: c.score * 0.5, field: 'urlText', positions: c.positions };
  return best;
}

export function rankEntries(query, entries, limit = 50) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results = [];
  for (const entry of entries) {
    let score = 0;
    const hl = { title: new Set(), path: new Set() };
    let ok = true;
    for (const term of terms) {
      const m = bestField(term, entry);
      if (!m) { ok = false; break; }
      score += m.score;
      if (hl[m.field]) m.positions.forEach(p => hl[m.field].add(p));
    }
    if (!ok) continue;
    results.push({
      entry,
      score,
      highlights: {
        title: [...hl.title].sort((x, y) => x - y),
        path: [...hl.path].sort((x, y) => x - y),
      },
    });
  }
  results.sort((x, y) => y.score - x.score
    || x.entry.title.length - y.entry.title.length
    || x.entry.isFolder - y.entry.isFolder);
  return results.slice(0, limit);
}

// Which rendered column holds this chain, and which ids must be opened
export function pickColumn(chain, columns, showRoot) {
  for (let i = chain.length - 1; i >= 0; i--) {
    for (let x = 0; x < columns.length; x++) {
      if (columns[x].includes(chain[i])) {
        const start = columns[x].length === 1 && !showRoot ? i + 1 : i;
        return { x, start };
      }
    }
  }
  return null;
}
