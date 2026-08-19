import { getSupabaseAdmin } from "./supabase";
import type { Billing } from "./advisor";

export type LeadConversationTurn = { role: "user" | "assistant"; content: string };

export type LeadInput = {
  name: string;
  email: string;
  /** Celular en formato E.164 (+573001234567) para escribirle por WhatsApp. */
  phone: string;
  /** Plan que el asesor recomendó en el momento de dejar los datos. */
  planId?: string;
  billing?: Billing;
  /** "asesor-landing" | "asesor-home" */
  source: string;
  conversation?: LeadConversationTurn[];
  /** utm_*, gclid, fbclid y referrer capturados en la landing. */
  utm?: Record<string, string>;
};

export type SaveLeadResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Guarda el lead en Supabase. Requiere la migración 0011_leads.sql; si la tabla
 * no existe devuelve el error para que el endpoint pueda seguir avisando por
 * correo en vez de perder el contacto.
 */
export async function saveLead(input: LeadInput): Promise<SaveLeadResult> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("leads")
      .insert({
        name: input.name,
        email: input.email,
        phone: input.phone,
        plan_id: input.planId ?? null,
        billing: input.billing ?? null,
        source: input.source,
        conversation: input.conversation ?? null,
        utm: input.utm && Object.keys(input.utm).length ? input.utm : null,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: String(data.id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
