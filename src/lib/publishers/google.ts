import "server-only";
import { managedGoogleAdsToken } from "../oauth";
import { fetchJson } from "./http";
import { type AdTarget, type LiveConnection, type Publisher, postText } from "./types";

// Google Ads API (REST) and Google Business Profile.
// Docs: developers.google.com/google-ads/api/rest/overview, developers.google.com/my-business.

const ADS = `https://googleads.googleapis.com/${process.env.GOOGLE_ADS_API_VERSION || "v21"}`;
const digits = (s: string) => s.replace(/\D/g, "");

async function adsContext(conn: LiveConnection | null, target: AdTarget) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not set");
  if (target.managed) {
    const customer = process.env.GOOGLE_ADS_MANAGED_CUSTOMER_ID;
    const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    if (!customer || !login) throw new Error("Elevated's Google Ads account isn't configured (GOOGLE_ADS_MANAGED_CUSTOMER_ID, GOOGLE_ADS_LOGIN_CUSTOMER_ID)");
    return { token: await managedGoogleAdsToken(), developerToken, customer: digits(customer), login: digits(login) };
  }
  if (!conn?.adAccountId) throw new Error("Connect Google Ads to run ads from your own account");
  return { token: conn.accessToken, developerToken, customer: digits(conn.adAccountId), login: conn.extra.loginCustomerId as string | undefined };
}

function adsHeaders(c: { token: string; developerToken: string; login?: string }) {
  return {
    Authorization: `Bearer ${c.token}`,
    "developer-token": c.developerToken,
    "Content-Type": "application/json",
    ...(c.login ? { "login-customer-id": c.login } : {}),
  };
}

function uniqueTrimmed(list: string[], max: number, maxLen: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.replace(/[!]{2,}/g, "!").trim().slice(0, maxLen).trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.slice(0, max);
}

const customerOf = (resource: string) => resource.split("/")[1];

