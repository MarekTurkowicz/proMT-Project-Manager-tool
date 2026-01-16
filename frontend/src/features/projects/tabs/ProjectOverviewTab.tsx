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
  date: string;
  label: string;
  started: number;
  due: number;
};

type WeekdayStat = {
  weekday: number;
  label: string;
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
  if (projStart && start && start < projStart) outside = true;
  if (projEnd && end && end > projEnd) outside = true;

  return outside;
}

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
  const labels = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
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

  const [descExpanded, setDescExpanded] = useState(false);
  const descriptionText = project.description ?? "";
  const canToggleDescription = (descriptionText?.trim().length ?? 0) > 160;

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
    const totalCount = tasks.length;
    const done = tasks.filter((t) => isDone(t.status)).length;
    const doing = tasks.filter((t) => t.status === "doing").length;
    const todo = tasks.filter((t) => t.status === "todo").length;

    const highPriority = tasks.filter((t) => isHighPriority(t.priority)).length;

    const overdue = tasks.filter((t) =>
      isOverdue(t, todayStart, project.start_date, project.end_date)
    ).length;

    const noStartDate = tasks.filter((t) => !t.start_date).length;
    const noDueDate = tasks.filter((t) => !t.due_date).length;

    const missingDatesCountCalc = tasks.filter(
      (t) => !t.start_date || !t.due_date
    ).length;

    const highPriorityOverdueCountCalc = tasks.filter(
      (t) =>
        isHighPriority(t.priority) &&
        isOverdue(t, todayStart, project.start_date, project.end_date)
    ).length;

    const completion = totalCount === 0 ? 0 : done / Math.max(totalCount, 1);

    const daysWindow = 14;
    const dateMap = new Map<string, { started: number; due: number }>();
    for (let i = daysWindow - 1; i >= 0; i -= 1) {
      const d = new Date(todayStart);
      d.setDate(todayStart.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { started: 0, due: 0 });
    }

    tasks.forEach((task) => {
      const start = parseDate(task.start_date);
      const due = parseDate(task.due_date);

      if (start) {
        const key = start.toISOString().slice(0, 10);
        const current = dateMap.get(key);
        if (current) current.started += 1;
      }
      if (due) {
        const key = due.toISOString().slice(0, 10);
        const current = dateMap.get(key);
        if (current) current.due += 1;
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

    // Trend momentum (7 vs 7)
    let trend: MomentumTrend = "none";
    if (dailyActivityArr.length >= 14) {
      const last7 = dailyActivityArr.slice(-7);
      const prev7 = dailyActivityArr.slice(-14, -7);

      const sumLast = last7.reduce((acc, p) => acc + p.started, 0);
      const sumPrev = prev7.reduce((acc, p) => acc + p.started, 0);

      if (sumPrev === 0 && sumLast === 0) trend = "none";
      else if (sumPrev === 0 && sumLast > 0) trend = "up";
      else {
        const diff = sumLast - sumPrev;
        const ratio = diff / Math.max(sumPrev, 1);
        if (ratio > 0.1) trend = "up";
        else if (ratio < -0.1) trend = "down";
        else trend = "stable";
      }
    }

    // Statystyki wg dnia tygodnia
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    tasks.forEach((task) => {
      const baseDate = parseDate(task.start_date) ?? parseDate(task.created_at);
      if (!baseDate) return;
      weekdayCounts[baseDate.getDay()] += 1;
    });

    const weekdayStatsArr: WeekdayStat[] = weekdayCounts.map(
      (count, weekday) => ({
        weekday,
        label: weekdayLabel(weekday),
        count,
      })
    );

    // Wynik ryzyka
    let riskScoreCalc = 0;
    if (totalCount > 0) {
      const ratioOverdue = overdue / totalCount;
      const ratioHighOverdue = highPriorityOverdueCountCalc / totalCount;
      const ratioNoDates =
        (noStartDate + noDueDate) / Math.max(totalCount * 2, 1);
      const raw =
        0.5 * ratioOverdue + 0.3 * ratioHighOverdue + 0.2 * ratioNoDates;
      riskScoreCalc = clamp(Math.round(raw * 100), 0, 100);
    }
    const riskLevelCalc = computeRiskLevel(riskScoreCalc);

    // Oś czasu vs postęp
    let timeProgressPctCalc = 0;
    const taskProgressPctCalc = Math.round(completion * 100);
    let scheduleDeltaPctCalc = 0;
    let canComputeTimelineCalc = false;

    const projStart = parseDate(project.start_date);
    const projEnd = parseDate(project.end_date);

    if (projStart && projEnd && projEnd.getTime() > projStart.getTime()) {
      canComputeTimelineCalc = true;
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
      timeProgressPctCalc = Math.round((elapsedDays / totalDays) * 100);
      scheduleDeltaPctCalc = taskProgressPctCalc - timeProgressPctCalc;
    }

    // Prognoza
    let predictedDaysRemainingCalc: number | null = null;
    let predictedCompletionDateCalc: Date | null = null;

    if (done > 0 && totalCount > 0) {
      const doneTasks = tasks.filter((t) => isDone(t.status));
      let firstStart: Date | null = null;

      doneTasks.forEach((t) => {
        const baseDate = parseDate(t.start_date) ?? parseDate(t.created_at);
        if (!baseDate) return;
        if (!firstStart || baseDate < firstStart) firstStart = baseDate;
      });

      if (firstStart) {
        const daysSpan = Math.max(daysBetween(firstStart, todayStart), 1);
        const velocity = done / daysSpan;
        const remaining = totalCount - done;
        if (velocity > 0 && remaining > 0) {
          const estDays = Math.round(remaining / velocity);
          predictedDaysRemainingCalc = estDays;
          const estDate = new Date(todayStart);
          estDate.setDate(todayStart.getDate() + estDays);
          predictedCompletionDateCalc = estDate;
        }
      }
    }

    const cycleDurations: number[] = [];
    tasks.forEach((task) => {
      if (!task.start_date || !task.due_date) return;
      const start = parseDate(task.start_date);
      const end = parseDate(task.due_date);
      if (!start || !end) return;
      const diffDays = daysBetween(start, end);
      if (diffDays < 0) return;
      cycleDurations.push(diffDays);
    });

    let avgCycleTimeCalc: number | null = null;
    let medianCycleTimeCalc: number | null = null;
    let maxCycleTimeCalc: number | null = null;

    const cycleBucketsCalc: CycleBucket[] = [
      { label: "0–1d", count: 0 },
      { label: "2–3d", count: 0 },
      { label: "4–7d", count: 0 },
      { label: "8+d", count: 0 },
    ];

    if (cycleDurations.length > 0) {
      const sum = cycleDurations.reduce((acc, d) => acc + d, 0);
      avgCycleTimeCalc = sum / cycleDurations.length;

      const sorted = [...cycleDurations].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianCycleTimeCalc =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      maxCycleTimeCalc = sorted[sorted.length - 1];

      cycleDurations.forEach((d) => {
        if (d <= 1) cycleBucketsCalc[0].count += 1;
        else if (d <= 3) cycleBucketsCalc[1].count += 1;
        else if (d <= 7) cycleBucketsCalc[2].count += 1;
        else cycleBucketsCalc[3].count += 1;
      });
    }

    const recentSorted = [...tasks].sort((a, b) => {
      const aTime = parseDate(a.created_at)?.getTime() ?? 0;
      const bTime = parseDate(b.created_at)?.getTime() ?? 0;
      return bTime - aTime;
    });

    const recentTasksCalc = recentSorted.slice(0, 4);

    return {
      total: totalCount,
      doneCount: done,
      doingCount: doing,
      todoCount: todo,
      highPriorityCount: highPriority,
      overdueCount: overdue,
      noStartDateCount: noStartDate,
      noDueDateCount: noDueDate,
      highPriorityOverdueCount: highPriorityOverdueCountCalc,
      completionRate: completion,
      dailyActivity: dailyActivityArr,
      momentumTrend: trend,
      weekdayStats: weekdayStatsArr,
      riskScore: riskScoreCalc,
      riskLevel: riskLevelCalc,
      timeProgressPct: timeProgressPctCalc,
      taskProgressPct: taskProgressPctCalc,
      scheduleDeltaPct: scheduleDeltaPctCalc,
      canComputeTimeline: canComputeTimelineCalc,
      predictedDaysRemaining: predictedDaysRemainingCalc,
      predictedCompletionDate: predictedCompletionDateCalc,
      recentTasks: recentTasksCalc,
      avgCycleTime: avgCycleTimeCalc,
      medianCycleTime: medianCycleTimeCalc,
      maxCycleTime: maxCycleTimeCalc,
      cycleBuckets: cycleBucketsCalc,
      missingDatesCount: missingDatesCountCalc,
    };
  }, [tasks, todayStart, project.start_date, project.end_date]);

  const statusTotal = todoCount + doingCount + doneCount;
  const todoPct = statusTotal ? Math.round((todoCount / statusTotal) * 100) : 0;
  const doingPct = statusTotal
    ? Math.round((doingCount / statusTotal) * 100)
    : 0;
  const donePct = statusTotal ? Math.max(0, 100 - todoPct - doingPct) : 0;

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

  const hasCycleData =
    avgCycleTime !== null &&
    medianCycleTime !== null &&
    maxCycleTime !== null &&
    cycleBuckets.some((b) => b.count > 0);

  const planningRiskPct =
    total === 0 ? 0 : Math.round((missingDatesCount / total) * 100);
  const wipLoadPct = total === 0 ? 0 : Math.round((doingCount / total) * 100);
  const highPrioSharePct =
    total === 0 ? 0 : Math.round((highPriorityCount / total) * 100);

  const riskMessage =
    riskLevel === "healthy"
      ? "W większości pod kontrolą – obserwuj przeterminowane zadania i brakujące daty."
      : riskLevel === "warning"
      ? "Są zauważalne problemy – skup się na przeterminowanych i wysokopriorytetowych zadaniach."
      : "Wysokie ryzyko – dużo przeterminowanych lub słabo zdefiniowanych zadań; projekt wymaga uwagi.";

  const workloadHint =
    statusTotal === 0
      ? "Brak zadań – dodaj pierwsze, aby zobaczyć przepływ pracy."
      : doingCount > todoCount && doingCount > doneCount
      ? "Dużo w toku – zwróć uwagę na blokery i przepływ."
      : todoCount > doingCount && todoCount > doneCount
      ? "Backlog dominuje – rozważ priorytety i start kluczowych zadań."
      : doneCount > todoCount && doneCount > doingCount
      ? "Duża część gotowa – jesteś blisko końca."
      : "Praca dość równomiernie rozłożona.";

  const riskInlineNote = `${riskMessage} • ${workloadHint}`;

  const hasTimelineInfo =
    canComputeTimeline ||
    (predictedDaysRemaining != null && predictedCompletionDate);

  return (
    <div className="pov-root">
      {/* HEADER */}
      <div className="card pov-header">
        <div className="pov-header-row">
          <div className="pov-head-main">
            <div className="pov-status-row">
              <span className={`pov-status-pill pov-status-${project.status}`}>
                {project.status}
              </span>
            </div>

            <div className="pov-head-text">
              <h2 className="pov-title">{project.name}</h2>

              {project.description && (
                <div className="pov-description-wrap">
                  <p
                    className={
                      "pov-description" +
                      (descExpanded ? " is-expanded" : " is-collapsed")
                    }
                    title={!descExpanded ? project.description : undefined}
                  >
                    {project.description}
                  </p>

                  {canToggleDescription && (
                    <button
                      type="button"
                      className="pov-desc-toggle"
                      onClick={() => setDescExpanded((v) => !v)}
                    >
                      {descExpanded ? "Zwiń" : "Pokaż więcej"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pov-header-meta">
            <div className="pov-meta-item">
              <span className="pov-meta-label">Start</span>
              <span className="pov-meta-value">
                {formatFullDate(project.start_date)}
              </span>
            </div>
            <div className="pov-meta-item">
              <span className="pov-meta-label">Koniec</span>
              <span className="pov-meta-value">
                {formatFullDate(project.end_date)}
              </span>
            </div>
            <div className="pov-meta-item">
              <span className="pov-meta-label">Postęp</span>
              <span className="pov-meta-value">
                {Math.round(completionRate * 100)}%
              </span>
            </div>
            <div className="pov-meta-item">
              <span className="pov-meta-label">Zadania</span>
              <span className="pov-meta-value">{total}</span>
            </div>
          </div>

          <div className={`pov-mood-badge pov-mood-${riskLevel}`}>
            <span className="pov-mood-emoji">{moodEmoji}</span>
            <span className="pov-mood-label">
              {riskLevel === "healthy"
                ? "Zdrowo"
                : riskLevel === "warning"
                ? "Uwaga"
                : "Krytycznie"}
            </span>
            <span className="pov-mood-score">{riskScore}/100</span>
          </div>
        </div>
      </div>

      <div className="pov-layout">
        <div className="pov-col pov-col-main">
          {/* WORK DISTRIBUTION */}
          <div className="card pov-section pov-area-dist">
            <div className="pov-section-header">
              <h3>Rozkład pracy</h3>
              <span className="pov-section-subtitle">
                Jak praca dzieli się na: do zrobienia / w trakcie / zrobione
              </span>
            </div>

            {statusTotal === 0 ? (
              <div className="pov-chart-empty">
                Brak zadań – dodaj co najmniej jedno, aby zobaczyć przepływ
                pracy.
              </div>
            ) : (
              <>
                <div className="pov-dist-bar">
                  {todoPct > 0 && (
                    <div
                      className="pov-dist-seg pov-dist-seg-todo"
                      style={{ width: `${todoPct}%` }}
                    >
                      <span className="pov-dist-label">
                        Do zrobienia {todoPct}%
                      </span>
                    </div>
                  )}
                  {doingPct > 0 && (
                    <div
                      className="pov-dist-seg pov-dist-seg-doing"
                      style={{ width: `${doingPct}%` }}
                    >
                      <span className="pov-dist-label">
                        W trakcie {doingPct}%
                      </span>
                    </div>
                  )}
                  {donePct > 0 && (
                    <div
                      className="pov-dist-seg pov-dist-seg-done"
                      style={{ width: `${donePct}%` }}
                    >
                      <span className="pov-dist-label">
                        Zrobione {donePct}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="pov-merged-health pov-merged-health-compact">
                  <div className="pov-progress-bars">
                    <div className="pov-progress-row">
                      <div className="pov-progress-label">
                        <span>Postęp zadań</span>
                        <span className="pov-progress-value">
                          {taskProgressPct}%
                        </span>
                      </div>
                      <div className="pov-progress-track">
                        <div
                          className="pov-progress-fill pov-progress-fill-tasks"
                          style={{
                            width: `${clamp(taskProgressPct, 0, 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {canComputeTimeline && (
                      <div className="pov-progress-row">
                        <div className="pov-progress-label">
                          <span>Upływ czasu</span>
                          <span className="pov-progress-value">
                            {timeProgressPct}%
                          </span>
                        </div>
                        <div className="pov-progress-track">
                          <div
                            className="pov-progress-fill pov-progress-fill-time"
                            style={{
                              width: `${clamp(timeProgressPct, 0, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {hasTimelineInfo && (
                    <div className="pov-health-summary pov-health-summary-compact">
                      {canComputeTimeline ? (
                        scheduleDeltaPct >= 5 ? (
                          <div className="pov-health-line">
                            ✅ <strong>{scheduleDeltaPct}%</strong> do przodu.
                          </div>
                        ) : scheduleDeltaPct <= -5 ? (
                          <div className="pov-health-line">
                            ⚠️ <strong>{Math.abs(scheduleDeltaPct)}%</strong> za
                            planem.
                          </div>
                        ) : (
                          <div className="pov-health-line">
                            ℹ️ Mniej więcej zgodnie z planem.
                          </div>
                        )
                      ) : (
                        <div className="pov-health-line">
                          ℹ️ Ustaw start i koniec, aby porównać.
                        </div>
                      )}

                      {predictedDaysRemaining != null &&
                        predictedCompletionDate && (
                          <div className="pov-health-line">
                            📅 Tempo sugeruje koniec za{" "}
                            <strong>{predictedDaysRemaining} dni</strong> (
                            {predictedCompletionDate.toLocaleDateString()}).
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* FLOW & PERFORMANCE */}
          <div className="card pov-section pov-area-flow">
            <div className="pov-section-header">
              <h3>Przepływ i wydajność</h3>
              <span className="pov-section-subtitle">
                Tempo pracy, rytm tygodnia i szybkość dostarczania
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
                Aktywność dzienna
              </button>
              <button
                type="button"
                className={
                  "pov-chart-tab" + (chartMode === "weekly" ? " is-active" : "")
                }
                onClick={() => setChartMode("weekly")}
              >
                Rytm tygodnia
              </button>
              <button
                type="button"
                className={
                  "pov-chart-tab" +
                  (chartMode === "delivery" ? " is-active" : "")
                }
                onClick={() => setChartMode("delivery")}
              >
                Skuteczność dostarczania
              </button>
            </div>

            <div className="pov-chart-switcher">
              {chartMode === "activity" && (
                <>
                  <div className="pov-chart-title">
                    Aktywność dzienna (ostatnie 14 dni)
                  </div>
                  {dailyActivity.length === 0 ? (
                    <div className="pov-chart-empty">
                      Brak danych osi czasu.
                    </div>
                  ) : (
                    <div className="pov-chart-inner">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyActivity}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="started"
                            name="Rozpoczęte"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="due"
                            name="Z terminem"
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
                  <div className="pov-chart-title">Rytm tygodnia</div>
                  {weekdayStats.every((w) => w.count === 0) ? (
                    <div className="pov-chart-empty">Brak aktywności.</div>
                  ) : (
                    <div className="pov-chart-inner">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weekdayStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" name="Zadania" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="pov-chart-footer">
                    Wizualizacja tego, kiedy zwykle dzieje się praca.
                  </div>
                </>
              )}

              {chartMode === "delivery" && (
                <>
                  <div className="pov-chart-title">
                    Skuteczność dostarczania
                  </div>
                  {!hasCycleData ? (
                    <div className="pov-chart-empty">
                      Za mało zadań z uzupełnioną datą startu i terminu.
                    </div>
                  ) : (
                    <>
                      <div className="pov-delivery-stats">
                        <div className="pov-delivery-stat">
                          <div className="pov-delivery-label">Średnia</div>
                          <div className="pov-delivery-value">
                            {avgCycleTime !== null
                              ? avgCycleTime.toFixed(1)
                              : "—"}
                            d
                          </div>
                        </div>
                        <div className="pov-delivery-stat">
                          <div className="pov-delivery-label">Mediana</div>
                          <div className="pov-delivery-value">
                            {medianCycleTime !== null
                              ? medianCycleTime.toFixed(1)
                              : "—"}
                            d
                          </div>
                        </div>
                        <div className="pov-delivery-stat">
                          <div className="pov-delivery-label">Maks</div>
                          <div className="pov-delivery-value">
                            {maxCycleTime !== null
                              ? maxCycleTime.toFixed(1)
                              : "—"}
                            d
                          </div>
                        </div>
                      </div>

                      <div className="pov-chart-inner">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={cycleBuckets}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" name="Zadania" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="pov-delivery-hint">
                        Na podstawie zadań z uzupełnioną datą startu i terminu.
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pov-col pov-col-side">
          {/* RISK RADAR */}
          <div className="card pov-section pov-area-risk">
            <div className="pov-section-header">
              <h3>Radar ryzyka</h3>
              <span className="pov-section-subtitle">
                Najważniejsze czerwone flagi
              </span>
            </div>

            <div className="pov-risk-columns">
              <ul className="pov-risk-list">
                <li>
                  🕓 <strong>{overdueCount}</strong> zadań przeterminowanych
                </li>
                <li>
                  ⚡ <strong>{highPriorityOverdueCount}</strong>{" "}
                  przeterminowanych o wysokim priorytecie
                </li>
                <li>
                  📅 <strong>{noStartDateCount}</strong> zadań bez daty startu
                </li>
                <li>
                  📅 <strong>{noDueDateCount}</strong> zadań bez terminu
                </li>
              </ul>

              <ul className="pov-risk-list pov-risk-list-secondary">
                <li>
                  🧩 <strong>{planningRiskPct}%</strong> brakujących dat (
                  {missingDatesCount})
                </li>
                <li>
                  🔁 <strong>{wipLoadPct}%</strong> w trakcie ({doingCount})
                </li>
                <li>
                  ⚡ <strong>{highPrioSharePct}%</strong> wysoki priorytet (
                  {highPriorityCount})
                </li>
              </ul>
            </div>

            <div className="pov-risk-inline" title={riskInlineNote}>
              {riskInlineNote}
            </div>
          </div>

          {/* ACTIVITY FEED */}
          <div className="card pov-section pov-area-feed">
            <div className="pov-section-header">
              <h3>Aktywność</h3>
              <span className="pov-section-subtitle">
                Ostatnie ruchy w projekcie
              </span>
            </div>

            {isLoading ? (
              <div className="pov-feed-empty">Ładowanie aktywności…</div>
            ) : recentTasks.length === 0 ? (
              <div className="pov-feed-empty">Brak zadań.</div>
            ) : (
              <ul className="pov-feed-list">
                {recentTasks.map((task) => {
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
                          <span> • Priorytet: {task.priority}</span>
                        )}
                        <span> • Utworzono: {createdLabel}</span>
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
