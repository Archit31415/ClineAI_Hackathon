import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

let app: FastifyInstance | undefined;
export async function getApp(): Promise<FastifyInstance> {
  app ??= await buildApp();
  return app;
}

export async function post<T>(url: string, payload: unknown): Promise<{ status: number; body: T }> {
  const r = await (await getApp()).inject({ method: "POST", url, payload: payload as object });
  return { status: r.statusCode, body: r.json() as T };
}

export async function waitTask<T>(id: string): Promise<{ status: string; result: T; progress: { msg: string }[] }> {
  const a = await getApp();
  for (let i = 0; i < 300; i++) {
    const r = (await a.inject({ method: "GET", url: `/api/cline/tasks/${id}` })).json();
    if (r.status === "done" || r.status === "failed") return r;
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new Error("task timeout");
}
