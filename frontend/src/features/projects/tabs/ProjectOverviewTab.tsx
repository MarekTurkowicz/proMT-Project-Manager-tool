import { useMemo, useState } from "react";
import { useProject } from "../context/ProjectContext";
import { useListTasksQuery } from "../../tasks/tasksApi";
import type { Task, TaskStatus, TaskPriority } from "../../tasks/types";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import "./ProjectOverviewTab.css";

type DailyActivityPoint = {
  date: string; // "YYYY-MM-DD"
  label: string; // np. "04.11"
  started: number;
  due: number;
};

type WeekdayStat = {
  weekday: number; // 0-6
  label: string; // "Mon"
  count: number;
};

type CycleBucket = {
  label: string;
  count: number;
};

type MomentumTrend = "up" | "down" | "stable" | "none";
type RiskLevel = "healthy" | "warning" | "critical";
type ChartMode = "activity" | "weekly" | "delivery";

type OverviewStats = {
  total: number;
  doneCount: number;
  doingCount: number;
  todoCount: number;
  highPriorityCount: number;
  overdueCount: number;
  noStartDateCount: number;
  noDueDateCount: number;
  highPriorityOverdueCount: number;
  completionRate: number;
  dailyActivity: DailyActivityPoint[];
  momentumTrend: MomentumTrend;
  weekdayStats: WeekdayStat[];
  riskScore: number;
  riskLevel: RiskLevel;
  timeProgressPct: number;
  taskProgressPct: number;
  scheduleDeltaPct: number;
  canComputeTimeline: boolean;
  predictedDaysRemaining: number | null;
  predictedCompletionDate: Date | null;
  recentTasks: Task[];
  avgCycleTime: number | null;
  medianCycleTime: number | null;
  maxCycleTime: number | null;
  cycleBuckets: CycleBucket[];
  missingDatesCount: number;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(diff / msPerDay);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isDone(status: TaskStatus): boolean {
  return status === "done";
}

function isHighPriority(priority: TaskPriority | null | undefined): boolean {
  if (!priority) return false;
  return priority === 3;
}

function isOutsideProjectRange(
  task: Task,
  projectStart: string | null | undefined,
  projectEnd: string | null | undefined
): boolean {
  if (!projectStart && !projectEnd) return false;

  const taskStartDate = parseDate(task.start_date);
  const taskEndDate = parseDate(task.due_date);

  const start = taskStartDate ?? taskEndDate;
  const end = taskEndDate ?? taskStartDate;

  const projStart = projectStart ? startOfDay(new Date(projectStart)) : null;
  const projEnd = projectEnd ? startOfDay(new Date(projectEnd)) : null;

  if (!start && !end) return false;

  let outside = false;

  if (projStart && start && start < projStart) {
    outside = true;
  }
  if (projEnd && end && end > projEnd) {
    outside = true;
  }

  return outside;
}

/**
 * Overdue =
 *  - nie jest done
 *  - ma start_date < dzisiaj (po samej dacie)
 *    LUB
 *  - zakres zadania wychodzi poza zakres projektu
 */
function isOverdue(
  task: Task,
  todayStart: Date,
  projectStart: string | null | undefined,
  projectEnd: string | null | undefined
): boolean {
  if (isDone(task.status)) return false;

  const start = parseDate(task.start_date);
  const startBeforeToday =
    start != null && startOfDay(start).getTime() < todayStart.getTime();

  const outside = isOutsideProjectRange(task, projectStart, projectEnd);

  return startBeforeToday || outside;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatFullDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function weekdayLabel(weekday: number): string {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[weekday] ?? "";
}

function computeRiskLevel(score: number): RiskLevel {
  if (score < 35) return "healthy";
  if (score < 70) return "warning";
  return "critical";
}

export default function ProjectOverviewTab() {
  const project = useProject();

  const { data, isLoading } = useListTasksQuery({
    project: project.id,
    ordering: "-created_at",
  });

  const tasks: Task[] = useMemo(() => data?.results ?? [], [data]);
  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const [chartMode, setChartMode] = useState<ChartMode>("activity");

  const {
    total,
    doneCount,
    doingCount,
    todoCount,
    highPriorityCount,
    overdueCount,
    noStartDateCount,
    noDueDateCount,
    highPriorityOverdueCount,
    completionRate,
    dailyActivity,
    momentumTrend,
    weekdayStats,
    riskScore,
    riskLevel,
    timeProgressPct,
    taskProgressPct,
    scheduleDeltaPct,
    canComputeTimeline,
    predictedDaysRemaining,
    predictedCompletionDate,
    recentTasks,
    avgCycleTime,
    medianCycleTime,
    maxCycleTime,
    cycleBuckets,
    missingDatesCount,
  }: OverviewStats = useMemo<OverviewStats>(() => {
    const totalCount: number = tasks.length;
    const done: number = tasks.filter((t: Task) => isDone(t.status)).length;
    const doing: number = tasks.filter(
      (t: Task) => t.status === "doing"
    ).length;
    const todo: number = tasks.filter((t: Task) => t.status === "todo").length;
    const highPriority: number = tasks.filter((t: Task) =>
      isHighPriority(t.priority)
    ).length;

    const overdue: number = tasks.filter((t: Task) =>
      isOverdue(t, todayStart, project.start_date, project.end_date)
    ).length;

    const noStartDate: number = tasks.filter((t: Task) => !t.start_date).length;
    const noDueDate: number = tasks.filter((t: Task) => !t.due_date).length;

    const missingDatesCount: number = tasks.filter(
      (t: Task) => !t.start_date || !t.due_date
    ).length;

    const highPriorityOverdueCount: number = tasks.filter(
      (t: Task) =>
        isHighPriority(t.priority) &&
        isOverdue(t, todayStart, project.start_date, project.end_date)
    ).length;

    const completion: number =
      totalCount === 0 ? 0 : done / Math.max(totalCount, 1);

    // === Daily activity (ostatnie 14 dni) ===
    const daysWindow = 14;
    const dateMap = new Map<string, { started: number; due: number }>();

    for (let i = daysWindow - 1; i >= 0; i -= 1) {
      const d = new Date(todayStart);
      d.setDate(todayStart.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { started: 0, due: 0 });
    }

    tasks.forEach((task: Task) => {
      const start = parseDate(task.start_date);
      const due = parseDate(task.due_date);

      if (start) {
        const key = start.toISOString().slice(0, 10);
        const current = dateMap.get(key);
        if (current) {
          current.started += 1;
        }
      }

      if (due) {
        const key = due.toISOString().slice(0, 10);
        const current = dateMap.get(key);
        if (current) {
          current.due += 1;
        }
      }
    });

    const dailyActivityArr: DailyActivityPoint[] = Array.from(dateMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, counts]) => {
        const d = new Date(date);
        return {
          date,
          label: formatDateLabel(d),
          started: counts.started,
          due: counts.due,
        };
      });

    // Momentum trend – porównanie ostatnich 7 dni vs poprzednie 7
    let trend: MomentumTrend = "none";
    if (dailyActivityArr.length >= 14) {
      const last7 = dailyActivityArr.slice(-7);
      const prev7 = dailyActivityArr.slice(-14, -7);

      const sumStartedLast = last7.reduce(
        (acc: number, p: DailyActivityPoint) => acc + p.started,
        0
      );
      const sumStartedPrev = prev7.reduce(
        (acc: number, p: DailyActivityPoint) => acc + p.started,
        0
      );

      if (sumStartedPrev === 0 && sumStartedLast === 0) {
        trend = "none";
      } else if (sumStartedPrev === 0 && sumStartedLast > 0) {
        trend = "up";
      } else {
        const diff = sumStartedLast - sumStartedPrev;
        const changeRatio = diff / Math.max(sumStartedPrev, 1);
        if (changeRatio > 0.1) {
          trend = "up";
        } else if (changeRatio < -0.1) {
          trend = "down";
        } else {
          trend = "stable";
        }
      }
    }

    // Rytm tygodnia – na podstawie start_date albo created_at
    const weekdayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];

    tasks.forEach((task: Task) => {
      const baseDate = parseDate(task.start_date) ?? parseDate(task.created_at);
      if (!baseDate) return;
      const weekday = baseDate.getDay(); // 0-6
      weekdayCounts[weekday] += 1;
    });

    const weekdayStatsArr: WeekdayStat[] = weekdayCounts.map(
      (count: number, weekday: number) => ({
        weekday,
        label: weekdayLabel(weekday),
        count,
      })
    );

    // Risk index
    let riskScore = 0;
    if (totalCount > 0) {
      const ratioOverdue = overdue / totalCount;
      const ratioHighOverdue = highPriorityOverdueCount / totalCount;
      const ratioNoDates =
        (noStartDate + noDueDate) / Math.max(totalCount * 2, 1);

      const rawScore =
        0.5 * ratioOverdue + 0.3 * ratioHighOverdue + 0.2 * ratioNoDates;

      riskScore = clamp(Math.round(rawScore * 100), 0, 100);
    }
    const riskLevel = computeRiskLevel(riskScore);

    // Timeline vs task progress
    let timeProgressPct = 0;
    const taskProgressPct = Math.round(completion * 100);
    let scheduleDeltaPct = 0;
    let canComputeTimeline = false;

    const projStart = parseDate(project.start_date);
    const projEnd = parseDate(project.end_date);

    if (projStart && projEnd && projEnd.getTime() > projStart.getTime()) {
      canComputeTimeline = true;
      const totalDays = Math.max(daysBetween(projStart, projEnd), 1);
      const clampedToday =
        todayStart.getTime() > projEnd.getTime()
          ? projEnd
          : todayStart.getTime() < projStart.getTime()
          ? projStart
          : todayStart;
      const elapsedDays = clamp(
        daysBetween(projStart, clampedToday),
        0,
        totalDays
      );
      const timeProgress = elapsedDays / totalDays;
      timeProgressPct = Math.round(timeProgress * 100);
      scheduleDeltaPct = taskProgressPct - timeProgressPct;
    }

    // Predykcja zakończenia – na podstawie velocity (done / dni)
    let predictedDaysRemaining: number | null = null;
    let predictedCompletionDate: Date | null = null;

    if (done > 0 && totalCount > 0) {
      const doneTasks: Task[] = tasks.filter((t: Task) => isDone(t.status));

      let firstStart: Date | null = null;
      doneTasks.forEach((t: Task) => {
        const baseDate = parseDate(t.start_date) ?? parseDate(t.created_at);
        if (!baseDate) return;
        if (!firstStart || baseDate < firstStart) {
          firstStart = baseDate;
        }
      });

      if (firstStart) {
        const daysSpan = Math.max(daysBetween(firstStart, todayStart), 1);
        const velocity = done / daysSpan; // done per day
        const remaining = totalCount - done;
        if (velocity > 0 && remaining > 0) {
          const estDays = Math.round(remaining / velocity);
          predictedDaysRemaining = estDays;
          const estDate = new Date(todayStart);
          estDate.setDate(todayStart.getDate() + estDays);
          predictedCompletionDate = estDate;
        }
      }
    }

    // Delivery performance – duration = start_date -> due_date (tylko jeśli oba są)
    const cycleDurations: number[] = [];
    tasks.forEach((task: Task) => {
      if (!task.start_date || !task.due_date) return;
      const start = parseDate(task.start_date);
      const end = parseDate(task.due_date);
      if (!start || !end) return;
      const diffDays = daysBetween(start, end);
      if (diffDays < 0) return;
      cycleDurations.push(diffDays);
    });

    let avgCycleTime: number | null = null;
    let medianCycleTime: number | null = null;
    let maxCycleTime: number | null = null;
    const cycleBuckets: CycleBucket[] = [
      { label: "0–1d", count: 0 },
      { label: "2–3d", count: 0 },
      { label: "4–7d", count: 0 },
      { label: "8+d", count: 0 },
    ];

    if (cycleDurations.length > 0) {
      const sum = cycleDurations.reduce((acc: number, d: number) => acc + d, 0);
      avgCycleTime = sum / cycleDurations.length;

      const sortedDurations = [...cycleDurations].sort(
        (a: number, b: number) => a - b
      );
      const mid = Math.floor(sortedDurations.length / 2);
      if (sortedDurations.length % 2 === 0) {
        medianCycleTime = (sortedDurations[mid - 1] + sortedDurations[mid]) / 2;
      } else {
        medianCycleTime = sortedDurations[mid];
      }

      maxCycleTime = sortedDurations[sortedDurations.length - 1];

      cycleDurations.forEach((d: number) => {
        if (d <= 1) {
          cycleBuckets[0].count += 1;
        } else if (d <= 3) {
          cycleBuckets[1].count += 1;
        } else if (d <= 7) {
          cycleBuckets[2].count += 1;
        } else {
          cycleBuckets[3].count += 1;
        }
      });
    }

    // Recent activity – ostatnie 5 zadań
    const recentSorted = [...tasks].sort((a: Task, b: Task) => {
      const aTime = parseDate(a.created_at)?.getTime() ?? 0;
      const bTime = parseDate(b.created_at)?.getTime() ?? 0;
      return bTime - aTime;
    });
    const recentTasks: Task[] = recentSorted.slice(0, 4);

    return {
      total: totalCount,
      doneCount: done,
      doingCount: doing,
      todoCount: todo,
      highPriorityCount: highPriority,
      overdueCount: overdue,
      noStartDateCount: noStartDate,
      noDueDateCount: noDueDate,
      highPriorityOverdueCount,
      completionRate: completion,
      dailyActivity: dailyActivityArr,
      momentumTrend: trend,
      weekdayStats: weekdayStatsArr,
      riskScore,
      riskLevel,
      timeProgressPct,
      taskProgressPct,
      scheduleDeltaPct,
      canComputeTimeline,
      predictedDaysRemaining,
      predictedCompletionDate,
      recentTasks,
      avgCycleTime,
      medianCycleTime,
      maxCycleTime,
      cycleBuckets,
      missingDatesCount,
    };
  }, [tasks, todayStart, project.start_date, project.end_date]);

  // === Work distribution (todo / doing / done) ===
  const statusTotal = todoCount + doingCount + doneCount;

  const todoPct = statusTotal ? Math.round((todoCount / statusTotal) * 100) : 0;
  const doingPct = statusTotal
    ? Math.round((doingCount / statusTotal) * 100)
    : 0;
  const donePct = statusTotal ? Math.max(0, 100 - todoPct - doingPct) : 0;

  let workloadHint = "";
  if (statusTotal === 0) {
    workloadHint = "No tasks yet – create the first one to see the flow.";
  } else if (doingCount > todoCount && doingCount > doneCount) {
    workloadHint =
      "Most work is currently in progress – keep an eye on flow & blockers.";
  } else if (todoCount > doingCount && todoCount > doneCount) {
    workloadHint =
      "Backlog is the largest bucket – consider prioritising and starting key items.";
  } else if (doneCount > todoCount && doneCount > doingCount) {
    workloadHint =
      "Largest part of work is already done – you’re approaching the finish line.";
  } else {
    workloadHint = "Work is fairly evenly spread between states.";
  }

  const moodEmoji =
    riskLevel === "healthy" ? "🟢" : riskLevel === "warning" ? "🟡" : "🔴";

  const momentumLabel =
    momentumTrend === "up"
      ? "Momentum rośnie"
      : momentumTrend === "down"
      ? "Momentum spada"
      : momentumTrend === "stable"
      ? "Momentum stabilne"
      : "Za mało danych";

  const hasFunding =
    Array.isArray(project.funding_ids) && project.funding_ids.length > 0;

  const hasCycleData =
    avgCycleTime !== null &&
    medianCycleTime !== null &&
    maxCycleTime !== null &&
    cycleBuckets.some((b: CycleBucket) => b.count > 0);

  const planningRiskPct =
    total === 0 ? 0 : Math.round((missingDatesCount / total) * 100);

  const wipLoadPct = total === 0 ? 0 : Math.round((doingCount / total) * 100);

  const highPrioSharePct =
    total === 0 ? 0 : Math.round((highPriorityCount / total) * 100);

  const riskMessage =
    riskLevel === "healthy"
      ? "Mostly under control – keep an eye on overdue tasks and missing dates."
      : riskLevel === "warning"
      ? "Noticeable issues – focus on overdue and high priority tasks first."
      : "High risk – many overdue or poorly defined tasks, project needs attention.";

  return (
    <div className="pov-root">
      {/* HEADER */}
      <div className="card pov-header">
        <div className="pov-header-top">
          <div>
            <div className="pov-status-row">
              <span className={`pov-status-pill pov-status-${project.status}`}>
                {project.status}
              </span>
              <span className="pov-funding-pill">
                {hasFunding ? "Funding linked" : "No funding linked yet"}
              </span>
            </div>
            <h2 className="pov-title">{project.name}</h2>
          </div>
          <div className={`pov-mood-badge pov-mood-${riskLevel}`}>
            <span className="pov-mood-emoji">{moodEmoji}</span>
            <span className="pov-mood-label">
              {riskLevel === "healthy"
                ? "Healthy"
                : riskLevel === "warning"
                ? "Warning"
                : "Critical"}
            </span>
            <span className="pov-mood-score">{riskScore}/100</span>
          </div>
        </div>

        {project.description && (
          <p className="pov-description">{project.description}</p>
        )}

        <div className="pov-header-meta">
          <div className="pov-meta-item">
            <span className="pov-meta-label">Start</span>
            <span className="pov-meta-value">
              {formatFullDate(project.start_date)}
            </span>
          </div>
          <div className="pov-meta-item">
            <span className="pov-meta-label">End</span>
            <span className="pov-meta-value">
              {formatFullDate(project.end_date)}
            </span>
          </div>
          <div className="pov-meta-item">
            <span className="pov-meta-label">Progress</span>
            <span className="pov-meta-value">
              {Math.round(completionRate * 100)}%
            </span>
          </div>
          <div className="pov-meta-item">
            <span className="pov-meta-label">Tasks</span>
            <span className="pov-meta-value">{total}</span>
          </div>
        </div>
      </div>

      <div className="pov-layout">
        {/* MAIN COLUMN */}
        <div className="pov-main">
          {/* WORK DISTRIBUTION */}
          <div className="card pov-section">
            <div className="pov-section-header">
              <h3>Work distribution</h3>
              <span className="pov-section-subtitle">
                How work is split across todo / doing / done
              </span>
            </div>

            {statusTotal === 0 ? (
              <div className="pov-chart-empty">
                No tasks yet – create at least one task to see the workflow.
              </div>
            ) : (
              <>
                <div className="pov-dist-bar">
                  {todoPct > 0 && (
                    <div
                      className="pov-dist-seg pov-dist-seg-todo"
                      style={{ width: `${todoPct}%` }}
                    >
                      <span className="pov-dist-label">To do {todoPct}%</span>
                    </div>
                  )}
                  {doingPct > 0 && (
                    <div
                      className="pov-dist-seg pov-dist-seg-doing"
                      style={{ width: `${doingPct}%` }}
                    >
                      <span className="pov-dist-label">Doing {doingPct}%</span>
                    </div>
                  )}
                  {donePct > 0 && (
                    <div
                      className="pov-dist-seg pov-dist-seg-done"
                      style={{ width: `${donePct}%` }}
                    >
                      <span className="pov-dist-label">Done {donePct}%</span>
                    </div>
                  )}
                </div>

                <div className="pov-dist-stats">
                  <div className="pov-dist-stat-row">
                    <span>Total tasks</span>
                    <span className="pov-dist-stat-value">{total}</span>
                  </div>
                  <div className="pov-dist-stat-row">
                    <span>Completed</span>
                    <span className="pov-dist-stat-value">
                      {doneCount} ({Math.round(completionRate * 100)}%)
                    </span>
                  </div>
                  <div className="pov-dist-stat-row">
                    <span>High priority</span>
                    <span className="pov-dist-stat-value">
                      {highPriorityCount}
                    </span>
                  </div>
                  <div className="pov-dist-stat-row">
                    <span>Overdue / out of range</span>
                    <span className="pov-dist-stat-value">{overdueCount}</span>
                  </div>
                </div>

                <div className="pov-dist-hint">{workloadHint}</div>
              </>
            )}
          </div>

          {/* FLOW & PERFORMANCE TABS */}
          <div className="card pov-section">
            <div className="pov-section-header">
              <h3>Flow & performance</h3>
              <span className="pov-section-subtitle">
                Tempo pracy, rytm tygodnia i czas dostarczania
              </span>
            </div>

            <div className="pov-chart-tabs">
              <button
                type="button"
                className={
                  "pov-chart-tab" +
                  (chartMode === "activity" ? " is-active" : "")
                }
                onClick={() => setChartMode("activity")}
              >
                Daily activity
              </button>
              <button
                type="button"
                className={
                  "pov-chart-tab" + (chartMode === "weekly" ? " is-active" : "")
                }
                onClick={() => setChartMode("weekly")}
              >
                Weekly rhythm
              </button>
              <button
                type="button"
                className={
                  "pov-chart-tab" +
                  (chartMode === "delivery" ? " is-active" : "")
                }
                onClick={() => setChartMode("delivery")}
              >
                Delivery performance
              </button>
            </div>

            <div className="pov-chart-switcher">
              {chartMode === "activity" && (
                <>
                  <div className="pov-chart-title">
                    Daily activity (last 14 days)
                  </div>
                  {dailyActivity.length === 0 ? (
                    <div className="pov-chart-empty">
                      No timeline data yet – set dates or add tasks.
                    </div>
                  ) : (
                    <div className="pov-chart-inner">
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={dailyActivity}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="started"
                            name="Started"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="due"
                            name="Due"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="pov-chart-footer">{momentumLabel}</div>
                </>
              )}

              {chartMode === "weekly" && (
                <>
                  <div className="pov-chart-title">Weekly rhythm</div>
                  {weekdayStats.every((w: WeekdayStat) => w.count === 0) ? (
                    <div className="pov-chart-empty">
                      No activity yet – add some tasks.
                    </div>
                  ) : (
                    <div className="pov-chart-inner">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={weekdayStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" name="Tasks" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="pov-chart-footer">
                    Visual rhythm of when work happens.
                  </div>
                </>
              )}

              {chartMode === "delivery" && (
                <>
                  <div className="pov-chart-title">Delivery performance</div>
                  {!hasCycleData ? (
                    <div className="pov-chart-empty">
                      Not enough tasks with both start &amp; due dates to
                      calculate durations.
                    </div>
                  ) : (
                    <>
                      <div className="pov-delivery-stats">
                        <div className="pov-delivery-stat">
                          <div className="pov-delivery-label">Average</div>
                          <div className="pov-delivery-value">
                            {avgCycleTime !== null
                              ? avgCycleTime.toFixed(1)
                              : "—"}
                            d
                          </div>
                        </div>
                        <div className="pov-delivery-stat">
                          <div className="pov-delivery-label">Median</div>
                          <div className="pov-delivery-value">
                            {medianCycleTime !== null
                              ? medianCycleTime.toFixed(1)
                              : "—"}
                            d
                          </div>
                        </div>
                        <div className="pov-delivery-stat">
                          <div className="pov-delivery-label">Longest</div>
                          <div className="pov-delivery-value">
                            {maxCycleTime !== null
                              ? maxCycleTime.toFixed(1)
                              : "—"}
                            d
                          </div>
                        </div>
                      </div>

                      <div className="pov-chart-inner pov-delivery-chart">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={cycleBuckets}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" name="Tasks" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="pov-delivery-hint">
                        Based on tasks with both start and due dates – shorter
                        cycle times mean quicker delivery.
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="pov-side">
          {/* RISK RADAR */}
          <div className="card pov-section">
            <div className="pov-section-header">
              <h3>Risk radar</h3>
              <span className="pov-section-subtitle">
                Najważniejsze czerwone flagi
              </span>
            </div>

            <div className="pov-risk-columns">
              {/* lewa kolumna */}
              <ul className="pov-risk-list">
                <li>
                  🕓 <strong>{overdueCount}</strong> overdue / out of range
                  tasks
                </li>
                <li>
                  ⚡ <strong>{highPriorityOverdueCount}</strong> high priority
                  overdue
                </li>
                <li>
                  📅 <strong>{noStartDateCount}</strong> tasks without start
                  date
                </li>
                <li>
                  📅 <strong>{noDueDateCount}</strong> tasks without due date
                </li>
              </ul>

              {/* prawa kolumna */}
              <ul className="pov-risk-list pov-risk-list-secondary">
                <li>
                  🧩 <strong>{planningRiskPct}%</strong> tasks with missing
                  start or due dates ({missingDatesCount})
                </li>
                <li>
                  🔁 <strong>{wipLoadPct}%</strong> of tasks currently in
                  progress ({doingCount})
                </li>
                <li>
                  ⚡ <strong>{highPrioSharePct}%</strong> of tasks are high
                  priority ({highPriorityCount})
                </li>
              </ul>
            </div>

            <div className="pov-risk-index">
              <span>Project risk index</span>
              <span className="pov-risk-index-value">{riskScore}/100</span>
            </div>

            <div className="pov-risk-message">{riskMessage}</div>
          </div>

          {/* HEALTH & TIMELINE */}
          <div className="card pov-section">
            <div className="pov-section-header">
              <h3>Health & timeline</h3>
              <span className="pov-section-subtitle">
                Czy projekt nadąża za planem?
              </span>
            </div>

            <div className="pov-progress-bars">
              <div className="pov-progress-row">
                <div className="pov-progress-label">
                  <span>Task progress</span>
                  <span className="pov-progress-value">{taskProgressPct}%</span>
                </div>
                <div className="pov-progress-track">
                  <div
                    className="pov-progress-fill pov-progress-fill-tasks"
                    style={{ width: `${clamp(taskProgressPct, 0, 100)}%` }}
                  />
                </div>
              </div>

              {canComputeTimeline && (
                <div className="pov-progress-row">
                  <div className="pov-progress-label">
                    <span>Time elapsed</span>
                    <span className="pov-progress-value">
                      {timeProgressPct}%
                    </span>
                  </div>
                  <div className="pov-progress-track">
                    <div
                      className="pov-progress-fill pov-progress-fill-time"
                      style={{ width: `${clamp(timeProgressPct, 0, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pov-health-summary">
              {canComputeTimeline ? (
                scheduleDeltaPct >= 5 ? (
                  <span>
                    ✅ Project is <strong>{scheduleDeltaPct}%</strong> ahead of
                    time.
                  </span>
                ) : scheduleDeltaPct <= -5 ? (
                  <span>
                    ⚠️ Project is <strong>{Math.abs(scheduleDeltaPct)}%</strong>{" "}
                    behind schedule.
                  </span>
                ) : (
                  <span>ℹ️ Project is roughly on schedule.</span>
                )
              ) : (
                <span>
                  ℹ️ Set both start and end date to compare time vs progress.
                </span>
              )}

              {predictedDaysRemaining != null && predictedCompletionDate && (
                <span>
                  📅 If you keep this pace, project will finish in{" "}
                  <strong>{predictedDaysRemaining} days</strong> (
                  {predictedCompletionDate.toLocaleDateString()}).
                </span>
              )}
            </div>
          </div>

          {/* ACTIVITY FEED */}
          <div className="card pov-section">
            <div className="pov-section-header">
              <h3>Activity feed</h3>
              <span className="pov-section-subtitle">
                Ostatnie ruchy w projekcie
              </span>
            </div>

            {isLoading ? (
              <div className="pov-feed-empty">Loading activity…</div>
            ) : recentTasks.length === 0 ? (
              <div className="pov-feed-empty">
                No tasks yet – start by creating the first one.
              </div>
            ) : (
              <ul className="pov-feed-list">
                {recentTasks.map((task: Task) => {
                  const created = parseDate(task.created_at);
                  const createdLabel = created
                    ? created.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })
                    : "—";

                  return (
                    <li key={task.id} className="pov-feed-item">
                      <div className="pov-feed-title">{task.title}</div>
                      <div className="pov-feed-meta">
                        <span>Status: {task.status}</span>
                        {task.priority != null && (
                          <span> • Priority: {task.priority}</span>
                        )}
                        <span> • Created: {createdLabel}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
