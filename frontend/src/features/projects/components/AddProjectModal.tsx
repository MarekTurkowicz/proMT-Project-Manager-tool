import { useEffect, useState } from "react";
import {
  useForm,
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ProjectCreate } from "../../types/project";
import "./ProjectModals.css";

const emptyToNull = (v?: string) => (!v || v.trim() === "" ? null : v);

const ProjectCreateSchema = z
  .object({
    name: z.string().trim().min(3, "Nazwa musi mieć min. 3 znaki"),
    description: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Data końcowa nie może być wcześniejsza niż start",
      });
    }
  });

type FormValues = z.infer<typeof ProjectCreateSchema>;

export default function AddProjectModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ProjectCreate) => Promise<void> | void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(ProjectCreateSchema) as Resolver<FormValues>,
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      start_date: "",
      end_date: "",
    },
  });

  const [datesOpen, setDatesOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDatesOpen(true);
  }, [open]);

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    const payload: ProjectCreate = {
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      start_date: emptyToNull(values.start_date),
      end_date: emptyToNull(values.end_date),
      // status celowo NIE ustawiamy przy create
    };

    await onSubmit(payload);
    closeAndReset();
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const order: Path<FormValues>[] = [
      "name",
      "start_date",
      "end_date",
      "description",
    ];
    const first = order.find((k) => errs[k]);
    if (first) setFocus(first);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={closeAndReset}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-head-left">
            <h2 className="modal-title">Dodaj projekt</h2>
            <div className="modal-subtitle">Uzupełnij szczegóły i zapisz</div>
          </div>

          <button
            className="icon-btn"
            onClick={closeAndReset}
            aria-label="Zamknij"
            type="button"
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
                <label className="form-label">Nazwa</label>
                <input
                  className={`form-input ${errors.name ? "input-invalid" : ""}`}
                  aria-invalid={!!errors.name}
                  {...register("name")}
                  placeholder="Np. Strona www 2026"
                />
                {errors.name && (
                  <p className="error-text">{String(errors.name.message)}</p>
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

            {/* DATY (obok siebie) */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setDatesOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Daty</span>
                </span>
                <span className="acc-right" aria-hidden>
                  {datesOpen ? "−" : "+"}
                </span>
              </button>

              {datesOpen && (
                <div className="acc-body">
                  <div className="grid-2">
                    <div className="field">
                      <label className="form-label">Start</label>
                      <input
                        type="date"
                        className="form-input"
                        {...register("start_date")}
                      />
                    </div>

                    <div className="field">
                      <label className="form-label">Koniec</label>
                      <input
                        type="date"
                        className={`form-input ${
                          errors.end_date ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.end_date}
                        {...register("end_date")}
                      />
                      {errors.end_date && (
                        <p className="error-text">
                          {String(errors.end_date.message)}
                        </p>
                      )}
                    </div>
                  </div>
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
