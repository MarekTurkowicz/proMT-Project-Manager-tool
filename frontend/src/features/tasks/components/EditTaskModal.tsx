import { useEffect, useMemo, useState } from "react";
import {
  useForm,
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { usePickProjectsQuery, usePickFundingsQuery } from "../tasksApi";
import { useListUsersQuery } from "../../api/usersApi";

import type { Task, CreateTaskPayload } from "../types";
import type { AppUser } from "../../types/users";

import "./EditTaskModal.css";

type Scope = "unassigned" | "project" | "funding";
const emptyToNull = (v?: string) => (!v || v.trim() === "" ? null : v);

export interface EditTaskModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSubmit: (
    id: number,
    patch: Partial<CreateTaskPayload>
  ) => Promise<void> | void;
}

const TaskEditSchema = z
  .object({
    title: z.string().trim().min(3, "Tytuł musi mieć min. 3 znaki"),
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
        "Szacowany czas musi być ≥ 0"
      ),
    cost_amount: z
      .string()
      .optional()
      .refine(
        (v) =>
          v === undefined ||
          v === "" ||
          (!Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0),
        "Koszt musi być ≥ 0"
      ),
    cost_currency: z.string().optional().default("PLN"),

    receipt_url: z
      .string()
      .optional()
      .refine(
        (v) => !v || v.trim() === "" || /^https?:\/\/.+/i.test(v),
        "Niepoprawny adres URL"
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
        message: "Data końcowa nie może być wcześniejsza niż start",
      });
    }
    if (
      data.scope === "project" &&
      (!data.projectId || data.projectId === "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["projectId"],
        message: "Wybierz projekt",
      });
    }
    if (
      data.scope === "funding" &&
      (!data.fundingId || data.fundingId === "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fundingId"],
        message: "Wybierz finansowanie",
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
  const { data: users = [], isLoading: usersLoading } = useListUsersQuery();

  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);

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

  // Accordions
  const [flowOpen, setFlowOpen] = useState(true);
  const [costOpen, setCostOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFlowOpen(true);
    setCostOpen(false);
    setReceiptOpen(false);
    setAssignOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !task) return;

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
      est_hours: (task.est_hours as string) ?? "",
      cost_amount: (task.cost_amount as string) ?? "",
      cost_currency: task.cost_currency ?? "PLN",
      receipt_url: task.receipt_url ?? "",
      receipt_note: task.receipt_note ?? "",
      scope,
      projectId: task.scope_project ? String(task.scope_project) : "",
      fundingId: task.scope_funding ? String(task.scope_funding) : "",
    });

    setAssigneeIds(task.assignees ? task.assignees.map((u) => u.id) : []);
  }, [task, reset, open]);

  const scope = watch("scope") as Scope;

  const receiptFilled = useMemo(() => {
    const url = watch("receipt_url");
    const note = watch("receipt_note");
    return !!(url?.trim() || note?.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch("receipt_url"), watch("receipt_note")]);

  const assigneesFilled = useMemo(() => assigneeIds.length > 0, [assigneeIds]);

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
      assignee_ids: assigneeIds,
    };

    if (values.scope === "project") patch.project = Number(values.projectId);
    else if (values.scope === "funding")
      patch.funding = Number(values.fundingId);

    await onSubmit(task.id, patch);
    closeAndReset();
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const order: Path<FormValues>[] = [
      "title",
      "status",
      "priority",
      "start_date",
      "due_date",
      "est_hours",
      "cost_amount",
      "cost_currency",
      "receipt_url",
      "projectId",
      "fundingId",
    ];
    const first = order.find((k) => errs[k]);
    if (first) setFocus(first);
  };

  if (!open || !task) return null;

  return (
    <div className="modal-overlay" onClick={closeAndReset}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-head-left">
            <h2 className="modal-title">Edytuj zadanie</h2>
            <div className="modal-subtitle">Zmień dane i zapisz</div>
          </div>

          <button
            className="icon-btn"
            onClick={closeAndReset}
            type="button"
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit(submit, onInvalid)}>
          <div className="modal-body">
            {/* OGÓLNE */}
            <div className="card">
              <div className="section-title">Ogólne</div>

              <div className="field">
                <label className="form-label">Tytuł</label>
                <input
                  className={`form-input ${
                    errors.title ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.title}
                  {...register("title")}
                  placeholder="Np. Przygotować ofertę"
                />
                {errors.title && (
                  <p className="error-text">{String(errors.title.message)}</p>
                )}
              </div>

              <div className="field">
                <label className="form-label">Opis</label>
                <textarea
                  className="form-textarea textarea-compact"
                  rows={2}
                  {...register("description")}
                  placeholder="Opcjonalnie"
                />
              </div>
            </div>

            {/* PRZEPŁYW ZADAŃ */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setFlowOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Przepływ zadań</span>
                </span>
                <span className="acc-right" aria-hidden>
                  {flowOpen ? "−" : "+"}
                </span>
              </button>

              {flowOpen && (
                <div className="acc-body">
                  <div className="grid-4 grid-4--tight">
                    <div className="field">
                      <label className="form-label">Status</label>
                      <select
                        className={`form-select ${
                          errors.status ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.status}
                        {...register("status")}
                      >
                        <option value="todo">Do zrobienia</option>
                        <option value="doing">W trakcie</option>
                        <option value="done">Zrobione</option>
                      </select>
                    </div>

                    <div className="field">
                      <label className="form-label">Priorytet</label>
                      <select
                        className={`form-select ${
                          errors.priority ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.priority}
                        {...register("priority")}
                      >
                        <option value={1}>Niski</option>
                        <option value={2}>Średni</option>
                        <option value={3}>Wysoki</option>
                      </select>
                    </div>

                    <div className="field">
                      <label className="form-label">Start</label>
                      <input
                        type="date"
                        className={`form-input ${
                          errors.start_date ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.start_date}
                        {...register("start_date")}
                      />
                    </div>

                    <div className="field">
                      <label className="form-label">Termin</label>
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
                </div>
              )}
            </div>

            {/* KOSZTY */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setCostOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Koszty</span>
                </span>
                <span className="acc-right" aria-hidden>
                  {costOpen ? "−" : "+"}
                </span>
              </button>

              {costOpen && (
                <div className="acc-body">
                  <div className="grid-3">
                    <div className="field">
                      <label className="form-label">Szac. czas (h)</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        className={`form-input ${
                          errors.est_hours ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.est_hours}
                        {...register("est_hours")}
                        placeholder="0"
                      />
                      {errors.est_hours && (
                        <p className="error-text">
                          {String(errors.est_hours.message)}
                        </p>
                      )}
                    </div>

                    <div className="field">
                      <label className="form-label">Kwota</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`form-input ${
                          errors.cost_amount ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.cost_amount}
                        {...register("cost_amount")}
                        placeholder="0.00"
                      />
                      {errors.cost_amount && (
                        <p className="error-text">
                          {String(errors.cost_amount.message)}
                        </p>
                      )}
                    </div>

                    <div className="field">
                      <label className="form-label">Waluta</label>
                      <select
                        className="form-select"
                        {...register("cost_currency")}
                      >
                        <option value="PLN">PLN</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ZAŁĄCZNIK / PARAGON */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setReceiptOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Załącznik / paragon</span>
                  {receiptFilled && <span className="acc-dot" aria-hidden />}
                </span>
                <span className="acc-right" aria-hidden>
                  {receiptOpen ? "−" : "+"}
                </span>
              </button>

              {receiptOpen && (
                <div className="acc-body">
                  <div className="grid-1">
                    <div className="field">
                      <label className="form-label">Link (URL)</label>
                      <input
                        type="url"
                        className={`form-input ${
                          errors.receipt_url ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.receipt_url}
                        {...register("receipt_url")}
                        placeholder="https://…"
                      />
                      {errors.receipt_url && (
                        <p className="error-text">
                          {String(errors.receipt_url.message)}
                        </p>
                      )}
                    </div>

                    <div className="field">
                      <label className="form-label">Notatka</label>
                      <input
                        className="form-input"
                        {...register("receipt_note")}
                        placeholder="Opcjonalnie"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PRZYPISANIE */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setAssignOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Przypisanie</span>
                  {assigneesFilled && <span className="acc-dot" aria-hidden />}
                </span>
                <span className="acc-right" aria-hidden>
                  {assignOpen ? "−" : "+"}
                </span>
              </button>

              {assignOpen && (
                <div className="acc-body">
                  {/* Assignees */}
                  <div className="field">
                    <label className="form-label">Osoby</label>

                    {usersLoading && (
                      <div className="muted small">
                        Ładowanie listy użytkowników…
                      </div>
                    )}

                    {!usersLoading && users.length > 0 && (
                      <select
                        multiple
                        className="form-multiselect"
                        value={assigneeIds.map(String)}
                        onChange={(e) => {
                          const selected = Array.from(
                            e.target.selectedOptions
                          ).map((opt) => Number(opt.value));
                          setAssigneeIds(selected);
                        }}
                      >
                        {users.map((u: AppUser) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                    )}

                    {!usersLoading && users.length === 0 && (
                      <div className="muted small">
                        Brak dostępnych użytkowników do przypisania.
                      </div>
                    )}
                  </div>

                  <div className="divider" />

                  {/* Scope */}
                  <div className="scope-group">
                    <label
                      className={`scope-pill ${
                        scope === "unassigned" ? "on" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        value="unassigned"
                        {...register("scope")}
                      />
                      <span>Nieprzypisane</span>
                    </label>

                    <label
                      className={`scope-pill ${
                        scope === "project" ? "on" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        value="project"
                        {...register("scope")}
                      />
                      <span>Projekt</span>
                    </label>

                    <label
                      className={`scope-pill ${
                        scope === "funding" ? "on" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        value="funding"
                        {...register("scope")}
                      />
                      <span>Finansowanie</span>
                    </label>
                  </div>

                  {scope === "project" && (
                    <div className="field mt-10">
                      <label className="form-label">Projekt</label>
                      <select
                        className={`form-select ${
                          errors.projectId ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.projectId}
                        disabled={lp}
                        {...register("projectId")}
                        defaultValue=""
                      >
                        <option value="">Wybierz projekt…</option>
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
                    <div className="field mt-10">
                      <label className="form-label">Finansowanie</label>
                      <select
                        className={`form-select ${
                          errors.fundingId ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.fundingId}
                        disabled={lf}
                        {...register("fundingId")}
                        defaultValue=""
                      >
                        <option value="">Wybierz finansowanie…</option>
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
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeAndReset}
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!isValid || isSubmitting}
              title={!isValid ? "Popraw błędy walidacji" : ""}
            >
              {isSubmitting ? "Zapisywanie…" : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
