import { useEffect } from "react";
import {
  useForm,
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePickProjectsQuery, usePickFundingsQuery } from "../tasksApi";
import type { Task, CreateTaskPayload } from "../types";
import "./EditTaskModal.css"; // osobny plik, ale identyczny jak Add (poniżej CSS)

type Scope = "unassigned" | "project" | "funding";

export interface EditTaskModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSubmit: (
    id: number,
    patch: Partial<CreateTaskPayload>
  ) => Promise<void> | void;
}

const emptyToNull = (v?: string) => (!v || v.trim() === "" ? null : v);

const TaskEditSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),

    status: z.enum(["todo", "doing", "done"]),
    priority: z.coerce.number().int().min(1).max(3),

    start_date: z.string().optional(),
    due_date: z.string().optional(),

    est_hours: z
      .string()
      .optional()
      .refine(
        (v) =>
          v === undefined ||
          v === "" ||
          (!Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0),
        "Estimated hours must be ≥ 0"
      ),
    cost_amount: z
      .string()
      .optional()
      .refine(
        (v) =>
          v === undefined ||
          v === "" ||
          (!Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0),
        "Cost amount must be ≥ 0"
      ),
    cost_currency: z.string().optional().default("PLN"),

    receipt_url: z
      .string()
      .optional()
      .refine(
        (v) => !v || v.trim() === "" || /^https?:\/\/.+/i.test(v),
        "Invalid URL format"
      ),
    receipt_note: z.string().optional(),

    scope: z.enum(["unassigned", "project", "funding"]),
    projectId: z.string().optional(),
    fundingId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.due_date && data.start_date > data.due_date) {
      ctx.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "End date cannot be before start date",
      });
    }
    if (
      data.scope === "project" &&
      (!data.projectId || data.projectId === "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["projectId"],
        message: "Select project",
      });
    }
    if (
      data.scope === "funding" &&
      (!data.fundingId || data.fundingId === "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fundingId"],
        message: "Select funding",
      });
    }
  });

type FormValues = z.infer<typeof TaskEditSchema>;

