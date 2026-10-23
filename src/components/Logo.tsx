import Link from "next/link";

// The full-color logo (gray arrow and lettering with the neon green outline)
// reads well on both the white header and the dark sidebar/footer.
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Elevated Digital Marketing home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.svg" alt="Elevated Digital Marketing" />
    </Link>
  );
}
