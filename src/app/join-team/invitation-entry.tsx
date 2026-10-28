"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvitationEntry() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  function openInvitation() {
    let token = value.trim();
    try {
      if (token.includes("/")) {
        const parsed = new URL(token);
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
        const match = parsed.pathname.match(/^\/invite\/([a-f0-9]{64})\/?$/);
        if (!match) throw new Error();
        token = match[1]!;
      }
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error();
      setError("");
      router.push("/invite/" + token);
    } catch {
      setError("Enter the complete invitation link sent by your restaurant administrator.");
    }
  }
  return (
    <form className="mm-auth-form" onSubmit={(event) => { event.preventDefault(); openInvitation(); }}>
      <label className="mm-auth-field" htmlFor="invite-link">Your invitation link
        <input id="invite-link" type="text" autoComplete="off" value={value}
          placeholder="https://food.bababuilds.com/invite/..."
          onChange={(event) => setValue(event.target.value)} required />
      </label>
      {error && <p role="alert" className="mm-auth-message mm-auth-message--error">{error}</p>}
      <button type="submit" className="mm-auth-submit">Continue to invitation</button>
    </form>
  );
}
