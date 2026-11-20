import { t } from "../i18n/t";

// How many of a game's platforms are named before the rest are counted.
const maxPlatformsNamed = 3;

// The platforms that lead a game's list, by IGDB's abbreviation, in their order (ADR-0012): PC,
// then PlayStation, Xbox and Nintendo, each from oldest to newest. Any other platform follows
// them, by name.
const leadingPlatforms: readonly string[] = [
  "PC",
  // PlayStation
  "PS1",
  "PS2",
  "PSP",
  "PS3",
  "Vita",
  "PS4",
  "PSVR",
  "PS5",
  "PSVR2",
  // Xbox
  "XBOX",
  "X360",
  "XONE",
  "Series X|S",
  // Nintendo
  "NES",
  "famicom",
  "FDS",
  "GB",
  "SNES",
  "SFAM",
  "VB",
  "N64",
  "GBC",
  "GBA",
  "NGC",
  "NDS",
  "Wii",
  "3DS",
  "WiiU",
  "New 3DS",
  "Switch",
  "Switch 2",
];

function rank(platform: string): number {
  const index = leadingPlatforms.indexOf(platform);
  return index === -1 ? leadingPlatforms.length : index;
}

// A game's platforms in the order ADR-0012 lists them.
export function orderedPlatforms(platforms: readonly string[]): string[] {
  return platforms.toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// A game's platforms in one line, the first three in order and then how many more, "PC, PS4, PS5
// +4". Null for a game with none.
export function platformsLine(platforms: readonly string[]): string | null {
  if (platforms.length === 0) return null;
  const ordered = orderedPlatforms(platforms);
  const named = ordered.slice(0, maxPlatformsNamed).join(", ");
  const more = ordered.length - maxPlatformsNamed;
  return more > 0 ? t("game.platformsAndMore", { platforms: named, more }) : named;
}

// Facts in one line, those known, "2015 · PC, PS4, PS5 +4"; null when none is.
function factsLine(facts: readonly (string | null)[]): string | null {
  const known = facts.filter((fact) => fact !== null);
  return known.length > 0 ? known.join(" · ") : null;
}

// What a game's Search row says under its title: the year it first came out and its platforms,
// "1997 · PS1", leaving out whichever is unknown. Null when neither is known.
export function yearAndPlatforms({
  year,
  platforms,
}: {
  year: number | null;
  platforms: readonly string[];
}): string | null {
  return factsLine([year === null ? null : String(year), platformsLine(platforms)]);
}

// What a game's page says under its title, as far as it is known: the year it first came out, its
// developer and its platforms, "2015 · CD Projekt RED · PC, PS4, PS5 +4". Its title has no year,
// since the year leads this line. Null when none of it is known.
export function gameFacts({
  year,
  developer,
  platforms,
}: {
  year: number | null;
  developer: string | null;
  platforms: readonly string[];
}): string | null {
  return factsLine([year === null ? null : String(year), developer, platformsLine(platforms)]);
}
