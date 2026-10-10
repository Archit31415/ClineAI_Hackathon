import { buildApp } from "./app";
import { sttStatus, warmUpStt } from "./voice/stt";

// Load the free local Whisper model in the background so the first voice request is fast.
warmUpStt();
console.log(`[stt] provider=${sttStatus().provider} model=${sttStatus().model ?? "-"}`);

const port = Number(process.env.PORT || 8787);
const app = await buildApp({ logger: true });
await app.listen({ port, host: "0.0.0.0" });
console.log(`KisanSahay-AI server on http://localhost:${port} (CLINE_MODE=${process.env.CLINE_MODE ?? "fixture"})`);
