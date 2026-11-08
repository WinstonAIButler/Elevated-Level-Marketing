"use client";
import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Phone-only top bar: logo on the left, a menu button in the top-right corner that
 * opens every portal tab (children). Closes on navigation, Escape, or tapping the backdrop.
 */
export function MobileMenu({ logo, children }: { logo: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const id = useId();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="mobile-bar">
      <div className="mobile-bar-inner">
        {logo}
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`burger ${open ? "x" : ""}`} aria-hidden="true"><i /><i /><i /></span>
          <span className="menu-word">{open ? "Close" : "Menu"}</span>
        </button>
      </div>
      {open && <div className="mobile-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav id={id} className={`mobile-menu ${open ? "open" : ""}`} aria-label="Portal" hidden={!open}>
        {children}
      </nav>
    </div>
  );
}
