export function decodeEntities(input: string): string {
  let value = input;
  for (let pass = 0; pass < 2; pass += 1) {
    value = value
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeCode(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec: string) => safeCode(Number.parseInt(dec, 10)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
  }
  return value;
}

function safeCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function stripNoise(text: string): string {
  return text
    .replace(/The post .+? appeared first on The GitHub Blog\.?/g, "")
    .replace(/\n?Tags:\s[\s\S]+$/i, "")
    .trim();
}

export function htmlToText(html: string): string {
  const withoutCdata = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const decoded = decodeEntities(withoutCdata);
  const noScript = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withBreaks = noScript
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const lines = stripped
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1] !== ""));
  return stripNoise(lines.join("\n").replace(/\n{3,}/g, "\n\n"));
}

export function truncate(value: string, max = 460): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}

export function excerptFromHtml(html: string, max = 460): string {
  const text = htmlToText(html);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^tags:/i.test(line));
  const bullets = lines.filter((line) => line.startsWith("•") || line.length > 40);
  const chosen = (bullets.length > 0 ? bullets : lines).slice(0, 5).join(" ");
  return truncate(chosen || text, max);
}

export function plainTitle(value: string): string {
  return htmlToText(value).replace(/\s+/g, " ").trim();
}

export function titleFromFeed(title: string, rawHtml: string): string {
  const clean = plainTitle(title);
  if (/^[A-Z][a-z]{2,9} \d{1,2}, \d{4}$/.test(clean)) {
    const decoded = decodeEntities(rawHtml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
    const heading = decoded.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (heading?.[1]) {
      const inner = plainTitle(heading[1]);
      if (inner) return inner;
    }
  }
  return clean;
}
