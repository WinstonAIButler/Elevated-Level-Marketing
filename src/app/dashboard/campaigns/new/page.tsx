import { requireBusiness } from "@/lib/auth";
import { CampaignForm } from "./CampaignForm";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const { business } = await requireBusiness();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>New campaign</h1>
          <p className="muted">Give us the goal and channels. We&apos;ll write everything for {business.name}.</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 820 }}>
        <CampaignForm defaultAudience={business.targetAudience} />
      </div>
    </>
  );
}
