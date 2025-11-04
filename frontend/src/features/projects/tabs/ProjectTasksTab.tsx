import { useMemo, useState } from "react";
import { useProject } from "../context/ProjectContext";
import { useListTasksQuery, useCreateTaskMutation } from "../../tasks/tasksApi";
import type { Task, TaskStatus, TaskPriority } from "../../tasks/types";
import AddTaskModal from "../../tasks/components/AddTaskModal";
import toast from "react-hot-toast";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import "./ProjectTasksTab.css";

type GroupBy = "none" | "status" | "priority";
type SortField = "created_at" | "due_date" | "priority";
type SortDir = "asc" | "desc";
type DueFilter = "all" | "overdue" | "today" | "thisWeek" | "noDueDate";

type StatusPieItem = {
  name: string; // TaskStatus
  value: number;
};

type PriorityPieItem = {
  name: string; // "Low" | "Medium" | "High"
  value: number;
  priority: TaskPriority;
};

// kolory wykresów (łagodniejszy niebieski na start)
const CHART_COLORS: string[] = [
  "#60a5fa",
  "#6366f1",
  "#e11d48",
  "#f97316",
  "#22c55e",
];

const STATUS_OPTIONS: TaskStatus[] = ["todo", "doing", "done"];

/* ==== HELPERS ==== */

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isDone(status: TaskStatus): boolean {
  return status === "done";
}

function isHighPriority(priority: TaskPriority | null | undefined): boolean {
  if (!priority) return false;
  return priority === 3;
}

/**
 * Czy zakres zadania wychodzi poza zakres projektu?
 * (start < project.start albo koniec > project.end)
 */
