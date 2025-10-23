// src/features/tasks/components/AddTaskModal.tsx
import {
  useForm,
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePickProjectsQuery, usePickFundingsQuery } from "../tasksApi";
import type { CreateTaskPayload } from "../types";
import "./AddTaskModal.css";

type Scope = "unassigned" | "project" | "funding";
const emptyToNull = (v?: string) => (!v || v.trim() === "" ? null : v);

/** Schemat Zod (bez deprecated; code: "custom") */
const TaskCreateSchema = z
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
    projectId: z.string().optional(), // "" lub "123"
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

type FormValues = z.infer<typeof TaskCreateSchema>;

export interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTaskPayload) => Promise<void> | void;
}

export default function AddTaskModal({
  open,
  onClose,
  onSubmit,
}: AddTaskModalProps) {
  const { data: projectOptions = [], isLoading: lp } = usePickProjectsQuery();
  const { data: fundingOptions = [], isLoading: lf } = usePickFundingsQuery();

  // Używamy generyka + rzut na Resolver<FormValues>, żeby TS znał pola i ścieżki
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setFocus,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(TaskCreateSchema) as Resolver<FormValues>,
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

  const scope = watch("scope") as Scope;

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    const payload: CreateTaskPayload = {
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
    };

    if (values.scope === "project") {
      payload.project = Number(values.projectId);
      payload.funding = null;
      payload.project_funding = null;
    } else if (values.scope === "funding") {
      payload.funding = Number(values.fundingId);
      payload.project = null;
      payload.project_funding = null;
    } else {
      payload.project = null;
      payload.funding = null;
      payload.project_funding = null;
    }

    await onSubmit(payload);
    closeAndReset();
  };

  // Fokus na pierwszym błędzie — bez `any` dzięki Path<FormValues>
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

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={closeAndReset}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add task</h2>
          <button
            className="icon-btn"
            onClick={closeAndReset}
            aria-label="Close"
          >
            x
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit(submit, onInvalid)}>
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
              {isSubmitting ? "Saving…" : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
