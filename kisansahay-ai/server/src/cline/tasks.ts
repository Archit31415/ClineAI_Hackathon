/**
 * In-memory task store for async Cline workflows (GET /api/cline/tasks/:id polls this).
 */
import { randomUUID } from "node:crypto";
import type { ClineTaskStatus } from "@kisansahay/contracts";
import { nowIso } from "../lib/clock";
import type { ClineTaskKind } from "./adapter";

const tasks = new Map<string, ClineTaskStatus>();

export function createTask<R>(
  kind: ClineTaskKind,
  work: (progress: (msg: string) => void) => Promise<{ result: R; provenance: "cline-sdk" | "fixture" }>,
): string {
  const id = randomUUID();
  const task: ClineTaskStatus = { id, kind, status: "queued", progress: [] };
  tasks.set(id, task);
  const progress = (msg: string) => task.progress.push({ at: nowIso(), msg });
  queueMicrotask(async () => {
    task.status = "running";
    try {
      const { result, provenance } = await work(progress);
      task.result = result;
      task.provenance = provenance;
      task.status = "done";
      progress("done");
    } catch (e) {
      task.status = "failed";
      task.error = (e as Error).message;
      progress(`failed: ${task.error}`);
    }
  });
  return id;
}

export function getTask(id: string): ClineTaskStatus | undefined {
  return tasks.get(id);
}

/** Await a task (used by synchronous callers like the claim module and tests). */
export async function waitTask(id: string, timeoutMs = 30000): Promise<ClineTaskStatus> {
  const start = Date.now();
  for (;;) {
    const t = tasks.get(id);
    if (!t) throw new Error("unknown task");
    if (t.status === "done" || t.status === "failed") return t;
    if (Date.now() - start > timeoutMs) throw new Error("task wait timeout");
    await new Promise((r) => setTimeout(r, 25));
  }
}
