import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { accessSteps, appConfigured, CHANNELS, isProvider, LINK_FIELDS, managedAdsConfigured, PROVIDERS } from "@/lib/channels";
import { formatDate } from "@/lib/format";
import { disconnectChannel } from "@/app/actions/channels";
import { LinkForm } from "./LinkForm";

export const metadata = { title: "Channels" };

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string; p?: string }> }) {
  const { business } = await requireBusiness();
  const { connected, error, p } = await searchParams;
  const conns = await db.channelConnection.findMany({ where: { businessId: business.id } });
  const byProvider = new Map(conns.map((c) => [c.provider, c]));
  const wallet = business.adSpendMode === "WALLET";
  const linkedCount = conns.filter((c) => c.status === "active" || c.status === "linked").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <p className="muted">
            Add the accounts you want us to market on. Posts and ads always come to you for approval first. You can remove an
            account any time.
          </p>
        </div>
        <span className="badge badge-dark">{linkedCount} of {PROVIDERS.length} set up</span>
      </div>
      {connected && isProvider(connected) && <div className="alert alert-ok" style={{ marginBottom: 20 }}>{CHANNELS[connected].name} connected.</div>}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          {error === "not-configured"
            ? `One-click sign-in for ${p && isProvider(p) ? CHANNELS[p].name : "this platform"} isn't available yet. Add your account details on its card instead.`
            : error}
        </div>
      )}
      {wallet && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          You&apos;re on the Elevated ad wallet, so ads run from our ad accounts and you don&apos;t need to add ad accounts. Do add
          your Facebook Page: Meta ads always run under your Page&apos;s name.
        </div>
      )}
      <div className="grid grid-2">
        {PROVIDERS.map((id) => {
          const info = CHANNELS[id];
          const conn = byProvider.get(id);
          const oneClick = appConfigured(id);
          const extra = (conn?.extra as Record<string, any>) ?? {};
          const manual = conn?.method === "manual";
          const fields = LINK_FIELDS[id];
          const badge = !conn
            ? { cls: "badge-dark", text: "Not set up" }
            : conn.status === "active"
              ? { cls: "badge-good", text: "Connected" }
              : conn.status === "linked"
                ? extra.accessGranted
                  ? { cls: "badge-good", text: "Linked" }
                  : { cls: "badge-warn", text: "Linked · access pending" }
                : { cls: "badge-bad", text: "Reconnect needed" };
          const form = (
            <LinkForm
              provider={id}
              account={fields.account}
              extra={fields.extra}
              steps={accessSteps(id)}
              current={manual ? { account: conn?.profileUrl, extra: extra.secondary, accessGranted: extra.accessGranted } : undefined}
            />
          );
          return (
            <div className="card channel-card" key={id}>
              <div className="row between">
                <h2 style={{ margin: 0 }}>{info.name}</h2>
                <span className={`badge ${badge.cls}`}>{badge.text}</span>
              </div>
              <p className="muted small" style={{ marginTop: 8 }}>{info.does}.{info.manualNote ? ` ${info.manualNote}.` : ""}</p>

              {conn && (
                <p className="small">
                  <strong>{conn.accountName ?? conn.profileUrl}</strong>
                  {extra.secondary && <> · {extra.secondary}</>}
                  {id === "META" && extra.instagramUsername && <> · Instagram @{extra.instagramUsername}</>}
                  {conn.adAccountId && !wallet && id !== "GOOGLE_ADS" && <><br /><span className="muted">Ad account {conn.adAccountId}</span></>}
                  <br />
                  <span className="muted">
                    {manual ? "Linked" : "Connected"} {formatDate(conn.createdAt)}
                    {manual && " · the Elevated team publishes what you approve"}
                    {manual && !extra.accessGranted && " once you've given us access"}
                  </span>
                  {conn.lastError && <><br /><span style={{ color: "var(--bad)" }}>{conn.lastError}</span></>}
                </p>
              )}
              {wallet && info.autoAds && (
                <p className="small muted">Ads: {managedAdsConfigured(id) ? "run by Elevated from your ad wallet." : "launched by the Elevated team from your ad wallet."}</p>
              )}

              {!conn && (oneClick ? (
                <>
                  <a className="btn btn-primary" href={`/api/connect/${id.toLowerCase()}`}>Connect {info.name}</a>
                  <details><summary>Or add your account details</summary>{form}</details>
                </>
              ) : form)}

              {conn && (
                <>
                  {manual && <details><summary>Edit account details</summary>{form}</details>}
                  <div className="row" style={{ marginTop: 12 }}>
                    {oneClick && (
                      <a className={`btn ${manual || conn.status !== "active" ? "btn-primary" : "btn-ghost"}`} href={`/api/connect/${id.toLowerCase()}`}>
                        {manual ? "Upgrade to one-click connect" : "Reconnect"}
                      </a>
                    )}
                    <form action={disconnectChannel}>
                      <input type="hidden" name="provider" value={id} />
                      <button className="btn btn-ghost">Remove</button>
                    </form>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
