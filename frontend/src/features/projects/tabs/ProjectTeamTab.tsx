import { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useProject } from "../context/ProjectContext";
import {
  useListTasksQuery,
  useUpdateTaskMutation,
  useCreateTaskMutation,
  tasksApi,
} from "../../tasks/tasksApi";
import type { Task, CreateTaskPayload } from "../../tasks/types";
import type { AppUser } from "../../types/users";
import { useListUsersQuery } from "../../api/usersApi";
import EditTaskModal from "../../tasks/components/EditTaskModal";
import AddTaskModal from "../../tasks/components/AddTaskModal";
import type { AppDispatch } from "../../../app/store";

type MemberStats = {
  user: AppUser;
  total: number;
  todo: number;
  doing: number;
  done: number;
  overdue: number;
};

export default function ProjectTeamTab() {
  const project = useProject();
  const dispatch = useDispatch<AppDispatch>();

  // Wszyscy użytkownicy z systemu (nie tylko z tego projektu)
  const {
    data: allUsers = [],
    isLoading: usersLoading,
    isFetching: usersFetching,
  } = useListUsersQuery();

  // Zadania w tym projekcie
  const { data: tasksData, isFetching: tasksLoading } = useListTasksQuery({
    project: project.id,
  });

  const tasks: Task[] = useMemo(() => tasksData?.results ?? [], [tasksData]);

  const [updateTask] = useUpdateTaskMutation();
  const [createTask] = useCreateTaskMutation();

  // Wybrany user po lewej
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Modal edycji zadania
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Modal tworzenia zadania dla konkretnego usera
  const [creating, setCreating] = useState<{
    open: boolean;
    assigneeId: number | null;
  }>({ open: false, assigneeId: null });

  // Statystyki zadań per user – tylko dla zadań z TEGO projektu
  const memberStatsMap = useMemo(() => {
    const map = new Map<number, MemberStats>();
    const today = new Date().toISOString().slice(0, 10);

    for (const t of tasks) {
      if (!t.assignees || t.assignees.length === 0) continue;

      const isOverdue =
        t.due_date != null && t.status !== "done" && t.due_date < today;

      for (const u of t.assignees) {
        if (!map.has(u.id)) {
          map.set(u.id, {
            user: u,
            total: 0,
            todo: 0,
            doing: 0,
            done: 0,
            overdue: 0,
          });
        }
        const s = map.get(u.id)!;
        s.total += 1;

        if (t.status === "todo") s.todo += 1;
        else if (t.status === "doing") s.doing += 1;
        else if (t.status === "done") s.done += 1;

        if (isOverdue) s.overdue += 1;
      }
    }

    return map;
  }, [tasks]);

  // Lista członków po lewej:
  // wszyscy userzy z systemu + statystyki, jeśli mają zadania w projekcie
  const members: MemberStats[] = useMemo(() => {
    return allUsers
      .map((u) => {
        const stats = memberStatsMap.get(u.id);
        if (stats) return stats;
        return {
          user: u,
          total: 0,
          todo: 0,
          doing: 0,
          done: 0,
          overdue: 0,
        };
      })
      .sort((a, b) => a.user.username.localeCompare(b.user.username));
  }, [allUsers, memberStatsMap]);

  const effectiveSelectedId =
    selectedUserId ?? (members.length ? members[0].user.id : null);

  const selectedMember =
    members.find((m) => m.user.id === effectiveSelectedId) ?? null;

  const tasksForSelected = useMemo(() => {
    if (!effectiveSelectedId) return [];
    return tasks.filter((t) =>
      (t.assignees ?? []).some((u) => u.id === effectiveSelectedId)
    );
  }, [tasks, effectiveSelectedId]);

  const loadingAny = tasksLoading || usersLoading || usersFetching;

  return (
    <div className="team-tab card">
      <div className="team-layout">
        {/* LEWA LISTA UŻYTKOWNIKÓW */}
        <aside className="team-sidebar">
          <div className="team-sidebar-header">
            <div className="team-title">Team</div>
            <div className="team-subtitle">
              Użytkownicy dostępni w systemie
              <br />
              (statystyki dla zadań w tym projekcie)
            </div>
          </div>

          {loadingAny && <div className="muted small">Ładowanie danych…</div>}

          {!loadingAny && members.length === 0 && (
            <div className="muted small">
              Brak użytkowników. Dodaj ich najpierw w systemie.
            </div>
          )}

          <div className="team-members-list">
            {members.map((m) => (
              <button
                key={m.user.id}
                type="button"
                className={
                  "team-member-row" +
                  (m.user.id === effectiveSelectedId ? " is-active" : "")
                }
                onClick={() => setSelectedUserId(m.user.id)}
              >
                <div className="team-member-main">
                  <div className="team-avatar">
                    <span>{m.user.username.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="team-member-text">
                    <div className="team-member-name">{m.user.username}</div>
                    <div className="team-member-meta small">
                      {m.total} tasks • {m.doing} doing • {m.overdue} overdue
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* PRAWA STRONA – zadania wybranego usera */}
        <main className="team-main">
          {selectedMember ? (
            <>
              <div className="team-main-header">
                <div>
                  <div className="team-main-title">
                    {selectedMember.user.username}
                  </div>
                  <div className="team-main-subtitle small">
                    Tasks: {selectedMember.total} • Doing:{" "}
                    {selectedMember.doing} • Done: {selectedMember.done} •
                    Overdue: {selectedMember.overdue}
                  </div>
                </div>

                <div className="team-main-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() =>
                      setCreating({
                        open: true,
                        assigneeId: selectedMember.user.id,
                      })
                    }
                  >
                    + New task for this user
                  </button>
                </div>
              </div>

              <div className="team-tasks-list">
                {tasksForSelected.map((t) => (
                  <div key={t.id} className="team-task-row">
                    <div className="team-task-main">
                      <div className="team-task-title">{t.title}</div>
                      {t.description && (
                        <div className="team-task-desc small">
                          {t.description.length > 120
                            ? t.description.slice(0, 120) + "…"
                            : t.description}
                        </div>
                      )}
                    </div>
                    <div className="team-task-meta">
                      <span className={`pill pill-status st-${t.status}`}>
                        {t.status}
                      </span>
                      {t.start_date && t.due_date && (
                        <span className="team-task-dates small">
                          {t.start_date} → {t.due_date}
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn-small btn-outline"
                        onClick={() => setEditingTask(t)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}

                {tasksForSelected.length === 0 && (
                  <div className="muted small">
                    Ten użytkownik nie ma jeszcze zadań w tym projekcie.
                    <br />
                    Użyj przycisku „New task for this user”.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="muted small">
              Brak użytkowników – najpierw dodaj konta w systemie.
            </div>
          )}
        </main>
      </div>

      {/* Modal edycji zadania – tu ustawiasz assignee_ids itd. */}
      {editingTask && (
        <EditTaskModal
          open
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={async (id: number, patch: Partial<CreateTaskPayload>) => {
            const patchCache = dispatch(
              tasksApi.util.updateQueryData(
                "listTasks",
                { project: project.id },
                (draft) => {
                  const arr = draft?.results ?? [];
                  const idx = arr.findIndex((t) => t.id === id);
                  if (idx !== -1) {
                    arr[idx] = { ...arr[idx], ...patch };
                  }
                }
              )
            );

            try {
              await updateTask({ id, patch }).unwrap();
              setEditingTask(null);
            } catch {
              patchCache.undo();
            }
          }}
        />
      )}

      {/* Modal dodawania zadania dla wybranego usera */}
      {creating.open && (
        <AddTaskModal
          open
          onClose={() => setCreating({ open: false, assigneeId: null })}
          onSubmit={async (payload: CreateTaskPayload) => {
            const body: CreateTaskPayload = {
              ...payload,
              project: project.id,
              assignee_ids: creating.assigneeId ? [creating.assigneeId] : [],
            };

            try {
              const created = await createTask(body).unwrap();

              dispatch(
                tasksApi.util.updateQueryData(
                  "listTasks",
                  { project: project.id },
                  (draft) => {
                    if (!draft) return;
                    const arr = draft.results ?? [];
                    if (!arr.find((t) => t.id === created.id)) {
                      draft.results = [created, ...arr];
                    }
                  }
                )
              );

              setCreating({ open: false, assigneeId: null });
            } catch {
              // jak chcesz, możesz tu dodać toast z błędem
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
