import { getStatusTheme } from "./task-status.js";
import { computeTaskStats } from "./ontrack-api.js";

/** @type {Record<string, import('chart.js').Chart>} */
const instances = {};

const FONT = "Roboto, system-ui, sans-serif";
const GRID = "#e0e0e0";
const TEXT = "rgba(0, 0, 0, 0.87)";
const TEXT_MUTED = "rgba(0, 0, 0, 0.54)";

function getChart() {
  if (typeof Chart === "undefined") {
    throw new Error("Chart.js is not loaded. Run npm run build in extension/.");
  }
  return Chart;
}

function destroyChart(key) {
  if (instances[key]) {
    instances[key].destroy();
    delete instances[key];
  }
}

function showEmpty(container, message) {
  if (!container) return;
  container.innerHTML = `<p class="text-sm text-md-text-secondary text-center py-12">${message}</p>`;
}

function ensureCanvas(container, canvasId) {
  if (!container) return null;
  container.innerHTML = `<div class="chart-canvas-wrap"><canvas id="${canvasId}"></canvas></div>`;
  return document.getElementById(canvasId);
}

export function parseIsoDate(iso) {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatChartDate(iso) {
  const d = parseIsoDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function localTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoFromChartTime(x) {
  const d = new Date(x);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function effectiveCompleteDate(task) {
  if (task.status !== "complete") return null;
  return task.completionDate || task.submissionDate || task.dueDate || null;
}

function aggregateByStatus(tasks) {
  const counts = new Map();
  for (const task of tasks) {
    const key = task.status || "not_started";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => {
      const theme = getStatusTheme(status);
      return { status, label: theme.label, color: theme.color, count };
    })
    .sort((a, b) => b.count - a.count);
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          font: { family: FONT, size: 12 },
          color: TEXT,
          usePointStyle: true,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: "rgba(33, 33, 33, 0.92)",
        titleFont: { family: FONT, size: 13, weight: "500" },
        bodyFont: { family: FONT, size: 12 },
        padding: 10,
        cornerRadius: 4,
      },
    },
  };
}

function collectTimelineDates(tasks) {
  const dates = new Set([localTodayIso()]);
  for (const t of tasks) {
    if (t.dueDate) dates.add(t.dueDate);
    if (t.submissionDate) dates.add(t.submissionDate);
    if (t.completionDate) dates.add(t.completionDate);
    const done = effectiveCompleteDate(t);
    if (done) dates.add(done);
  }
  return [...dates].sort();
}

function buildTimelineSeries(tasks) {
  const dates = collectTimelineDates(tasks);
  const withDue = tasks.filter((t) => t.dueDate);

  return dates.map((date) => {
    const dueByDate = withDue.filter((t) => t.dueDate <= date).length;
    const completeByDate = tasks.filter((t) => {
      const done = effectiveCompleteDate(t);
      return done && done <= date;
    }).length;
    return {
      date,
      dueByDate,
      completeByDate,
      openByDate: dueByDate - completeByDate,
    };
  });
}

function tasksOnDate(tasks, iso, field) {
  return tasks.filter((t) => t[field] === iso);
}