export const googleAds: Publisher = {
  async discover(tokens) {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
    const res = await fetchJson<any>(`${ADS}/customers:listAccessibleCustomers`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, "developer-token": developerToken },
    });
    const first: string | undefined = res.resourceNames?.[0];
    if (!first) throw new Error("No Google Ads account found on this Google login");
    const id = customerOf(first);
    return { accountId: id, accountName: `Google Ads ${id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`, adAccountId: id, extra: {} };
  },

  /** Search campaign with Maximize Clicks, one ad group, a responsive search ad and phrase-match keywords. */
  async launchAd(conn, ad, dailyBudgetCents, target) {
    const c = await adsContext(conn, target);
    const headlines = uniqueTrimmed(ad.headlines, 15, 30);
    const descriptions = uniqueTrimmed(ad.descriptions, 4, 90);
    if (headlines.length < 3 || descriptions.length < 2) throw new Error("Google needs at least 3 headlines and 2 descriptions");
    if (!/^https?:\/\//.test(ad.link)) throw new Error("Google ads need the client's website URL (add it to the business profile)");
    const keywords = uniqueTrimmed(ad.keywords, 20, 80);
    if (!keywords.length) throw new Error("Google Search ads need keywords");

    const r = (kind: string, id: number) => `customers/${c.customer}/${kind}/${id}`;
    const geo = (process.env.GOOGLE_ADS_GEO_TARGETS || "2840").split(",").map((g) => g.trim());
    const ops: object[] = [
      {
        campaignBudgetOperation: {
          create: {
            resourceName: r("campaignBudgets", -1),
            name: `${ad.campaignName} budget ${Date.now()}`,
            amountMicros: String(dailyBudgetCents * 10_000),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      },
      {
        campaignOperation: {
          create: {
            resourceName: r("campaigns", -2),
            name: `${ad.campaignName} ${new Date().toISOString().slice(0, 10)}`,
            status: "ENABLED",
            advertisingChannelType: "SEARCH",
            campaignBudget: r("campaignBudgets", -1),
            targetSpend: {},
            networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          },
        },
      },
      ...geo.map((g) => ({
        campaignCriterionOperation: { create: { campaign: r("campaigns", -2), location: { geoTargetConstant: `geoTargetConstants/${g}` } } },
      })),
      {
        adGroupOperation: {
          create: { resourceName: r("adGroups", -3), name: `${ad.campaignName} – main`, campaign: r("campaigns", -2), status: "ENABLED", type: "SEARCH_STANDARD" },
        },
      },
      {
        adGroupAdOperation: {
          create: {
            adGroup: r("adGroups", -3),
            status: "ENABLED",
            ad: {
              finalUrls: [ad.link],
              responsiveSearchAd: { headlines: headlines.map((text) => ({ text })), descriptions: descriptions.map((text) => ({ text })) },
            },
          },
        },
      },
      ...keywords.map((text) => ({
        adGroupCriterionOperation: { create: { adGroup: r("adGroups", -3), status: "ENABLED", keyword: { text, matchType: "PHRASE" } } },
      })),
    ];
    const res = await fetchJson<any>(`${ADS}/customers/${c.customer}/googleAds:mutate`, {
      method: "POST",
      headers: adsHeaders(c),
      body: JSON.stringify({ mutateOperations: ops }),
    });
    const campaign: string | undefined = res.mutateOperationResponses?.find((x: any) => x.campaignResult)?.campaignResult.resourceName;
    if (!campaign) throw new Error("Google Ads didn't return the new campaign");
    const id = campaign.split("/").pop();
    return { externalId: campaign, externalUrl: `https://ads.google.com/aw/campaigns?campaignId=${id}&__c=${c.customer}`, adAccountId: c.customer };
  },

  async setAdStatus(conn, resource, active, target) {
    const c = await adsContext(conn, target);
    await fetchJson(`${ADS}/customers/${customerOf(resource)}/googleAds:mutate`, {
      method: "POST",
      headers: adsHeaders(c),
      body: JSON.stringify({
        mutateOperations: [{ campaignOperation: { update: { resourceName: resource, status: active ? "ENABLED" : "PAUSED" }, updateMask: "status" } }],
      }),
    });
  },

  async adMetrics(conn, resource, day, target) {
    const c = await adsContext(conn, target);
    const id = resource.split("/").pop();
    const res = await fetchJson<any>(`${ADS}/customers/${customerOf(resource)}/googleAds:search`, {
      method: "POST",
      headers: adsHeaders(c),
      body: JSON.stringify({
        query: `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE campaign.id = ${id} AND segments.date = '${day}'`,
      }),
    });
    const m = res.results?.[0]?.metrics ?? {};
    return {
      spendCents: Math.round(Number(m.costMicros ?? 0) / 10_000),
      impressions: Number(m.impressions ?? 0),
      clicks: Number(m.clicks ?? 0),
      conversions: Number(m.conversions ?? 0),
    };
  },
};

export const googleBusiness: Publisher = {
  async discover(tokens) {
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };
    const accounts = await fetchJson<any>("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: auth });
    for (const account of accounts.accounts ?? []) {
      const locs = await fetchJson<any>(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title&pageSize=100`,
        { headers: auth },
      );
      const loc = locs.locations?.[0];
      if (loc) {
        return {
          accountId: `${account.name}/${loc.name}`, // accounts/123/locations/456
          accountName: loc.title,
          extra: { otherLocations: (locs.locations ?? []).slice(1).map((l: any) => ({ name: l.name, title: l.title })) },
        };
      }
    }
    throw new Error("No Google Business Profile location found on this Google login");
  },

  async publishPost(conn, p) {
    const body: Record<string, unknown> = {
      languageCode: "en-US",
      summary: postText({ ...p, hashtags: [] }).slice(0, 1500),
      topicType: "STANDARD",
    };
    if (p.link) body.callToAction = { actionType: "LEARN_MORE", url: p.link };
    if (p.imageUrl) body.media = [{ mediaFormat: "PHOTO", sourceUrl: p.imageUrl }];
    const res = await fetchJson<any>(`https://mybusiness.googleapis.com/v4/${conn.accountId}/localPosts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { externalId: res.name, externalUrl: res.searchUrl };
  },
};
