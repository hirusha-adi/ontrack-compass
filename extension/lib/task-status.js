/**
 * OnTrack task status colours (matches the platform legend).
 * Keys are API snake_case values from /api/projects/{id}.
 */
export const TASK_STATUSES = {
  ready_for_feedback: {
    label: "Ready for Feedback",
    color: "#2196f3",
  },
  not_started: {
    label: "Not Started",
    color: "#bdbdbd",
  },
  working_on_it: {
    label: "Working On It",
    color: "#ff9800",
  },
  need_help: {
    label: "Need Help",
    color: "#b39ddb",
  },
  redo: {
    label: "Redo",
    color: "#6d4c41",
  },
  feedback_exceeded: {
    label: "Feedback Exceeded",
    color: "#e57373",
  },
  resubmit: {
    label: "Resubmit",
    color: "#fdd835",
  },
  discuss: {
    label: "Discuss",
    color: "#00bcd4",
  },
  demonstrate: {
    label: "Demonstrate",
    color: "#42a5f5",
  },
  complete: {
    label: "Complete",
    color: "#66bb6a",
  },
  fail: {
    label: "Fail",
    color: "#f44336",
  },
  time_exceeded: {
    label: "Time Exceeded",
    color: "#c62828",
  },
  assess_in_portfolio: {
    label: "Assess in Portfolio",
    color: "#fff176",
  },
  attention_required: {
    label: "Attention Required",
    color: "#ff8a65",
  },
};

/** @deprecated Use getStatusTheme().label */
export const STATUS_LABELS = Object.fromEntries(
  Object.entries(TASK_STATUSES).map(([k, v]) => [k, v.label])
);

const COMPLETE_STATUSES = new Set(["complete", "fail"]);

export function getStatusTheme(status) {
  const key = status || "not_started";
  const theme = TASK_STATUSES[key];
  if (theme) {
    return { key, ...theme };
  }
  return {
    key,
    label: formatUnknownStatus(key),
    color: "#9e9e9e",
  };
}

/** Text colour for badges on light backgrounds (pale status colours). */
export function getStatusTextColor(status) {
  const { color } = getStatusTheme(status);
  const light = new Set(["#fff176", "#fdd835", "#bdbdbd"]);
  return light.has(color.toLowerCase()) ? "#424242" : color;
}

export function renderStatusBadge(status) {
  const theme = getStatusTheme(status);
  const textColor = getStatusTextColor(status);
  return {
    theme,
    badgeStyle: `color: ${textColor}`,
    dotStyle: `background-color: ${theme.color}`,
    accentStyle: `background-color: ${theme.color}`,
  };
}

function formatUnknownStatus(status) {
  return String(status)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isTaskComplete(status) {
  return COMPLETE_STATUSES.has(status);
}

export function isTaskIncomplete(status) {
  return !isTaskComplete(status);
}

/** Statuses that count toward open-task stats and remaining hours. */
export function isOpenTask(status) {
  return status !== "complete";
}

export function statusAccentColor(status) {
  return getStatusTheme(status).color;
}

export function statusBadgeStyle(status) {
  const { color } = getStatusTheme(status);
  return `color: ${color}`;
}

export function statusDotStyle(status) {
  const { color } = getStatusTheme(status);
  return `background-color: ${color}`;
}

export function statusLegendEntries() {
  return Object.entries(TASK_STATUSES).map(([key, { label, color }]) => ({
    key,
    label,
    color,
  }));
}
