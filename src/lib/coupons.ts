import type { Plan } from "./plans";
import { getSupabaseAdmin } from "./supabase";

export type CouponRow = {
  code: string;
  label: string;
  type: "percent" | "amount";
  percent_off: number | null;
  amount_off: number | null;
  applies_to: "monthly" | "annual" | null;
  min_amount: number | null;
  max_uses: number | null;
  uses_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
};

export type AppliedCoupon = {
  code: string;
  label: string;
  discount: number;
};

export type CouponValidation =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; error: string };

async function fetchCoupon(rawCode: string): Promise<CouponRow | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle<CouponRow>();
  if (error) throw new Error(`coupons.fetch failed: ${error.message}`);
  return data;
}

function evaluateCoupon(
  row: CouponRow,
  plan: Plan,
  billing: "monthly" | "annual",
): CouponValidation {
  if (!row.active) return { ok: false, error: "Cupón no disponible" };

  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) {
    return { ok: false, error: "Este cupón aún no está activo." };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) {
    return { ok: false, error: "Este cupón ya expiró." };
  }
  if (row.max_uses != null && row.uses_count >= row.max_uses) {
    return { ok: false, error: "Este cupón ya alcanzó el límite de usos." };
  }

  if (row.applies_to && row.applies_to !== billing) {
    return {
      ok: false,
      error: `Este cupón solo aplica al plan ${
        row.applies_to === "annual" ? "anual" : "mensual"
      }.`,
    };
  }

  const subtotal = billing === "annual" ? plan.price.annual : plan.price.monthly;

  if (row.min_amount != null && subtotal < row.min_amount) {
    return {
      ok: false,
      error: `Este cupón requiere un subtotal mínimo de $${row.min_amount.toLocaleString("es-CO")}.`,
    };
  }

  let discount = 0;
  if (row.type === "percent" && row.percent_off != null) {
    discount = Math.round((subtotal * row.percent_off) / 100);
  } else if (row.type === "amount" && row.amount_off != null) {
    discount = row.amount_off;
  }
  discount = Math.max(0, Math.min(discount, subtotal));

  return {
    ok: true,
    coupon: { code: row.code, label: row.label, discount },
  };
}

export async function applyCoupon(
  rawCode: string,
  plan: Plan,
  billing: "monthly" | "annual",
): Promise<CouponValidation> {
  const row = await fetchCoupon(rawCode);
  if (!row) return { ok: false, error: "Cupón no válido" };
  return evaluateCoupon(row, plan, billing);
}

/**
 * Atomically increments uses_count if the coupon is still redeemable.
 * Returns the resolved discount, or null if the coupon could not be redeemed.
 */
export async function redeemCoupon(
  rawCode: string,
  plan: Plan,
  billing: "monthly" | "annual",
): Promise<AppliedCoupon | null> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .rpc("redeem_coupon", { p_code: code })
    .single<CouponRow>();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`coupons.redeem failed: ${error.message}`);
  }
  if (!data || !data.code) return null;
  const result = evaluateCoupon(data, plan, billing);
  return result.ok ? result.coupon : null;
}
