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
  group?: IdType;
};

type TaskStatus = Task["status"];
type TimelineSelectEvent = { items: IdType[] };

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

/* ===== Konfiguracja grup ===== */

const SHOW_UNASSIGNED_ROW = true;
const UNASSIGNED_ID: IdType = "unassigned";

/* ===== Utils ===== */

function escapeHtml(s: string) {
  const str = s ?? "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function getPriorityLabel(p?: number | null): PriorityLabel {
  if (p === 3) return "High";
  if (p === 2) return "Medium";
  return "Low";
}

function priorityClassFromNumber(p?: number | null): string {
  const label = getPriorityLabel(p);
  return `prio-${label.toLowerCase()}`;
}

/* ===== PL Labels ===== */

const STATUS_LABEL_PL: Record<string, string> = {
  todo: "Do zrobienia",
  in_progress: "W trakcie",
  done: "Zrobione",
};

function statusLabelPl(status?: TaskStatus | null) {
  if (!status) return "";
  return STATUS_LABEL_PL[String(status)] ?? String(status);
}

const PRIORITY_LABEL_PL: Record<PriorityLabel, string> = {
  Low: "Niski",
  Medium: "Średni",
  High: "Wysoki",
};

function priorityLabelPl(p: PriorityLabel) {
  return PRIORITY_LABEL_PL[p] ?? p;
}

function makeItemId(taskId: number, groupId: IdType) {
  return `${taskId}:${String(groupId)}`;
}

function taskIdFromItemId(id: IdType | null | undefined): number | null {
  if (id == null) return null;
  if (typeof id === "number") return id;
  const left = String(id).split(":")[0];
  const n = Number(left);
  return Number.isFinite(n) ? n : null;
}

/* ===== Render item ===== */

function itemHtml(t: Task) {
  const title = escapeHtml(t.title ?? "");
  let desc =
    t.description && t.description.trim()
      ? escapeHtml(t.description.trim())
      : "";
  if (desc.length > 70) desc = desc.slice(0, 70) + "…";

  return `
    <div class="tl-item">
      <div class="tl-label">${desc ? `${title} — ${desc}` : title}</div>
    </div>
  `;
}

/* ===== Komponent ===== */

