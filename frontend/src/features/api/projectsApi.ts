import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";
import type {
  Project,
  ProjectsListParams,
  ProjectCreate,
  ProjectUpdate,
} from "../types/project";

type Paged<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export const projectsApi = createApi({
  reducerPath: "projectsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Projects", "Project"],
  endpoints: (b) => ({
    projects: b.query<Paged<Project>, ProjectsListParams | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.ordering) p.set("ordering", params.ordering);
        if (params?.search) p.set("search", params.search);
        if (params?.page) p.set("page", String(params.page));
        const qs = p.toString();
        return { url: `/api/projects/${qs ? `?${qs}` : ""}`, method: "GET" };
      },
      providesTags: (res) =>
        res?.results
          ? [
              ...res.results.map((pr) => ({ type: "Project" as const, id: pr.id })),
              { type: "Projects" as const, id: "LIST" },
            ]
          : [{ type: "Projects" as const, id: "LIST" }],
    }),

    // CREATE
    create: b.mutation<Project, ProjectCreate>({
      query: (body) => ({ url: "/api/projects/", method: "POST", data: body }),
      invalidatesTags: [{ type: "Projects", id: "LIST" }],
    }),

    // DELETE
    delete: b.mutation<void, number>({
      query: (id) => ({ url: `/api/projects/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Projects", id: "LIST" }],
    }),

    // DETAIL
    getById: b.query<Project, number>({
      query: (id) => ({ url: `/api/projects/${id}/` }),
      providesTags: (_res, _err, id) => [{ type: "Project", id }],
    }),

    // UPDATE (PATCH)
    update: b.mutation<Project, { id: number; patch: ProjectUpdate }>({
      query: ({ id, patch }) => ({
        url: `/api/projects/${id}/`,
        method: "PATCH",
        data: patch,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Project", id: arg.id },
        { type: "Projects", id: "LIST" },
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
