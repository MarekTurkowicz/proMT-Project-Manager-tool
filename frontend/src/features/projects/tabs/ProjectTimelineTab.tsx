import { useEffect, useMemo, useRef, useState } from "react";
import { Timeline } from "vis-timeline/standalone";
import { DataSet } from "vis-data";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../../app/store";
import { useProject } from "../context/ProjectContext";
import {
  useListTasksQuery,
  useUpdateTaskMutation,
  useCreateTaskMutation,
  tasksApi,
} from "../../tasks/tasksApi";
import type { Task, CreateTaskPayload } from "../../tasks/types";
import EditTaskModal from "../../tasks/components/EditTaskModal";
import AddTaskModal from "../../tasks/components/AddTaskModal";

import type {
  DataItem,
  TimelineOptions,
  DateType,
  IdType,
  TimelineItem,
  TimelineItemType,
} from "vis-timeline";

import "vis-timeline/styles/vis-timeline-graph2d.css";
import "./ProjectTimelineTab.css";

/* ===== Typy ===== */

type FixedVisItem = TimelineItem & {
  id: IdType;
  type?: TimelineItemType;
  start?: DateType;
  end?: DateType;
};

type TaskStatus = Task["status"];

type TimelineSelectEvent = {
  items: IdType[];
};

type TimelinePointerEvent = {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
};

type TimelineClickEvent = {
  item?: IdType | null;
  event?: TimelinePointerEvent;
};

type TimelineClickWithTime = {
  item?: IdType | null;
  event?: TimelinePointerEvent;
  time?: DateType;
  what?: "background" | "item" | "axis" | string;
};

type ItemOverEvent = {
  item?: IdType | null;
  event?: TimelinePointerEvent;
};

type PriorityLabel = "Low" | "Medium" | "High";

/* ===== Utils ===== */

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function itemHtml(t: Task) {
  const title = escapeHtml(t.title ?? "");
  let desc =
    t.description && t.description.trim()
      ? escapeHtml(t.description.trim())
      : "";
  if (desc.length > 50) desc = desc.slice(0, 50) + "…";
  const label = desc ? `${title} — ${desc}` : title;
  return `<div class="tl-item"><div class="tl-label">${label}</div></div>`;
}

function statusClass(status: TaskStatus) {
  if (!status) return "";
  return `st-${status}`;
}

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function endOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(23, 59, 59, 999);
  return n;
}

function toDate(dt: DateType | undefined): Date {
  if (dt instanceof Date) return dt;
  if (typeof dt === "number") return new Date(dt);
  if (typeof dt === "string") return new Date(dt);
  return new Date();
}

function toDateOrNull(dt: DateType | undefined): Date | null {
  if (!dt) return null;
  if (dt instanceof Date) return dt;
  if (typeof dt === "number") return new Date(dt);
  if (typeof dt === "string") return new Date(dt);
  return null;
}

/** Parsowanie 'YYYY-MM-DD' bez niespodzianek strefowych */
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Mapowanie liczbowego priorytetu na label UI */
function getPriorityLabel(p?: number | null): PriorityLabel {
  if (p === 3) return "High";
  if (p === 2) return "Medium";
  return "Low";
}

/** Klasa CSS z liczbowego priorytetu */
function priorityClassFromNumber(p?: number | null): string {
  const label = getPriorityLabel(p);
  return `prio-${label.toLowerCase()}`;
}

/* ===== Komponent ===== */

