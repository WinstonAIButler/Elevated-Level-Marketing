import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHECK_COOKIE } from "@/lib/visibility";
import { BusinessForm } from "./BusinessForm";

export const metadata = { title: "Business profile" };

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  // Prefill from the free visibility check they ran before signing up.
  const checkId = user.business ? null : (await cookies()).get(CHECK_COOKIE)?.value;
  const check = checkId ? await db.visibilityCheck.findFirst({ where: { id: checkId, businessId: null } }) : null;
  const defaults = check ? { name: check.businessName, website: check.url, location: check.city, industry: check.industry } : undefined;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{user.business ? "Business profile" : "Tell us about your business"}</h1>
          <p className="muted">
            {welcome
              ? "Welcome aboard! This profile powers your assessment, plan and every campaign we generate."
              : "The more specific you are, the sharper your plan and campaigns will be."}
          </p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 820 }}>
        {check && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            We filled in what you gave us in your visibility check. Your report will be saved to your account.
          </div>
        )}
        <BusinessForm business={user.business} defaults={defaults} />
      </div>
    </>
  );
}
