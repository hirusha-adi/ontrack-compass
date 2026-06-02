/**
 * A project is "currently enrolled" when its unit is active and today falls
 * within the unit teaching period (start_date … end_date).
 */
export function isCurrentlyEnrolled(project) {
  const unit = project?.unit;
  if (!unit?.active) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (unit.start_date) {
    const start = new Date(unit.start_date + "T00:00:00");
    if (today < start) return false;
  }

  if (unit.end_date) {
    const end = new Date(unit.end_date + "T23:59:59");
    if (today > end) return false;
  }

  return true;
}

export function filterEnrolledProjects(projects) {
  return (projects || [])
    .filter(isCurrentlyEnrolled)
    .sort((a, b) =>
      (a.unit?.code || "").localeCompare(b.unit?.code || "")
    );
}
