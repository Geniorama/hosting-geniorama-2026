"use client";

import { useState } from "react";
import type { Plan } from "@/lib/plans";
import type { AppliedCoupon } from "@/lib/coupons";
import { CheckoutForm } from "./CheckoutForm";
import { CheckoutSummary } from "./CheckoutSummary";

type CheckoutBodyProps = {
  plan: Plan;
  billing: "monthly" | "annual";
};

export function CheckoutBody({ plan, billing }: CheckoutBodyProps) {
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  return (
    <div className="checkout-grid">
      <CheckoutForm planId={plan.id} billing={billing} couponCode={coupon?.code ?? null} />
      <CheckoutSummary
        plan={plan}
        billing={billing}
        coupon={coupon}
        onApplyCoupon={setCoupon}
      />
    </div>
  );
}
