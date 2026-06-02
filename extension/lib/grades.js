/** Hours per grade tier (extension estimates). */
export const GRADE_HOURS = {
  P: 1.5,
  C: 2.5,
  D: 5,
  HD: 12,
};

/**
 * Parse P/C/D/HD from OnTrack task abbreviation (e.g. "7.3HD", "1.1.1P", "3.0GP").
 * GP (group pass) is treated like P.
 */
export function parseGradeFromAbbreviation(abbreviation) {
  if (!abbreviation) return null;
  const abbr = String(abbreviation).trim();
  if (abbr.endsWith("HD")) return "HD";
  if (abbr.endsWith("GP")) return "P";
  const last = abbr.slice(-1);
  if (last === "P" || last === "C" || last === "D") return last;
  return null;
}

export function estimateHours(grade) {
  if (!grade || !(grade in GRADE_HOURS)) return null;
  return GRADE_HOURS[grade];
}

export function formatHours(hours) {
  if (hours == null) return "—";
  if (hours === 1) return "1 hr";
  return `${hours} hrs`;
}
