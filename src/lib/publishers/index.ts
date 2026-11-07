import "server-only";
import type { ChannelConnection, Provider } from "@prisma/client";
import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { refreshTokens } from "../oauth";
import { meta } from "./meta";
import { googleAds, googleBusiness } from "./google";
import { linkedin, tiktok, x } from "./social";
import type { LiveConnection, Publisher } from "./types";

export const PUBLISHERS: Record<Provider, Publisher> = {
  META: meta,
  GOOGLE_ADS: googleAds,
  GOOGLE_BUSINESS: googleBusiness,
  LINKEDIN: linkedin,
  TIKTOK: tiktok,
  X: x,
};

/** Loads a connection, refreshing its token first when it's about to expire. */
export async function liveConnection(businessId: string, provider: Provider): Promise<LiveConnection | null> {
  const conn = await db.channelConnection.findUnique({ where: { businessId_provider: { businessId, provider } } });
  if (!conn || conn.status !== "active") return null;
  return toLive(await refreshIfNeeded(conn));
}

async function refreshIfNeeded(conn: ChannelConnection) {
  const soon = Date.now() + 5 * 60 * 1000;
  if (!conn.expiresAt || conn.expiresAt.getTime() > soon || !conn.refreshTokenEnc) return conn;
  try {
    const t = await refreshTokens(conn.provider, decrypt(conn.refreshTokenEnc));
    return db.channelConnection.update({
      where: { id: conn.id },
      data: {
        accessTokenEnc: encrypt(t.accessToken),
        refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : conn.refreshTokenEnc,
        expiresAt: t.expiresAt ?? null,
        lastError: null,
      },
    });
  } catch (err) {
    await markConnectionBroken(conn.id, `Token refresh failed: ${err instanceof Error ? err.message : "error"}`);
    throw new Error(`Your ${conn.provider} connection expired. Reconnect it on the Channels page.`);
  }
}

export function markConnectionBroken(id: string, message: string) {
  return db.channelConnection.update({ where: { id }, data: { status: "expired", lastError: message.slice(0, 500) } });
}

function toLive(c: ChannelConnection): LiveConnection {
  return {
    provider: c.provider,
    accessToken: decrypt(c.accessTokenEnc),
    accountId: c.accountId,
    accountName: c.accountName,
    adAccountId: c.adAccountId,
    extra: (c.extra as Record<string, any>) ?? {},
  };
}
