/**
 * Contador en memoria y por instancia: en serverless cada lambda tiene el suyo,
 * así que es un freno básico contra bots, no una cuota exacta.
 */
const buckets = new Map<string, Map<string, { count: number; resetAt: number }>>();

export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-nf-client-connection-ip") || "anon";
}

/**
 * @param name    Espacio de nombres del límite (un endpoint, normalmente).
 * @param key     Identificador del cliente, típicamente `clientKey(req)`.
 * @param limit   Peticiones permitidas dentro de la ventana.
 * @param windowMs Duración de la ventana en milisegundos.
 */
export function rateLimited(name: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = new Map();
    buckets.set(name, bucket);
  }

  const entry = bucket.get(key);
  if (!entry || entry.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    if (bucket.size > 500) {
      for (const [k, v] of bucket) if (v.resetAt <= now) bucket.delete(k);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}
