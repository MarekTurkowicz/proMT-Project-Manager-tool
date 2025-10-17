// frontend/src/features/projects/projectsApi.ts
import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

export type Project = {
  id: number;
  name: string;
  description: string;
  status: "new" | "active" | "closed";
  start_date: string | null;
  end_date: string | null;
  funding_ids: number[];
  created_at: string;
  updated_at: string;
  owner: number;
};

export const projectsApi = createApi({
  reducerPath: "projectsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Projects", "Project"],
  endpoints: (b) => ({
    // już masz:
    projects: b.query<{ count: number; results: Project[] }, void>({
      query: () => ({ url: "/api/projects/" }),
      providesTags: ["Projects"],
    }),
    create: b.mutation<Project, Partial<Project>>({
      query: (body) => ({ url: "/api/projects/", method: "post", data: body }),
      invalidatesTags: ["Projects"],
    }),
    delete: b.mutation<void, number>({
      query: (id) => ({ url: `/api/projects/${id}/`, method: "delete" }),
      invalidatesTags: ["Projects"],
    }),

    // NOWE:
    getById: b.query<Project, number>({
      // co: detail endpoint
      // po co: prefill formularza edit
      query: (id) => ({ url: `/api/projects/${id}/` }),
      providesTags: (_res, _err, id) => [{ type: "Project", id }],
    }),
    update: b.mutation<Project, { id: number; patch: Partial<Project> }>({
      // co: PATCH bo zmieniamy fragmenty
      // po co: eleganckie, zgodne z REST
      query: ({ id, patch }) => ({
        url: `/api/projects/${id}/`,
        method: "patch",
        data: patch,
      }),
      // co: przeterminuj listę i konkretny detail
      // po co: żeby UI odświeżył dane
      invalidatesTags: (_res, _err, arg) => [
        "Projects",
        { type: "Project", id: arg.id },
      ],
    }),
  }),
});

export const {
  useProjectsQuery,
  useCreateMutation,
  useDeleteMutation,
  useGetByIdQuery,
  useUpdateMutation,
} = projectsApi;
