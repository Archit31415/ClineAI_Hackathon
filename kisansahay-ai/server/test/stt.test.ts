import { afterEach, describe, expect, it, vi } from "vitest";

// Replace the real model with a fake so tests don't download ~150 MB.
vi.mock("../src/voice/whisper_local", async (orig) => {
  const real = await orig<typeof import("../src/voice/whisper_local")>();
  return {
    ...real,
    localWhisperReady: () => true,
    warmUpLocalWhisper: () => undefined,
    transcribeLocal: vi.fn(async (pcm: Float32Array, lang: string) => `heard ${pcm.length} samples in ${lang}`),
  };
});

const { decodePcm, cleanTranscript, isSilent } = await import("../src/voice/whisper_local");
const { pcmToWav, sttStatus, transcribe } = await import("../src/voice/stt");
const { post } = await import("./app");

function s16(seconds: number): string {
  const n = Math.round(seconds * 16000);
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / 10) * 8000), i * 2);
  return buf.toString("base64");
}

afterEach(() => { delete process.env.STT_PROVIDER; });

describe("speech-to-text", () => {
  it("defaults to the free local Whisper provider (no key needed)", () => {
    expect(sttStatus()).toMatchObject({ provider: "local", model: "onnx-community/whisper-small" });
  });

  it("decodes 16-bit PCM to normalised floats", () => {
    const f = decodePcm(Buffer.from([0x00, 0x40, 0x00, 0xc0]).toString("base64"), "s16");
    expect(Array.from(f)).toEqual([0.5, -0.5]);
  });

  it("transcribes browser PCM through the local model", async () => {
    expect(await transcribe({ lang: "as", pcm_base64: s16(1) })).toBe("heard 16000 samples in as");
  });

  it("filters Whisper hallucinations on non-speech but keeps real sentences", () => {
    expect(cleanTranscript("अप ".repeat(80))).toBe(""); // what a test tone produced in Chrome
    expect(cleanTranscript(" [BLANK_AUDIO] ")).toBe("");
    expect(cleanTranscript("...")).toBe("");
    expect(cleanTranscript("अप अद अब अगर अव अत अन")).toBe(""); // babble seen on a test tone
    expect(cleanTranscript("मैं लक्नो से हूँ एक एक तेर गे हूँ है प्यम किसान की किस्त नहीं आई")).not.toBe(""); // real Hindi
    expect(cleanTranscript("मेरी गाय को बुखार है बुखार बुखार बुखार")).toBe("मेरी गाय को बुखार है बुखार बुखार");
    expect(cleanTranscript("My cow has fever and lumps on the skin.")).toBe("My cow has fever and lumps on the skin.");
  });

  it("silence never reaches the model", async () => {
    expect(isSilent(new Float32Array(16000))).toBe(true);
    const silent = Buffer.alloc(32000).toString("base64");
    expect(await transcribe({ lang: "hi", pcm_base64: silent })).toBe("");
  });

  it("rejects clips that are too short or too long", async () => {
    expect(await transcribe({ lang: "hi", pcm_base64: s16(0.05) })).toBeNull();
    expect(await transcribe({ lang: "hi", pcm_base64: s16(61) })).toBeNull();
  });

  it("openai provider without a key is reported as off", () => {
    process.env.STT_PROVIDER = "openai";
    expect(sttStatus().provider).toBe("none");
  });

  it("builds a valid WAV header for the OpenAI path", () => {
    const wav = pcmToWav(new Float32Array(160));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(16000);
    expect(wav.length).toBe(44 + 320);
  });

  it("a real whisper-small Hindi transcript (with ASR spellings) still fills the profile", async () => {
    // Exact output of onnx-community/whisper-small for "मैं लखनऊ से हूँ। एक हेक्टेयर गेहूँ है। पीएम किसान की किस्त नहीं आई।"
    const asr = "मैं लक्नो से हूँ एक एक तेर गे हूँ है प्यम किसान की किस्त नहीं आई";
    const { body } = await post<{ profile: Record<string, unknown>; intents: string[] }>("/api/interview/turn", {
      session_id: "stt-asr", lang: "hi", user_text: asr, profile: { lang: "hi" },
    });
    expect(body.profile).toMatchObject({ district: "Lucknow", state: "Uttar Pradesh", crops: ["wheat"], pain_point: "stuck_payment" });
    expect(body.intents).toContain("schemes");
  });

  it("POST /api/stt returns text; disabled provider returns a clear 503", async () => {
    const ok = await post<{ text: string; provider: string }>("/api/stt", { lang: "hi", pcm_base64: s16(1), pcm_format: "s16" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ text: "heard 16000 samples in hi", provider: "local" });
    process.env.STT_PROVIDER = "none";
    const off = await post<{ error: { code: string } }>("/api/stt", { lang: "hi", pcm_base64: s16(1) });
    expect(off.status).toBe(503);
    expect(off.body.error.code).toBe("stt_unavailable");
  });
});
