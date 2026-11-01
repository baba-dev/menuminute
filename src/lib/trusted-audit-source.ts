import { isIP } from "node:net";

/** Only Nginx's overwritten X-Real-IP may identify a visitor in audit events.
 * Never record unparsed X-Forwarded-For supplied by clients.
 */
export function trustedAuditIp(headers: Pick<Headers, "get">): string {
  const value = headers.get("x-real-ip");
  return value && isIP(value) !== 0 ? value : "unknown";
}
