import { cookies } from "next/headers";

// This is a commercial UI restriction marker, NOT an authentication credential.
// TWA's entry endpoint sets it before redirecting into the logged-in workspace.
export const PLAY_CLIENT_COOKIE = "menuminute.play_client";

export async function isPlayClient(): Promise<boolean> {
  return (await cookies()).get(PLAY_CLIENT_COOKIE)?.value === "1";
}
