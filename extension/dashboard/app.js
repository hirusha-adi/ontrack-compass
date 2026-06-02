import {
  fetchProject,
  fetchUnit,
  fetchEnrolledProjects,
  fetchAllEnrolledTasks,
  mergeTasks,
  sortTasksByDueDate,
  computeTaskStats,
} from "../lib/ontrack-api.js";
import { formatHours } from "../lib/grades.js";
import { loadTodos, saveTodos, createTodo } from "../lib/todos.js";
import {
  getStatusTheme,
  renderStatusBadge,
  statusLegendEntries,
} from "../lib/task-status.js";
import { renderCharts } from "../lib/charts.js";

const $ = (id) => document.getElementById(id);

const VIEW_STORAGE_KEY = "compass_view_mode";

let viewMode = "unit";
let currentProjectId = null;
let currentTasks = [];
let currentProject = null;
let currentUnit = null;
let enrolledProjects = [];
let taskBundles = [];
let selectedTaskId = null;

function showAlert(message, type = "warning") {
  $("alert-area").innerHTML = `
    <div role="alert" class="alert-banner alert-banner--${type}">
      <span>${escapeHtml(message)}</span>
    </div>`;
}

function clearAlert() {
  $("alert-area").innerHTML = "";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const due = new Date(isoDate + "T23:59:59");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function renderStatusLegend() {
  const el = $("status-legend");
  if (!el) return;
  el.innerHTML = statusLegendEntries()
    .map(
      ({ label, color }) => `
    <li class="status-legend-item">
      <span class="status-dot shrink-0" style="background-color: ${color}"></span>
      <span>${escapeHtml(label)}</span>
    </li>`
    )
    .join("");
}

function dueLabelClass(task) {
  if (task.status === "complete") return "text-md-text-secondary";
  const days = daysUntil(task.dueDate);
  if (days !== null && (days < 0 || task.status === "time_exceeded")) {
    return "font-medium";
  }
  if (days !== null && days <= 3) return "font-medium";
  return "text-md-text-secondary";
}

function dueLabelStyle(task) {
  if (task.status === "complete") return "";
  const days = daysUntil(task.dueDate);
  if (days !== null && (days < 0 || task.status === "time_exceeded")) {
    return `color: ${getStatusTheme("time_exceeded").color}`;
  }
  if (days !== null && days <= 3) {
    return `color: ${getStatusTheme("attention_required").color}`;
  }
  return "";
}

function statusBadgeHtml(status) {
  const st = renderStatusBadge(status);
  return `<div class="status-badge shrink-0" style="${st.badgeStyle}">
      <span class="status-dot" style="${st.dotStyle}"></span>
      ${escapeHtml(st.theme.label)}
    </div>`;
}

function dueLabel(task) {
  if (task.status === "complete") {
    if (task.submissionDate) {
      return `Submitted ${formatDate(task.submissionDate)}`;
    }
    if (task.completionDate) {
      return `Completed ${formatDate(task.completionDate)}`;
    }
    return "Completed";
  }
  const days = daysUntil(task.dueDate);
  if (days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return formatDate(task.dueDate);
}

function gradePill(grade) {
  if (!grade) return "";
  return `<span class="grade-pill grade-pill--${grade}">${grade}</span>`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function taskKey(task) {
  return `${task.projectId}-${task.id}`;
}

function findTaskByKey(key) {
  return currentTasks.find((t) => taskKey(t) === key);
}

function setViewMode(mode) {
  viewMode = mode;
  browser.storage.local.set({ [VIEW_STORAGE_KEY]: mode });

  $("mode-unit").classList.toggle("mat-tab--active", mode === "unit");
  $("mode-all").classList.toggle("mat-tab--active", mode === "all");
  $("unit-picker-wrap").classList.toggle("hidden", mode !== "unit");
  $("enrolled-units-wrap").classList.toggle("hidden", mode !== "all");
  $("unit-breakdown-section").classList.toggle("hidden", mode !== "all" || !taskBundles.length);

  const codes = enrolledProjects.map((p) => p.unit?.code).filter(Boolean);
  $("enrolled-hint").classList.toggle("hidden", mode !== "all");
  $("enrolled-hint").textContent =
    codes.length > 0
      ? `${codes.length} units in your current teaching period`
      : "";

  $("tasks-subtitle").textContent =
    mode === "all"
      ? "All tasks from enrolled units · sorted by due date"
      : "Sorted by due date";

  clearSelection();
}

function clearSelection() {
  selectedTaskId = null;
  renderTaskDetail(null);
}

function revealStats() {
  $("stats-row").classList.remove("hidden");
}

function updateStats() {
  const stats = computeTaskStats(currentTasks);
  $("stat-total-count").textContent = String(stats.total);
  $("stat-incomplete-count").textContent = String(stats.incomplete);
  $("stat-complete-count").textContent = String(stats.complete);
  $("stat-hours-remaining").textContent = formatHours(stats.hoursRemaining);
  $("stat-hours-total").textContent = formatHours(stats.hoursTotal);

  if (viewMode === "all") {
    $("stat-units-count").textContent = String(enrolledProjects.length);
  }

  const meta = $("stats-meta");
  const parts = [
    `${stats.complete} complete`,
    `${formatHours(stats.hoursTotal)} total workload`,
  ];
  if (viewMode === "all" && enrolledProjects.length) {
    parts.push(`${enrolledProjects.length} units`);
  }
  meta.textContent = parts.join(" · ");
  meta.classList.remove("hidden");

  revealStats();
  refreshCharts();
}

function refreshCharts() {
  renderCharts(currentTasks, {
    bundles: taskBundles,
    viewMode,
  });
}

function renderUnitBreakdown() {
  const section = $("unit-breakdown-section");
  const container = $("unit-breakdown");

  if (viewMode !== "all" || !taskBundles.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  container.innerHTML = taskBundles
    .map(({ project, unit, tasks }) => {
      const s = computeTaskStats(tasks);
      return `
      <div class="unit-stat-card">
        <div class="flex items-center justify-between gap-2">
          <span class="mat-chip mat-chip--primary font-mono">${escapeHtml(unit.code)}</span>
          <span class="text-xs text-md-text-secondary">${s.incomplete} open</span>
        </div>
        <p class="mt-2 text-sm text-md-text-secondary line-clamp-2">${escapeHtml(unit.name)}</p>
        <div class="mt-3 flex flex-wrap gap-3 text-xs tabular-nums text-md-text-secondary">
          <span><strong class="text-md-text-primary">${s.total}</strong> tasks</span>
          <span><strong class="text-md-text-primary">${formatHours(s.hoursRemaining)}</strong> left</span>
        </div>
      </div>`;
    })
    .join("");
}

function renderTaskDetail(task) {
  const empty = $("task-detail-empty");
  const content = $("task-detail-content");

  if (!task) {
    empty.classList.remove("hidden");
    content.classList.add("hidden");
    content.innerHTML = "";
    return;
  }

  empty.classList.add("hidden");
  content.classList.remove("hidden");

  const st = renderStatusBadge(task.status);
  const desc = stripHtml(task.description);
  const descBlock = desc
    ? `<p class="text-sm text-md-text-secondary leading-relaxed max-h-40 overflow-y-auto border-t border-md-divider pt-3">${escapeHtml(desc.slice(0, 1200))}${desc.length > 1200 ? "…" : ""}</p>`
    : `<p class="text-sm text-md-text-disabled italic">No description</p>`;

  content.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      ${gradePill(task.grade)}
      <span class="font-mono text-xs text-md-text-secondary">${escapeHtml(task.abbreviation)}</span>
      ${viewMode === "all" ? `<span class="mat-chip">${escapeHtml(task.unitCode)}</span>` : ""}
    </div>
    <h3 class="text-base font-medium leading-snug text-md-text-primary">${escapeHtml(task.name)}</h3>
    <div class="status-badge" style="${st.badgeStyle}">
      <span class="status-dot" style="${st.dotStyle}"></span>
      ${escapeHtml(st.theme.label)}
    </div>
    ${descBlock}
    <dl class="detail-dl grid grid-cols-2 gap-x-4 gap-y-3 border-t border-md-divider pt-3">
      <div><dt>Due</dt><dd>${formatDate(task.dueDate)}</dd></div>
      <div><dt>Estimate</dt><dd>${formatHours(task.estimatedHours)}</dd></div>
      <div><dt>Weight</dt><dd>${task.weighting != null ? `${task.weighting}%` : "—"}</dd></div>
      <div><dt>Extensions</dt><dd>${task.extensions || 0}</dd></div>
      ${task.submissionDate ? `<div><dt>Submitted</dt><dd>${formatDate(task.submissionDate)}</dd></div>` : ""}
      ${task.completionDate ? `<div><dt>Completed</dt><dd>${formatDate(task.completionDate)}</dd></div>` : ""}
    </dl>
    <a href="${escapeHtml(task.ontrackUrl)}" target="_blank" rel="noopener" class="btn-contained normal-case">
      Open in OnTrack
    </a>`;
}

function selectTask(task) {
  selectedTaskId = taskKey(task);
  renderTaskDetail(task);
  document.querySelectorAll(".task-card").forEach((el) => {
    el.classList.toggle("task-card--selected", el.dataset.taskKey === selectedTaskId);
  });
}

function renderTasks() {
  const showCompleted = $("show-completed").checked;
  const list = $("tasks-list");
  const filtered = showCompleted
    ? currentTasks
    : currentTasks.filter((t) => t.status !== "complete");
  const sorted = sortTasksByDueDate(filtered);

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p class="font-medium text-md-text-primary">All caught up</p>
        <p class="mt-1 text-sm text-md-text-secondary">No tasks match your filters</p>
      </div>`;
    return;
  }

  list.innerHTML = `<div class="task-list">${sorted
    .map((t) => {
      const isDone = t.status === "complete";
      const key = taskKey(t);
      const selected = key === selectedTaskId ? " task-card--selected" : "";
      const accent = renderStatusBadge(t.status);
      const unitBadge =
        viewMode === "all"
          ? `<span class="mat-chip shrink-0">${escapeHtml(t.unitCode)}</span>`
          : "";

      return `
    <article class="task-card${selected}" data-task-key="${key}">
      <div class="task-card__accent" style="${accent.accentStyle}"></div>
      <div class="flex gap-4 px-4 py-3 ${isDone ? "opacity-60" : ""}">
        <div class="hidden sm:flex w-12 shrink-0 flex-col items-center pt-0.5">
          ${t.grade ? gradePill(t.grade) : '<span class="text-xs text-md-text-disabled">—</span>'}
          <span class="mt-1 font-mono text-[10px] text-md-text-secondary">${escapeHtml(t.abbreviation)}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="mb-1 flex flex-wrap items-center gap-2 sm:hidden">
                ${unitBadge}
                ${gradePill(t.grade)}
                <span class="font-mono text-[10px] text-md-text-secondary">${escapeHtml(t.abbreviation)}</span>
              </div>
              <div class="mb-1 hidden sm:flex">${unitBadge}</div>
              <h3 class="text-sm font-medium leading-snug text-md-text-primary ${isDone ? "line-through" : ""}">${escapeHtml(t.name)}</h3>
            </div>
            ${statusBadgeHtml(t.status)}
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span class="${dueLabelClass(t)}" style="${dueLabelStyle(t)}">${escapeHtml(dueLabel(t))}</span>
            <span class="text-md-text-secondary tabular-nums">${formatHours(t.estimatedHours)} est.</span>
            ${t.weighting != null ? `<span class="text-md-text-secondary">${t.weighting}%</span>` : ""}
            ${t.extensions ? `<span class="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-md-warning ring-1 ring-amber-200">+${t.extensions} ext</span>` : ""}
            ${isDone && t.submissionDate ? `<span class="text-md-text-secondary">Due ${formatDate(t.dueDate)}</span>` : ""}
          </div>
        </div>
        <div class="hidden md:block shrink-0 text-right text-xs text-md-text-secondary">
          ${
            isDone
              ? `
          ${t.submissionDate ? `<div class="section-title mb-0.5">Submitted</div><time class="font-medium text-md-text-primary">${formatDate(t.submissionDate)}</time>` : ""}
          ${t.completionDate ? `<div class="section-title mb-0.5 ${t.submissionDate ? "mt-1.5" : ""}">Completed</div><time class="font-medium text-md-text-primary">${formatDate(t.completionDate)}</time>` : ""}
          ${!t.submissionDate && !t.completionDate ? `<div class="section-title mb-0.5">Completed</div><time class="font-medium text-md-text-primary">${formatDate(t.dueDate)}</time>` : ""}
          ${t.dueDate ? `<div class="section-title mb-0.5 mt-1.5">Due</div><time>${formatDate(t.dueDate)}</time>` : ""}`
              : `
          <div class="section-title mb-0.5">Due</div>
          <time class="font-medium text-md-text-primary">${formatDate(t.dueDate)}</time>`
          }
        </div>
      </div>
    </article>`;
    })
    .join("")}</div>`;

  list.querySelectorAll(".task-card").forEach((el) => {
    el.addEventListener("click", () => {
      const task = findTaskByKey(el.dataset.taskKey);
      if (task) selectTask(task);
    });
  });

  if (selectedTaskId) {
    const still = findTaskByKey(selectedTaskId);
    if (still) renderTaskDetail(still);
    else clearSelection();
  }
}

function renderUnitSummary() {
  const el = $("unit-summary");
  if (viewMode !== "unit" || !currentProject || !currentUnit) {
    el.classList.add("hidden");
    return;
  }
  const u = currentUnit;
  const p = currentProject;
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="flex flex-wrap items-baseline gap-2">
      <span class="mat-chip mat-chip--primary font-mono">${escapeHtml(u.code)}</span>
      <h2 class="text-base font-medium text-md-text-primary">${escapeHtml(u.name)}</h2>
    </div>
    <p class="text-sm text-md-text-secondary">
      ${formatDate(u.start_date)} – ${formatDate(u.end_date)}
      · Target grade ${p.target_grade ?? "—"}
    </p>
    <a class="text-sm font-medium text-md-primary hover:underline mt-1 inline-block"
      href="https://ontrack.deakin.edu.au/projects/${p.id}/dashboard/" target="_blank" rel="noopener">
      Open in OnTrack
    </a>`;
}

function renderEnrolledChips() {
  $("enrolled-units-chips").innerHTML = enrolledProjects
    .map(
      (p) =>
        `<span class="mat-chip font-mono" title="${escapeHtml(p.unit?.name || "")}">${escapeHtml(p.unit?.code || "?")}</span>`
    )
    .join("");
}

function renderLoadingTasks() {
  $("tasks-list").innerHTML = `
    <div class="divide-y divide-md-divider">
      ${[1, 2, 3, 4].map(() => `<div class="skeleton m-3"></div>`).join("")}
    </div>`;
}

async function loadProject(projectId) {
  clearAlert();
  currentProjectId = projectId;
  taskBundles = [];
  await browser.runtime.sendMessage({ type: "SAVE_LAST_PROJECT", projectId });

  renderLoadingTasks();
  try {
    currentProject = await fetchProject(projectId);
    currentUnit = await fetchUnit(currentProject.unit_id);
    currentTasks = mergeTasks(currentProject, currentUnit);
    renderUnitSummary();
    updateStats();
    renderUnitBreakdown();
    renderTasks();
    await renderTodoList();
  } catch (err) {
    showAlert(err.message || String(err), "error");
    $("tasks-list").innerHTML = `
      <div class="empty-state">
        <p class="text-md-error font-medium">Could not load tasks</p>
        <p class="mt-1 text-sm text-md-text-secondary">${escapeHtml(err.message || String(err))}</p>
      </div>`;
  }
}

async function loadAllEnrolled() {
  clearAlert();
  currentProjectId = null;
  currentProject = null;
  currentUnit = null;

  renderLoadingTasks();

  try {
    const data = await fetchAllEnrolledTasks();
    enrolledProjects = data.projects.map((p, i) => ({
      id: p.id,
      unit: data.units[i],
    }));
    taskBundles = data.bundles;
    currentTasks = data.tasks;

    renderEnrolledChips();
    $("unit-summary").classList.add("hidden");
    updateStats();
    renderUnitBreakdown();
    renderTasks();
    $("todo-form").classList.add("opacity-50", "pointer-events-none");
    $("todo-empty").textContent = "Todos are per-unit — switch to Single unit view.";
    $("todo-list").innerHTML = "";
    $("todo-empty").classList.remove("hidden");
  } catch (err) {
    showAlert(err.message || String(err), "error");
    $("tasks-list").innerHTML = "";
  }
}

async function populateProjectSelect() {
  const select = $("project-select");
  try {
    enrolledProjects = await fetchEnrolledProjects();
    renderEnrolledChips();

    if (enrolledProjects.length === 0) {
      select.innerHTML = '<option value="">No currently enrolled units</option>';
      showAlert(
        "No units found in the current teaching period. Check that you are logged in to OnTrack.",
        "warning"
      );
      return;
    }

    const authRes = await browser.runtime.sendMessage({ type: "GET_AUTH" });
    const lastId = authRes?.lastProjectId;

    select.innerHTML = enrolledProjects
      .map((p) => {
        const label = `${p.unit?.code || "?"} — ${p.unit?.name || "Project " + p.id}`;
        const selected = p.id === lastId ? " selected" : "";
        return `<option value="${p.id}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");

    const stored = await browser.storage.local.get(VIEW_STORAGE_KEY);
    if (stored[VIEW_STORAGE_KEY] === "all") {
      setViewMode("all");
      await loadAllEnrolled();
    } else {
      setViewMode("unit");
      $("todo-form").classList.remove("opacity-50", "pointer-events-none");
      if (lastId && enrolledProjects.some((p) => p.id === lastId)) {
        await loadProject(lastId);
      } else if (enrolledProjects.length > 0) {
        select.value = String(enrolledProjects[0].id);
      }
    }
  } catch (err) {
    select.innerHTML = '<option value="">Could not load projects</option>';
    showAlert(err.message || String(err), "error");
  }
}

async function renderTodoList() {
  const list = $("todo-list");
  const empty = $("todo-empty");
  if (viewMode !== "unit" || !currentProjectId) return;

  empty.textContent = "Nothing here yet — add your first todo above.";
  const todos = await loadTodos(currentProjectId);
  if (todos.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = todos
    .map(
      (todo) => `
    <li class="todo-item group/todo">
      <input type="checkbox" class="checkbox checkbox-primary checkbox-sm rounded-sm todo-check"
        data-id="${todo.id}" ${todo.done ? "checked" : ""} />
      <span class="flex-1 text-sm leading-snug ${todo.done ? "line-through text-md-text-disabled" : "text-md-text-primary"}">${escapeHtml(todo.text)}</span>
      <button type="button" class="todo-delete shrink-0 rounded p-1 text-md-text-disabled opacity-0 transition-all hover:bg-red-50 hover:text-md-error group-hover/todo:opacity-100"
        data-id="${todo.id}" aria-label="Delete todo">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
        </svg>
      </button>
    </li>`
    )
    .join("");

  list.querySelectorAll(".todo-check").forEach((el) => {
    el.addEventListener("change", async () => {
      const id = el.dataset.id;
      const updated = todos.map((t) => (t.id === id ? { ...t, done: el.checked } : t));
      await saveTodos(currentProjectId, updated);
      await renderTodoList();
    });
  });

  list.querySelectorAll(".todo-delete").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id;
      await saveTodos(currentProjectId, todos.filter((t) => t.id !== id));
      await renderTodoList();
    });
  });
}

