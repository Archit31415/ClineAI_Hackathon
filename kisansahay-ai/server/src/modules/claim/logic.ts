/**
 * Claim Assistant deterministic pieces: reporting window, deadline, evidence checklist, channels.
 */
import type { ClaimBody, ClaimInput, FarmerProfile, I18n } from "@kisansahay/contracts";
import { addHours, now } from "../../lib/clock";
import { t } from "../../lib/i18n";
import { readJson } from "../../lib/paths";
import { hoursBetween } from "../../rules/deadlines";

export interface ChannelsFile {
  report_window_hours: Record<string, number>;
  report_window_source: { label: string; url: string; verified_on: string };
  channels: { id: string; label: I18n; value: string; verified_on: string }[];
  evidence_shots: { shot_type: string; label: I18n }[];
}

export const LOSS_WORD: Record<string, I18n> = {
  hail: t("hail", "ओलावृष्टि", "শিলাবৃষ্টি"),
  flood: t("flood", "बाढ़", "বানপানী"),
  drought: t("drought", "सूखा", "খৰাং"),
  pest: t("pest attack", "कीट प्रकोप", "পোক-পতংগৰ আক্ৰমণ"),
  other: t("crop", "फसल", "শস্য"),
};

export function loadClaimData(): ChannelsFile {
  return readJson<ChannelsFile>("claim", "channels.json");
}

export function reportWindowHours(data: ChannelsFile, profile: FarmerProfile): number {
  return data.report_window_hours[profile.loss_event?.type ?? "other"] ?? 72;
}

export function computeDeadline(profile: FarmerProfile, windowH: number): ClaimBody["deadline"] {
  const occurred = profile.loss_event?.occurred_at;
  if (occurred && windowH > 0) {
    const due = addHours(occurred, windowH);
    const hl = hoursBetween(now(), due);
    return { due_at: due, hours_left: Math.max(0, hl), expired: hl < 0 };
  }
  // drought / area-wide events: no individual intimation window
  return { due_at: occurred ?? now().toISOString(), hours_left: 0, expired: false };
}

export function evidenceChecklist(data: ChannelsFile, evidence: ClaimInput["evidence"]): ClaimBody["evidence_checklist"] {
  const done = new Set<string>(evidence.map((e) => e.shot_type));
  return data.evidence_shots.map((s) => ({ shot_type: s.shot_type, label: s.label, done: done.has(s.shot_type) }));
}

export function channelsFor(data: ChannelsFile): ClaimBody["channels"] {
  return data.channels.map((c) => ({
    label: c.label,
    value: c.verified_on === "TODO_VERIFY" ? `${c.value} (verify before use)` : c.value,
    verified_on: c.verified_on,
  }));
}

export const EXPIRED_MESSAGE = t(
  "The usual reporting window has passed. Report anyway today and contact your insurer, bank or agriculture office — late reports are sometimes still considered.",
  "सामान्य सूचना अवधि बीत चुकी है। फिर भी आज ही सूचना दें और बीमा कंपनी, बैंक या कृषि कार्यालय से संपर्क करें — देर की सूचना पर भी कभी-कभी विचार होता है।",
  "সাধাৰণ জনোৱাৰ সময় পাৰ হৈ গৈছে। তথাপি আজিয়েই জনাওক আৰু বীমা কোম্পানী, বেংক বা কৃষি কাৰ্যালয়ৰ সৈতে যোগাযোগ কৰক — পলমৰ খবৰো কেতিয়াবা বিবেচনা কৰা হয়।",
);
