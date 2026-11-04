const PRERELEASE =
  /(\d+\.\d+\.\d+[.-](?:alpha|beta|rc|pre|preview|nightly|canary|dev|insiders)\b)|\b(?:nightly|canary|insiders|prerelease|pre-release)\b|\balpha\b|\bpreview\b|[-.]rc\d*\b/i;

/** `v2.1.318` has no word boundary between v and 2. */
function loose(title: string): string {
  return title.replace(/\bv(?=\d)/gi, "");
}

export function isPrereleaseTitle(title: string): boolean {
  return PRERELEASE.test(loose(title));
}

export function semverOf(title: string): { major: number; minor: number; patch: number; raw: string } | null {
  const match = loose(title).match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

export function versionLabel(title: string): string | null {
  const match = loose(title).match(/\b(\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?)\b/);
  return match?.[1] ?? semverOf(title)?.raw ?? null;
}

/** Patch-releases are version-shaped titles (Grok Build 1.0.70, v2.1.318), not feature headlines. */
export function isPatchRelease(title: string): boolean {
  if (isPrereleaseTitle(title)) return false;
  const version = semverOf(title);
  if (!version || version.patch === 0) return false;
  const stripped = loose(title)
    .replace(/\b\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?\b/g, " ")
    .replace(/\b(release|version|grok\s+build|v)\b/gi, " ")
    .replace(/[^a-z]+/gi, " ")
    .trim();
  return stripped.length < 18;
}
