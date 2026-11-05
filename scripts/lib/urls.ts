import { createHash } from "node:crypto";

const TRACKING = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "ref", "ref_src"];

export function canonicalUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol === "http:") url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of TRACKING) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function itemId(url: string): string {
  return createHash("sha256").update(canonicalUrl(url)).digest("hex").slice(0, 16);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
