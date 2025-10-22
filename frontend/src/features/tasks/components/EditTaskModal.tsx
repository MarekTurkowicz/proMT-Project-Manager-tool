import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePickProjectsQuery, usePickFundingsQuery } from "../tasksApi";
import type { Task, CreateTaskPayload } from "../types";
import "./EditTaskModal.css";

type Scope = "unassigned" | "project" | "funding";

interface Props {
  open: boolean;
  onClose: () => void;
  task: Task;
  onSubmit: (patch: Partial<CreateTaskPayload>) => Promise<void> | void;
}

export default function EditTaskModal({
  open,
  onClose,
  task,
  onSubmit,
}: Props) {
  // --- bezpieczne defaulty; prefill w useEffect ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "doing" | "done">("todo");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);

  const [startDate, setStartDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  const [estHours, setEstHours] = useState<string>("");
  const [costAmount, setCostAmount] = useState<string>("");
  const [costCurrency, setCostCurrency] = useState<string>("PLN");
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [receiptNote, setReceiptNote] = useState<string>("");

  const [scope, setScope] = useState<Scope>("unassigned");
  const [projectId, setProjectId] = useState<number | "">("");
  const [fundingId, setFundingId] = useState<number | "">("");

  const { data: projectOptions = [], isLoading: lp } = usePickProjectsQuery();
  const { data: fundingOptions = [], isLoading: lf } = usePickFundingsQuery();

  useEffect(() => {
    if (!open) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setStatus((task.status as "todo" | "doing" | "done") ?? "todo");
    setPriority((task.priority as 1 | 2 | 3) ?? 2);

    setStartDate(task.start_date ?? "");
    setDueDate(task.due_date ?? "");
    setEstHours(task.est_hours ?? "");
    setCostAmount(task.cost_amount ?? "");
    setCostCurrency(task.cost_currency ?? "PLN");
    setReceiptUrl(task.receipt_url ?? "");
    setReceiptNote(task.receipt_note ?? "");

    const sc: Scope = task.scope_project
      ? "project"
      : task.scope_funding
      ? "funding"
      : "unassigned";
    setScope(sc);
    setProjectId(task.scope_project ?? "");
    setFundingId(task.scope_funding ?? "");
  }, [open, task]);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (scope === "project" && projectId === "") return false;
    if (scope === "funding" && fundingId === "") return false;
    return true;
  }, [title, scope, projectId, fundingId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const patch: Partial<CreateTaskPayload> = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      est_hours: estHours === "" ? null : estHours,
      cost_amount: costAmount === "" ? null : costAmount,
      cost_currency: costCurrency || undefined,
      receipt_url: receiptUrl.trim() || undefined,
      receipt_note: receiptNote.trim() || undefined,
    };

    if (scope === "unassigned") {
      patch.project = null;
      patch.funding = null;
      patch.project_funding = null;
    }
    if (scope === "project") {
      patch.project = Number(projectId);
      patch.funding = null;
      patch.project_funding = null;
    }
    if (scope === "funding") {
      patch.funding = Number(fundingId);
      patch.project = null;
      patch.project_funding = null;
    }

    await onSubmit(patch);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Edit task</h2>

        <form className="modal-form" onSubmit={handleSubmit}>
          {/* Tytuł / opis */}
          <div>
            <label className="form-label">Title</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Status / Priorytet */}
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
          </div>

          {/* Daty */}
          <div className="form-grid">
            <div>
              <label className="form-label">Start date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
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

          {/* Czas / Koszt */}
          <div className="form-grid">
            <div>
              <label className="form-label">Est. hours</label>
              <input
                type="number"
                step="0.25"
                min="0"
                className="form-input"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                placeholder="np. 1.5"
              />
            </div>
            <div>
              <label className="form-label">Cost amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                placeholder="np. 199.99"
              />
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select
                className="form-select"
                value={costCurrency}
                onChange={(e) => setCostCurrency(e.target.value)}
              >
                <option value="PLN">PLN</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Faktura */}
          <div>
            <label className="form-label">Receipt URL</label>
            <input
              type="url"
              className="form-input"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="form-label">Receipt note</label>
            <textarea
              className="form-textarea"
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Przypisanie */}
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
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
