export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export async function sendWebPush(
  subscription: StoredPushSubscription,
  vapid: VapidConfig,
) {
  const token = await createVapidToken(subscription.endpoint, vapid);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${vapid.publicKey}`,
      TTL: "300",
      Urgency: "normal",
      "Content-Length": "0",
    },
  });
}

async function createVapidToken(endpoint: string, vapid: VapidConfig) {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  };
  const unsignedToken = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const signature = await signVapidToken(unsignedToken, vapid);

  return `${unsignedToken}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function signVapidToken(unsignedToken: string, vapid: VapidConfig) {
  const publicKeyBytes = base64UrlToBytes(vapid.publicKey);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncodeBytes(publicKeyBytes.slice(1, 33)),
      y: base64UrlEncodeBytes(publicKeyBytes.slice(33, 65)),
      d: vapid.privateKey,
      ext: false,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
}

function base64UrlEncodeJson(value: unknown) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
