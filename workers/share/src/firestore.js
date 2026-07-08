// Firestore REST access for the public sharedPets/{shareId} docs.
// Unauthenticated: the API key is the standard public Firebase client key and
// the security rules only allow reading docs whose status == "active", so a
// revoked or missing share surfaces here as null.

/** Recursively unwrap Firestore's typed-value JSON into plain JS. */
export function unwrapValue(v) {
  if (v == null) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(unwrapValue);
  if (v.mapValue) return unwrapFields(v.mapValue.fields || {});
  return null;
}

export function unwrapFields(fields) {
  const out = {};
  for (const key of Object.keys(fields)) out[key] = unwrapValue(fields[key]);
  return out;
}

/**
 * Fetch a shared-pet doc. Returns the plain JS object for an ACTIVE share,
 * or null for missing/revoked/error (the caller renders the unavailable page
 * for all of those — recipients don't need to know the difference).
 */
export async function fetchSharedPet(shareId, env) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/sharedPets/${encodeURIComponent(shareId)}` +
    `?key=${env.FIREBASE_API_KEY}`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  // 403 = rules rejected the read (revoked share), 404 = never existed.
  if (!res.ok) return null;
  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const share = unwrapFields(json.fields || {});
  if (share.status !== "active") return null;
  return share;
}
