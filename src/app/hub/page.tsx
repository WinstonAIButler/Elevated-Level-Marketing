import { db } from "@/lib/db";
import { CHANNELS } from "@/lib/channels";
import { addDays, formatDate } from "@/lib/format";
import { PAID_TIERS, TIERS } from "@/lib/tiers";
import { livePrices } from "@/lib/stripe-prices";
import { marginAtPrice, TARGET_MARGIN } from "@/lib/pricing-model";
import { confirmAccess, markPublished, retryFromHub } from "@/app/actions/hub";

export const dynamic = "force-dynamic";

const usd = (cents: number, digits = 0) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export default async function OwnersHub() {
  const since30 = addDays(new Date(), -30);
  const [users, queue, manualLinks, pendingApprovals, topups, spend, liveAds, lastActivity] = await Promise.all([
    db.user.findMany({
      include: { business: { include: { connections: { select: { provider: true, status: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.publishItem.findMany({
      where: { status: { in: ["NEEDS_TEAM", "FAILED"] } },
      include: { business: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.channelConnection.findMany({
      where: { method: "manual", status: "linked" },
      include: { business: { select: { name: true, user: { select: { email: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    db.publishItem.count({ where: { status: "PENDING_APPROVAL" } }),
    db.walletEntry.aggregate({ where: { kind: "TOPUP", createdAt: { gte: since30 } }, _sum: { amountCents: true } }),
    db.channelMetric.aggregate({ where: { date: { gte: since30 } }, _sum: { spendCents: true } }),
    db.publishItem.count({ where: { kind: "AD", status: "PUBLISHED" } }),
    db.activity.groupBy({ by: ["businessId"], _max: { createdAt: true } }),
  ]);

  const live = await livePrices();
  const [leads30, won30] = await Promise.all([
    db.lead.groupBy({ by: ["businessId"], where: { occurredAt: { gte: since30 } }, _count: true }),
    db.lead.groupBy({ by: ["businessId"], where: { status: "WON", wonAt: { gte: since30 } }, _count: true, _sum: { valueCents: true } }),
  ]);
  const leadsByBiz = new Map(leads30.map((l) => [l.businessId, l._count]));
  const wonByBiz = new Map(won30.map((w) => [w.businessId, { n: w._count, cents: w._sum.valueCents ?? 0 }]));
  const lastByBusiness = new Map(lastActivity.map((a) => [a.businessId, a._max.createdAt]));
  const paying = users.filter((u) => u.tier !== "TRIAL" && (u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing"));
  const mrr = paying.reduce((sum, u) => sum + (live[u.tier] ? live[u.tier]!.cents / 100 : TIERS[u.tier].price), 0);
  const byTier = (["TRIAL", "STARTER", "GROWTH", "ELITE"] as const).map((t) => ({ t, n: users.filter((u) => u.tier === t).length }));
  const newSignups = users.filter((u) => u.createdAt >= since30).length;
  const walletTotal = users.reduce((s, u) => s + (u.business?.walletBalanceCents ?? 0), 0);
  const accessPending = manualLinks.filter((c) => !(c.extra as Record<string, unknown> | null)?.accessGranted || !(c.extra as Record<string, unknown> | null)?.accessConfirmedAt);
  const stripeClients = users.filter((u) => u.business?.stripeAccountId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Owners Hub</h1>
          <p className="muted">Elevated Level Marketing, all clients. {formatDate(new Date())}</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="muted small">Monthly recurring revenue</div><div className="stat">${mrr.toLocaleString()}</div><div className="muted small">{paying.length} paying client{paying.length === 1 ? "" : "s"}</div></div>
        <div className="card"><div className="muted small">Clients</div><div className="stat">{users.length}</div><div className="muted small">{byTier.map((b) => `${TIERS[b.t].name.replace("Free ", "")} ${b.n}`).join(" · ")}</div></div>
        <div className="card"><div className="muted small">New sign-ups, 30 days</div><div className="stat">{newSignups}</div></div>
        <div className="card"><div className="muted small">Team queue</div><div className="stat" style={{ color: queue.length ? "var(--warn)" : undefined }}>{queue.length}</div><div className="muted small">{accessPending.length} account{accessPending.length === 1 ? "" : "s"} waiting on access</div></div>
        <div className="card"><div className="muted small">Ad wallets held</div><div className="stat">{usd(walletTotal)}</div><div className="muted small">Owed to clients as ad spend</div></div>
        <div className="card"><div className="muted small">Wallet top-ups, 30 days</div><div className="stat">{usd(topups._sum.amountCents ?? 0)}</div></div>
        <div className="card"><div className="muted small">Ad spend, 30 days</div><div className="stat">{usd(spend._sum.spendCents ?? 0)}</div><div className="muted small">{liveAds} ad campaign{liveAds === 1 ? "" : "s"} live</div></div>
        <div className="card"><div className="muted small">Waiting on client approval</div><div className="stat">{pendingApprovals}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }} id="pricing">
        <h2>Plan prices</h2>
        <p className="muted small">
          Read from Stripe every 5 minutes. To change a price, add a new monthly price on the plan&apos;s product in Stripe (and
          make it the default); the site and checkout switch to it automatically. Existing subscribers stay on their old price
          until moved.
        </p>
        <table className="simple">
          <thead><tr><th>Plan</th><th>Price in Stripe</th><th>Margin at full use</th><th>Found by</th></tr></thead>
          <tbody>
            {PAID_TIERS.map((t) => {
              const p = live[t.id];
              const m = p ? marginAtPrice(t, p.cents / 100) : null;
              return (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>{p ? `${usd(p.cents)}/mo` : <span className="badge badge-bad">Not found in Stripe</span>}</td>
                  <td>
                    {m === null ? "–" : (
                      <span className={`badge ${m >= TARGET_MARGIN ? "badge-good" : "badge-bad"}`}>
                        {(m * 100).toFixed(0)}%{m < TARGET_MARGIN ? " · below 40% target" : ""}
                      </span>
                    )}
                  </td>
                  <td className="small muted">{p ? { env: "Vercel setting", lookup_key: "Stripe lookup key", product: `Product "Elevated ${t.name}"` }[p.source] : `Add a monthly price to a product named "Elevated ${t.name}"`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 20 }} id="queue">
        <h2>Team queue</h2>
        <p className="muted small">Approved by the client but not automated (TikTok, LinkedIn and X ads, accounts linked by hand) or failed. Publish it, then mark it published with the live link.</p>
        {queue.length ? (
          <table className="simple">
            <thead><tr><th>Client</th><th>Item</th><th>Why it&apos;s here</th><th></th></tr></thead>
            <tbody>
              {queue.map((i) => {
                const p = i.payload as Record<string, any>;
                return (
                  <tr key={i.id}>
                    <td><strong>{i.business.name}</strong><div className="small muted">{formatDate(i.createdAt)}</div></td>
                    <td>
                      {i.title}
                      <div className="small muted">{CHANNELS[i.provider].name} · {i.kind === "AD" ? `ad, ${usd(i.dailyBudgetCents, 2)}/day` : "post"}</div>
                      <details className="small"><summary>Content</summary>
                        <div className="preview" style={{ marginTop: 6 }}>
                          {i.kind === "AD"
                            ? `${p.primaryText ?? ""}\n\nHeadlines: ${(p.headlines ?? []).join(" | ")}\nLink: ${p.link ?? ""}`
                            : `${p.text ?? ""}\n\n${(p.hashtags ?? []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}${p.link ? `\n${p.link}` : ""}`}
                          {p.imageUrl ? `\n\nImage: ${p.imageUrl}` : ""}
                        </div>
                      </details>
                    </td>
                    <td className="small">
                      <span className={`badge ${i.status === "FAILED" ? "badge-bad" : "badge-warn"}`}>{i.status === "FAILED" ? "Failed" : "Needs team"}</span>
                      <div className="muted" style={{ marginTop: 4 }}>{i.error}</div>
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <form action={markPublished} className="stack" style={{ gap: 6 }}>
                        <input type="hidden" name="id" value={i.id} />
                        <input name="link" type="url" placeholder="Live link (optional)" aria-label="Live link" />
                        <button className="btn btn-primary btn-sm">Mark published</button>
                      </form>
                      <form action={retryFromHub} style={{ marginTop: 6 }}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="btn btn-ghost btn-sm">Retry automatically</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nothing waiting. 🎉</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }} id="access">
        <h2>Accounts linked by hand</h2>
        <p className="muted small">Clients entered these and were asked to give Elevated access. Confirm once you can post on the account.</p>
        {manualLinks.length ? (
          <table className="simple">
            <thead><tr><th>Client</th><th>Platform</th><th>Account</th><th>Access</th><th></th></tr></thead>
            <tbody>
              {manualLinks.map((c) => {
                const extra = (c.extra as Record<string, any>) ?? {};
                return (
                  <tr key={c.id}>
                    <td><strong>{c.business.name}</strong><div className="small muted">{c.business.user.email}</div></td>
                    <td>{CHANNELS[c.provider].name}</td>
                    <td className="small">{c.profileUrl}{extra.secondary ? ` · ${extra.secondary}` : ""}</td>
                    <td className="small">
                      {extra.accessConfirmedAt
                        ? <span className="badge badge-good">Confirmed</span>
                        : extra.accessGranted
                          ? <span className="badge badge-warn">Client says given</span>
                          : <span className="badge badge-dark">Not given yet</span>}
                    </td>
                    <td>
                      {!extra.accessConfirmedAt && (
                        <form action={confirmAccess}>
                          <input type="hidden" name="businessId" value={c.businessId} />
                          <input type="hidden" name="provider" value={c.provider} />
                          <button className="btn btn-ghost btn-sm">Confirm access</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">No accounts linked by hand yet.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }} id="clients">
        <h2>Clients</h2>
        <table className="simple">
          <thead><tr><th>Business</th><th>Owner</th><th>Plan</th><th>Results, 30 days</th><th>Wallet</th><th>Channels</th><th>Last active</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const b = u.business;
              const channels = b?.connections.filter((c) => c.status === "active" || c.status === "linked").length ?? 0;
              return (
                <tr key={u.id}>
                  <td><strong>{b?.name ?? "No business profile yet"}</strong><div className="small muted">{b?.industry}{b?.location ? ` · ${b.location}` : ""}</div></td>
                  <td className="small">{u.name}<div className="muted">{u.email}</div></td>
                  <td className="small">{TIERS[u.tier].name}{u.subscriptionStatus && u.tier !== "TRIAL" ? <div className="muted">{u.subscriptionStatus}</div> : null}<div className="muted">joined {formatDate(u.createdAt)}</div></td>
                  <td className="small">
                    {b ? <>{leadsByBiz.get(b.id) ?? 0} leads · {wonByBiz.get(b.id)?.n ?? 0} won<div className="muted">{usd(wonByBiz.get(b.id)?.cents ?? 0)} revenue</div></> : "–"}
                  </td>
                  <td className="small">{b ? usd(b.walletBalanceCents, 2) : "–"}<div className="muted">{b?.adSpendMode === "OWN_ACCOUNTS" ? "own accounts" : b ? `$${b.monthlyBudget.toLocaleString()}/mo budget` : ""}</div></td>
                  <td className="small">{channels} / 6</td>
                  <td className="small">{b && lastByBusiness.get(b.id) ? formatDate(lastByBusiness.get(b.id)!) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card" id="stripe">
        <h2>Client Stripe accounts</h2>
        <p className="muted small">Connected accounts under Elevated&apos;s Stripe platform. Clients own them; you can see them in Stripe under Connect → Accounts.</p>
        {stripeClients.length ? (
          <table className="simple">
            <tbody>
              {stripeClients.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.business!.name}</strong><div className="small muted">{u.email}</div></td>
                  <td className="small"><code>{u.business!.stripeAccountId}</code></td>
                  <td>
                    <span className={`badge ${u.business!.stripeChargesEnabled ? "badge-good" : "badge-warn"}`}>
                      {u.business!.stripeChargesEnabled ? "Taking payments" : u.business!.stripeDetailsSubmitted ? "In review" : "Setup not finished"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No client Stripe accounts yet.</p>
        )}
      </div>
    </>
  );
}
