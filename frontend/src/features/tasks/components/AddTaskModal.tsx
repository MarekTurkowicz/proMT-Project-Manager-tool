import { useState, useMemo, type FormEvent, useEffect } from "react";
import {
  useCreateTaskMutation,
  usePickProjectsQuery,
  usePickFundingsQuery,
} from "../tasksApi";
import type { CreateTaskPayload } from "../types";
import "./AddTaskModal.css";

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type Scope = "project" | "funding" | "unassigned";

export default function AddTaskModal({
  open,
  onClose,
  onCreated,
}: AddTaskModalProps) {
  const [scope, setScope] = useState<Scope>("unassigned");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "doing" | "done">("todo");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [dueDate, setDueDate] = useState<string>("");

  const [projectId, setProjectId] = useState<number | "">("");
  const [fundingId, setFundingId] = useState<number | "">("");

  const { data: projectOptions = [], isLoading: lp } = usePickProjectsQuery();
  const { data: fundingOptions = [], isLoading: lf } = usePickFundingsQuery();
  const [createTask, { isLoading }] = useCreateTaskMutation();

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (scope === "project" && projectId === "") return false;
    if (scope === "funding" && fundingId === "") return false;
    return true;
  }, [title, scope, projectId, fundingId]);

  // Reset formularza po zamknięciu
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority(2);
      setDueDate("");
      setProjectId("");
      setFundingId("");
      setScope("unassigned");
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const payload: CreateTaskPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      due_date: dueDate ? dueDate : null,
    };

    if (scope === "project") payload.project = Number(projectId);
    if (scope === "funding") payload.funding = Number(fundingId);

    try {
      await createTask(payload).unwrap();
      onCreated?.();
      onClose();
    } catch (err) {
      console.error("Create task failed:", err);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-window">
        <h2 className="modal-title">Add new task</h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Title</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="form-grid">
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="todo">To do</option>
                <option value="doing">Doing</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) =>
                  setPriority(Number(e.target.value) as 1 | 2 | 3)
                }
              >
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>
            </div>

            <div>
              <label className="form-label">Due date</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="form-label">Assign to</label>
            <div className="scope-group">
              <label className="scope-item">
                <input
                  type="radio"
                  name="scope"
                  value="unassigned"
                  checked={scope === "unassigned"}
                  onChange={() => setScope("unassigned")}
                />
                <span>Unassigned</span>
              </label>
              <label className="scope-item">
                <input
                  type="radio"
                  name="scope"
                  value="project"
                  checked={scope === "project"}
                  onChange={() => setScope("project")}
                />
                <span>Project</span>
              </label>
              <label className="scope-item">
                <input
                  type="radio"
                  name="scope"
                  value="funding"
                  checked={scope === "funding"}
                  onChange={() => setScope("funding")}
                />
                <span>Funding</span>
              </label>
            </div>
          </div>

          {scope === "project" && (
            <div>
              <label className="form-label">Project</label>
              <select
                className="form-select"
                disabled={lp}
                value={projectId}
                onChange={(e) =>
                  setProjectId(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              >
                <option value="">Select project…</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "funding" && (
            <div>
              <label className="form-label">Funding</label>
              <select
                className="form-select"
                disabled={lf}
                value={fundingId}
                onChange={(e) =>
                  setFundingId(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              >
                <option value="">Select funding…</option>
                {fundingOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!canSubmit || isLoading}
              type="submit"
            >
              {isLoading ? "Saving…" : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
