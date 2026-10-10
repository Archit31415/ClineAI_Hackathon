import type { ActionPlan, DossierResponse } from "@kisansahay/contracts";
import { renderPdf } from "./pdf";
import { whatsappLink, whatsappText } from "./whatsapp";

export async function compileDossier(plan: ActionPlan): Promise<DossierResponse> {
  const pdf = await renderPdf(plan);
  const text = whatsappText(plan);
  return {
    pdf_base64: Buffer.from(pdf).toString("base64"),
    whatsapp_text: text,
    whatsapp_link: whatsappLink(text),
    json: plan,
  };
}
