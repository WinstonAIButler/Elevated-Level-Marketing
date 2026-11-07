import "server-only";
import { META_VERSION } from "../oauth";
import { decrypt, encrypt } from "../crypto";
import { fetchJson, form } from "./http";
import { postText, type AdTarget, type LiveConnection, type Publisher } from "./types";

// Facebook Pages, Instagram (business accounts linked to the Page) and Meta Marketing API.
// Docs: developers.facebook.com/docs/pages-api, /docs/instagram-platform/content-publishing,
// /docs/marketing-api.

const G = `https://graph.facebook.com/${META_VERSION}`;

const get = (path: string, token: string, params: Record<string, string> = {}) =>
  fetchJson<any>(`${G}/${path}?${form({ ...params, access_token: token })}`);
const post = (path: string, token: string, params: Record<string, string | undefined>) =>
  fetchJson<any>(`${G}/${path}`, { method: "POST", body: form({ ...params, access_token: token }) });

function adContext(conn: LiveConnection | null, target: AdTarget) {
  if (target.managed) {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    const account = process.env.META_AD_ACCOUNT_ID;
    if (!token || !account) throw new Error("Elevated's Meta ad account isn't configured (META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID)");
    return { token, account: account.startsWith("act_") ? account : `act_${account}` };
  }
  const userToken = conn?.extra.userTokenEnc ? decrypt(conn.extra.userTokenEnc) : null;
  if (!userToken || !conn?.adAccountId) throw new Error("Connect Facebook with an ad account to run ads from your own account");
  return { token: userToken, account: conn.adAccountId };
}

const CTA: Record<string, string> = {
  LEARN_MORE: "LEARN_MORE",
  CONTACT_US: "CONTACT_US",
  SIGN_UP: "SIGN_UP",
  BOOK_NOW: "BOOK_TRAVEL",
  GET_QUOTE: "GET_QUOTE",
  SHOP_NOW: "SHOP_NOW",
  CALL_NOW: "LEARN_MORE",
};

export const meta: Publisher = {
  async discover(tokens) {
    const pages = await get("me/accounts", tokens.accessToken, {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "50",
    });
    const page = pages.data?.[0];
    if (!page) throw new Error("No Facebook Page found. Make sure you're an admin of your business's Page and allowed access to it.");
    let adAccountId: string | null = null;
    try {
      const accounts = await get("me/adaccounts", tokens.accessToken, { fields: "id,name,account_status", limit: "25" });
      adAccountId = accounts.data?.find((a: any) => a.account_status === 1)?.id ?? null;
    } catch {
      // ads permissions not granted; posting still works
    }
    return {
      accountId: page.id,
      accountName: page.name,
      adAccountId,
      extra: {
        instagramId: page.instagram_business_account?.id ?? null,
        instagramUsername: page.instagram_business_account?.username ?? null,
        userTokenEnc: encrypt(tokens.accessToken),
        pageToken: page.access_token, // replaced by the caller (stored encrypted as the access token)
        otherPages: (pages.data ?? []).slice(1).map((p: any) => ({ id: p.id, name: p.name })),
      },
    };
  },

  /** Posts to the Facebook Page, or to the linked Instagram account when placement is "instagram". */
  async publishPost(conn, p) {
    const message = postText(p);
    if (p.placement === "instagram") {
      const ig = conn.extra.instagramId;
      if (!ig) throw new Error("No Instagram business account is linked to this Facebook Page");
      if (!p.imageUrl) throw new Error("Instagram posts need an image. Add an image URL before approving.");
      const container = await post(`${ig}/media`, conn.accessToken, { image_url: p.imageUrl, caption: message });
      const published = await post(`${ig}/media_publish`, conn.accessToken, { creation_id: container.id });
      return { externalId: published.id, externalUrl: conn.extra.instagramUsername ? `https://www.instagram.com/${conn.extra.instagramUsername}/` : undefined };
    }
    const page = conn.accountId!;
    const res = p.imageUrl
      ? await post(`${page}/photos`, conn.accessToken, { url: p.imageUrl, caption: p.link ? `${message}\n\n${p.link}` : message })
      : await post(`${page}/feed`, conn.accessToken, { message, link: p.link });
    const id = res.post_id ?? res.id;
    return { externalId: id, externalUrl: `https://www.facebook.com/${id}` };
  },

  /** Creates campaign → ad set → creative → ad (Traffic objective), then switches it on. */
  async launchAd(conn, ad, dailyBudgetCents, target) {
    const { token, account } = adContext(conn, target);
    const pageId = conn?.accountId;
    if (!pageId) throw new Error("Connect the client's Facebook Page first; ads run under the Page");
    const countries = (process.env.META_AD_COUNTRIES || "US").split(",").map((c) => c.trim());

    const campaign = await post(`${account}/campaigns`, token, {
      name: ad.campaignName,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
    });
    try {
      const adset = await post(`${account}/adsets`, token, {
        name: `${ad.campaignName} – ad set`,
        campaign_id: campaign.id,
        daily_budget: String(dailyBudgetCents),
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: JSON.stringify({ geo_locations: { countries }, targeting_automation: { advantage_audience: 1 } }),
        status: "ACTIVE",
      });
      const creative = await post(`${account}/adcreatives`, token, {
        name: `${ad.campaignName} – creative`,
        object_story_spec: JSON.stringify({
          page_id: pageId,
          ...(conn?.extra.instagramId ? { instagram_user_id: conn.extra.instagramId } : {}),
          link_data: {
            link: ad.link,
            message: ad.primaryText,
            name: ad.headlines[0],
            description: ad.descriptions[0],
            ...(ad.imageUrl ? { picture: ad.imageUrl } : {}),
            call_to_action: { type: CTA[ad.callToAction] ?? "LEARN_MORE", value: { link: ad.link } },
          },
        }),
      });
      await post(`${account}/ads`, token, {
        name: `${ad.campaignName} – ad`,
        adset_id: adset.id,
        creative: JSON.stringify({ creative_id: creative.id }),
        status: "ACTIVE",
      });
      await post(campaign.id, token, { status: "ACTIVE" });
    } catch (err) {
      // Don't leave a half-built paused campaign lying around.
      await post(campaign.id, token, { status: "DELETED" }).catch(() => {});
      throw err;
    }
    const actId = account.replace("act_", "");
    return { externalId: campaign.id, externalUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId}&selected_campaign_ids=${campaign.id}` };
  },

  async setAdStatus(conn, campaignId, active, target) {
    const { token } = adContext(conn, target);
    await post(campaignId, token, { status: active ? "ACTIVE" : "PAUSED" });
  },

  async adMetrics(conn, campaignId, day, target) {
    const { token } = adContext(conn, target);
    const res = await get(`${campaignId}/insights`, token, {
      fields: "spend,impressions,clicks,actions",
      time_range: JSON.stringify({ since: day, until: day }),
    });
    const row = res.data?.[0];
    if (!row) return { spendCents: 0, impressions: 0, clicks: 0, conversions: 0 };
    const conversions = (row.actions ?? [])
      .filter((a: any) => /lead|purchase|complete_registration|contact|schedule|submit_application/.test(a.action_type))
      .reduce((s: number, a: any) => s + Number(a.value || 0), 0);
    return {
      spendCents: Math.round(Number(row.spend || 0) * 100),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      conversions,
    };
  },
};
