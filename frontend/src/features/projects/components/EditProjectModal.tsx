import { useEffect } from "react";
import {
  useForm,
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Project, ProjectUpdate } from "../../types/project";
import "./ProjectModals.css"; // albo ten sam CSS co używasz w modals

const ProjectEditSchema = z
  .object({
    name: z.string().trim().min(3, "Name must be at least 3 characters"),
    description: z.string().optional(),
    status: z.enum(["new", "active", "closed"]),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date cannot be before start date",
      });
    }
  });

type FormValues = z.infer<typeof ProjectEditSchema>;

export default function EditProjectModal({
  open,
  project,
  onClose,
  onSubmit,
}: {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSubmit: (id: number, patch: ProjectUpdate) => Promise<void> | void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(ProjectEditSchema) as Resolver<FormValues>,
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      status: "new",
      start_date: "",
      end_date: "",
    },
  });

  useEffect(() => {
    if (!project) return;
    reset({
      name: project.name ?? "",
      description: project.description ?? "",
      status: project.status,
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
    });
  }, [project, reset, open]);

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    if (!project) return;
    const patch: ProjectUpdate = {
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      status: values.status,
      start_date: values.start_date ? values.start_date : null,
      end_date: values.end_date ? values.end_date : null,
    };
    await onSubmit(project.id, patch);
    closeAndReset();
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const order: Path<FormValues>[] = [
      "name",
      "start_date",
      "end_date",
      "status",
      "description",
    ];
    const first = order.find((k) => errs[k]);
    if (first) setFocus(first);
  };

  if (!open || !project) return null;

  return (
    <div className="modal-overlay" onClick={closeAndReset}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit project</h2>
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
            <div>
              <label className="form-label">Name</label>
              <input
                className={`form-input ${errors.name ? "input-invalid" : ""}`}
                aria-invalid={!!errors.name}
                {...register("name")}
                placeholder="Project name"
              />
              {errors.name && (
                <p className="error-text">{String(errors.name.message)}</p>
              )}
            </div>

            <div>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                {...register("description")}
                placeholder="Optional"
              />
            </div>

            <div className="form-grid">
              <div>
                <label className="form-label">Status</label>
                <select className="form-select" {...register("status")}>
                  <option value="new">New</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="form-label">Start date</label>
                <input
                  type="date"
                  className="form-input"
                  {...register("start_date")}
                />
              </div>
              <div>
                <label className="form-label">End date</label>
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
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
