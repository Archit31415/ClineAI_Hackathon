/**
 * Records the microphone with MediaRecorder, then decodes and resamples to 16 kHz mono 16-bit PCM
 * in the browser (OfflineAudioContext). That is exactly what Whisper expects, so the server needs
 * no ffmpeg. MediaRecorder is used instead of a live AudioContext graph because live graphs can be
 * suspended by the browser (no output device / power saving) and silently deliver no samples.
 */
export interface PcmRecording { stop(): Promise<Int16Array>; cancel(): void }

const TARGET_RATE = 16000;

function pickMime(): string | undefined {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return opts.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m));
}

async function toPcm16k(blob: Blob): Promise<Int16Array> {
  const bytes = await blob.arrayBuffer();
  const Off = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const decoded = await new Off(1, 1, 44100).decodeAudioData(bytes);
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const off = new Off(1, frames, TARGET_RATE); // mixes to mono + resamples
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = (await off.startRendering()).getChannelData(0);
  const out = new Int16Array(rendered.length);
  for (let i = 0; i < rendered.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(rendered[i] * 32767)));
  return out;
}

export async function startPcmRecording(maxMs = 15000, onAutoStop?: () => void): Promise<PcmRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start(250);
  const timer = setTimeout(() => onAutoStop?.(), maxMs);
  let done = false;

  const end = async () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    async stop() {
      await end();
      return toPcm16k(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }));
    },
    cancel: () => void end(),
  };
}

export function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
