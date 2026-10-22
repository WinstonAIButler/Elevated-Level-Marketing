// Vercel build: run database migrations when a database is connected, then build.
// Without DATABASE_URL the build still succeeds (so the deploy shows what is
// missing at /api/health) instead of failing before the site exists.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("prisma generate");
if (process.env.DATABASE_URL) {
  run("prisma migrate deploy");
} else {
  console.warn(
    "\n[vercel-build] DATABASE_URL is not set, so database migrations were skipped.\n" +
      "[vercel-build] Add a Neon database under Storage in the Vercel project, then redeploy.\n",
  );
}
run("next build");
