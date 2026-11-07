import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Platform access tokens are stored encrypted (AES-256-GCM). The key comes from
// TOKEN_ENCRYPTION_KEY (any long random string; `openssl rand -base64 32`).
// CONNECTIONS_ENCRYPTION_KEY is accepted too, the name the Winston app uses.
const rawKey = () => process.env.TOKEN_ENCRYPTION_KEY || process.env.CONNECTIONS_ENCRYPTION_KEY;

function key() {
  const raw = rawKey();
  if (!raw || raw.length < 16) throw new Error("TOKEN_ENCRYPTION_KEY must be set (16+ characters) to connect channels");
  return createHash("sha256").update(raw).digest();
}

export const encryptionEnabled = () => (rawKey()?.length ?? 0) >= 16;

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(token: string) {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable stored token");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
