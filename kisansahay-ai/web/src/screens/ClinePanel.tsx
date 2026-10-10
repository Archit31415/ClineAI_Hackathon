/**
 * Cline-in-product panel: Workflow A (ingest circular -> generated tests -> repair -> diff -> approve)
 * with live progress from the task API.
 */
import { useEffect, useState } from "react";
import type { ClineTaskStatus } from "@kisansahay/contracts/types";
import { Btn, Card, ErrorNote, ProvenanceBadge } from "../components/common";
import { api, pollTask } from "../lib/api";

interface Draft {
  draft_id: string; status: string; provenance: string;
  attempts: { attempt: number; passed: number; failed: number; failures: string[] }[];
  tests: { name: string; expect: string; source_quote?: string }[];
  test_results: { results: { name: string; expect: string; got: string; pass: boolean }[] };
  diff: { path: string; op: string; before?: unknown; after?: unknown }[];
  rule: { id: string; eligibility: unknown };
}

export function ClinePanel({ health }: { health?: { cline_mode: string; llm: string } }) {
  const [samples, setSamples] = useState<{ id: string; title: string }[]>([]);
  const [text, setText] = useState("");
  const [task, setTask] = useState<ClineTaskStatus<Draft> | null>(null);
  const [err, setErr] = useState("");
  const [approved, setApproved] = useState("");

  useEffect(() => { api.clineSamples().then(setSamples).catch(() => undefined); }, []);

  async function ingest(body: Parameters<typeof api.clineIngest>[0]) {
    setErr(""); setApproved(""); setTask(null);
    try {
      const { task_id } = await api.clineIngest(body);
      await pollTask<Draft>(task_id, setTask);
    } catch (e) { setErr((e as Error).message); }
  }

  async function approve(id: string) {
    try { await api.clineApprove(id, "reviewer"); setApproved(id); } catch (e) { setErr((e as Error).message); }
  }

  const d = task?.result;
  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-xl font-bold">🤖 Cline agent — rule ingestion (Workflow A)</h2>
        <p className="text-sm text-stone-600">A circular goes in → Cline drafts a rule citing page + quote → writes tests from the circular's own examples → runs them against our evaluator → repairs (max 3) → draft + diff → <b>human approves</b>.</p>
        <p className="mt-1 text-xs text-stone-500">Mode: <b>{health?.cline_mode ?? "?"}</b> · LLM: {health?.llm ?? "?"}</p>
        <div className="mt-3 space-y-2">
          {samples.map((s) => <Btn key={s.id} kind="ghost" className="w-full text-left" onClick={() => ingest({ sample_id: s.id })}>📄 {s.title}</Btn>)}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="…or paste circular text (needs CLINE_MODE=sdk)" className="w-full rounded-xl border p-2 text-sm" />
          <Btn disabled={!text.trim()} onClick={() => ingest({ text, target_rule_id: "pmkisan" })}>Ingest pasted text</Btn>
        </div>
      </Card>
      {err && <ErrorNote msg={err} />}
      {task && (
        <Card>
          <div className="flex items-center gap-2"><b>Task</b> <span className="text-sm">{task.status}</span> {task.provenance && <ProvenanceBadge p={task.provenance} />}</div>
          <ol className="mt-2 max-h-48 overflow-auto font-mono text-xs text-stone-700">
            {task.progress.map((p, i) => <li key={i}>{p.at.slice(11, 19)} {p.msg}</li>)}
          </ol>
          {task.error && <ErrorNote msg={task.error} />}
        </Card>
      )}
      {d && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold">Draft {d.draft_id}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.status === "tests_passing" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{d.status}</span>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Repair loop</h4>
            {d.attempts.map((a) => (
              <p key={a.attempt} className="text-sm">Attempt {a.attempt}: {a.passed}/{a.passed + a.failed} pass {a.failures.map((f, i) => <span key={i} className="block text-xs text-red-700">✗ {f}</span>)}</p>
            ))}
          </div>
          <div>
            <h4 className="text-sm font-semibold">Generated tests (from the circular's examples)</h4>
            <ul className="text-sm">{d.test_results.results.map((r) => <li key={r.name}>{r.pass ? "✅" : "❌"} {r.name} → {r.got}</li>)}</ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Diff vs current rule</h4>
            <pre className="max-h-56 overflow-auto rounded bg-stone-900 p-2 text-xs text-stone-100">
              {d.diff.length ? d.diff.map((x) => `${x.op === "added" ? "+" : x.op === "removed" ? "-" : "~"} ${x.path}: ${JSON.stringify(x.before ?? "")} → ${JSON.stringify(x.after ?? "")}`).join("\n") : "(no rule changes)"}
            </pre>
          </div>
          {approved === d.draft_id ? <p className="font-semibold text-green-700">✅ Approved and published</p> : (
            <Btn disabled={d.status !== "tests_passing"} onClick={() => approve(d.draft_id)}>👤 Approve & publish</Btn>
          )}
        </Card>
      )}
    </div>
  );
}
