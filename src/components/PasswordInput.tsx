"use client";
import { useState } from "react";

/** Password field with a Show/Hide button so people can check what they typed. */
export function PasswordInput({
  id = "password",
  autoComplete,
  minLength,
}: {
  id?: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        id={id}
        name="password"
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        minLength={minLength}
        required
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