function renderPieChart(tasks) {
  const container = document.getElementById("chart-pie");
  destroyChart("pie");

  if (!tasks.length) {
    showEmpty(container, "No task data yet");
    return;
  }

  const canvas = ensureCanvas(container, "chart-pie-canvas");
  if (!canvas) return;

  const segments = aggregateByStatus(tasks);
  const Chart = getChart();

  instances.pie = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: segments.map((s) => s.label),
      datasets: [
        {
          data: segments.map((s) => s.count),
          backgroundColor: segments.map((s) => s.color),
          borderColor: "#fff",
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      ...baseOptions(),
      cutout: "58%",
      plugins: {
        ...baseOptions().plugins,
        legend: { position: "right", ...baseOptions().plugins.legend },
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label(ctx) {
              const total = tasks.length;
              const val = ctx.parsed;
              const pct = total ? Math.round((val / total) * 100) : 0;
              return ` ${val} task${val === 1 ? "" : "s"} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderBarChart(tasks, { bundles = [], viewMode = "unit" } = {}) {
  const container = document.getElementById("chart-bars");
  destroyChart("bars");

  if (!tasks.length) {
    showEmpty(container, "No task data yet");
    return;
  }

  const canvas = ensureCanvas(container, "chart-bars-canvas");
  if (!canvas) return;

  const stats = computeTaskStats(tasks);

  const labels = ["All tasks"];
  const completeData = [stats.complete];
  const remainingData = [stats.total - stats.complete];

  if (viewMode === "all" && bundles.length > 0) {
    for (const { unit, tasks: unitTasks } of bundles) {
      labels.push(unit.code);
      const done = unitTasks.filter((t) => t.status === "complete").length;
      completeData.push(done);
      remainingData.push(unitTasks.length - done);
    }
  } else {
    labels.push(tasks[0]?.unitCode || "Unit");
    completeData.push(stats.complete);
    remainingData.push(stats.total - stats.complete);
  }

  const Chart = getChart();

  instances.bars = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Complete",
          data: completeData,
          backgroundColor: "#66bb6a",
          borderRadius: 4,
        },
        {
          label: "Remaining",
          data: remainingData,
          backgroundColor: "#e0e0e0",
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...baseOptions(),
      indexAxis: "y",
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          grid: { color: GRID },
          ticks: {
            font: { family: FONT, size: 11 },
            color: TEXT_MUTED,
          },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { family: FONT, size: 12 }, color: TEXT },
        },
      },
      plugins: {
        ...baseOptions().plugins,
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            label(ctx) {
              const label = ctx.dataset.label || "";
              const val = ctx.parsed.x;
              return ` ${label}: ${val}`;
            },
            footer(items) {
              const done = completeData[items[0].dataIndex];
              const total = done + remainingData[items[0].dataIndex];
              const pct = total ? Math.round((done / total) * 100) : 0;
              return `${pct}% complete`;
            },
          },
        },
      },
    },
  });
}

function renderLineChart(tasks) {
  const container = document.getElementById("chart-line");
  destroyChart("line");

  const withDue = tasks.filter((t) => t.dueDate);
  if (withDue.length === 0) {
    showEmpty(container, "No due dates to plot yet");
    return;
  }

  const canvas = ensureCanvas(container, "chart-line-canvas");
  if (!canvas) return;
  canvas.parentElement?.classList.add("chart-canvas-wrap--line");

  const series = buildTimelineSeries(tasks);
  const Chart = getChart();

  const duePoints = series.map((p) => ({ x: parseIsoDate(p.date), y: p.dueByDate }));
  const completePoints = series.map((p) => ({
    x: parseIsoDate(p.date),
    y: p.completeByDate,
  }));
  const openPoints = series.map((p) => ({ x: parseIsoDate(p.date), y: p.openByDate }));

  const submittedPoints = tasks
    .filter((t) => t.submissionDate)
    .map((t) => {
      const sub = t.submissionDate;
      const y = tasks.filter((x) => {
        const done = effectiveCompleteDate(x);
        return done && done <= sub;
      }).length;
      return {
        x: parseIsoDate(t.submissionDate),
        y,
        task: t,
      };
    });

  instances.line = new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          type: "line",
          label: "Total due by date",
          data: duePoints,
          borderColor: "#1976d2",
          backgroundColor: "rgba(25, 118, 210, 0.08)",
          fill: false,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2.5,
        },
        {
          type: "line",
          label: "Complete (by submission/completion)",
          data: completePoints,
          borderColor: "#66bb6a",
          backgroundColor: "rgba(102, 187, 106, 0.08)",
          fill: false,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2.5,
        },
        {
          type: "line",
          label: "Still open",
          data: openPoints,
          borderColor: "#ff9800",
          borderDash: [6, 4],
          fill: false,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
        {
          type: "scatter",
          label: "Task submitted",
          data: submittedPoints,
          pointBackgroundColor: "#7b1fa2",
          pointBorderColor: "#fff",
          pointBorderWidth: 1.5,
          pointRadius: 5,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      ...baseOptions(),
      interaction: { mode: "nearest", axis: "x", intersect: false },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            tooltipFormat: "EEE, d MMM yyyy",
            displayFormats: {
              day: "d MMM",
              week: "d MMM",
              month: "MMM yyyy",
            },
          },
          grid: { color: GRID },
          ticks: {
            font: { family: FONT, size: 11 },
            color: TEXT_MUTED,
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 12,
          },
          title: {
            display: true,
            text: "Date",
            font: { family: FONT, size: 12 },
            color: TEXT_MUTED,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: GRID },
          ticks: {
            stepSize: 1,
            font: { family: FONT, size: 11 },
            color: TEXT_MUTED,
          },
          title: {
            display: true,
            text: "Tasks (cumulative)",
            font: { family: FONT, size: 12 },
            color: TEXT_MUTED,
          },
        },
      },
      plugins: {
        ...baseOptions().plugins,
        legend: { position: "bottom", ...baseOptions().plugins.legend },
        annotation: {
          annotations: {
            today: {
              type: "line",
              xMin: parseIsoDate(localTodayIso()),
              xMax: parseIsoDate(localTodayIso()),
              borderColor: "#d32f2f",
              borderWidth: 1.5,
              borderDash: [4, 4],
              label: {
                display: true,
                content: "Today",
                position: "start",
                backgroundColor: "rgba(211, 47, 47, 0.9)",
                color: "#fff",
                font: { family: FONT, size: 10 },
              },
            },
          },
        },
        tooltip: {
          ...baseOptions().plugins.tooltip,
          callbacks: {
            title(items) {
              const x = items[0]?.parsed?.x ?? items[0]?.raw?.x;
              if (!x) return "";
              return formatChartDate(isoFromChartTime(x));
            },
            label(ctx) {
              if (ctx.dataset.label === "Task submitted") {
                const t = ctx.raw.task;
                const lines = [
                  ` ${t.name}`,
                  ` Due: ${formatChartDate(t.dueDate)}`,
                  ` Submitted: ${formatChartDate(t.submissionDate)}`,
                ];
                if (t.completionDate) {
                  lines.push(` Completed: ${formatChartDate(t.completionDate)}`);
                }
                return lines;
              }
              return ` ${ctx.dataset.label}: ${ctx.parsed.y}`;
            },
            afterBody(items) {
              const ctx = items[0];
              if (!ctx || ctx.dataset.label === "Task submitted") return [];

              const x = ctx.parsed.x;
              const iso = isoFromChartTime(x);

              const due = tasksOnDate(tasks, iso, "dueDate");
              const submitted = tasksOnDate(tasks, iso, "submissionDate");
              const lines = [];
              if (due.length) {
                lines.push("", `Due this day (${due.length}):`);
                due.slice(0, 5).forEach((t) => lines.push(` · ${t.name}`));
                if (due.length > 5) lines.push(` · +${due.length - 5} more`);
              }
              if (submitted.length) {
                lines.push("", `Submitted this day (${submitted.length}):`);
                submitted.slice(0, 5).forEach((t) => {
                  lines.push(
                    ` · ${t.name} (due ${formatChartDate(t.dueDate)})`
                  );
                });
                if (submitted.length > 5) {
                  lines.push(` · +${submitted.length - 5} more`);
                }
              }
              return lines;
            },
          },
        },
      },
    },
  });
}

export function renderCharts(tasks, { bundles = [], viewMode = "unit" } = {}) {
  try {
    getChart();
  } catch {
    const msg = "Charts failed to load. Run npm run build in extension/ to copy Chart.js.";
    showEmpty(document.getElementById("chart-pie"), msg);
    showEmpty(document.getElementById("chart-bars"), msg);
    showEmpty(document.getElementById("chart-line"), msg);
    return;
  }
  renderPieChart(tasks);
  renderBarChart(tasks, { bundles, viewMode });
  renderLineChart(tasks);
}

export function destroyAllCharts() {
  destroyChart("pie");
  destroyChart("bars");
  destroyChart("line");
}