export default function ProjectTimelineTab() {
  const project = useProject();
  const dispatch = useDispatch<AppDispatch>();

  const queryArg = useMemo(() => ({ project: project.id }), [project.id]);

  const { data, isFetching } = useListTasksQuery(queryArg);
  const tasks: Task[] = useMemo(() => data?.results ?? [], [data]);

  const [updateTask] = useUpdateTaskMutation();
  const [createTask] = useCreateTaskMutation();

  const tasksRef = useRef<Task[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const itemsDSRef = useRef(new DataSet<DataItem>());
  const groupsDSRef = useRef(
    new DataSet<{ id: IdType; content: string; order?: number }>()
  );
  const dragRectRef = useRef<HTMLDivElement | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
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
  const [todayFlash, setTodayFlash] = useState(false);

  const [filterText, setFilterText] = useState("");
  const normalizedFilter = useMemo(
    () => filterText.trim().toLowerCase(),
    [filterText]
  );

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLabel | "all">(
    "all"
  );

  const [addingOnTimeline, setAddingOnTimeline] = useState(false);
  const addingOnTimelineRef = useRef(addingOnTimeline);
  useEffect(() => {
    addingOnTimelineRef.current = addingOnTimeline;
  }, [addingOnTimeline]);

  const addStartRef = useRef<Date | null>(null);

  const [newTaskId, setNewTaskId] = useState<number | null>(null);

  const [hoverTask, setHoverTask] = useState<Task | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const hoverLockedRef = useRef(false);
  const hoverHideTimeoutRef = useRef<number | null>(null);

  const statusOptions = useMemo(() => {
    const set = new Set<TaskStatus>();
    tasks.forEach((t) => {
      if (t.status) set.add(t.status);
    });
    return Array.from(set);
  }, [tasks]);

  const priorityOptions: PriorityLabel[] = useMemo(
    () => ["Low", "Medium", "High"],
    []
  );

  const { scheduled, unscheduled } = useMemo(() => {
    const sched: Task[] = [];
    const uns: Task[] = [];
    for (const t of tasks) {
      if (t.start_date && t.due_date) sched.push(t);
      else uns.push(t);
    }
    return { scheduled: sched, unscheduled: uns };
  }, [tasks]);

  // Lista osób z assignees (z tasków)
  const allAssigneesOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    for (const t of tasks) {
      for (const a of t.assignees ?? []) {
        if (typeof a.id !== "number") continue;
        if (!map.has(a.id)) {
          const name = a.username ?? "Użytkownik";
          map.set(a.id, { id: a.id, name });
        }
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return arr;
  }, [tasks]);

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

  // ===== GROUPS: osoby po lewej =====
  const groups = useMemo(() => {
    const base = allAssigneesOptions.map((p, idx) => ({
      id: p.id as IdType,
      order: idx,
      content: `
        <div class="tl-group-person" title="${escapeHtml(p.name)}">
          <span class="tl-person-name">${escapeHtml(p.name)}</span>
        </div>
      `,
    }));

    if (SHOW_UNASSIGNED_ROW) {
      base.push({
        id: UNASSIGNED_ID,
        order: 999999,
        content: `
          <div class="tl-group-person" title="Nieprzypisane">
            <span class="tl-person-name">Nieprzypisane</span>
          </div>
        `,
      });
    }

    return base;
  }, [allAssigneesOptions]);

  // ===== ITEMS: task w wierszu osoby =====
  const taskItems: DataItem[] = useMemo(() => {
    const items: DataItem[] = [];

    for (const t of filteredScheduled) {
      const start = parseDateOnly(t.start_date!);
      const rawEnd = parseDateOnly(t.due_date!);
      const sameDay = start.toDateString() === rawEnd.toDateString();
      const end = sameDay ? endOfDay(start) : rawEnd;

      const prioLabel = getPriorityLabel(t.priority);
      const isNew = typeof newTaskId === "number" && t.id === newTaskId;
      const isSelected =
        typeof selectedTaskId === "number" && t.id === selectedTaskId;

      const assignees = t.assignees ?? [];

      if (assignees.length) {
        for (const a of assignees) {
          const groupId: IdType =
            typeof a.id === "number" ? a.id : UNASSIGNED_ID;

          items.push({
            id: makeItemId(t.id, groupId),
            group: groupId,
            start,
            end,
            type: "range",
            content: itemHtml(t),
            className: [
              "tl-vis-item",
              "tl-rounded",
              priorityClassFromNumber(t.priority),
              statusClass(t.status),
              isSelected ? "is-selected" : "",
              isNew ? "is-new" : "",
              `prio-label-${prioLabel.toLowerCase()}`,
            ]
              .filter(Boolean)
              .join(" "),
          });
        }
      } else if (SHOW_UNASSIGNED_ROW) {
        items.push({
          id: makeItemId(t.id, UNASSIGNED_ID),
          group: UNASSIGNED_ID,
          start,
          end,
          type: "range",
          content: itemHtml(t),
          className: [
            "tl-vis-item",
            "tl-rounded",
            priorityClassFromNumber(t.priority),
            statusClass(t.status),
            isSelected ? "is-selected" : "",
            isNew ? "is-new" : "",
            `prio-label-${prioLabel.toLowerCase()}`,
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
    }

    return items;
  }, [filteredScheduled, selectedTaskId, newTaskId]);

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

  const tooltipRef = useRef<HTMLDivElement | null>(null);

  function showRangeTooltip(start: Date, end: Date) {
    const el = tooltipRef.current;
    if (!el) return;
    const fmt = (d: Date) =>
      d.toLocaleDateString("pl-PL", {
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

  function syncRowHeights() {
    const host = containerRef.current;
    if (!host) return;

    const tlRoot = host.querySelector(".vis-timeline") as HTMLElement | null;
    if (!tlRoot) return;

    const groupEls = Array.from(
      tlRoot.querySelectorAll(".vis-itemset .vis-group[data-groupid]")
    ) as HTMLElement[];

    const labelEls = Array.from(
      tlRoot.querySelectorAll(".vis-labelset .vis-label[data-groupid]")
    ) as HTMLElement[];

    const hById = new Map<string, number>();
    for (const g of groupEls) {
      const gid = g.getAttribute("data-groupid");
      if (!gid) continue;
      const h = Math.round(g.getBoundingClientRect().height);
      if (h > 0) hById.set(gid, h);
    }

    for (const l of labelEls) {
      const gid = l.getAttribute("data-groupid");
      if (!gid) continue;

      const h = hById.get(gid);
      if (h && h > 0) {
        l.style.height = `${h}px`;
        l.style.minHeight = `${h}px`;
      } else {
        l.style.height = "";
        l.style.minHeight = "";
      }
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;

      if (sideOpen) setSideOpen(false);

      if (addingOnTimeline) {
        setAddingOnTimeline(false);
        addStartRef.current = null;
        const rectEl = dragRectRef.current;
        if (rectEl) rectEl.style.display = "none";
        hideTooltip();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sideOpen, addingOnTimeline]);

  const isModalOpen = Boolean(editing) || creating.open;
  useEffect(() => {
    if (!isModalOpen) return;
    const el = document.activeElement as HTMLElement | null;
    el?.blur?.();
    setHoverTask(null);
    setHoverPos(null);
    hoverLockedRef.current = false;
  }, [isModalOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const itemsDS = itemsDSRef.current;
    const groupsDS = groupsDSRef.current;

    if (!timelineRef.current) {
      const options: TimelineOptions = {
        orientation: "top",

        stack: true,
        groupHeightMode: "fitItems",

        height: "100%",
        horizontalScroll: true,
        zoomKey: "ctrlKey",
        selectable: true,
        multiselect: false,
        margin: { item: 10, axis: 12 },
        editable: {
          add: false,
          updateTime: true,
          updateGroup: false,
          remove: false,
        },
        timeAxis: { scale: "day", step: 1 },
        zoomMin: 1000 * 60 * 60 * 24,
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 3,

        onMove: (rawItem: TimelineItem, cb) => {
          const item = rawItem as FixedVisItem;
          const tid = taskIdFromItemId(item.id);
          if (typeof tid !== "number") return cb(null);

          const useSnap = snapRef.current;
          const start = useSnap
            ? startOfDay(toDate(item.start))
            : toDate(item.start);
          const end = useSnap ? endOfDay(toDate(item.end)) : toDate(item.end);

          showRangeTooltip(start, end);

          const patch: Partial<CreateTaskPayload> = {
            start_date: start.toISOString().slice(0, 10),
            due_date: end.toISOString().slice(0, 10),
          };

          const patchCache = dispatch(
            tasksApi.util.updateQueryData("listTasks", queryArg, (draft) => {
              const arr = draft?.results ?? [];
              const i = arr.findIndex((t) => t.id === tid);
              if (i !== -1) arr[i] = { ...arr[i], ...patch };
            })
          );

          updateTask({ id: tid, patch })
            .unwrap()
            .then(() => cb({ ...item, start, end, type: "range" }))
            .catch(() => {
              patchCache.undo();
              cb(null);
            });
        },

        onUpdate: (rawItem: TimelineItem, cb) => {
          const item = rawItem as FixedVisItem;
          const tid = taskIdFromItemId(item.id);
          if (typeof tid !== "number") return cb(null);

          const useSnap = snapRef.current;
          const start = useSnap
            ? startOfDay(toDate(item.start))
            : toDate(item.start);
          const end = useSnap ? endOfDay(toDate(item.end)) : toDate(item.end);

          showRangeTooltip(start, end);

          const patch: Partial<CreateTaskPayload> = {
            start_date: start.toISOString().slice(0, 10),
            due_date: end.toISOString().slice(0, 10),
          };

          const patchCache = dispatch(
            tasksApi.util.updateQueryData("listTasks", queryArg, (draft) => {
              const arr = draft?.results ?? [];
              const i = arr.findIndex((t) => t.id === tid);
              if (i !== -1) arr[i] = { ...arr[i], ...patch };
            })
          );

          updateTask({ id: tid, patch })
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

      const rect = document.createElement("div");
      rect.className = "drag-rect";
      container.appendChild(rect);
      dragRectRef.current = rect;

      let pendingRectStartX: number | null = null;

      tl.on("select", (props: TimelineSelectEvent) => {
        const tid = taskIdFromItemId(props.items[0] ?? null);
        setSelectedTaskId(tid);
      });

      tl.on("doubleClick", (props: TimelineClickEvent) => {
        const tid = taskIdFromItemId(props.item ?? null);
        if (typeof tid !== "number") return;
        const task = tasksRef.current.find((t) => t.id === tid);
        if (task) setEditing(task);
      });

      tl.on("itemover", (props: ItemOverEvent) => {
        const tid = taskIdFromItemId(props.item ?? null);
        if (typeof tid !== "number") return;
        const task = tasksRef.current.find((t) => t.id === tid);
        if (!task) return;

        const e = props.event;
        const clientX = e?.clientX ?? e?.pageX ?? 0;
        const clientY = e?.clientY ?? e?.pageY ?? 0;

        if (hoverHideTimeoutRef.current !== null) {
          window.clearTimeout(hoverHideTimeoutRef.current);
          hoverHideTimeoutRef.current = null;
        }

        setHoverPos({ x: clientX, y: clientY });
        setHoverTask(task);
      });

      tl.on("itemout", () => {
        if (hoverLockedRef.current) return;

        if (hoverHideTimeoutRef.current !== null) {
          window.clearTimeout(hoverHideTimeoutRef.current);
        }
        hoverHideTimeoutRef.current = window.setTimeout(() => {
          if (!hoverLockedRef.current) {
            setHoverTask(null);
            setHoverPos(null);
          }
        }, 120);
      });

      tl.on("mouseUp", () => hideTooltip());

      tl.on("changed", () => {
        requestAnimationFrame(() => requestAnimationFrame(syncRowHeights));
      });

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
        if (pendingRectStartX === null) return;

        const leftPx = Math.min(pendingRectStartX, currentX);
        const widthPx = Math.abs(currentX - pendingRectStartX);

        rectEl.style.display = "block";
        rectEl.style.left = `${leftPx}px`;
        rectEl.style.width = `${widthPx}px`;

        const endDateRaw = toDateOrNull(time);
        if (endDateRaw) {
          const startRef = addStartRef.current;
          const start =
            startRef.getTime() <= endDateRaw.getTime() ? startRef : endDateRaw;
          const end =
            startRef.getTime() <= endDateRaw.getTime() ? endDateRaw : startRef;

          const useSnap = snapRef.current;
          const s = useSnap ? startOfDay(start) : start;
          const e2 = useSnap ? endOfDay(end) : end;

          showRangeTooltip(s, e2);
        }
      });

      tl.on("click", (props: TimelineClickWithTime) => {
        if (!addingOnTimelineRef.current) return;

        const { time, what, event } = props;
        const rectEl = dragRectRef.current;

        if (what === "item") {
          addStartRef.current = null;
          pendingRectStartX = null;
          if (rectEl) rectEl.style.display = "none";
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

        const first = addStartRef.current;
        const startTime =
          first.getTime() <= normalized.getTime() ? first : normalized;
        const endRaw =
          first.getTime() <= normalized.getTime() ? normalized : first;
        const endTime = useSnap ? endOfDay(endRaw) : endRaw;

        addStartRef.current = null;
        pendingRectStartX = null;
        hideTooltip();
        if (rectEl) rectEl.style.display = "none";

        setAddingOnTimeline(false);
        setCreating({
          open: true,
          startISO: startTime.toISOString().slice(0, 10),
          endISO: endTime.toISOString().slice(0, 10),
        });
      });
    }

    // datasety
    itemsDS.clear();
    itemsDS.add(allItems);

    groupsDS.clear();
    groupsDS.add(groups);

    const tl = timelineRef.current!;
    const hasTasks = taskItems.length > 0;

    tl.redraw();
    requestAnimationFrame(() => requestAnimationFrame(syncRowHeights));

    if (project.start_date && project.end_date) {
      const s = parseDateOnly(project.start_date);
      const e = parseDateOnly(project.end_date);
      const padMs = (e.getTime() - s.getTime()) * 0.05;
      tl.setWindow(
        new Date(s.getTime() - padMs),
        new Date(e.getTime() + padMs),
        { animation: false }
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
    window.setTimeout(() => setTodayFlash(false), 900);
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
    if (rectEl) rectEl.style.display = "none";
    hideTooltip();
  }

  return (
    <div
      className={"timeline-tab card" + (isModalOpen ? " is-modal-open" : "")}
    >
      <div className="tls-topbar">
        <div className="tls-topbar-left">
          <div className="tls-btn-group">
            <button
              className="tls-btn tls-btn-zoom"
              onClick={() => zoom(-0.2)}
              title="Powiększ"
              type="button"
            >
              <span className="tls-ico">＋</span>
              <span className="tls-btn-txt">Powiększ</span>
            </button>

            <button
              className="tls-btn tls-btn-zoom"
              onClick={() => zoom(0.2)}
              title="Pomniejsz"
              type="button"
            >
              <span className="tls-ico">－</span>
              <span className="tls-btn-txt">Pomniejsz</span>
            </button>

            <button
              className="tls-btn tls-btn-ghost"
              onClick={() => timelineRef.current?.fit({ animation: false })}
              title="Dopasuj do zadań"
              type="button"
            >
              Dopasuj
            </button>

            <button
              className="tls-btn tls-btn-ghost"
              onClick={today}
              title="Przejdź do dziś"
              type="button"
            >
              Dziś
            </button>

            <button
              className="tls-btn tls-btn-ghost"
              onClick={fitProject}
              title="Dopasuj do zakresu projektu"
              type="button"
            >
              Dopasuj projekt
            </button>
          </div>

          <label
            className="snap-toggle"
            title="Przyciągaj zakresy do całych dni"
          >
            <input
              type="checkbox"
              checked={snapToDay}
              onChange={(e) => setSnapToDay(e.target.checked)}
            />
            <span>Przyciągaj</span>
          </label>

          <div className="tls-search">
            <span className="tls-filter-icon">🔍</span>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Szukaj zadań…"
            />
          </div>

          <div className="tls-selects">
            <div className="tls-select-wrap">
              <span className="tls-select-label">Status</span>
              <select
                className="tls-select"
                value={statusFilter ?? "all"}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setStatusFilter(v === "all" ? "all" : (v as TaskStatus));
                }}
              >
                <option value="all">Wszystkie</option>
                {statusOptions.map((s) => (
                  <option key={String(s)} value={String(s)}>
                    {statusLabelPl(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="tls-select-wrap">
              <span className="tls-select-label">Priorytet</span>
              <select
                className="tls-select"
                value={priorityFilter}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setPriorityFilter(v === "all" ? "all" : (v as PriorityLabel));
                }}
              >
                <option value="all">Wszystkie</option>
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabelPl(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="tls-topbar-center">
          <button
            type="button"
            className={
              "tls-btn tls-btn-add-timeline" +
              (addingOnTimeline ? " is-active" : "")
            }
            onClick={() => {
              if (addingOnTimeline) cancelAddingMode();
              else setAddingOnTimeline(true);
            }}
          >
            ➕ Dodaj na osi
          </button>

          {addingOnTimeline && (
            <span className="tls-hint">
              Kliknij początek i koniec na osi czasu…
            </span>
          )}
        </div>

        <div className="tls-topbar-right">
          <span className="tls-muted tls-small">
            {isFetching ? "Ładowanie…" : "Gotowe"}
          </span>
          <span className="tls-divider" />
          <span className="tls-badge tls-badge-light">
            Zadania: {tasks.length} • Zaplanowane: {scheduled.length} • Bez dat:{" "}
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

          {hoverTask && hoverPos && (
            <div
              className="hover-card"
              style={{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }}
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
                  {hoverTask.description.length > 240
                    ? hoverTask.description.slice(0, 240) + "…"
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
                  {priorityLabelPl(getPriorityLabel(hoverTask.priority))}
                </span>

                {hoverTask.status && (
                  <span className="hover-pill hover-status">
                    {statusLabelPl(hoverTask.status)}
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
                className="tls-hover-btn"
                onClick={() => {
                  setEditing(hoverTask);
                  setHoverTask(null);
                  setHoverPos(null);
                }}
              >
                Edytuj zadanie
              </button>
            </div>
          )}

          {!sideOpen && unscheduled.length > 0 && (
            <button
              className="tls-side-toggle"
              onClick={() => setSideOpen(true)}
              type="button"
            >
              Bez dat ({filteredUnscheduled.length})
            </button>
          )}

          {sideOpen && (
            <div className="tls-backdrop" onClick={() => setSideOpen(false)} />
          )}

          <aside className={"tls-side-drawer" + (sideOpen ? " is-open" : "")}>
            <div className="tls-side-header">
              <div>
                <div className="tls-side-title">Zadania bez dat</div>
                <div className="tls-side-subtitle">Zadania bez zakresu dat</div>
              </div>
              <div className="tls-side-header-right">
                <span className="count-pill">{filteredUnscheduled.length}</span>
                <button
                  className="tls-btn tls-btn-ghost tls-btn-small"
                  onClick={() => setSideOpen(false)}
                  title="Zwiń panel"
                  type="button"
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
                          {t.description.length > 70
                            ? t.description.slice(0, 70) + "…"
                            : t.description}
                        </div>
                      )}
                    </div>

                    <div className="tls-uns-footer">
                      <div className="tls-meta">
                        <span
                          className={`tls-pill tls-pill-prio ${priorityClassFromNumber(
                            t.priority
                          )}`}
                        >
                          {priorityLabelPl(prioLabel)}
                        </span>

                        {t.status && (
                          <span
                            className={`tls-pill tls-pill-status st-${t.status}`}
                          >
                            {statusLabelPl(t.status)}
                          </span>
                        )}
                      </div>

                      <button
                        className="tls-btn tls-btn-outline tls-btn-small"
                        onClick={() => setEditing(t)}
                        type="button"
                      >
                        Ustaw daty
                      </button>
                    </div>
                  </div>
                );
              })}

              {!filteredUnscheduled.length && (
                <div className="tls-muted tls-small tls-empty">
                  Brak zadań bez dat pasujących do filtra
                </div>
              )}
            </div>
          </aside>
        </div>
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
                if (idx !== -1) arr[idx] = { ...arr[idx], ...patch };
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