$("mode-unit").addEventListener("click", async () => {
  setViewMode("unit");
  $("todo-form").classList.remove("opacity-50", "pointer-events-none");
  const id = parseInt($("project-select").value, 10);
  if (id) await loadProject(id);
  else clearSelection();
});

$("mode-all").addEventListener("click", async () => {
  setViewMode("all");
  await loadAllEnrolled();
});

$("project-select").addEventListener("change", () => {
  if (viewMode !== "unit") return;
  const id = parseInt($("project-select").value, 10);
  if (id) loadProject(id);
});

$("btn-refresh").addEventListener("click", () => {
  const btn = $("btn-refresh");
  btn.disabled = true;
  populateProjectSelect().finally(() => {
    btn.disabled = false;
  });
});

$("show-completed").addEventListener("change", renderTasks);

$("todo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (viewMode !== "unit" || !currentProjectId) {
    showAlert("Switch to Single unit view and load a unit to use todos.", "warning");
    return;
  }
  const input = $("todo-input");
  const text = input.value.trim();
  if (!text) return;
  const todos = await loadTodos(currentProjectId);
  todos.push(createTodo(text));
  await saveTodos(currentProjectId, todos);
  input.value = "";
  await renderTodoList();
});

populateProjectSelect();
renderStatusLegend();
refreshCharts();
