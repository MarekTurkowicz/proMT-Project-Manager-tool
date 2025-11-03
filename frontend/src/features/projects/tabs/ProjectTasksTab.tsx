import { useState } from "react";
import { useProject } from "../context/ProjectContext";
import { useListTasksQuery, useCreateTaskMutation } from "../../tasks/tasksApi";
import type { Task } from "../../tasks/types";
import AddTaskModal from "../../tasks/components/AddTaskModal";
import toast from "react-hot-toast";

export default function ProjectTasksTab() {
  const project = useProject();
  const { data, isLoading } = useListTasksQuery({
    project: project.id,
    ordering: "-created_at",
  });
  const tasks: Task[] = data?.results ?? [];

  const [openAdd, setOpenAdd] = useState(false);
  const [createTask] = useCreateTaskMutation();

  return (
    <>
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>Tasks</strong> ({tasks.length})
        </div>
        <button className="btn" onClick={() => setOpenAdd(true)}>
          Add task
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {isLoading && <div className="card centered muted">Loading…</div>}
        {!isLoading && tasks.length === 0 && (
          <div className="card centered muted">No tasks.</div>
        )}
        {tasks.map((t) => (
          <div key={t.id} className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                {t.description && (
                  <div style={{ color: "#64748b" }}>{t.description}</div>
                )}
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  Status: {t.status} • Priority: {t.priority}{" "}
                  {t.due_date ? `• Due: ${t.due_date}` : ""}
                </div>
              </div>
              <a className="btn" href={`/dashboard/tasks?focus=${t.id}`}>
                Open
              </a>
            </div>
          </div>
        ))}
      </div>

      <AddTaskModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={async (payload) => {
          try {
            await createTask(payload).unwrap();
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