function isOutsideProjectRange(
  task: Task,
  projectStart: string | null | undefined,
  projectEnd: string | null | undefined
): boolean {
  if (!projectStart && !projectEnd) return false;

  const taskStartDate = parseDate(task.start_date);
  const taskEndDate = parseDate(task.due_date);

  // jeśli jedno z pól brak, używamy drugiego
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

/**
 * Due today = due_date (po samej dacie) == dzisiejsza data
 */
function isDueToday(task: Task, todayStart: Date): boolean {
  const due = parseDate(task.due_date);
  if (!due) return false;

  const dueStart = startOfDay(due);
  return dueStart.getTime() === todayStart.getTime();
}

/**
 * This week = due_date w tygodniu bieżącym (pon–niedz),
 * liczone po samej dacie (bez godzin)
 */
function isDueThisWeek(task: Task, todayStart: Date): boolean {
  const due = parseDate(task.due_date);
  if (!due) return false;

  const dueStart = startOfDay(due);

  const currentDay = todayStart.getDay(); // 0 = niedziela
  const diffToMonday = (currentDay + 6) % 7;

  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  weekEnd.setHours(0, 0, 0, 0);

  return dueStart >= weekStart && dueStart < weekEnd;
}

function priorityLabel(priority: TaskPriority | null | undefined): string {
  if (!priority) return "—";
  if (priority === 1) return "Low";
  if (priority === 2) return "Medium";
  return "High";
}

/* ==== Komponent główny ==== */

export default function ProjectTasksTab() {
  const project = useProject();

  const { data, isLoading } = useListTasksQuery({
    project: project.id,
    ordering: "-created_at",
  });

  const tasks: Task[] = useMemo(() => data?.results ?? [], [data]);

  const [openAdd, setOpenAdd] = useState(false);
  const [createTask] = useCreateTaskMutation();

  // Lokalny stan widoku
  const [search, setSearch] = useState("");
  const [prioritiesFilter, setPrioritiesFilter] = useState<TaskPriority[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const today = useMemo(() => startOfDay(new Date()), []);

  // === STATYSTYKI / OVERVIEW ===
  const {
    total,
    completed,
    overdueCount,
    thisWeekCount,
    highPriorityCount,
    statusPieData,
    priorityPieData,
    dominantPriority,
  } = useMemo(() => {
    const totalCount = tasks.length;
    const completedCount = tasks.filter((t) => isDone(t.status)).length;

    const overdue = tasks.filter((t) =>
      isOverdue(t, today, project.start_date, project.end_date)
    ).length;

    const thisWeek = tasks.filter((t) => isDueThisWeek(t, today)).length;
    const highPriority = tasks.filter((t) => isHighPriority(t.priority)).length;

    const statusMap = new Map<TaskStatus, number>();
    tasks.forEach((task) => {
      const statusName = task.status;
      statusMap.set(statusName, (statusMap.get(statusName) ?? 0) + 1);
    });

    const statusPie: StatusPieItem[] = Array.from(statusMap.entries()).map(
      ([name, value]) => ({ name, value })
    );

    let low = 0;
    let medium = 0;
    let high = 0;
    tasks.forEach((task) => {
      if (task.priority === 1) low += 1;
      else if (task.priority === 2) medium += 1;
      else if (task.priority === 3) high += 1;
    });

    const priorityPie: PriorityPieItem[] = [];
    if (low > 0) priorityPie.push({ name: "Low", value: low, priority: 1 });
    if (medium > 0)
      priorityPie.push({ name: "Medium", value: medium, priority: 2 });
    if (high > 0) priorityPie.push({ name: "High", value: high, priority: 3 });

    let dominant = "";
    if (priorityPie.length > 0) {
      const sorted = [...priorityPie].sort((a, b) => b.value - a.value);
      dominant = sorted[0]?.name ?? "";
    }

    return {
      total: totalCount,
      completed: completedCount,
      overdueCount: overdue,
      thisWeekCount: thisWeek,
      highPriorityCount: highPriority,
      statusPieData: statusPie,
      priorityPieData: priorityPie,
      dominantPriority: dominant,
    };
  }, [tasks, today, project.start_date, project.end_date]);

  // === FILTROWANIE + SORTOWANIE LISTY ===
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (search.trim().length > 0) {
      const q = search.toLowerCase();
      result = result.filter((task) => {
        const title = task.title.toLowerCase();
        const description = (task.description ?? "").toLowerCase();
        return title.includes(q) || description.includes(q);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((task) => task.status === statusFilter);
    }

    if (prioritiesFilter.length > 0) {
      result = result.filter((task) =>
        prioritiesFilter.includes(task.priority)
      );
    }

    if (dueFilter !== "all") {
      if (dueFilter === "overdue") {
        result = result.filter((task) =>
          isOverdue(task, today, project.start_date, project.end_date)
        );
      } else if (dueFilter === "today") {
        result = result.filter((task) => isDueToday(task, today));
      } else if (dueFilter === "thisWeek") {
        result = result.filter((task) => isDueThisWeek(task, today));
      } else if (dueFilter === "noDueDate") {
        result = result.filter((task) => !task.due_date);
      }
    }

    result.sort((a, b) => {
      if (sortField === "created_at") {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        if (aTime === bTime) return 0;
        return sortDir === "asc" ? aTime - bTime : bTime - aTime;
      }

      if (sortField === "due_date") {
        const aTime = parseDate(a.due_date)?.getTime() ?? 0;
        const bTime = parseDate(b.due_date)?.getTime() ?? 0;
        if (aTime === bTime) return 0;
        return sortDir === "asc" ? aTime - bTime : bTime - aTime;
      }

      if (sortField === "priority") {
        const ap = a.priority ?? 0;
        const bp = b.priority ?? 0;
        if (ap === bp) return 0;
        return sortDir === "asc" ? ap - bp : bp - ap;
      }

      return 0;
    });

    return result;
  }, [
    tasks,
    search,
    statusFilter,
    prioritiesFilter,
    dueFilter,
    sortField,
    sortDir,
    today,
    project.start_date,
    project.end_date,
  ]);

  // Grupowanie
  const groupedTasks = useMemo(() => {
    if (groupBy === "none") return null;

    const groups = new Map<string, Task[]>();

    filteredTasks.forEach((task) => {
      let key = "";
      if (groupBy === "status") {
        key = task.status || "No status";
      } else if (groupBy === "priority") {
        const label = priorityLabel(task.priority);
        key = label === "—" ? "No priority" : `${label} priority`;
      }
      const current = groups.get(key) ?? [];
      current.push(task);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([key, groupTasks]) => ({
      key,
      tasks: groupTasks,
    }));
  }, [filteredTasks, groupBy]);

  // === Interakcja z wykresami ===

  const activeStatusIndex =
    statusFilter === "all"
      ? -1
      : statusPieData.findIndex((d) => d.name === statusFilter);

  const selectedStatusItem =
    activeStatusIndex >= 0 ? statusPieData[activeStatusIndex] : null;

  const activePriority =
    prioritiesFilter.length === 1 ? prioritiesFilter[0] : null;

  const activePriorityIndex =
    activePriority != null
      ? priorityPieData.findIndex((d) => d.priority === activePriority)
      : -1;

  const selectedPriorityItem =
    activePriorityIndex >= 0 ? priorityPieData[activePriorityIndex] : null;

  function togglePriorityFilter(p: TaskPriority) {
    setPrioritiesFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  const allKpiActive = false;

  return (
    <>
      {/* OVERVIEW + CHARTS */}
      <div className="card tsk-overview">
        {/* KPI cards + Add task jako kafelek */}
        <div className="tsk-kpi-grid">
          <OverviewCard
            label="All tasks"
            value={total}
            subtitle={
              completed && total
                ? `${completed} completed (${Math.round(
                    (completed / Math.max(total, 1)) * 100
                  )}%)`
                : completed
                ? `${completed} completed`
                : "No completed tasks yet"
            }
            clickable={false}
            active={allKpiActive}
          />
          <OverviewCard
            label="Overdue"
            value={overdueCount}
            subtitle={
              overdueCount
                ? "Tasks with start date before today or outside project range"
                : "No overdue tasks 🎉"
            }
            highlight={overdueCount > 0}
            clickable
            active={dueFilter === "overdue"}
            onClick={() =>
              setDueFilter((prev) => (prev === "overdue" ? "all" : "overdue"))
            }
          />
          <OverviewCard
            label="Due this week"
            value={thisWeekCount}
            subtitle={
              thisWeekCount
                ? "Planned for the current week"
                : "No tasks scheduled this week"
            }
            clickable
            active={dueFilter === "thisWeek"}
            onClick={() =>
              setDueFilter((prev) => (prev === "thisWeek" ? "all" : "thisWeek"))
            }
          />
          <OverviewCard
            label="High priority"
            value={highPriorityCount}
            subtitle={
              highPriorityCount
                ? "High / urgent priority tasks"
                : "No high priority tasks"
            }
            highlight={highPriorityCount > 0}
            clickable
            active={prioritiesFilter.length === 1 && prioritiesFilter[0] === 3}
            onClick={() =>
              setPrioritiesFilter((prev) =>
                prev.length === 1 && prev[0] === 3 ? [] : [3]
              )
            }
          />

          {/* Add task jako piąty kafel */}
          <button
            type="button"
            className="tsk-kpi-card-wrapper is-clickable tsk-add-card"
            onClick={() => setOpenAdd(true)}
          >
            <div className="card tsk-kpi-card tsk-kpi-card--add">
              <div className="tsk-kpi-label">Add task</div>
              <div className="tsk-kpi-value tsk-kpi-add-value">+ Task</div>
              <div className="tsk-kpi-subtitle">
                Create a new task for this project.
              </div>
            </div>
          </button>
        </div>

        {/* Charts + Insights */}
        <div className="tsk-charts-grid">
          {/* Status pie */}
          <div className="tsk-chart-block">
            <div className="tsk-chart-title">Tasks by status</div>
            {statusPieData.length === 0 ? (
              <div className="tsk-chart-empty">
                No data yet – add some tasks to see the breakdown.
              </div>
            ) : (
              <>
                <div className="tsk-chart-inner">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={2}
                        isAnimationActive
                        onClick={(_entry: unknown, index: number) => {
                          const item = statusPieData[index];
                          if (!item) return;
                          const status = item.name as TaskStatus;
                          setStatusFilter((prev) =>
                            prev === status ? "all" : status
                          );
                        }}
                      >
                        {statusPieData.map((entry, index) => {
                          const color =
                            CHART_COLORS[index % CHART_COLORS.length] ??
                            "#0f172a";
                          const isActive = index === activeStatusIndex;
                          const dimmed =
                            activeStatusIndex >= 0 &&
                            index !== activeStatusIndex;

                          return (
                            <Cell
                              key={entry.name}
                              fill={color}
                              opacity={dimmed ? 0.35 : 1}
                              stroke={isActive ? "#0f172a" : undefined}
                              strokeWidth={isActive ? 2 : 1}
                              style={{ cursor: "pointer" }}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="tsk-chart-summary">
                  {statusPieData.map((d) => (
                    <span key={d.name}>
                      {d.name}: <strong>{d.value}</strong>
                    </span>
                  ))}
                </div>

                {selectedStatusItem && (
                  <div className="tsk-chart-selected">
                    Selected: <strong>{selectedStatusItem.name}</strong> –{" "}
                    <strong>{selectedStatusItem.value}</strong> tasks
                  </div>
                )}
              </>
            )}
          </div>

          {/* Priority pie */}
          <div className="tsk-chart-block">
            <div className="tsk-chart-title">Tasks by priority</div>
            {priorityPieData.length === 0 ? (
              <div className="tsk-chart-empty">
                No data yet – add some tasks to see the breakdown.
              </div>
            ) : (
              <>
                <div className="tsk-chart-inner">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={priorityPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={2}
                        isAnimationActive
                        onClick={(_entry: unknown, index: number) => {
                          const item = priorityPieData[index];
                          if (!item) return;
                          const p = item.priority;
                          setPrioritiesFilter((prev) =>
                            prev.length === 1 && prev[0] === p ? [] : [p]
                          );
                        }}
                      >
                        {priorityPieData.map((entry, index) => {
                          const color =
                            CHART_COLORS[index % CHART_COLORS.length] ??
                            "#0f172a";
                          const isActive = index === activePriorityIndex;
                          const dimmed =
                            activePriorityIndex >= 0 &&
                            index !== activePriorityIndex;

                          return (
                            <Cell
                              key={entry.priority}
                              fill={color}
                              opacity={dimmed ? 0.35 : 1}
                              stroke={isActive ? "#0f172a" : undefined}
                              strokeWidth={isActive ? 2 : 1}
                              style={{ cursor: "pointer" }}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="tsk-chart-summary">
                  {priorityPieData.map((d) => (
                    <span key={d.priority}>
                      {d.name}: <strong>{d.value}</strong>
                    </span>
                  ))}
                </div>

                {selectedPriorityItem && (
                  <div className="tsk-chart-selected">
                    Selected:{" "}
                    <strong>{selectedPriorityItem.name} priority</strong> –{" "}
                    <strong>{selectedPriorityItem.value}</strong> tasks
                  </div>
                )}
              </>
            )}
          </div>

          {/* Insights */}
          <div className="tsk-insights-block">
            <div className="tsk-insights-title">Insights</div>
            <ul className="tsk-insights-list">
              {total === 0 && (
                <li>
                  Brak zadań – zacznij od dodania pierwszego zadania w
                  projekcie.
                </li>
              )}
              {total > 0 && (
                <>
                  <li>
                    W projekcie jest <strong>{total}</strong> zadań, z czego{" "}
                    <strong>{completed}</strong> oznaczono jako ukończone.
                  </li>
                  <li>
                    {overdueCount
                      ? `Masz ${overdueCount} zadań, które zaczęły się wcześniej niż dziś lub wychodzą poza zakres projektu – warto je przejrzeć w pierwszej kolejności.`
                      : "Nie masz żadnych zadań zaczynających się przed dziś ani poza zakresem projektu – tak trzymać!"}
                  </li>
                  {thisWeekCount > 0 && (
                    <li>
                      <strong>{thisWeekCount}</strong> zadań ma termin w tym
                      tygodniu.
                    </li>
                  )}
                  {highPriorityCount > 0 && (
                    <li>
                      <strong>{highPriorityCount}</strong> zadań ma wysoki
                      priorytet.
                    </li>
                  )}
                  {dominantPriority && (
                    <li>
                      Najczęściej spotykany priorytet w tym projekcie to{" "}
                      <strong>{dominantPriority}</strong>.
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* FILTRY / SORT */}
      <div className="card tsk-filters">
        <input
          type="text"
          placeholder="Search by title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="tsk-search-input"
        />

        <div className="tsk-filters-middle">
          {/* Status chips */}
          <div className="tsk-status-filter">
            <span className="tsk-status-label">Status:</span>
            <button
              type="button"
              className={
                "tsk-chip" + (statusFilter === "all" ? " is-active" : "")
              }
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={
                  "tsk-chip" + (statusFilter === s ? " is-active" : "")
                }
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Priorytety / multi-selekcja */}
          <div className="tsk-priority-filter">
            <span className="tsk-priority-label">Priority:</span>
            <button
              type="button"
              className={
                "tsk-chip" + (prioritiesFilter.length === 0 ? " is-active" : "")
              }
              onClick={() => setPrioritiesFilter([])}
            >
              All
            </button>
            <button
              type="button"
              className={
                "tsk-chip" + (prioritiesFilter.includes(1) ? " is-active" : "")
              }
              onClick={() => togglePriorityFilter(1)}
            >
              Low
            </button>
            <button
              type="button"
              className={
                "tsk-chip" + (prioritiesFilter.includes(2) ? " is-active" : "")
              }
              onClick={() => togglePriorityFilter(2)}
            >
              Medium
            </button>
            <button
              type="button"
              className={
                "tsk-chip" + (prioritiesFilter.includes(3) ? " is-active" : "")
              }
              onClick={() => togglePriorityFilter(3)}
            >
              High
            </button>
          </div>

          <select
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value as DueFilter)}
            className="tsk-select"
          >
            <option value="all">Due: all</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="thisWeek">This week</option>
            <option value="noDueDate">No due date</option>
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="tsk-select"
          >
            <option value="none">Group: none</option>
            <option value="status">Group by status</option>
            <option value="priority">Group by priority</option>
          </select>
        </div>

        <div className="tsk-filters-right">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="tsk-select"
          >
            <option value="created_at">Sort by: Created</option>
            <option value="due_date">Sort by: Due date</option>
            <option value="priority">Sort by: Priority</option>
          </select>

          <button
            type="button"
            className="btn tsk-sort-dir-btn"
            onClick={() =>
              setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
            }
          >
            {sortDir === "asc" ? "Asc ↑" : "Desc ↓"}
          </button>
        </div>
      </div>

      {/* LISTA / GRUPY – kafelkowy grid jak wcześniej */}
      <div className="tsk-list-wrapper">
        {isLoading && (
          <>
            <div className="card centered muted">Loading tasks…</div>
            {renderSkeletonCards(3)}
          </>
        )}

        {!isLoading && filteredTasks.length === 0 && (
          <div className="card tsk-empty-state">
            <div className="tsk-empty-title">No tasks</div>
            <div className="tsk-empty-text">
              This project has no tasks matching current filters.
            </div>
            <div className="tsk-empty-subtext">
              Try clearing filters or create a new task.
            </div>
            <button
              className="btn tsk-empty-btn"
              onClick={() => setOpenAdd(true)}
            >
              Add task
            </button>
          </div>
        )}

        {!isLoading && filteredTasks.length > 0 && groupBy === "none" && (
          <>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isOverdue={isOverdue(
                  task,
                  today,
                  project.start_date,
                  project.end_date
                )}
                dueToday={isDueToday(task, today)}
              />
            ))}
          </>
        )}

        {!isLoading && groupedTasks && groupBy !== "none" && (
          <>
            {groupedTasks.map((group) => (
              <div key={group.key} className="tsk-group">
                <div className="tsk-group-header">
                  <span>{group.key}</span>
                  <span className="tsk-group-count">{group.tasks.length}</span>
                </div>
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isOverdue={isOverdue(
                      task,
                      today,
                      project.start_date,
                      project.end_date
                    )}
                    dueToday={isDueToday(task, today)}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* MODAL – z doklejeniem project: project.id */}
      <AddTaskModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={async (payload) => {
          try {
            await createTask({ ...payload, project: project.id }).unwrap();
            toast.success("Task created");
            setOpenAdd(false);
          } catch {
            toast.error("Create failed");
          }
        }}
        defaultScope="project"
        lockScope
        defaultProjectId={project.id}
      />
    </>
  );
}

/* ==== Drobne komponenty pomocnicze ==== */

type OverviewCardProps = {
  label: string;
  value: number;
  subtitle?: string;
  highlight?: boolean;
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
};

function OverviewCard(props: OverviewCardProps) {
  const { label, value, subtitle, highlight, clickable, active, onClick } =
    props;
  return (
    <button
      type="button"
      className={
        "tsk-kpi-card-wrapper" +
        (clickable ? " is-clickable" : "") +
        (active ? " is-active" : "")
      }
      onClick={clickable ? onClick : undefined}
    >
      <div
        className={
          "card tsk-kpi-card" +
          (highlight && value > 0 ? " tsk-kpi-card--highlight" : "")
        }
      >
        <div className="tsk-kpi-label">{label}</div>
        <div className="tsk-kpi-value">{value}</div>
        {subtitle && <div className="tsk-kpi-subtitle">{subtitle}</div>}
      </div>
    </button>
  );
}

type TaskCardProps = {
  task: Task;
  isOverdue: boolean;
  dueToday: boolean;
};

function TaskCard(props: TaskCardProps) {
  const { task, isOverdue, dueToday } = props;
  const { id, title, description, status, priority, due_date } = task;

  const priorityIsHigh = isHighPriority(priority);

  return (
    <div className="card tsk-item-card">
      <div className="tsk-item-main">
        <div className="tsk-item-header">
          <div className="tsk-item-title">{title}</div>
          {priority != null && (
            <span
              className={
                "tsk-badge tsk-badge-priority" +
                (priorityIsHigh ? " tsk-badge-priority--high" : "")
              }
            >
              {priorityLabel(priority)}
            </span>
          )}
          {isOverdue && (
            <span className="tsk-badge tsk-badge-overdue">Overdue</span>
          )}
          {dueToday && !isOverdue && (
            <span className="tsk-badge tsk-badge-today">Due today</span>
          )}
        </div>

        {description && (
          <div className="tsk-item-description">{description}</div>
        )}

        <div className="tsk-item-meta">
          Status: {status ?? "—"} • Priority: {priorityLabel(priority)}{" "}
          {due_date ? `• Due: ${due_date}` : ""}
        </div>
      </div>
      <a
        className="btn tsk-item-open-btn"
        href={`/dashboard/tasks?focus=${id}`}
      >
        Open
      </a>
    </div>
  );
}

/* Skeleton cards */

function renderSkeletonCards(count: number) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push(
      <div key={i} className="card tsk-skeleton-card">
        <div className="tsk-skeleton-line tsk-skeleton-line-short" />
        <div className="tsk-skeleton-line tsk-skeleton-line-medium" />
        <div className="tsk-skeleton-line tsk-skeleton-line-long" />
      </div>
    );
  }
  return items;
}
