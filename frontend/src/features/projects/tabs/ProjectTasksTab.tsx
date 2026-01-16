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

type StatusPieItem = { name: string; value: number };
type PriorityPieItem = { name: string; value: number; priority: TaskPriority };

const CHART_COLORS: string[] = [
  "#60a5fa",
  "#6366f1",
  "#e11d48",
  "#f97316",
  "#22c55e",
];
const STATUS_OPTIONS: TaskStatus[] = ["todo", "doing", "done"];

/* ==== HELPERS ==== */

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

function isDone(status: TaskStatus): boolean {
  return status === "done";
}

function isHighPriority(priority: TaskPriority | null | undefined): boolean {
  return priority === 3;
}

function priorityLabel(priority: TaskPriority | null | undefined): string {
  if (!priority) return "—";
  if (priority === 1) return "Niski";
  if (priority === 2) return "Średni";
  return "Wysoki";
}

/** todo / doing / done
 */
function statusLabelPretty(status: TaskStatus | null | undefined): string {
  if (!status) return "—";
  return status;
}

function fmtDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = parseDate(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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

/** Overdue = nie done + start_date < today OR poza zakresem projektu */
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

function isDueToday(task: Task, todayStart: Date): boolean {
  const due = parseDate(task.due_date);
  if (!due) return false;
  return startOfDay(due).getTime() === todayStart.getTime();
}

function isDueThisWeek(task: Task, todayStart: Date): boolean {
  const due = parseDate(task.due_date);
  if (!due) return false;

  const dueStart = startOfDay(due);

  const currentDay = todayStart.getDay();
  const diffToMonday = (currentDay + 6) % 7;

  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  weekEnd.setHours(0, 0, 0, 0);

  return dueStart >= weekStart && dueStart < weekEnd;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

/* ==== MAIN ==== */

export default function ProjectTasksTab() {
  const project = useProject();

  const { data, isLoading } = useListTasksQuery({
    project: project.id,
    ordering: "-created_at",
  });

  const tasks: Task[] = useMemo(() => data?.results ?? [], [data]);

  const [openAdd, setOpenAdd] = useState(false);
  const [createTask] = useCreateTaskMutation();

  // View state
  const [search, setSearch] = useState("");
  const [prioritiesFilter, setPrioritiesFilter] = useState<TaskPriority[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const today = useMemo(() => startOfDay(new Date()), []);

  // KPI / stats
  const {
    total,
    completed,
    overdueCount,
    thisWeekCount,
    highPriorityCount,
    statusPieData,
    priorityPieData,
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
      statusMap.set(task.status, (statusMap.get(task.status) ?? 0) + 1);
    });

    const statusPie: StatusPieItem[] = Array.from(statusMap.entries()).map(
      ([name, value]) => ({ name, value })
    );

    let low = 0,
      medium = 0,
      high = 0;
    tasks.forEach((task) => {
      if (task.priority === 1) low += 1;
      else if (task.priority === 2) medium += 1;
      else if (task.priority === 3) high += 1;
    });

    const priorityPie: PriorityPieItem[] = [];
    if (low > 0) priorityPie.push({ name: "Niski", value: low, priority: 1 });
    if (medium > 0)
      priorityPie.push({ name: "Średni", value: medium, priority: 2 });
    if (high > 0)
      priorityPie.push({ name: "Wysoki", value: high, priority: 3 });

    return {
      total: totalCount,
      completed: completedCount,
      overdueCount: overdue,
      thisWeekCount: thisWeek,
      highPriorityCount: highPriority,
      statusPieData: statusPie,
      priorityPieData: priorityPie,
    };
  }, [tasks, today, project.start_date, project.end_date]);

  // Filtering + sorting
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

    if (statusFilter !== "all")
      result = result.filter((task) => task.status === statusFilter);

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
        return sortDir === "asc" ? aTime - bTime : bTime - aTime;
      }

      if (sortField === "due_date") {
        const aTime = parseDate(a.due_date)?.getTime() ?? 0;
        const bTime = parseDate(b.due_date)?.getTime() ?? 0;
        return sortDir === "asc" ? aTime - bTime : bTime - aTime;
      }

      if (sortField === "priority") {
        const ap = a.priority ?? 0;
        const bp = b.priority ?? 0;
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

  // Grouping
  const groupedTasks = useMemo(() => {
    if (groupBy === "none") return null;

    const groups = new Map<string, Task[]>();

    filteredTasks.forEach((task) => {
      let key = "";
      if (groupBy === "status") key = task.status || "Brak statusu";
      else if (groupBy === "priority") {
        const label = priorityLabel(task.priority);
        key = label === "—" ? "Brak priorytetu" : `Priorytet: ${label}`;
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

  // Charts selection state
  const activeStatusIndex =
    statusFilter === "all"
      ? -1
      : statusPieData.findIndex((d) => d.name === statusFilter);

  const activePriority =
    prioritiesFilter.length === 1 ? prioritiesFilter[0] : null;

  const activePriorityIndex =
    activePriority != null
      ? priorityPieData.findIndex((d) => d.priority === activePriority)
      : -1;

  function togglePriorityFilter(p: TaskPriority) {
    setPrioritiesFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  const kpiAllActive =
    dueFilter === "all" &&
    statusFilter === "all" &&
    prioritiesFilter.length === 0;

  const statusTotal = sum(statusPieData.map((x) => x.value));
  const prioTotal = sum(priorityPieData.map((x) => x.value));

  return (
    <div className="tsk-root">
      <AddTaskModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={async (payload) => {
          try {
            await createTask({ ...payload, project: project.id }).unwrap();
            toast.success("Zadanie utworzone");
            setOpenAdd(false);
          } catch {
            toast.error("Nie udało się utworzyć zadania");
          }
        }}
        defaultScope="project"
        lockScope
        defaultProjectId={project.id}
      />

      {/* KPI STRIP */}
      <div className="card tsk-kpi-strip">
        <KpiTile
          label="Wszystkie zadania"
          value={total}
          meta={
            total > 0
              ? `${completed} ukończone (${Math.round(
                  (completed / Math.max(total, 1)) * 100
                )}%)`
              : "Brak zadań"
          }
          active={kpiAllActive}
          onClick={() => {
            setDueFilter("all");
            setStatusFilter("all");
            setPrioritiesFilter([]);
          }}
        />
        <KpiTile
          label="Zaległe"
          value={overdueCount}
          meta={
            overdueCount
              ? "Start przed dzisiaj lub poza zakresem projektu"
              : "Brak zaległych 🎉"
          }
          highlight={overdueCount > 0}
          active={dueFilter === "overdue"}
          onClick={() =>
            setDueFilter((p) => (p === "overdue" ? "all" : "overdue"))
          }
        />
        <KpiTile
          label="W tym tygodniu"
          value={thisWeekCount}
          meta={
            thisWeekCount
              ? "Zaplanowane na bieżący tydzień"
              : "Brak zadań w tym tygodniu"
          }
          active={dueFilter === "thisWeek"}
          onClick={() =>
            setDueFilter((p) => (p === "thisWeek" ? "all" : "thisWeek"))
          }
        />
        <KpiTile
          label="Wysoki priorytet"
          value={highPriorityCount}
          meta={highPriorityCount ? "Pilne zadania" : "Brak pilnych zadań"}
          highlight={highPriorityCount > 0}
          active={prioritiesFilter.length === 1 && prioritiesFilter[0] === 3}
          onClick={() =>
            setPrioritiesFilter((p) =>
              p.length === 1 && p[0] === 3 ? [] : [3]
            )
          }
        />
        <button
          type="button"
          className="tsk-kpi-tile tsk-kpi-tile--add"
          onClick={() => setOpenAdd(true)}
        >
          <div className="tsk-kpi-label">Dodaj zadanie</div>
          <div className="tsk-kpi-value">+ Zadanie</div>
          <div className="tsk-kpi-meta">
            Utwórz nowe zadanie w tym projekcie
          </div>
        </button>
      </div>

      {/* LAYOUT */}
      <div className="tsk-layout">
        {/* MAIN */}
        <div className="tsk-main">
          <div className="card tsk-list-card">
            <div className="tsk-list-head">
              <div>
                <h3 className="tsk-list-title">Zadania</h3>
                <div className="tsk-list-subtitle">
                  {isLoading
                    ? "Ładowanie…"
                    : `${filteredTasks.length} widocznych • ${total} łącznie • ${completed} ukończone`}
                </div>
              </div>
            </div>

            <div className="tsk-list-scroll">
              {isLoading ? (
                <div className="tsk-grid">{renderSkeletonCards(10)}</div>
              ) : filteredTasks.length === 0 ? (
                <div className="tsk-empty-state">
                  <div className="tsk-empty-title">Brak zadań</div>
                  <div className="tsk-empty-text">
                    Brak wyników dla aktualnych filtrów.
                  </div>
                  <button className="btn" onClick={() => setOpenAdd(true)}>
                    Dodaj zadanie
                  </button>
                </div>
              ) : groupBy === "none" ? (
                <div className="tsk-grid">
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
                </div>
              ) : (
                <div className="tsk-grouped">
                  {groupedTasks?.map((group) => (
                    <div key={group.key} className="tsk-group">
                      <div className="tsk-group-header">
                        <span>
                          {groupBy === "status"
                            ? `Status: ${group.key}`
                            : group.key}
                        </span>
                        <span className="tsk-group-count">
                          {group.tasks.length}
                        </span>
                      </div>
                      <div className="tsk-grid">
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SIDE */}
        <div className="tsk-side">
          {/* FILTERS */}
          <div className="card tsk-side-card">
            <div className="tsk-side-head">
              <h3 className="tsk-side-title">Filtry</h3>
            </div>

            <div className="tsk-filters-stack">
              <input
                type="text"
                placeholder="Szukaj zadań…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="tsk-search-input"
              />

              <div className="tsk-two-cols">
                <div className="tsk-filter-block">
                  <div className="tsk-filter-label">Status</div>
                  <div className="tsk-filter-row">
                    <button
                      type="button"
                      className={
                        "tsk-pill" +
                        (statusFilter === "all" ? " is-active" : "")
                      }
                      onClick={() => setStatusFilter("all")}
                    >
                      Wszystkie
                    </button>
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={
                          "tsk-pill" + (statusFilter === s ? " is-active" : "")
                        }
                        onClick={() => setStatusFilter(s)}
                      >
                        {statusLabelPretty(s)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tsk-filter-block">
                  <div className="tsk-filter-label">Priorytet</div>
                  <div className="tsk-filter-row">
                    <button
                      type="button"
                      className={
                        "tsk-pill" +
                        (prioritiesFilter.length === 0 ? " is-active" : "")
                      }
                      onClick={() => setPrioritiesFilter([])}
                    >
                      Wszystkie
                    </button>
                    <button
                      type="button"
                      className={
                        "tsk-pill" +
                        (prioritiesFilter.includes(1) ? " is-active" : "")
                      }
                      onClick={() => togglePriorityFilter(1)}
                    >
                      Niski
                    </button>
                    <button
                      type="button"
                      className={
                        "tsk-pill" +
                        (prioritiesFilter.includes(2) ? " is-active" : "")
                      }
                      onClick={() => togglePriorityFilter(2)}
                    >
                      Średni
                    </button>
                    <button
                      type="button"
                      className={
                        "tsk-pill" +
                        (prioritiesFilter.includes(3) ? " is-active" : "")
                      }
                      onClick={() => togglePriorityFilter(3)}
                    >
                      Wysoki
                    </button>
                  </div>
                </div>
              </div>

              <div className="tsk-controls-row">
                <div className="tsk-control">
                  <div className="tsk-control-label">Termin</div>
                  <select
                    value={dueFilter}
                    onChange={(e) => setDueFilter(e.target.value as DueFilter)}
                    className="tsk-select"
                  >
                    <option value="all">Wszystkie</option>
                    <option value="overdue">Zaległe</option>
                    <option value="today">Dzisiaj</option>
                    <option value="thisWeek">W tym tygodniu</option>
                    <option value="noDueDate">Bez terminu</option>
                  </select>
                </div>

                <div className="tsk-control">
                  <div className="tsk-control-label">Grupuj</div>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                    className="tsk-select"
                  >
                    <option value="none">Brak</option>
                    <option value="status">Status</option>
                    <option value="priority">Priorytet</option>
                  </select>
                </div>

                <div className="tsk-control">
                  <div className="tsk-control-label">Sortuj</div>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="tsk-select"
                  >
                    <option value="created_at">Data utworzenia</option>
                    <option value="due_date">Termin</option>
                    <option value="priority">Priorytet</option>
                  </select>
                </div>

                <div className="tsk-control tsk-control--dir">
                  <div className="tsk-control-label">Kierunek</div>
                  <div
                    className="tsk-sort-tabs"
                    role="tablist"
                    aria-label="Kierunek sortowania"
                  >
                    <button
                      type="button"
                      className={
                        "tsk-sort-tab" + (sortDir === "asc" ? " is-active" : "")
                      }
                      onClick={() => setSortDir("asc")}
                      role="tab"
                      aria-selected={sortDir === "asc"}
                    >
                      Rosnąco
                    </button>
                    <button
                      type="button"
                      className={
                        "tsk-sort-tab" +
                        (sortDir === "desc" ? " is-active" : "")
                      }
                      onClick={() => setSortDir("desc")}
                      role="tab"
                      aria-selected={sortDir === "desc"}
                    >
                      Malejąco
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CHARTS */}
          <div className="card tsk-side-card">
            <div className="tsk-side-head">
              <h3 className="tsk-side-title">Wykresy</h3>
              <div className="tsk-side-sub">
                Kliknij element wykresu, aby filtrować
              </div>
            </div>

            <div className="tsk-charts-row">
              {/* STATUS */}
              <div className="tsk-chart-mini">
                <div className="tsk-chart-title">Status</div>
                {statusPieData.length === 0 ? (
                  <div className="tsk-chart-empty">Brak danych.</div>
                ) : (
                  <>
                    <div className="tsk-chart-inner tsk-chart-inner--bigger">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            innerRadius={36}
                            paddingAngle={2}
                            isAnimationActive
                            onClick={(_entry: unknown, index: number) => {
                              const item = statusPieData[index];
                              if (!item) return;
                              const s = item.name as TaskStatus;
                              setStatusFilter((prev) =>
                                prev === s ? "all" : s
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

                          <Tooltip
                            formatter={(value: unknown, name: unknown) => {
                              const label =
                                typeof name === "string"
                                  ? statusLabelPretty(name as TaskStatus)
                                  : "—";

                              const val =
                                typeof value === "number" ||
                                typeof value === "string"
                                  ? value
                                  : 0;

                              return [val, label];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="tsk-chart-values">
                      {statusPieData.map((d) => (
                        <span key={d.name} className="tsk-chart-value">
                          {statusLabelPretty(d.name as TaskStatus)}:{" "}
                          <strong>{d.value}</strong>
                        </span>
                      ))}
                      <span className="tsk-chart-total">
                        Razem: <strong>{statusTotal}</strong>
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* PRIORITY */}
              <div className="tsk-chart-mini">
                <div className="tsk-chart-title">Priorytet</div>
                {priorityPieData.length === 0 ? (
                  <div className="tsk-chart-empty">Brak danych.</div>
                ) : (
                  <>
                    <div className="tsk-chart-inner tsk-chart-inner--bigger">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={priorityPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            innerRadius={36}
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

                    <div className="tsk-chart-values">
                      {priorityPieData.map((d) => (
                        <span key={d.priority} className="tsk-chart-value">
                          {d.name}: <strong>{d.value}</strong>
                        </span>
                      ))}
                      <span className="tsk-chart-total">
                        Razem: <strong>{prioTotal}</strong>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==== KPI Tile ==== */

function KpiTile(props: {
  label: string;
  value: number;
  meta: string;
  active?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const { label, value, meta, active, highlight, onClick } = props;

  return (
    <button
      type="button"
      className={
        "tsk-kpi-tile" +
        (active ? " is-active" : "") +
        (highlight ? " is-highlight" : "")
      }
      onClick={onClick}
    >
      <div className="tsk-kpi-label">{label}</div>
      <div className="tsk-kpi-value">{value}</div>
      <div className="tsk-kpi-meta">{meta}</div>
    </button>
  );
}

/* ==== Task Card ==== */

function TaskCard(props: {
  task: Task;
  isOverdue: boolean;
  dueToday: boolean;
}) {
  const { task, isOverdue: overdue, dueToday } = props;
  const priorityIsHigh = isHighPriority(task.priority);

  const statusClass =
    task.status === "done"
      ? "tsk-chip-status--done"
      : task.status === "doing"
      ? "tsk-chip-status--doing"
      : "tsk-chip-status--todo";

  return (
    <div className="tsk-item-card" title={task.description ?? ""}>
      <div className="tsk-item-header">
        <div className="tsk-item-title" title={task.title}>
          {task.title}
        </div>

        <a className="tsk-open-mini" href={`/dashboard/tasks?focus=${task.id}`}>
          Otwórz
        </a>
      </div>

      <div className="tsk-item-chips">
        {task.priority != null && (
          <span
            className={
              "tsk-badge tsk-badge-priority" +
              (priorityIsHigh ? " tsk-badge-priority--high" : "")
            }
          >
            {priorityLabel(task.priority)}
          </span>
        )}

        <span className={"tsk-badge tsk-chip-status " + statusClass}>
          {statusLabelPretty(task.status)}
        </span>

        {overdue && (
          <span className="tsk-badge tsk-badge-overdue">Zaległe</span>
        )}
        {dueToday && !overdue && (
          <span className="tsk-badge tsk-badge-today">Na dziś</span>
        )}
      </div>

      {task.description && (
        <div className="tsk-item-description" title={task.description}>
          {task.description}
        </div>
      )}

      <div className="tsk-item-meta">
        Termin: <strong>{fmtDateLong(task.due_date)}</strong>
      </div>
    </div>
  );
}

/* ==== Skeleton ==== */

function renderSkeletonCards(count: number) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push(
      <div key={i} className="tsk-skeleton-card">
        <div className="tsk-skeleton-line tsk-skeleton-line-short" />
        <div className="tsk-skeleton-line tsk-skeleton-line-medium" />
        <div className="tsk-skeleton-line tsk-skeleton-line-long" />
      </div>
    );
  }
  return items;
}