export default function ProjectTimelineTab() {
  const project = useProject();
  const dispatch = useDispatch<AppDispatch>();

  // 👇 ZMIANA: bez ordering, żeby API zwracało WSZYSTKIE taski z projektu (w tym bez dat)
  const queryArg = useMemo(() => ({ project: project.id }), [project.id]);

  const { data, isFetching } = useListTasksQuery(queryArg);
  const tasks: Task[] = useMemo(() => data?.results ?? [], [data]);

  const [updateTask] = useUpdateTaskMutation();
  const [createTask] = useCreateTaskMutation();

  // aktualna lista zadań w ref (do double click / hover)
  const tasksRef = useRef<Task[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const itemsDSRef = useRef(new DataSet<DataItem>());
  const groupsDSRef = useRef(new DataSet<{ id: IdType; content: string }>());
  const dragRectRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState<IdType | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const [creating, setCreating] = useState<{
    open: boolean;
    startISO?: string;
    endISO?: string;
  }>({ open: false });

  const [snapToDay, setSnapToDay] = useState(true);
  const snapRef = useRef(snapToDay);
  useEffect(() => {
    snapRef.current = snapToDay;
  }, [snapToDay]);

  const [sideOpen, setSideOpen] = useState(false);

  // today flash
  const [todayFlash, setTodayFlash] = useState(false);

  // filtr po nazwie
  const [filterText, setFilterText] = useState("");
  const normalizedFilter = useMemo(
    () => filterText.trim().toLowerCase(),
    [filterText]
  );

  // filtry status / priorytet
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLabel | "all">(
    "all"
  );

  // tryb dodawania taska klikami na osi
  const [addingOnTimeline, setAddingOnTimeline] = useState(false);
  const addingOnTimelineRef = useRef(addingOnTimeline);
  useEffect(() => {
    addingOnTimelineRef.current = addingOnTimeline;
  }, [addingOnTimeline]);
  const addStartRef = useRef<Date | null>(null);

  // id świeżo utworzonego taska (zielony highlight)
  const [newTaskId, setNewTaskId] = useState<number | null>(null);

  // hover-card state
  const [hoverTask, setHoverTask] = useState<Task | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const hoverLockedRef = useRef(false);
  const hoverHideTimeoutRef = useRef<number | null>(null);

  // unikalne statusy (do przycisków filtrów)
  const statusOptions = useMemo(() => {
    const set = new Set<TaskStatus>();
    tasks.forEach((t) => {
      if (t.status) set.add(t.status);
    });
    return Array.from(set);
  }, [tasks]);

  // priorytety – pełna lista labeli
  const priorityOptions: PriorityLabel[] = useMemo(
    () => ["Low", "Medium", "High"],
    []
  );

  // podział na scheduled / unscheduled (ma obie daty czy nie)
  const { scheduled, unscheduled } = useMemo(() => {
    const sched: Task[] = [];
    const uns: Task[] = [];
    for (const t of tasks) {
      if (t.start_date && t.due_date) sched.push(t);
      else uns.push(t);
    }
    return { scheduled: sched, unscheduled: uns };
  }, [tasks]);

  // filtrujemy po tytule + status + priorytet
  const { filteredScheduled, filteredUnscheduled } = useMemo(() => {
    const match = (t: Task) => {
      const nameMatch = (t.title ?? "")
        .toLowerCase()
        .includes(normalizedFilter);
      const statusMatch = statusFilter === "all" || t.status === statusFilter;

      const prioLabel = getPriorityLabel(t.priority);
      const prioMatch =
        priorityFilter === "all" || prioLabel === priorityFilter;

      return nameMatch && statusMatch && prioMatch;
    };

    return {
      filteredScheduled: scheduled.filter(match),
      filteredUnscheduled: unscheduled.filter(match),
    };
  }, [scheduled, unscheduled, normalizedFilter, statusFilter, priorityFilter]);

  /* ===== Items i Groups – na osi pokazujemy TYLKO scheduled ===== */

  const taskItems: DataItem[] = useMemo(() => {
    return filteredScheduled.map((t) => {
      const start = parseDateOnly(t.start_date!);
      const rawEnd = parseDateOnly(t.due_date!);
      const sameDay = start.toDateString() === rawEnd.toDateString();
      const end = sameDay ? endOfDay(start) : rawEnd;

      const prioLabel = getPriorityLabel(t.priority);
      const isNew = typeof newTaskId === "number" && t.id === newTaskId;

      return {
        id: t.id,
        group: t.id,
        start,
        end,
        type: "range",
        content: itemHtml(t),
        className: [
          "tl-vis-item",
          priorityClassFromNumber(t.priority),
          statusClass(t.status),
          selectedId === t.id ? "is-selected" : "",
          isNew ? "is-new" : "",
          `prio-label-${prioLabel.toLowerCase()}`,
        ]
          .filter(Boolean)
          .join(" "),
      };
    });
  }, [filteredScheduled, selectedId, newTaskId]);

  const groups = useMemo(
    () =>
      filteredScheduled.map((t) => ({
        id: t.id as IdType,
        content: t.title || `Task #${t.id}`,
      })),
    [filteredScheduled]
  );

  const projectRangeItem: DataItem | null = useMemo(() => {
    if (!project.start_date || !project.end_date) return null;
    return {
      id: "project-range",
      type: "background",
      start: parseDateOnly(project.start_date),
      end: parseDateOnly(project.end_date),
      className: "tl-bg-project",
      content: "",
    };
  }, [project.start_date, project.end_date]);

  const tasksRangeItem: DataItem | null = useMemo(() => {
    if (!scheduled.length) return null;
    const starts = scheduled.map((t) => parseDateOnly(t.start_date!));
    const ends = scheduled.map((t) => parseDateOnly(t.due_date!));
    const minStart = new Date(Math.min(...starts.map((d) => d.getTime())));
    const maxEnd = new Date(Math.max(...ends.map((d) => d.getTime())));
    return {
      id: "tasks-range",
      type: "background",
      start: startOfDay(minStart),
      end: endOfDay(maxEnd),
      className: "tl-bg-tasks",
      content: "",
    };
  }, [scheduled]);

  const allItems: DataItem[] = useMemo(() => {
    const list = [...taskItems];
    if (projectRangeItem) list.push(projectRangeItem);
    if (tasksRangeItem) list.push(tasksRangeItem);
    return list;
  }, [taskItems, projectRangeItem, tasksRangeItem]);

  /* ===== Tooltip (do zakresu) ===== */

  const tooltipRef = useRef<HTMLDivElement | null>(null);

  function showRangeTooltip(start: Date, end: Date) {
    const el = tooltipRef.current;
    if (!el) return;
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    el.textContent = `${fmt(start)} → ${fmt(end)}`;
    el.style.whiteSpace = "nowrap";
    el.style.opacity = "1";
  }

  function hideTooltip() {
    const el = tooltipRef.current;
    if (el) el.style.opacity = "0";
  }

  /* ===== Timeline Init ===== */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const itemsDS = itemsDSRef.current;
    const groupsDS = groupsDSRef.current;

    if (!timelineRef.current) {
      const options: TimelineOptions = {
        orientation: "top",
        stack: true,
        height: "100%",
        horizontalScroll: true,
        zoomKey: "ctrlKey",
        selectable: true,
        multiselect: false,
        groupHeightMode: "auto",
        margin: { item: 6, axis: 12 },
        editable: {
          add: false,
          updateTime: true,
          updateGroup: false,
          remove: false,
        },
        timeAxis: { scale: "day", step: 1 },
        zoomMin: 1000 * 60 * 60 * 24,
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 3,

        onMove: (
          rawItem: TimelineItem,
          cb: (item: TimelineItem | null) => void
        ) => {
          const item = rawItem as FixedVisItem;
          if (typeof item.id !== "number") return cb(null);

          const useSnap = snapRef.current;
          const start = useSnap
            ? startOfDay(toDate(item.start))
            : toDate(item.start);
          const end = useSnap ? endOfDay(toDate(item.end)) : toDate(item.end);
          showRangeTooltip(start, end);

          const id = item.id;
          const patch: Partial<CreateTaskPayload> = {
            start_date: start.toISOString().slice(0, 10),
            due_date: end.toISOString().slice(0, 10),
          };

          const patchCache = dispatch(
            tasksApi.util.updateQueryData("listTasks", queryArg, (draft) => {
              const arr = draft?.results ?? [];
              const i = arr.findIndex((t) => t.id === id);
              if (i !== -1) arr[i] = { ...arr[i], ...patch };
            })
          );

          updateTask({ id, patch })
            .unwrap()
            .then(() => cb({ ...item, start, end, type: "range" }))
            .catch(() => {
              patchCache.undo();
              cb(null);
            });
        },

        onUpdate: (
          rawItem: TimelineItem,
          cb: (item: TimelineItem | null) => void
        ) => {
          const item = rawItem as FixedVisItem;
          if (typeof item.id !== "number") return cb(null);

          const useSnap = snapRef.current;
          const start = useSnap
            ? startOfDay(toDate(item.start))
            : toDate(item.start);
          const end = useSnap ? endOfDay(toDate(item.end)) : toDate(item.end);
          showRangeTooltip(start, end);

          const id = item.id;
          const patch: Partial<CreateTaskPayload> = {
            start_date: start.toISOString().slice(0, 10),
            due_date: end.toISOString().slice(0, 10),
          };

          const patchCache = dispatch(
            tasksApi.util.updateQueryData("listTasks", queryArg, (draft) => {
              const arr = draft?.results ?? [];
              const i = arr.findIndex((t) => t.id === id);
              if (i !== -1) arr[i] = { ...arr[i], ...patch };
            })
          );

          updateTask({ id, patch })
            .unwrap()
            .then(() => cb({ ...item, start, end, type: "range" }))
            .catch(() => {
              patchCache.undo();
              cb(null);
            });
        },
      };

      const tl = new Timeline(container, itemsDS, groupsDS, options);
      timelineRef.current = tl;

      // prostokąt pod nowy zakres dla trybu Add task on timeline
      const rect = document.createElement("div");
      rect.className = "drag-rect";
      container.appendChild(rect);
      dragRectRef.current = rect;
      let pendingRectStartX: number | null = null;

      // Zaznaczanie tasków
      tl.on("select", (props: TimelineSelectEvent) => {
        setSelectedId(props.items[0] ?? null);
      });

      // Double click -> EditTaskModal
      tl.on("doubleClick", (props: TimelineClickEvent) => {
        const id = props.item;
        if (typeof id !== "number") return;
        const task = tasksRef.current.find((t) => t.id === id);
        if (task) setEditing(task);
      });

      // Hover -> hover-card z danymi taska
      tl.on("itemover", (props: ItemOverEvent) => {
        const { item, event } = props;
        if (typeof item !== "number") return;
        const task = tasksRef.current.find((t) => t.id === item);
        if (!task) return;

        const clientX = event?.clientX ?? event?.pageX ?? 0;
        const clientY = event?.clientY ?? event?.pageY ?? 0;

        if (hoverHideTimeoutRef.current !== null) {
          window.clearTimeout(hoverHideTimeoutRef.current);
          hoverHideTimeoutRef.current = null;
        }

        setHoverPos({ x: clientX, y: clientY });
        setHoverTask(task);
      });

      tl.on("itemout", () => {
        if (hoverLockedRef.current) {
          return;
        }
        if (hoverHideTimeoutRef.current !== null) {
          window.clearTimeout(hoverHideTimeoutRef.current);
        }
        hoverHideTimeoutRef.current = window.setTimeout(() => {
          if (!hoverLockedRef.current) {
            setHoverTask(null);
            setHoverPos(null);
          }
        }, 100);
      });

      // Ukrycie tooltipa po puszczeniu myszki
      tl.on("mouseUp", () => {
        hideTooltip();
      });

      // ===== Tryb dodawania taska klikami na osi =====

      tl.on("mouseMove", (props: TimelineClickWithTime) => {
        if (!addingOnTimelineRef.current) return;
        if (!addStartRef.current) return;

        const rectEl = dragRectRef.current;
        if (!rectEl) return;

        const { event, time } = props;
        const containerRect = container.getBoundingClientRect();
        const clientX = event?.clientX ?? event?.pageX;
        if (clientX == null) return;

        const currentX = clientX - containerRect.left;

        if (pendingRectStartX === null) {
          return;
        }

        const leftPx = Math.min(pendingRectStartX, currentX);
        const widthPx = Math.abs(currentX - pendingRectStartX);

        rectEl.style.display = "block";
        rectEl.style.left = `${leftPx}px`;
        rectEl.style.width = `${widthPx}px`;

        const endDateRaw = toDateOrNull(time);
        if (endDateRaw) {
          const startRef = addStartRef.current;
          if (!startRef) return;
          const start =
            startRef.getTime() <= endDateRaw.getTime() ? startRef : endDateRaw;
          const end =
            startRef.getTime() <= endDateRaw.getTime() ? endDateRaw : startRef;

          const useSnap = snapRef.current;
          const s = useSnap ? startOfDay(start) : start;
          const e = useSnap ? endOfDay(end) : end;

          showRangeTooltip(s, e);
        }
      });

      tl.on("click", (props: TimelineClickWithTime) => {
        if (!addingOnTimelineRef.current) return;

        const { time, what, event } = props;

        const rectEl = dragRectRef.current;

        // klik w istniejący item w trybie dodawania = anuluj zaznaczenie
        if (what === "item") {
          addStartRef.current = null;
          pendingRectStartX = null;
          if (rectEl) {
            rectEl.style.display = "none";
          }
          hideTooltip();
          return;
        }

        const clickDateRaw = toDateOrNull(time);
        if (!clickDateRaw) return;

        const useSnap = snapRef.current;
        const normalized = useSnap ? startOfDay(clickDateRaw) : clickDateRaw;

        const containerRect = container.getBoundingClientRect();
        const clientX = event?.clientX ?? event?.pageX;
        const clickX = clientX != null ? clientX - containerRect.left : null;

        // pierwszy klik → ustawiamy start
        if (!addStartRef.current) {
          addStartRef.current = normalized;
          pendingRectStartX = clickX ?? null;

          if (rectEl && clickX != null) {
            rectEl.style.display = "block";
            rectEl.style.left = `${clickX}px`;
            rectEl.style.width = "0px";
            rectEl.style.top = "0";
            rectEl.style.bottom = "0";
          }

          showRangeTooltip(normalized, normalized);
          return;
        }

        // drugi klik → mamy start + end
        const first = addStartRef.current;
        const startTime =
          first.getTime() <= normalized.getTime() ? first : normalized;
        const endRaw =
          first.getTime() <= normalized.getTime() ? normalized : first;

        const endTime = useSnap ? endOfDay(endRaw) : endRaw;

        addStartRef.current = null;
        pendingRectStartX = null;
        hideTooltip();
        if (rectEl) {
          rectEl.style.display = "none";
        }

        const startISO = startTime.toISOString().slice(0, 10);
        const endISO = endTime.toISOString().slice(0, 10);

        setAddingOnTimeline(false); // wychodzimy z trybu
        setCreating({
          open: true,
          startISO,
          endISO,
        });
      });
    }

    // ===== Aktualizacja datasetów =====
    itemsDS.clear();
    itemsDS.add(allItems);

    groupsDS.clear();
    groupsDS.add(groups);

    // ===== Fit widoku =====
    const tl = timelineRef.current!;
    const hasTasks = taskItems.length > 0;
    if (project.start_date && project.end_date) {
      const s = parseDateOnly(project.start_date);
      const e = parseDateOnly(project.end_date);
      const padMs = (e.getTime() - s.getTime()) * 0.05;
      tl.setWindow(
        new Date(s.getTime() - padMs),
        new Date(e.getTime() + padMs),
        {
          animation: false,
        }
      );
    } else if (hasTasks) {
      tl.fit({ animation: false });
    } else {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      tl.setWindow(start, end, { animation: false });
    }
  }, [
    allItems,
    groups,
    taskItems.length,
    project.start_date,
    project.end_date,
    dispatch,
    queryArg,
    updateTask,
  ]);

  /* ===== Akcje pomocnicze ===== */

  function zoom(factor: number) {
    const tl = timelineRef.current;
    if (!tl) return;
    const range = tl.getWindow();
    const interval = range.end.getTime() - range.start.getTime();
    const delta = interval * factor;
    tl.setWindow(
      new Date(range.start.getTime() - delta),
      new Date(range.end.getTime() + delta),
      { animation: false }
    );
  }

  function today() {
    const tl = timelineRef.current;
    if (!tl) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    tl.setWindow(start, end, { animation: false });

    setTodayFlash(true);
    window.setTimeout(() => setTodayFlash(false), 1200);
  }

  function fitProject() {
    const tl = timelineRef.current;
    if (!tl) return;
    if (project.start_date && project.end_date) {
      const s = parseDateOnly(project.start_date);
      const e = parseDateOnly(project.end_date);
      const padMs = (e.getTime() - s.getTime()) * 0.05;
      tl.setWindow(
        new Date(s.getTime() - padMs),
        new Date(e.getTime() + padMs),
        { animation: false }
      );
    } else {
      tl.fit({ animation: false });
    }
  }

  function cancelAddingMode() {
    setAddingOnTimeline(false);
    addStartRef.current = null;
    const rectEl = dragRectRef.current;
    if (rectEl) {
      rectEl.style.display = "none";
    }
    hideTooltip();
  }

  /* ===== Render ===== */

  return (
    <div className="timeline-tab card">
      <div className="tls-toolbar">
        <div className="tls-toolbar-left">
          <div className="btn-group">
            <button
              className="btn btn-icon"
              onClick={() => zoom(-0.2)}
              title="Zoom in (+)"
            >
              ⊕ <span>Zoom in</span>
            </button>
            <button
              className="btn btn-icon"
              onClick={() => zoom(0.2)}
              title="Zoom out (−)"
            >
              ⊖ <span>Zoom out</span>
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => timelineRef.current?.fit({ animation: false })}
              title="Fit"
            >
              ⇱ Fit
            </button>
            <button className="btn btn-ghost" onClick={today} title="Today (T)">
              📅 Today
            </button>
            <button className="btn btn-ghost" onClick={fitProject}>
              📌 Fit project
            </button>
          </div>

          <label className="snap-toggle">
            <input
              type="checkbox"
              checked={snapToDay}
              onChange={(e) => setSnapToDay(e.target.checked)}
            />
            <span>Snap to day</span>
          </label>

          <div className="tls-filter">
            <span className="tls-filter-icon">🔍</span>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by task name…"
            />
          </div>

          {/* Filtry status / priorytet */}
          <div className="tls-filter-group">
            <span className="tls-filter-label">Status</span>
            <div className="tls-chips">
              <button
                type="button"
                className={
                  "tls-chip" + (statusFilter === "all" ? " is-active" : "")
                }
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              {statusOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={
                    "tls-chip" + (statusFilter === s ? " is-active" : "")
                  }
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="tls-filter-group">
            <span className="tls-filter-label">Priority</span>
            <div className="tls-chips">
              <button
                type="button"
                className={
                  "tls-chip" + (priorityFilter === "all" ? " is-active" : "")
                }
                onClick={() => setPriorityFilter("all")}
              >
                All
              </button>
              {priorityOptions.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={
                    "tls-chip" + (priorityFilter === p ? " is-active" : "")
                  }
                  onClick={() => setPriorityFilter(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ŚRODEK – przycisk Add na osi */}
        <div className="tls-toolbar-center">
          <button
            type="button"
            className={
              "btn btn-add-timeline" + (addingOnTimeline ? " is-active" : "")
            }
            onClick={() => {
              if (addingOnTimeline) {
                cancelAddingMode();
              } else {
                setAddingOnTimeline(true);
              }
            }}
            title={
              addingOnTimeline
                ? "Click start and end date on the timeline to create a task (click to cancel)"
                : "Add task on timeline (then click start and end date)"
            }
          >
            ➕ Add task on timeline
          </button>

          {addingOnTimeline && (
            <span className="badge badge-primary small">
              Click start and end on timeline…
            </span>
          )}
        </div>

        <div className="tls-toolbar-right">
          {!addingOnTimeline && (
            <span className="muted small">
              {isFetching ? "Ładowanie zadań…" : "Gotowe"}
            </span>
          )}
          <span className="divider" />
          <span className="badge badge-light">
            Tasks: {tasks.length} • Scheduled: {scheduled.length} • Unscheduled:{" "}
            {unscheduled.length}
          </span>
        </div>
      </div>

      <div className="tls-content">
        <div
          className={"tls-main-wrapper" + (todayFlash ? " is-today-flash" : "")}
        >
          <div className="tls-main" ref={containerRef} />
          <div ref={tooltipRef} className="tl-tooltip" />

          {/* Hover card */}
          {hoverTask && hoverPos && (
            <div
              className="hover-card"
              style={{
                left: `${hoverPos.x}px`,
                top: `${hoverPos.y}px`,
              }}
              onMouseEnter={() => {
                hoverLockedRef.current = true;
                if (hoverHideTimeoutRef.current !== null) {
                  window.clearTimeout(hoverHideTimeoutRef.current);
                  hoverHideTimeoutRef.current = null;
                }
              }}
              onMouseLeave={() => {
                hoverLockedRef.current = false;
                setHoverTask(null);
                setHoverPos(null);
              }}
            >
              <strong>{hoverTask.title}</strong>
              {hoverTask.description && (
                <p>
                  {hoverTask.description.length > 200
                    ? hoverTask.description.slice(0, 200) + "…"
                    : hoverTask.description}
                </p>
              )}

              <div className="hover-meta">
                <span
                  className={
                    "hover-pill hover-prio " +
                    priorityClassFromNumber(hoverTask.priority)
                  }
                >
                  {getPriorityLabel(hoverTask.priority)}
                </span>
                {hoverTask.status && (
                  <span className="hover-pill hover-status">
                    {hoverTask.status}
                  </span>
                )}
              </div>

              {hoverTask.start_date && hoverTask.due_date && (
                <div className="hover-dates">
                  {hoverTask.start_date} → {hoverTask.due_date}
                </div>
              )}

              <button
                type="button"
                className="hover-btn"
                onClick={() => {
                  setEditing(hoverTask);
                  setHoverTask(null);
                  setHoverPos(null);
                }}
              >
                Edit task
              </button>
            </div>
          )}

          {!sideOpen && unscheduled.length > 0 && (
            <button
              className="tls-side-toggle"
              onClick={() => setSideOpen(true)}
            >
              Unscheduled ({unscheduled.length})
            </button>
          )}
        </div>

        {sideOpen && (
          <aside className="tls-side">
            <div className="tls-side-header">
              <div>
                <div className="tls-side-title">Unscheduled tasks</div>
                <div className="tls-side-subtitle">
                  Zadania bez zakresu dat w projekcie
                </div>
              </div>
              <div className="tls-side-header-right">
                <span className="count-pill">{unscheduled.length}</span>
                <button
                  className="btn btn-icon btn-ghost small"
                  onClick={() => setSideOpen(false)}
                  title="Zwiń panel"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="tls-list">
              {filteredUnscheduled.map((t) => {
                const prioLabel = getPriorityLabel(t.priority);
                return (
                  <div key={t.id} className="tls-uns-item">
                    <div className="tls-uns-main">
                      <div className="tls-title" title={t.title}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="tls-description">
                          {t.description.length > 50
                            ? t.description.slice(0, 50) + "…"
                            : t.description}
                        </div>
                      )}
                    </div>
                    <div className="tls-uns-footer">
                      <div className="tls-meta">
                        <span
                          className={`pill pill-prio ${priorityClassFromNumber(
                            t.priority
                          )}`}
                        >
                          {prioLabel}
                        </span>
                        <span className={`pill pill-status st-${t.status}`}>
                          {t.status}
                        </span>
                      </div>
                      <button
                        className="btn btn-small btn-outline"
                        onClick={() => setEditing(t)}
                      >
                        Set dates
                      </button>
                    </div>
                  </div>
                );
              })}
              {!filteredUnscheduled.length && (
                <div className="muted small tls-empty">
                  Brak zadań bez dat pasujących do filtra
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {editing && (
        <EditTaskModal
          open
          task={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (id: number, patch: Partial<CreateTaskPayload>) => {
            const patchCache = dispatch(
              tasksApi.util.updateQueryData("listTasks", queryArg, (draft) => {
                const arr = draft?.results ?? [];
                const idx = arr.findIndex((t) => t.id === id);
                if (idx !== -1) {
                  arr[idx] = { ...arr[idx], ...patch };
                }
              })
            );
            try {
              await updateTask({ id, patch }).unwrap();
              setEditing(null);
            } catch {
              patchCache.undo();
            }
          }}
        />
      )}

      {creating.open && (
        <AddTaskModal
          open
          onClose={() => setCreating({ open: false })}
          onSubmit={async (payload: CreateTaskPayload) => {
            const body: CreateTaskPayload = {
              ...payload,
              project: project.id,
              start_date: payload.start_date ?? creating.startISO,
              due_date: payload.due_date ?? creating.endISO,
            };
            try {
              const created = await createTask(body).unwrap();

              // dopisujemy nowy task do cache listTasks dla tego projektu
              dispatch(
                tasksApi.util.updateQueryData(
                  "listTasks",
                  queryArg,
                  (draft) => {
                    if (!draft) return;
                    const arr = draft.results ?? [];
                    if (!arr.find((t) => t.id === created.id)) {
                      draft.results = [created, ...arr];
                    }
                  }
                )
              );

              setCreating({ open: false });

              // zielony highlight przez 20 sekund
              if (created && typeof created.id === "number") {
                setNewTaskId(created.id);
                window.setTimeout(() => {
                  setNewTaskId((current) =>
                    current === created.id ? null : current
                  );
                }, 20000);
              }
            } catch {
              // bez toastów
            }
          }}
          defaultScope="project"
          defaultProjectId={project.id}
          lockScope
        />
      )}
    </div>
  );
}
