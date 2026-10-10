/**
 * Claim Assistant (Deep). Deadline + evidence checklist + intimation draft via Cline Workflow B + channels.
 * Photos are never stored on the server: only shot types / hashes are used.
 */
import type { ActionItem, ClaimBody, ClaimInput, FarmerProfile, I18n, ModuleResult } from "@kisansahay/contracts";
import { fillForm } from "../../cline/fill";
import { envelope } from "../../lib/envelope";
import { t } from "../../lib/i18n";
import {
  channelsFor, computeDeadline, evidenceChecklist, EXPIRED_MESSAGE, loadClaimData, LOSS_WORD, reportWindowHours,
} from "./logic";

export async function runClaim(profile: FarmerProfile, input?: ClaimInput): Promise<ModuleResult<ClaimBody>> {
  const data = loadClaimData();
  const evidence = input?.evidence ?? [];
  const occurred = profile.loss_event?.occurred_at;
  const windowH = reportWindowHours(data, profile);
  const deadline = computeDeadline(profile, windowH);
  const evidence_checklist = evidenceChecklist(data, evidence);
  const intimation = await fillForm("pmfby_loss_intimation", profile, { evidence_count: evidence.length });
  const body: ClaimBody = { deadline, evidence_checklist, intimation, channels: channelsFor(data) };

  const word = LOSS_WORD[profile.loss_event?.type ?? "other"];
  const actions: ActionItem[] = [];
  let headline: I18n;

  if (!occurred) {
    headline = t("Tell us when the crop loss happened to start your claim", "दावा शुरू करने के लिए बताइए नुकसान कब हुआ", "দাবী আৰম্ভ কৰিবলৈ ক্ষতি কেতিয়া হৈছিল কওক");
  } else if (windowH === 0) {
    headline = t("Drought losses are assessed area-wide; keep records and contact the agriculture office",
      "सूखे का आकलन क्षेत्र-स्तर पर होता है; रिकॉर्ड रखें और कृषि कार्यालय से संपर्क करें",
      "খৰাঙৰ মূল্যায়ন এলেকা ভিত্তিত হয়; নথি ৰাখক আৰু কৃষি কাৰ্যালয়ৰ সৈতে যোগাযোগ কৰক");
    actions.push({ id: "claim-visit-office", label: t("Inform the agriculture office about the drought damage", "सूखे के नुकसान की जानकारी कृषि कार्यालय को दें", "খৰাঙৰ ক্ষতিৰ বিষয়ে কৃষি কাৰ্যালয়ক জনাওক"), kind: "visit", priority: 2 });
  } else if (deadline.expired) {
    body.expired_message = EXPIRED_MESSAGE;
    headline = t(`Reporting window has passed — report your ${word.en} loss today anyway`,
      `सूचना अवधि बीत गई — फिर भी आज ही ${word.hi} नुकसान की सूचना दें`,
      `জনোৱাৰ সময় পাৰ হ'ল — তথাপি আজিয়েই ${word.as}ৰ ক্ষতি জনাওক`);
    actions.push({ id: "claim-report", label: t("Report the loss today anyway (insurer / bank / agri office)", "आज ही नुकसान की सूचना दें (बीमा / बैंक / कृषि कार्यालय)", "আজিয়েই ক্ষতিৰ খবৰ দিয়ক (বীমা / বেংক / কৃষি কাৰ্যালয়)"), kind: "do_now", priority: 1 });
  } else {
    const h = deadline.hours_left;
    headline = t(`Report your ${word.en} loss now: about ${h} hours left`,
      `अपने ${word.hi} नुकसान की सूचना अभी दें: लगभग ${h} घंटे बचे हैं`,
      `আপোনাৰ ${word.as}ৰ ক্ষতি এতিয়াই জনাওক: প্ৰায় ${h} ঘণ্টা বাকী`);
    actions.push({ id: "claim-report", label: t("Report loss to insurer / bank / agri office", "बीमा कंपनी / बैंक / कृषि कार्यालय को नुकसान की सूचना दें", "বীমা / বেংক / কৃষি কাৰ্যালয়ক ক্ষতিৰ খবৰ দিয়ক"), kind: "do_now", priority: 1, due_at: deadline.due_at });
  }

  if (occurred && windowH > 0) {
    const pending = evidence_checklist.filter((e) => !e.done);
    if (pending.length) {
      const a: ActionItem = {
        id: "claim-evidence",
        label: t(`Take ${pending.length} evidence photo(s): ${pending.map((p) => p.label.en).join("; ")}`,
          `${pending.length} सबूत फ़ोटो लें: ${pending.map((p) => p.label.hi).join("; ")}`,
          `${pending.length} টা প্ৰমাণ ফটো লওক: ${pending.map((p) => p.label.as).join("; ")}`),
        kind: "do_now", priority: 1,
      };
      if (!deadline.expired) a.due_at = deadline.due_at;
      actions.push(a);
    }
    for (const err of intimation.errors.slice(0, 3)) {
      actions.push({ id: `claim-fix-${err.field}`, label: t(`Claim form: ${err.message}`, `दावा फ़ॉर्म: ${err.message}`, `দাবী ফৰ্ম: ${err.message}`), kind: "collect_doc", priority: 2 });
    }
  }

  return envelope({
    module: "claim",
    status: occurred ? "ok" : "needs_info",
    headline,
    body,
    actions,
    sources: [{ label: data.report_window_source.label, url: data.report_window_source.url, as_of: data.report_window_source.verified_on }],
    confidence: intimation.confidence,
    provenance: intimation.provenance === "cline-sdk" ? "live" : "fixture",
    disclaimer: "general",
    missing_fields: occurred ? [] : ["loss_event"],
  });
}
