import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { appConfigured, CHANNELS, isProvider, managedAdsConfigured, PROVIDERS } from "@/lib/channels";
import { formatDate } from "@/lib/format";
import { disconnectChannel } from "@/app/actions/channels";

export const metadata = { title: "Channels" };

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string; p?: string }> }) {
  const { business } = await requireBusiness();
  const { connected, error, p } = await searchParams;
  const conns = await db.channelConnection.findMany({ where: { businessId: business.id } });
  const byProvider = new Map(conns.map((c) => [c.provider, c]));
  const wallet = business.adSpendMode === "WALLET";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <p className="muted">Connect your accounts once and approved posts and ads go out automatically. You can disconnect any time.</p>
        </div>
      </div>
      {connected && isProvider(connected) && <div className="alert alert-ok" style={{ marginBottom: 20 }}>{CHANNELS[connected].name} connected.</div>}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          {error === "not-configured"
            ? `${p && isProvider(p) ? CHANNELS[p].name : "This platform"} isn't available yet. We're finishing setup with the platform; please check back soon.`
            : error}
        </div>
      )}
      {wallet && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          You&apos;re on the Elevated ad wallet, so ads run from our ad accounts and you don&apos;t need to connect ad accounts. Do connect your Facebook Page: Meta ads always run under your Page&apos;s name.
        </div>
      )}
      <div className="grid grid-2">
        {PROVIDERS.map((id) => {
          const info = CHANNELS[id];
          const conn = byProvider.get(id);
          const available = appConfigured(id);
          const extra = (conn?.extra as Record<string, any>) ?? {};
          return (
            <div className="card" key={id}>
              <div className="row between">
                <h2 style={{ margin: 0 }}>{info.name}</h2>
                {conn ? (
                  <span className={`badge ${conn.status === "active" ? "badge-good" : "badge-bad"}`}>{conn.status === "active" ? "Connected" : "Reconnect needed"}</span>
                ) : (
                  <span className="badge badge-dark">Not connected</span>
                )}
              </div>
              <p className="muted small" style={{ marginTop: 8 }}>{info.does}.{info.manualNote ? ` ${info.manualNote}.` : ""}</p>
              {conn && (
                <p className="small">
                  {conn.accountName}
                  {id === "META" && extra.instagramUsername && <> · Instagram @{extra.instagramUsername}</>}
                  {id === "META" && !extra.instagramId && <><br /><span className="muted">No Instagram business account is linked to this Page, so only Facebook posts will go out.</span></>}
                  {conn.adAccountId && !wallet && <><br /><span className="muted">Ad account {conn.adAccountId}</span></>}
                  <br /><span className="muted">Connected {formatDate(conn.createdAt)}</span>
                  {conn.lastError && <><br /><span style={{ color: "var(--bad)" }}>{conn.lastError}</span></>}
                </p>
              )}
              {wallet && info.autoAds && (
                <p className="small muted">Ads: {managedAdsConfigured(id) ? "run by Elevated from your ad wallet." : "launched by the Elevated team from your ad wallet."}</p>
              )}
              <div className="row">
                {available ? (
                  <a className={`btn ${conn ? "btn-ghost" : "btn-primary"}`} href={`/api/connect/${id.toLowerCase()}`}>
                    {conn ? "Reconnect" : "Connect"}
                  </a>
                ) : (
                  <span className="small muted">Coming soon</span>
                )}
                {conn && (
                  <form action={disconnectChannel}>
                    <input type="hidden" name="provider" value={id} />
                    <button className="btn btn-ghost">Disconnect</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
