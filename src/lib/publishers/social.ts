import "server-only";
import { fetchJson } from "./http";
import { postText, type Publisher } from "./types";

// LinkedIn, X and TikTok. Organic posting only; ads on these go to the Elevated team.

const LI_VERSION = process.env.LINKEDIN_API_VERSION || "202510";

function liHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LI_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

export const linkedin: Publisher = {
  async discover(tokens) {
    // Prefer a company page the user administers (needs the Community Management API
    // scopes w_organization_social + r_organization_admin); fall back to their profile.
    try {
      const acls = await fetchJson<any>(
        "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
        { headers: liHeaders(tokens.accessToken) },
      );
      const org: string | undefined = acls.elements?.[0]?.organization;
      if (org) {
        const id = org.split(":").pop()!;
        let name = "LinkedIn company page";
        try {
          const o = await fetchJson<any>(`https://api.linkedin.com/rest/organizations/${id}`, { headers: liHeaders(tokens.accessToken) });
          name = o.localizedName ?? name;
        } catch {}
        return { accountId: org, accountName: name };
      }
    } catch {
      // no organization scopes; use the member profile
    }
    const me = await fetchJson<any>("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    return { accountId: `urn:li:person:${me.sub}`, accountName: me.name ?? "LinkedIn profile" };
  },

  async publishPost(conn, p) {
    const text = postText(p);
    const body: Record<string, unknown> = {
      author: conn.accountId,
      commentary: p.link ? `${text}\n\n${p.link}` : text,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: liHeaders(conn.accessToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LinkedIn: ${(err as any).message ?? `HTTP ${res.status}`}`);
    }
    const id = res.headers.get("x-restli-id") ?? "";
    return { externalId: id, externalUrl: id ? `https://www.linkedin.com/feed/update/${id}/` : undefined };
  },
};

export const x: Publisher = {
  async discover(tokens) {
    const me = await fetchJson<any>("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    return { accountId: me.data.id, accountName: `@${me.data.username}`, extra: { username: me.data.username } };
  },
  async publishPost(conn, p) {
    let text = postText(p);
    if (p.link) text = `${text}\n${p.link}`;
    if (text.length > 280) text = `${text.slice(0, 277)}...`;
    const res = await fetchJson<any>("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const id = res.data.id;
    return { externalId: id, externalUrl: conn.extra.username ? `https://x.com/${conn.extra.username}/status/${id}` : undefined };
  },
};

export const tiktok: Publisher = {
  async discover(tokens) {
    const me = await fetchJson<any>("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    return { accountId: me.data?.user?.open_id ?? null, accountName: me.data?.user?.display_name ?? "TikTok account" };
  },
  // No publishPost/launchAd: TikTok needs video, so items are routed to the Elevated team.
};
