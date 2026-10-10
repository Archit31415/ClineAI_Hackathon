/** Small structural JSON diff for rule review. */
export interface DiffEntry { path: string; op: "added" | "removed" | "changed"; before?: unknown; after?: unknown }

const IGNORE = new Set(["source", "review_status"]);

export function jsonDiff(before: unknown, after: unknown, path = ""): DiffEntry[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const isObj = (v: unknown) => v !== null && typeof v === "object";
  if (Array.isArray(before) && Array.isArray(after)) {
    const out: DiffEntry[] = [];
    const n = Math.max(before.length, after.length);
    for (let i = 0; i < n; i++) {
      const p = `${path}[${i}]`;
      if (i >= before.length) out.push({ path: p, op: "added", after: after[i] });
      else if (i >= after.length) out.push({ path: p, op: "removed", before: before[i] });
      else out.push(...jsonDiff(before[i], after[i], p));
    }
    return out;
  }
  if (isObj(before) && isObj(after) && !Array.isArray(before) && !Array.isArray(after)) {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    const out: DiffEntry[] = [];
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (!path && IGNORE.has(k)) continue;
      if (k === "label" || k === "source_quote" || k === "source_page") continue;
      const p = path ? `${path}.${k}` : k;
      if (!(k in b)) out.push({ path: p, op: "added", after: a[k] });
      else if (!(k in a)) out.push({ path: p, op: "removed", before: b[k] });
      else out.push(...jsonDiff(b[k], a[k], p));
    }
    return out;
  }
  return [{ path: path || "(root)", op: "changed", before, after }];
}
