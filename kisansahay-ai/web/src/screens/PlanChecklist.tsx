import type { ActionPlan, Lang } from "@kisansahay/contracts/types";
import { Speak } from "../components/common";
import { MODULE_META, pick, ui } from "../lib/i18n";

export function PlanChecklist({ plan, lang, ticks, tick }: {
  plan: ActionPlan; lang: Lang; ticks: Record<string, boolean>; tick: (id: string) => void;
}) {
  const groups: [string, ActionPlan["ordered_actions"]][] = [
    [ui("urgent", lang), plan.ordered_actions.filter((a) => a.priority === 1 && a.kind !== "collect_doc")],
    [ui("next", lang), plan.ordered_actions.filter((a) => a.priority === 2 && a.kind !== "collect_doc")],
    [ui("later", lang), plan.ordered_actions.filter((a) => a.priority === 3 && a.kind !== "collect_doc")],
  ];
  return (
    <>
      {groups.map(([title, items]) => items.length > 0 && (
        <div key={title} className="mt-4">
          <h3 className="mb-1 font-bold">{title}</h3>
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <input type="checkbox" checked={!!ticks[a.id]} onChange={() => tick(a.id)} className="mt-1.5 h-6 w-6 accent-green-700" />
                <div className={`flex-1 text-lg leading-snug ${ticks[a.id] ? "text-stone-400 line-through" : ""}`}>
                  <span className="mr-1">{MODULE_META[a.from].icon}</span>{pick(a.label, lang)}
                  {a.due_at && <span className="ml-2 text-sm text-red-700">⏰ {a.due_at.slice(5, 16).replace("T", " ")}</span>}
                  {a.link && <a className="ml-2 text-sm text-sky-700 underline" href={a.link} target="_blank" rel="noreferrer">↗</a>}
                </div>
                <Speak text={pick(a.label, lang)} lang={lang} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!!plan.documents?.length && (
        <div className="mt-4">
          <h3 className="mb-1 font-bold">📄 {ui("documents", lang)}</h3>
          <ul className="space-y-1">
            {plan.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3">
                <input type="checkbox" checked={!!ticks[`doc-${d.id}`]} onChange={() => tick(`doc-${d.id}`)} className="h-5 w-5 accent-green-700" />
                <span>{pick(d.name, lang)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.cross_notes.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 font-bold">💡 {ui("why", lang)}</h3>
          <ul className="space-y-1 text-sm">{plan.cross_notes.map((n, i) => <li key={i}>• {pick(n, lang)}</li>)}</ul>
        </div>
      )}
    </>
  );
}