export default function EditTaskModal({
  open,
  task,
  onClose,
  onSubmit,
}: EditTaskModalProps) {
  const { data: projectOptions = [], isLoading: lp } = usePickProjectsQuery();
  const { data: fundingOptions = [], isLoading: lf } = usePickFundingsQuery();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setFocus,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(TaskEditSchema) as Resolver<FormValues>,
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: 2,
      start_date: "",
      due_date: "",
      est_hours: "",
      cost_amount: "",
      cost_currency: "PLN",
      receipt_url: "",
      receipt_note: "",
      scope: "unassigned",
      projectId: "",
      fundingId: "",
    },
  });

  useEffect(() => {
    if (!task) return;
    const scope: Scope = task.scope_project
      ? "project"
      : task.scope_funding
      ? "funding"
      : "unassigned";

    reset({
      title: task.title ?? "",
      description: task.description ?? "",
      status: task.status as FormValues["status"],
      priority: (task.priority as number) ?? 2,
      start_date: task.start_date ?? "",
      due_date: task.due_date ?? "",
      est_hours: task.est_hours ?? "",
      cost_amount: task.cost_amount ?? "",
      cost_currency: task.cost_currency ?? "PLN",
      receipt_url: task.receipt_url ?? "",
      receipt_note: task.receipt_note ?? "",
      scope,
      projectId: task.scope_project ? String(task.scope_project) : "",
      fundingId: task.scope_funding ? String(task.scope_funding) : "",
    });
  }, [task, reset, open]);

  const scope = watch("scope") as Scope;

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    if (!task) return;

    const patch: Partial<CreateTaskPayload> = {
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      status: values.status,
      priority: values.priority as 1 | 2 | 3,
      start_date: emptyToNull(values.start_date),
      due_date: emptyToNull(values.due_date),
      est_hours: values.est_hours ? values.est_hours : null,
      cost_amount: values.cost_amount ? values.cost_amount : null,
      cost_currency: values.cost_currency || undefined,
      receipt_url: values.receipt_url?.trim() || undefined,
      receipt_note: values.receipt_note?.trim() || undefined,
      project: null,
      funding: null,
      project_funding: null,
    };

    if (values.scope === "project") {
      patch.project = Number(values.projectId);
    } else if (values.scope === "funding") {
      patch.funding = Number(values.fundingId);
    }

    await onSubmit(task.id, patch);
    closeAndReset();
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const order: Path<FormValues>[] = [
      "title",
      "start_date",
      "due_date",
      "est_hours",
      "cost_amount",
      "receipt_url",
      "projectId",
      "fundingId",
      "status",
      "priority",
    ];
    const first = order.find((k) => errs[k]);
    if (first) setFocus(first);
  };

  if (!open || !task) return null;

  return (
    <div className="modal-overlay" onClick={closeAndReset}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <form className="modal-form" onSubmit={handleSubmit(submit, onInvalid)}>
          <div className="modal-header">
            <h2 className="modal-title">Edit task</h2>
            <button
              className="icon-btn"
              onClick={closeAndReset}
              type="button"
              aria-label="Close"
            >
              x
            </button>
          </div>

          <div className="modal-body">
            {/* Title */}
            <div>
              <label className="form-label">Title</label>
              <input
                className={`form-input ${errors.title ? "input-invalid" : ""}`}
                aria-invalid={!!errors.title}
                {...register("title")}
                placeholder="Task title"
              />
              {errors.title && (
                <p className="error-text">{String(errors.title.message)}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                {...register("description")}
                placeholder="Optional"
              />
            </div>

            {/* Status / Priority */}
            <div className="form-grid">
              <div>
                <label className="form-label">Status</label>
                <select
                  className={`form-select ${
                    errors.status ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.status}
                  {...register("status")}
                >
                  <option value="todo">To do</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </select>
                {errors.status && (
                  <p className="error-text">{String(errors.status.message)}</p>
                )}
              </div>

              <div>
                <label className="form-label">Priority</label>
                <select
                  className={`form-select ${
                    errors.priority ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.priority}
                  {...register("priority")}
                >
                  <option value={1}>Low</option>
                  <option value={2}>Medium</option>
                  <option value={3}>High</option>
                </select>
                {errors.priority && (
                  <p className="error-text">
                    {String(errors.priority.message)}
                  </p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="form-grid">
              <div>
                <label className="form-label">Start date</label>
                <input
                  type="date"
                  className={`form-input ${
                    errors.start_date ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.start_date}
                  {...register("start_date")}
                />
              </div>
              <div>
                <label className="form-label">Due date</label>
                <input
                  type="date"
                  className={`form-input ${
                    errors.due_date ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.due_date}
                  {...register("due_date")}
                />
                {errors.due_date && (
                  <p className="error-text">
                    {String(errors.due_date.message)}
                  </p>
                )}
              </div>
            </div>

            {/* Estimates / Cost */}
            <div className="form-grid">
              <div>
                <label className="form-label">Est. hours</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className={`form-input ${
                    errors.est_hours ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.est_hours}
                  {...register("est_hours")}
                />
                {errors.est_hours && (
                  <p className="error-text">
                    {String(errors.est_hours.message)}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">Cost amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`form-input ${
                    errors.cost_amount ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.cost_amount}
                  {...register("cost_amount")}
                />
                {errors.cost_amount && (
                  <p className="error-text">
                    {String(errors.cost_amount.message)}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label">Currency</label>
                <select className="form-select" {...register("cost_currency")}>
                  <option value="PLN">PLN</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            {/* Receipt */}
            <div>
              <label className="form-label">Receipt URL</label>
              <input
                type="url"
                className={`form-input ${
                  errors.receipt_url ? "input-invalid" : ""
                }`}
                aria-invalid={!!errors.receipt_url}
                {...register("receipt_url")}
              />
              {errors.receipt_url && (
                <p className="error-text">
                  {String(errors.receipt_url.message)}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Receipt note</label>
              <textarea
                className="form-textarea"
                rows={2}
                {...register("receipt_note")}
              />
            </div>

            {/* Scope */}
            <div>
              <label className="form-label">Assign to</label>
              <div className="scope-group">
                <label className="scope-item">
                  <input
                    type="radio"
                    value="unassigned"
                    {...register("scope")}
                  />
                  <span>Unassigned</span>
                </label>
                <label className="scope-item">
                  <input type="radio" value="project" {...register("scope")} />
                  <span>Project</span>
                </label>
                <label className="scope-item">
                  <input type="radio" value="funding" {...register("scope")} />
                  <span>Funding</span>
                </label>
              </div>
            </div>

            {scope === "project" && (
              <div>
                <label className="form-label">Project</label>
                <select
                  className={`form-select ${
                    errors.projectId ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.projectId}
                  disabled={lp}
                  {...register("projectId")}
                  defaultValue=""
                >
                  <option value="">Select project…</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.projectId && (
                  <p className="error-text">
                    {String(errors.projectId.message)}
                  </p>
                )}
              </div>
            )}

            {scope === "funding" && (
              <div>
                <label className="form-label">Funding</label>
                <select
                  className={`form-select ${
                    errors.fundingId ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.fundingId}
                  disabled={lf}
                  {...register("fundingId")}
                  defaultValue=""
                >
                  <option value="">Select funding…</option>
                  {fundingOptions.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {errors.fundingId && (
                  <p className="error-text">
                    {String(errors.fundingId.message)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeAndReset}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!isValid || isSubmitting}
              title={!isValid ? "Fix validation errors first" : ""}
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
