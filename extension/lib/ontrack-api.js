import { parseGradeFromAbbreviation, estimateHours } from "./grades.js";
import { filterEnrolledProjects } from "./enrollment.js";
import { isOpenTask } from "./task-status.js";

export { STATUS_LABELS } from "./task-status.js";

export function apiFetch(path) {
  return browser.runtime.sendMessage({ type: "API_FETCH", path });
}

export async function fetchProject(projectId) {
  const res = await apiFetch(`/projects/${projectId}`);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function fetchUnit(unitId) {
  const res = await apiFetch(`/units/${unitId}`);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function fetchProjects() {
  const res = await apiFetch("/projects/?include_in_active=false");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function fetchEnrolledProjects() {
  const all = await fetchProjects();
  return filterEnrolledProjects(all);
}

/**
 * Load tasks for every currently enrolled project.
 */
export async function fetchAllEnrolledTasks() {
  const projects = await fetchEnrolledProjects();
  const bundles = await Promise.all(
    projects.map(async (summary) => {
      const project = await fetchProject(summary.id);
      const unit = await fetchUnit(project.unit_id);
      const tasks = mergeTasks(project, unit).map((t) => ({
        ...t,
        projectId: project.id,
        unitId: unit.id,
        unitCode: unit.code,
        unitName: unit.name,
      }));
      return { project, unit, tasks };
    })
  );

  const tasks = bundles.flatMap((b) => b.tasks);
  return { projects: bundles.map((b) => b.project), units: bundles.map((b) => b.unit), tasks, bundles };
}

/**
 * Merge project tasks with unit task definitions.
 */
export function mergeTasks(project, unit) {
  const defById = new Map(
    (unit.task_definitions || []).map((d) => [d.id, d])
  );

  return (project.tasks || []).map((task) => {
    const def = defById.get(task.task_definition_id) || {};
    const grade = parseGradeFromAbbreviation(def.abbreviation);
    const hours = estimateHours(grade);

    return {
      id: task.id,
      taskDefinitionId: task.task_definition_id,
      projectId: project.id,
      unitId: project.unit_id,
      unitCode: unit.code,
      unitName: unit.name,
      abbreviation: def.abbreviation || "—",
      name: def.name || `Task #${task.task_definition_id}`,
      description: def.description || "",
      weighting: def.weighting,
      grade,
      estimatedHours: hours,
      status: task.status,
      dueDate: task.due_date,
      submissionDate: task.submission_date,
      completionDate: task.completion_date,
      extensions: task.extensions,
      includeInPortfolio: task.include_in_portfolio,
      ontrackUrl: `https://ontrack.deakin.edu.au/projects/${project.id}/dashboard/`,
    };
  });
}

export function sortTasksByDueDate(tasks, { ascending = true } = {}) {
  return [...tasks].sort((a, b) => {
    const da = a.dueDate || "";
    const db = b.dueDate || "";
    if (da === db) return a.name.localeCompare(b.name);
    if (!da) return 1;
    if (!db) return -1;
    return ascending ? da.localeCompare(db) : db.localeCompare(da);
  });
}

export function computeTaskStats(tasks) {
  const total = tasks.length;
  const complete = tasks.filter((t) => t.status === "complete").length;
  const incomplete = tasks.filter((t) => isOpenTask(t.status)).length;
  return {
    total,
    complete,
    incomplete,
    hoursRemaining: sumEstimatedHours(tasks, { onlyIncomplete: true }),
    hoursTotal: sumEstimatedHours(tasks, { onlyIncomplete: false }),
  };
}

export function sumEstimatedHours(tasks, { onlyIncomplete = false } = {}) {
  return tasks.reduce((sum, t) => {
    if (onlyIncomplete && !isOpenTask(t.status)) return sum;
    return sum + (t.estimatedHours || 0);
  }, 0);
}
