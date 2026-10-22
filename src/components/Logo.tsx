import Link from "next/link";

export function Logo({ variant = "color", href = "/" }: { variant?: "color" | "white"; href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Elevated Digital Marketing home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={variant === "white" ? "/brand/logo-white.svg" : "/brand/logo.svg"} alt="Elevated Digital Marketing" />
    </Link>
  );
}
