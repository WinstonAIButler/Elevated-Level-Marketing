import { requireUser } from "@/lib/auth";
import { BusinessForm } from "./BusinessForm";

export const metadata = { title: "Business profile" };

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
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
        <BusinessForm business={user.business} />
      </div>
    </>
  );
}
