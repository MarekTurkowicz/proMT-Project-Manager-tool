import React, { useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useProject } from "../context/ProjectContext";

import { useListUsersQuery } from "../../api/usersApi";
import {
  useListTasksQuery,
  useUpdateTaskMutation,
  tasksApi,
} from "../../tasks/tasksApi";

import type { Task, CreateTaskPayload } from "../../tasks/types";
import type { AppUser } from "../../types/users";
import type { AppDispatch } from "../../../app/store";

import EditTaskModal from "../../tasks/components/EditTaskModal";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import "./ProjectTeamTab.css";

type PersonKpi = {
  user: AppUser;
  total: number;
  todo: number;
  doing: number;
  done: number;
  overdue: number;
  dueSoon: number;
};

type CriticalTaskItem = {
  task: Task;
  owner: AppUser | null;
  score: number;
  reason: "overdue" | "dueSoon" | "doing";
};

type TaskFilter = "all" | "todo" | "doing" | "done" | "overdue";

type HoverPreview = {
  task: Task;
  x: number;
  y: number;
} | null;

/* ===== date helpers ===== */
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const parts = s.split("-");
  if (parts.length !== 3) return null;
  const [yy, mm, dd] = parts.map((p) => Number(p));
  if (!yy || !mm || !dd) return null;
  const d = new Date(yy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

function daysBetween(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isOverdueTask(t: Task, today: Date) {
  if (t.status === "done") return false;
  const due = parseDateOnly(t.due_date);
  if (!due) return false;
  return due.getTime() < today.getTime();
}

function isDueSoonTask(t: Task, today: Date, days = 7) {
  if (t.status === "done") return false;
  const due = parseDateOnly(t.due_date);
  if (!due) return false;
  const diff = daysBetween(today, due);
  return diff >= 0 && diff <= days;
}

function clampText(s: string, max = 140) {
  const x = (s ?? "").trim();
  if (!x) return "";
  return x.length > max ? x.slice(0, max) + "…" : x;
}

function sortPeople(a: PersonKpi, b: PersonKpi) {
  if (a.overdue !== b.overdue) return b.overdue - a.overdue;
  if (a.doing !== b.doing) return b.doing - a.doing;
  if (a.todo !== b.todo) return b.todo - a.todo;
  return a.user.username.localeCompare(b.user.username);
}

/* ===== tiny modal for person details ===== */
function PersonDetailsModal(props: {
  open: boolean;
  user: AppUser;
  onClose: () => void;
}) {
  if (!props.open) return null;

  const role =
    (props.user as unknown as { profile?: { role?: string } })?.profile?.role ??
    "";
  const phone =
    (props.user as unknown as { profile?: { phone?: string } })?.profile
      ?.phone ?? "";
  const avatarUrl =
    (props.user as unknown as { profile?: { avatar_url?: string } })?.profile
      ?.avatar_url ?? "";

  return (
    <div className="team-modal-overlay" role="dialog" aria-modal="true">
      <div className="team-modal-backdrop" onClick={props.onClose} />
      <div className="team-modal">
        <div className="team-modal-head">
          <div className="team-modal-title">Person details</div>
          <button className="team-modal-close" onClick={props.onClose}>
            ✕
          </button>
        </div>

        <div className="team-modal-body">
          <div className="team-modal-user">
            <div className="team-modal-avatar">
              {props.user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="team-modal-userinfo">
              <div className="team-modal-username">{props.user.username}</div>
              {props.user.email ? (
                <div className="team-modal-email">{props.user.email}</div>
              ) : null}
            </div>
          </div>

          {(role || phone || avatarUrl) && (
            <div className="team-modal-grid">
              {role ? (
                <div className="team-modal-row">
                  <div className="k">Role</div>
                  <div className="v">{role}</div>
                </div>
              ) : null}

              {phone ? (
                <div className="team-modal-row">
                  <div className="k">Phone</div>
                  <div className="v">{phone}</div>
                </div>
              ) : null}

              {avatarUrl ? (
                <div className="team-modal-row">
                  <div className="k">Avatar URL</div>
                  <div className="v">
                    <span className="team-modal-mono">{avatarUrl}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="team-modal-foot">
          <button className="btn btn-outline" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== component ===== */
export default function ProjectTeamTab() {
  const project = useProject();
  const dispatch = useDispatch<AppDispatch>();

  const { data: users = [], isLoading: usersLoading } = useListUsersQuery();
  const { data: tasksData, isFetching: tasksFetching } = useListTasksQuery(
    { project: project.id },
    { refetchOnFocus: true }
  );

  const tasks: Task[] = useMemo(() => tasksData?.results ?? [], [tasksData]);
  const [updateTask] = useUpdateTaskMutation();

  // UI state
  const [q, setQ] = useState("");
  const [onlyWithTasks, setOnlyWithTasks] = useState(true);
  const [onlyWithAlerts, setOnlyWithAlerts] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // filters (kafelki)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");

  const [unassignedOpen, setUnassignedOpen] = useState(false);

  const [hoverPreview, setHoverPreview] = useState<HoverPreview>(null);
  const hoverTimerRef = useRef<number | null>(null);

  // modale
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [personModalOpen, setPersonModalOpen] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);

  const loading = usersLoading || tasksFetching;

  /* ===== KPI per person ===== */
  const peopleKpis: PersonKpi[] = useMemo(() => {
    const map = new Map<number, PersonKpi>();
    for (const u of users) {
      map.set(u.id, {
        user: u,
        total: 0,
        todo: 0,
        doing: 0,
        done: 0,
        overdue: 0,
        dueSoon: 0,
      });
    }

    for (const t of tasks) {
      const assignees = t.assignees ?? [];
      if (!assignees.length) continue;

      const overdue = isOverdueTask(t, today);
      const dueSoon = isDueSoonTask(t, today, 7);

      for (const u of assignees) {
        const row = map.get(u.id);
        if (!row) continue;

        row.total += 1;
        if (t.status === "todo") row.todo += 1;
        else if (t.status === "doing") row.doing += 1;
        else if (t.status === "done") row.done += 1;

        if (overdue) row.overdue += 1;
        if (dueSoon) row.dueSoon += 1;
      }
    }

    return Array.from(map.values()).sort(sortPeople);
  }, [users, tasks, today]);

  /* ===== project KPIs (top) ===== */
  const projectKpis = useMemo(() => {
    const overdue = tasks.filter((t) => isOverdueTask(t, today)).length;
    const dueSoon = tasks.filter((t) => isDueSoonTask(t, today, 7)).length;
    const wip = tasks.filter((t) => t.status === "doing").length;
    const unassigned = tasks.filter((t) => !(t.assignees?.length ?? 0)).length;

    const activeTeam = peopleKpis.filter((p) => p.total > 0).length;

    return { activeTeam, overdue, wip, dueSoon, unassigned };
  }, [tasks, today, peopleKpis]);

  /* ===== left list filtering ===== */
  const filteredPeople = useMemo(() => {
    const nq = q.trim().toLowerCase();
    let list = peopleKpis;

    if (nq) {
      list = list.filter((p) => {
        const name = (p.user.username ?? "").toLowerCase();
        const email = (p.user.email ?? "").toLowerCase();
        return name.includes(nq) || email.includes(nq);
      });
    }

    if (onlyWithTasks) list = list.filter((p) => p.total > 0);

    if (onlyWithAlerts) {
      list = list.filter((p) => p.overdue > 0 || p.dueSoon > 0 || p.doing >= 6);
    }

    return [...list].sort(sortPeople);
  }, [peopleKpis, q, onlyWithTasks, onlyWithAlerts]);

  /* ===== selection helpers ===== */
  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllVisible() {
    setSelectedIds(filteredPeople.map((p) => p.user.id));
  }

  function clearSelection() {
    setSelectedIds([]);
    setTaskFilter("all");
  }

  const selectionMode: "none" | "single" | "multi" =
    selectedIds.length === 0
      ? "none"
      : selectedIds.length === 1
      ? "single"
      : "multi";

  const selectedPeople = useMemo(() => {
    const map = new Map<number, PersonKpi>();
    for (const p of peopleKpis) map.set(p.user.id, p);
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as PersonKpi[];
  }, [selectedIds, peopleKpis]);

  const singlePerson = selectionMode === "single" ? selectedPeople[0] : null;

  /* ===== base tasks for center view ===== */
  const baseTasksForView = useMemo(() => {
    if (selectionMode === "none") return [] as Task[];

    if (selectionMode === "single" && singlePerson) {
      const id = singlePerson.user.id;
      return tasks.filter((t) => (t.assignees ?? []).some((u) => u.id === id));
    }

    const ids = selectedSet;
    return tasks.filter((t) => (t.assignees ?? []).some((u) => ids.has(u.id)));
  }, [selectionMode, singlePerson, tasks, selectedSet]);

  /* ===== filter tasks by clicked KPI card ===== */
  const filteredTasksForList = useMemo(() => {
    const list = baseTasksForView.slice();

    if (taskFilter === "todo") return list.filter((t) => t.status === "todo");
    if (taskFilter === "doing") return list.filter((t) => t.status === "doing");
    if (taskFilter === "done") return list.filter((t) => t.status === "done");
    if (taskFilter === "overdue")
      return list.filter((t) => isOverdueTask(t, today));
    return list;
  }, [baseTasksForView, taskFilter, today]);

  function toggleTaskFilter(next: TaskFilter) {
    setTaskFilter((prev) => (prev === next ? "all" : next));
  }

  /* ===== critical tasks ===== */
  const criticalTasksForSelection = useMemo(() => {
    if (selectionMode === "none") return [] as CriticalTaskItem[];

    const ids = selectedSet;
    const items: CriticalTaskItem[] = [];

    for (const t of baseTasksForView) {
      const assignees = t.assignees ?? [];
      const owner =
        selectionMode === "single"
          ? assignees.find((u) => u.id === (singlePerson?.user.id ?? -1)) ??
            null
          : assignees.find((u) => ids.has(u.id)) ?? null;

      if (!owner) continue;

      const overdue = isOverdueTask(t, today);
      const dueSoon = isDueSoonTask(t, today, 7);

      let reason: CriticalTaskItem["reason"] | null = null;
      let score = 0;

      if (overdue) {
        reason = "overdue";
        score = 1000;
        const due = parseDateOnly(t.due_date);
        if (due) score += Math.abs(daysBetween(due, today));
      } else if (dueSoon) {
        reason = "dueSoon";
        score = 700;
        const due = parseDateOnly(t.due_date);
        if (due) score += 50 - Math.max(0, daysBetween(today, due));
      } else if (t.status === "doing") {
        reason = "doing";
        score = 400;
      }

      if (!reason) continue;
      if (t.status === "done") continue;

      items.push({ task: t, owner, score, reason });
    }

    return items.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [selectionMode, selectedSet, baseTasksForView, singlePerson, today]);

  /* ===== aggregate KPIs (multi) ===== */
  const aggregateKpis = useMemo(() => {
    if (selectionMode !== "multi") return null;

    const ids = selectedSet;
    let total = 0;
    let open = 0;
    let overdue = 0;
    let dueSoon = 0;

    for (const t of tasks) {
      const belongs = (t.assignees ?? []).some((u) => ids.has(u.id));
      if (!belongs) continue;

      total += 1;
      if (t.status === "todo" || t.status === "doing") open += 1;
      if (isOverdueTask(t, today)) overdue += 1;
      if (isDueSoonTask(t, today, 7)) dueSoon += 1;
    }

    return { total, open, overdue, dueSoon };
  }, [selectionMode, selectedSet, tasks, today]);

  /* ===== charts data (CHANGES based on taskFilter) ===== */
  const workloadChartData = useMemo(() => {
    const rows = selectedIds.length
      ? selectedPeople
      : peopleKpis.filter((p) => p.total > 0).slice(0, 10);

    const sorted = [...rows].sort(
      (a, b) => b.todo + b.doing - (a.todo + a.doing)
    );

    if (taskFilter === "todo") {
      return sorted.map((p) => ({ name: p.user.username, value: p.todo }));
    }
    if (taskFilter === "doing") {
      return sorted.map((p) => ({ name: p.user.username, value: p.doing }));
    }
    if (taskFilter === "done") {
      return sorted.map((p) => ({ name: p.user.username, value: p.done }));
    }
    if (taskFilter === "overdue") {
      return sorted.map((p) => ({ name: p.user.username, value: p.overdue }));
    }

    // all => stacked open (todo+doing)
    return sorted.map((p) => ({
      name: p.user.username,
      todo: p.todo,
      doing: p.doing,
    }));
  }, [selectedIds.length, selectedPeople, peopleKpis, taskFilter]);

  const assignedVsUnassigned = useMemo(() => {
    const unassigned = tasks.filter((t) => !(t.assignees?.length ?? 0)).length;
    const assigned = Math.max(tasks.length - unassigned, 0);
    return [
      { name: "Assigned", value: assigned },
      { name: "Unassigned", value: unassigned },
    ];
  }, [tasks]);

  const unassignedTasks = useMemo(() => {
    return tasks
      .filter((t) => !(t.assignees?.length ?? 0))
      .sort((a, b) => {
        const ao = isOverdueTask(a, today) ? 1 : 0;
        const bo = isOverdueTask(b, today) ? 1 : 0;
        if (ao !== bo) return bo - ao;
        const ad =
          parseDateOnly(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
        const bd =
          parseDateOnly(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });
  }, [tasks, today]);

  /* ===== optimistic patch helper ===== */
  function optimisticPatchTask(id: number, patch: Partial<CreateTaskPayload>) {
    return dispatch(
      tasksApi.util.updateQueryData(
        "listTasks",
        { project: project.id },
        (draft) => {
          const arr = draft?.results ?? [];
          const idx = arr.findIndex((t) => t.id === id);
          if (idx !== -1)
            arr[idx] = { ...(arr[idx] as Task), ...patch } as Task;
        }
      )
    );
  }

  async function quickUpdate(id: number, patch: Partial<CreateTaskPayload>) {
    const patchCache = optimisticPatchTask(id, patch);
    try {
      await updateTask({ id, patch }).unwrap();
    } catch {
      patchCache.undo();
    }
  }

  async function quickUnassign(task: Task) {
    await quickUpdate(task.id, { assignee_ids: [] });
  }

  async function quickAssign(task: Task, userId: number) {
    if (!userId) return;
    await quickUpdate(task.id, { assignee_ids: [userId] });
  }

  function computePreviewPos(e: React.MouseEvent) {
    const pad = 14;
    const maxW = 520;
    const maxH = 340;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = e.clientX + 14;
    let y = e.clientY + 14;

    if (x + maxW + pad > vw) x = Math.max(pad, vw - maxW - pad);
    if (y + maxH + pad > vh) y = Math.max(pad, vh - maxH - pad);

    return { x, y };
  }

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function schedulePreview(e: React.MouseEvent, task: Task) {
    clearHoverTimer();
    const { x, y } = computePreviewPos(e);

    hoverTimerRef.current = window.setTimeout(() => {
      setHoverPreview({ task, x, y });
      hoverTimerRef.current = null;
    }, 3000);
  }

  function showPreviewNow(e: React.MouseEvent, task: Task) {
    clearHoverTimer();
    const { x, y } = computePreviewPos(e);
    setHoverPreview({ task, x, y });
  }

  function onTaskMouseLeave() {
    clearHoverTimer();
    setHoverPreview(null);
  }

  /* ===== render ===== */
  return (
    <div className="team-tab card">
      {/* header / top row */}
      <div className="team-topbar">
        <div className="team-topbar-left">
          <div className="team-topbar-title">Team</div>
          <div className="team-topbar-sub">People • workload • risks</div>
        </div>

        <div className="team-lite-kpis">
          <div className="team-lite-kpi muted">
            <div className="lbl">Team</div>
            <div className="val">{projectKpis.activeTeam}</div>
          </div>

          <div className="team-lite-kpi bad">
            <div className="lbl">Overdue</div>
            <div className="val">{projectKpis.overdue}</div>
          </div>

          <div className="team-lite-kpi muted">
            <div className="lbl">WIP</div>
            <div className="val">{projectKpis.wip}</div>
          </div>

          <div className="team-lite-kpi warn">
            <div className="lbl">Due (7d)</div>
            <div className="val">{projectKpis.dueSoon}</div>
          </div>

          <button
            type="button"
            className={
              "team-lite-kpi-btn warn" +
              (projectKpis.unassigned === 0 ? " muted" : "")
            }
            onClick={() => setUnassignedOpen(true)}
          >
            <div className="lbl">Unassigned</div>
            <div className="val">{projectKpis.unassigned}</div>
          </button>
        </div>
      </div>

      <div className="team-layout team-lite-layout">
        {/* LEFT */}
        <aside className="team-sidebar">
          <div className="team-sidebar-header">
            <div className="team-title">People</div>

            <div className="team-selection-bar">
              <button
                type="button"
                className="team-mini-btn"
                onClick={selectAllVisible}
                disabled={filteredPeople.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                className="team-mini-btn"
                onClick={clearSelection}
                disabled={selectedIds.length === 0}
              >
                Clear
              </button>
            </div>

            <div className="team-search">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name / email…"
              />
            </div>

            <div className="team-filters">
              <label className="team-check">
                <input
                  type="checkbox"
                  checked={onlyWithTasks}
                  onChange={(e) => setOnlyWithTasks(e.target.checked)}
                />
                <span>Only with tasks</span>
              </label>

              <label className="team-check">
                <input
                  type="checkbox"
                  checked={onlyWithAlerts}
                  onChange={(e) => setOnlyWithAlerts(e.target.checked)}
                />
                <span>Only with alerts</span>
              </label>

              <div className="team-selected-pill">
                Selected: <b>{selectedIds.length}</b>
              </div>
            </div>

            {loading && <div className="team-muted">Loading…</div>}
          </div>

          {!loading && filteredPeople.length === 0 && (
            <div className="team-muted" style={{ padding: "10px 12px" }}>
              No people match filters.
            </div>
          )}

          <div className="team-members-list">
            {filteredPeople.map((p) => {
              const active = selectedSet.has(p.user.id);
              const hasAlert = p.overdue > 0 || p.dueSoon > 0 || p.doing >= 6;

              return (
                <div
                  key={p.user.id}
                  className={"team-person-row" + (active ? " is-active" : "")}
                >
                  <label className="team-person-left">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleSelect(p.user.id)}
                    />
                    <div className="team-avatar">
                      {p.user.username.slice(0, 2).toUpperCase()}
                    </div>
                  </label>

                  <div
                    className="team-person-main"
                    onClick={() => toggleSelect(p.user.id)}
                  >
                    <div className="team-person-top">
                      <div className="team-person-name">
                        {p.user.username}
                        {hasAlert && (
                          <span className="team-alert-dot" title="Has alerts" />
                        )}
                      </div>
                    </div>

                    <div className="team-person-email">
                      {p.user.email ?? "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER */}
        <main className="team-main team-lite-main">
          <div className="team-main-header compact">
            <div className="team-main-title">
              {selectionMode === "none" && "Team snapshot"}
              {selectionMode === "single" && (
                <>
                  <span className="team-person-underline">
                    {singlePerson?.user.username}
                  </span>
                  {(singlePerson?.overdue ?? 0) > 0 && (
                    <span className="badge danger">Overdue</span>
                  )}
                  {(singlePerson?.dueSoon ?? 0) > 0 && (
                    <span className="badge warn">Due soon</span>
                  )}
                  <button
                    type="button"
                    className="team-info-btn"
                    onClick={() => setPersonModalOpen(true)}
                  >
                    Details
                  </button>
                </>
              )}
              {selectionMode === "multi" && (
                <>Selected team ({selectedIds.length})</>
              )}
            </div>

            {selectionMode === "multi" && (
              <div className="team-main-subtitle">Aggregated view</div>
            )}
            {selectionMode === "none" && (
              <div className="team-main-subtitle">
                Overview of workload & risks
              </div>
            )}
          </div>

          {selectionMode === "none" && (
            <div className="team-snapshot">
              <div className="team-snap-grid">
                <div className="team-snap-card">
                  <div className="team-snap-title">Top workload</div>
                  <div className="team-snap-sub">Open tasks (todo + doing)</div>
                  <div className="team-snap-list">
                    {peopleKpis
                      .filter((p) => p.total > 0)
                      .slice(0, 6)
                      .map((p) => {
                        const open = p.todo + p.doing;
                        const max = Math.max(
                          1,
                          ...peopleKpis
                            .filter((x) => x.total > 0)
                            .map((x) => x.todo + x.doing)
                        );
                        const w = Math.round((open / max) * 100);
                        return (
                          <div key={p.user.id} className="team-snap-row">
                            <div className="team-snap-name">
                              {p.user.username}
                            </div>
                            <div className="team-snap-bar">
                              <div
                                className="team-snap-barfill"
                                style={{ width: `${w}%` }}
                              />
                            </div>
                            <div className="team-snap-val">{open}</div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="team-snap-card">
                  <div className="team-snap-title">Top overdue risk</div>
                  <div className="team-snap-sub">Who needs attention</div>
                  <div className="team-snap-list">
                    {peopleKpis
                      .filter((p) => p.overdue > 0)
                      .slice(0, 6)
                      .map((p) => (
                        <div key={p.user.id} className="team-snap-row">
                          <div className="team-snap-name">
                            {p.user.username}
                          </div>
                          <div className="team-snap-pill danger">
                            {p.overdue} overdue
                          </div>
                        </div>
                      ))}

                    {peopleKpis.filter((p) => p.overdue > 0).length === 0 && (
                      <div className="team-muted">No overdue tasks 🎉</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SINGLE */}
          {selectionMode === "single" && singlePerson && (
            <>
              <div className="team-cards-grid">
                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "todo" ? " is-active" : "")
                  }
                  onClick={() => toggleTaskFilter("todo")}
                >
                  <div className="team-big-label">Todo</div>
                  <div className="team-big-value">{singlePerson.todo}</div>
                </button>

                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "doing" ? " is-active" : "")
                  }
                  onClick={() => toggleTaskFilter("doing")}
                >
                  <div className="team-big-label">Doing</div>
                  <div className="team-big-value">{singlePerson.doing}</div>
                </button>

                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "done" ? " is-active" : "")
                  }
                  onClick={() => toggleTaskFilter("done")}
                >
                  <div className="team-big-label">Done</div>
                  <div className="team-big-value">{singlePerson.done}</div>
                </button>

                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "overdue" ? " is-active danger" : "")
                  }
                  onClick={() => toggleTaskFilter("overdue")}
                >
                  <div className="team-big-label">Overdue</div>
                  <div className="team-big-value">{singlePerson.overdue}</div>
                </button>
              </div>

              {taskFilter !== "all" && (
                <div className="team-filter-chip">
                  Filter: <b>{taskFilter}</b>
                  <button
                    type="button"
                    className="team-chip-x"
                    onClick={() => setTaskFilter("all")}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="team-section">
                <div className="team-section-title">Critical tasks</div>

                {criticalTasksForSelection.length === 0 ? (
                  <div className="team-muted">Nothing critical 🎉</div>
                ) : (
                  <div className="team-critical-list">
                    {criticalTasksForSelection.map((x) => (
                      <div
                        key={x.task.id}
                        className="team-critical-row"
                        onMouseEnter={(e) => schedulePreview(e, x.task)}
                        onMouseLeave={onTaskMouseLeave}
                      >
                        <div className="team-critical-main">
                          <div className="team-critical-title">
                            {x.task.title}
                          </div>

                          <div className="team-critical-sub">
                            {x.reason === "overdue" && (
                              <span className="pill danger">Overdue</span>
                            )}
                            {x.reason === "dueSoon" && (
                              <span className="pill warn">Due soon</span>
                            )}
                            {x.reason === "doing" && (
                              <span className="pill info">Doing</span>
                            )}
                            {x.task.due_date && (
                              <span className="team-critical-date">
                                due {x.task.due_date}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="team-critical-actions">
                          <button
                            type="button"
                            className="btn btn-small btn-ghost"
                            onClick={(e) => showPreviewNow(e, x.task)}
                            title="Preview"
                          >
                            i
                          </button>

                          <button
                            type="button"
                            className="btn btn-small btn-outline"
                            onClick={() => quickUnassign(x.task)}
                          >
                            Unassign
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() => setEditingTask(x.task)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="team-section">
                <div className="team-section-title">Tasks</div>

                {filteredTasksForList.length === 0 ? (
                  <div className="team-muted">No tasks in this view.</div>
                ) : (
                  <div className="team-simple-list">
                    {filteredTasksForList
                      .slice()
                      .sort((a, b) => {
                        const ao = isOverdueTask(a, today) ? 1 : 0;
                        const bo = isOverdueTask(b, today) ? 1 : 0;
                        if (ao !== bo) return bo - ao;
                        const ad =
                          parseDateOnly(a.due_date)?.getTime() ??
                          Number.POSITIVE_INFINITY;
                        const bd =
                          parseDateOnly(b.due_date)?.getTime() ??
                          Number.POSITIVE_INFINITY;
                        return ad - bd;
                      })
                      .map((t) => (
                        <div
                          key={t.id}
                          className="team-task-row"
                          onMouseEnter={(e) => schedulePreview(e, t)}
                          onMouseLeave={onTaskMouseLeave}
                        >
                          <div className="team-task-main">
                            <div className="team-task-title">{t.title}</div>

                            <div className="team-task-meta-line">
                              <span
                                className={
                                  "pill " +
                                  (t.status === "done"
                                    ? "ok"
                                    : t.status === "doing"
                                    ? "info"
                                    : "muted")
                                }
                              >
                                {t.status}
                              </span>

                              {isOverdueTask(t, today) && (
                                <span className="pill danger">overdue</span>
                              )}
                              {isDueSoonTask(t, today, 7) && (
                                <span className="pill warn">due soon</span>
                              )}

                              {t.due_date && (
                                <span className="team-task-date">
                                  due {t.due_date}
                                </span>
                              )}
                            </div>

                            {t.description?.trim() ? (
                              <div className="team-task-desc">
                                {clampText(t.description, 110)}
                              </div>
                            ) : null}
                          </div>

                          <div className="team-task-actions-mini">
                            <button
                              type="button"
                              className="btn btn-small btn-ghost"
                              onClick={(e) => showPreviewNow(e, t)}
                              title="Preview"
                            >
                              i
                            </button>

                            <button
                              type="button"
                              className="btn btn-small btn-outline"
                              onClick={() => quickUnassign(t)}
                            >
                              Unassign
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-primary"
                              onClick={() => setEditingTask(t)}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* MULTI */}
          {selectionMode === "multi" && aggregateKpis && (
            <>
              <div className="team-cards-grid">
                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "all" ? " is-active" : "")
                  }
                  onClick={() => setTaskFilter("all")}
                >
                  <div className="team-big-label">Total</div>
                  <div className="team-big-value">{aggregateKpis.total}</div>
                </button>

                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "todo" ? " is-active" : "")
                  }
                  onClick={() => toggleTaskFilter("todo")}
                >
                  <div className="team-big-label">Todo</div>
                  <div className="team-big-value">
                    {baseTasksForView.filter((t) => t.status === "todo").length}
                  </div>
                </button>

                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "doing" ? " is-active" : "")
                  }
                  onClick={() => toggleTaskFilter("doing")}
                >
                  <div className="team-big-label">Doing</div>
                  <div className="team-big-value">
                    {
                      baseTasksForView.filter((t) => t.status === "doing")
                        .length
                    }
                  </div>
                </button>

                <button
                  type="button"
                  className={
                    "team-big-card-btn" +
                    (taskFilter === "overdue" ? " is-active danger" : "")
                  }
                  onClick={() => toggleTaskFilter("overdue")}
                >
                  <div className="team-big-label">Overdue</div>
                  <div className="team-big-value">{aggregateKpis.overdue}</div>
                </button>
              </div>

              {taskFilter !== "all" && (
                <div className="team-filter-chip">
                  Filter: <b>{taskFilter}</b>
                  <button
                    type="button"
                    className="team-chip-x"
                    onClick={() => setTaskFilter("all")}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="team-section">
                <div className="team-section-title">Critical tasks</div>

                {criticalTasksForSelection.length === 0 ? (
                  <div className="team-muted">Nothing critical 🎉</div>
                ) : (
                  <div className="team-critical-list">
                    {criticalTasksForSelection.map((x) => (
                      <div
                        key={x.task.id}
                        className="team-critical-row"
                        onMouseEnter={(e) => schedulePreview(e, x.task)}
                        onMouseLeave={onTaskMouseLeave}
                      >
                        <div className="team-critical-main">
                          <div className="team-critical-title">
                            {x.task.title}
                          </div>

                          <div className="team-critical-sub">
                            <span className="pill info">
                              {x.owner?.username ?? "—"}
                            </span>
                            {x.reason === "overdue" && (
                              <span className="pill danger">Overdue</span>
                            )}
                            {x.reason === "dueSoon" && (
                              <span className="pill warn">Due soon</span>
                            )}
                            {x.reason === "doing" && (
                              <span className="pill info">Doing</span>
                            )}
                            {x.task.due_date && (
                              <span className="team-critical-date">
                                due {x.task.due_date}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="team-critical-actions">
                          <button
                            type="button"
                            className="btn btn-small btn-ghost"
                            onClick={(e) => showPreviewNow(e, x.task)}
                            title="Preview"
                          >
                            i
                          </button>

                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() => setEditingTask(x.task)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="team-section">
                <div className="team-section-title">Tasks</div>

                {filteredTasksForList.length === 0 ? (
                  <div className="team-muted">No tasks in this view.</div>
                ) : (
                  <div className="team-simple-list">
                    {filteredTasksForList.slice(0, 14).map((t) => (
                      <div
                        key={t.id}
                        className="team-task-row"
                        onMouseEnter={(e) => schedulePreview(e, t)}
                        onMouseLeave={onTaskMouseLeave}
                      >
                        <div className="team-task-main">
                          <div className="team-task-title">{t.title}</div>

                          <div className="team-task-meta-line">
                            <span
                              className={
                                "pill " +
                                (t.status === "done"
                                  ? "ok"
                                  : t.status === "doing"
                                  ? "info"
                                  : "muted")
                              }
                            >
                              {t.status}
                            </span>

                            {isOverdueTask(t, today) && (
                              <span className="pill danger">overdue</span>
                            )}
                            {isDueSoonTask(t, today, 7) && (
                              <span className="pill warn">due soon</span>
                            )}

                            {t.due_date && (
                              <span className="team-task-date">
                                due {t.due_date}
                              </span>
                            )}
                          </div>

                          {t.description?.trim() ? (
                            <div className="team-task-desc">
                              {clampText(t.description, 110)}
                            </div>
                          ) : null}
                        </div>

                        <div className="team-task-actions-mini">
                          <button
                            type="button"
                            className="btn btn-small btn-ghost"
                            onClick={(e) => showPreviewNow(e, t)}
                            title="Preview"
                          >
                            i
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() => setEditingTask(t)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* RIGHT */}
        <aside className="team-lite-right">
          <div className="card-soft">
            <div className="team-chart-title">Workload distribution</div>
            <div className="team-chart-sub">
              {taskFilter === "all"
                ? "Open = todo + doing (stacked)"
                : `Per person: ${taskFilter}`}
            </div>

            <div style={{ height: 270 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workloadChartData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={90} />
                  <Tooltip />

                  {taskFilter === "all" ? (
                    <>
                      <Bar dataKey="todo" stackId="a" fill="#93c5fd" />
                      <Bar dataKey="doing" stackId="a" fill="#fdba74" />
                    </>
                  ) : (
                    <Bar dataKey="value" fill="#60a5fa" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="team-chart-legend">
              {taskFilter === "all" ? (
                <>
                  <span>
                    <span className="dot todo" /> todo
                  </span>
                  <span>
                    <span className="dot doing" /> doing
                  </span>
                </>
              ) : (
                <span className="team-legend-pill">showing: {taskFilter}</span>
              )}
            </div>
          </div>

          <div className="card-soft">
            <div className="team-chart-title">Assigned vs Unassigned</div>

            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assignedVsUnassigned}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    <Cell fill="#60a5fa" />
                    <Cell fill="#fb923c" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="team-chart-legend">
              <span>
                Assigned: <b>{assignedVsUnassigned[0]?.value ?? 0}</b>
              </span>
              <span>
                Unassigned: <b>{assignedVsUnassigned[1]?.value ?? 0}</b>
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Hover preview (after 3s OR via i button) */}
      {hoverPreview && (
        <div
          className="team-task-preview"
          style={{ left: hoverPreview.x, top: hoverPreview.y }}
        >
          <div className="team-task-preview-title">
            {hoverPreview.task.title}
          </div>

          <div className="team-task-preview-meta">
            <span
              className={
                "pill " +
                (hoverPreview.task.status === "done"
                  ? "ok"
                  : hoverPreview.task.status === "doing"
                  ? "info"
                  : "muted")
              }
            >
              {hoverPreview.task.status}
            </span>

            {hoverPreview.task.due_date && (
              <span className="team-task-preview-date">
                due {hoverPreview.task.due_date}
              </span>
            )}
          </div>

          <div className="team-task-preview-desc">
            {hoverPreview.task.description?.trim()
              ? hoverPreview.task.description
              : "No description."}
          </div>

          {!!hoverPreview.task.assignees?.length && (
            <div className="team-task-preview-assignees">
              Assignees:{" "}
              <b>
                {hoverPreview.task.assignees?.map((a) => a.username).join(", ")}
              </b>
            </div>
          )}
        </div>
      )}

      {/* Unassigned drawer */}
      {unassignedOpen && (
        <div className="team-drawer-overlay" role="dialog" aria-modal="true">
          <div
            className="team-drawer-backdrop"
            onClick={() => setUnassignedOpen(false)}
          />
          <div className="team-drawer">
            <div className="team-drawer-head">
              <div className="team-drawer-title">
                Unassigned tasks{" "}
                <span className="team-drawer-count">
                  {unassignedTasks.length}
                </span>
              </div>
              <button
                className="team-drawer-close"
                onClick={() => setUnassignedOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="team-drawer-sub">
              Quick assign (no scrolling the whole page)
            </div>

            <div className="team-drawer-list">
              {unassignedTasks.length === 0 ? (
                <div className="team-muted">No unassigned tasks 🎉</div>
              ) : (
                unassignedTasks.slice(0, 30).map((t) => (
                  <div
                    key={t.id}
                    className="team-drawer-item"
                    onMouseEnter={(e) => schedulePreview(e, t)}
                    onMouseLeave={onTaskMouseLeave}
                  >
                    <div>
                      <div className="team-drawer-item-title">{t.title}</div>

                      <div className="team-drawer-item-meta">
                        <span
                          className={
                            "pill " +
                            (t.status === "done"
                              ? "ok"
                              : t.status === "doing"
                              ? "info"
                              : "muted")
                          }
                        >
                          {t.status}
                        </span>
                        {isOverdueTask(t, today) && (
                          <span className="pill danger">overdue</span>
                        )}
                        {isDueSoonTask(t, today, 7) && (
                          <span className="pill warn">due soon</span>
                        )}
                        {t.due_date && (
                          <span className="team-task-date">
                            due {t.due_date}
                          </span>
                        )}
                      </div>

                      {t.description?.trim() ? (
                        <div className="team-drawer-item-desc">
                          {clampText(t.description, 160)}
                        </div>
                      ) : null}
                    </div>

                    <div className="team-drawer-item-actions">
                      <div className="team-drawer-assignrow">
                        <select
                          className="team-drawer-select"
                          defaultValue=""
                          onChange={(e) =>
                            quickAssign(t, Number(e.target.value))
                          }
                        >
                          <option value="">Assign to…</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="team-drawer-actions-row">
                        <button
                          type="button"
                          className="btn btn-small btn-ghost"
                          onClick={(e) => showPreviewNow(e, t)}
                          title="Preview"
                        >
                          i
                        </button>

                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => setEditingTask(t)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="team-drawer-foot">
              <button
                className="btn btn-outline"
                onClick={() => setUnassignedOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Person details modal */}
      {selectionMode === "single" && singlePerson && (
        <PersonDetailsModal
          open={personModalOpen}
          user={singlePerson.user}
          onClose={() => setPersonModalOpen(false)}
        />
      )}

      {/* Edit modal */}
      {editingTask && (
        <EditTaskModal
          open
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={async (id, patch) => {
            const patchCache = optimisticPatchTask(id, patch);
            try {
              await updateTask({ id, patch }).unwrap();
              setEditingTask(null);
            } catch {
              patchCache.undo();
            }
          }}
        />
      )}
    </div>
  );
}
