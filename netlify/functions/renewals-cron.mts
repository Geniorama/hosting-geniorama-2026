/**
 * Netlify Scheduled Function — daily renewal sweep.
 *
 * The work itself lives in the Next route (/api/cron/renewals) so it can also
 * be triggered by hand and shares the app's code; this function only wakes it
 * up on schedule. Netlify reads `config.schedule` below at deploy time, so no
 * netlify.toml entry is needed.
 *
 * Netlify caps how long a function may run, and the sweep sends email per
 * order, so the route processes a bounded batch per invocation
 * (RENEWAL_SWEEP_LIMIT) and reports `truncated: true` when work was left over.
 *
 * Required env vars on the site: CRON_SECRET (or RESCUE_SECRET) and, ideally,
 * NEXT_PUBLIC_BASE_URL. Netlify's own URL is used as a fallback.
 */

const runRenewalsCron = async () => {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET ?? process.env.RESCUE_SECRET;

  if (!base || !secret) {
    console.error("[netlify:renewals-cron] missing base URL or secret", {
      hasBase: Boolean(base),
      hasSecret: Boolean(secret),
    });
    return new Response("Not configured", { status: 503 });
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/cron/renewals`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
  } catch (err) {
    console.error("[netlify:renewals-cron] request failed", (err as Error).message);
    return new Response("Sweep unreachable", { status: 502 });
  }

  const body = await res.text();
  console.log("[netlify:renewals-cron] sweep finished", res.status, body.slice(0, 1000));

  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export default runRenewalsCron;

// 13:00 UTC = 8:00 a.m. en Colombia.
export const config = {
  schedule: "0 13 * * *",
};
