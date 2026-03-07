import crypto from "crypto";

// ── Base64url helpers ──

function base64urlEncode(data: Buffer): string {
  return data.toString("base64url");
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

// ── Key pair generation ──

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

// ── Create invite code ──

export function createInviteCode(
  privateKeyPem: string,
  expiresInDays: number = 7
): string {
  const payload = {
    id: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + expiresInDays * 86400,
  };

  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf-8");
  const payloadB64 = base64urlEncode(payloadBytes);

  const signature = crypto.sign(null, payloadBytes, privateKeyPem);
  const signatureB64 = base64urlEncode(signature);

  return `${payloadB64}.${signatureB64}`;
}

// ── Verify invite code ──

export interface VerifyResult {
  valid: boolean;
  id?: string;
  error?: string;
}

export function verifyInviteCode(
  publicKeyPem: string,
  code: string
): VerifyResult {
  const parts = code.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Invalid invite code format" };
  }

  const [payloadB64, signatureB64] = parts;

  let payloadBytes: Buffer;
  let signatureBytes: Buffer;
  try {
    payloadBytes = base64urlDecode(payloadB64);
    signatureBytes = base64urlDecode(signatureB64);
  } catch {
    return { valid: false, error: "Invalid invite code encoding" };
  }

  // Verify signature
  let signatureValid: boolean;
  try {
    signatureValid = crypto.verify(null, payloadBytes, publicKeyPem, signatureBytes);
  } catch {
    return { valid: false, error: "Signature verification failed" };
  }

  if (!signatureValid) {
    return { valid: false, error: "Invalid signature" };
  }

  // Parse payload
  let payload: { id: string; exp: number };
  try {
    payload = JSON.parse(payloadBytes.toString("utf-8"));
  } catch {
    return { valid: false, error: "Invalid payload" };
  }

  if (!payload.id || typeof payload.exp !== "number") {
    return { valid: false, error: "Malformed payload" };
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    return { valid: false, id: payload.id, error: "Invite code expired" };
  }

  return { valid: true, id: payload.id };
}
