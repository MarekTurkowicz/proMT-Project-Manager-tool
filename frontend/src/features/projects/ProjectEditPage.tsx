import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetByIdQuery, useUpdateMutation } from "./projectsApi";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const ProjectSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(5000).optional().or(z.literal("")),
    status: z.enum(["new", "active", "closed"]),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    funding_ids: z.array(z.number()).optional().default([]),
    owner: z.number().nullable().optional().default(null),
  })
  .refine(
    (v) => {
      if (!v.start_date || !v.end_date) return true;
      return v.start_date <= v.end_date;
    },
    {
      path: ["end_date"],
      message: "Start date must be before or equal to end date",
    }
  );

type ProjectForm = z.infer<typeof ProjectSchema>;

export default function ProjectEditPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();

  const { data: project, isLoading, isError } = useGetByIdQuery(id);

  const form = useForm<ProjectForm>({
    resolver: zodResolver(ProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "new",
      start_date: null,
      end_date: null,
      funding_ids: [],
      owner: null,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = form;

  useEffect(() => {
    if (!project) return;
    reset({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      start_date: project.start_date,
      end_date: project.end_date,
      funding_ids: project.funding_ids ?? [],
      owner: project.owner ?? null,
    });
  }, [project, reset]);

  const [updateProject, { isLoading: isSaving }] = useUpdateMutation();

  function parseFundingIds(text: string): number[] {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
  }

  async function onSubmit(values: ProjectForm) {
    const patch = {
      ...values,
      description: values.description || "",
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      owner: values.owner ?? null,
    };
    try {
      await updateProject({ id, patch }).unwrap();
      navigate("/projects");
    } catch {
      alert("Update failed");
    }
  }

  if (isLoading) return <div style={{ padding: 24 }}>Ładowanie…</div>;
  if (isError || !project)
    return <div style={{ padding: 24 }}>Nie znaleziono projektu.</div>;

  const fundingIdsText = (watch("funding_ids") ?? []).join(", ");

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h1>Edytuj projekt #{project.id}</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: "grid", gap: 12 }}
      >
        <div>
          <label>Nazwa *</label>
          <br />
          <input {...register("name")} />
          {errors.name && (
            <div style={{ color: "crimson" }}>{errors.name.message}</div>
          )}
        </div>

        <div>
          <label>Opis</label>
          <br />
          <textarea rows={4} {...register("description")} />
          {errors.description && (
            <div style={{ color: "crimson" }}>{errors.description.message}</div>
          )}
        </div>

        <div>
          <label>Status *</label>
          <br />
          <select {...register("status")}>
            <option value="new">New</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          {errors.status && (
            <div style={{ color: "crimson" }}>{errors.status.message}</div>
          )}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label>Data startu</label>
            <br />
            <input type="date" {...register("start_date")} />
            {errors.start_date && (
              <div style={{ color: "crimson" }}>
                {errors.start_date.message}
              </div>
            )}
          </div>
          <div>
            <label>Data zakończenia</label>
            <br />
            <input type="date" {...register("end_date")} />
            {errors.end_date && (
              <div style={{ color: "crimson" }}>{errors.end_date.message}</div>
            )}
          </div>
        </div>

        <div>
          <label>Funding IDs (comma separated)</label>
          <br />
          <input
            value={fundingIdsText}
            onChange={(e) =>
              setValue("funding_ids", parseFundingIds(e.target.value), {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
          {errors.funding_ids && (
            <div style={{ color: "crimson" }}>Funding ids invalid</div>
          )}
        </div>

        <div>
          <label>Owner (ID — opcjonalnie)</label>
          <br />
          <input
            type="number"
            placeholder="np. 123"
            onChange={(e) => {
              const raw = e.target.value;
              const val = raw === "" ? null : Number(raw);
              setValue(
                "owner",
                Number.isNaN(val as number) ? null : (val as number | null),
                {
                  shouldValidate: true,
                  shouldDirty: true,
                }
              );
            }}
            value={watch("owner") ?? ""}
          />
          {errors.owner && (
            <div style={{ color: "crimson" }}>
              {String(errors.owner.message)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={isSubmitting || isSaving}>
            {isSubmitting || isSaving ? "Zapisywanie…" : "Zapisz"}
          </button>
          <button type="button" onClick={() => navigate("/projects")}>
            Anuluj
          </button>
        </div>
      </form>
    </div>
  );
}
