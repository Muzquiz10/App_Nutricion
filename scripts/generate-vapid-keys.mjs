function base64UrlEncode(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const publicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${base64UrlEncode(new Uint8Array(publicKey))}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey.d}`);
console.log("VAPID_SUBJECT=mailto:ej.egmanalytics@gmail.com");
