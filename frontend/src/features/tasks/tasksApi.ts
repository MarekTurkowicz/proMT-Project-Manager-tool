import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";
import type { Task, CreateTaskPayload } from "./types";

type Paged<T> = { count: number; next: string | null; previous: string | null; results: T[] };
export type TasksListParams = {
  project?: number;
  funding?: number;
  unassigned?: boolean;
  status?: "todo" | "doing" | "done";
  ordering?: "-created_at" | "created_at" | "due_date" | "-due_date" | "priority" | "-priority";
  page?: number;
  search?: string;
  priority?: "1" | "2" | "3";
};

export const tasksApi = createApi({
  reducerPath: "tasksApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Task", "ProjectPick", "FundingPick"],
  endpoints: (b) => ({
    // LISTA
    listTasks: b.query<Paged<Task>, TasksListParams | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.project != null) p.set("project", String(params.project));
        if (params?.funding != null) p.set("funding", String(params.funding));
        if (params?.unassigned) p.set("unassigned", "true");
        if (params?.status) p.set("status", params.status);
        if (params?.ordering) p.set("ordering", params.ordering);
        if (params?.page) p.set("page", String(params.page));
        const qs = p.toString();
        return { url: `/api/tasks/${qs ? `?${qs}` : ""}`, method: "GET" };
      },
      providesTags: (res) =>
        res?.results
          ? [
              ...res.results.map((t) => ({ type: "Task" as const, id: t.id })),
              { type: "Task" as const, id: "LIST" },
            ]
          : [{ type: "Task" as const, id: "LIST" }],
    }),

    // CREATE
    createTask: b.mutation<Task, CreateTaskPayload>({
      query: (body) => ({ url: "/api/tasks/", method: "POST", data: body }),
      invalidatesTags: [{ type: "Task", id: "LIST" }],
    }),

    // DELETE
    deleteTask: b.mutation<void, number>({
      query: (id) => ({
        url: `/api/tasks/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: [{type: "Task", id: "LIST"}],
    }),
    updateTask: b.mutation<Task, {id: number, patch: Partial<CreateTaskPayload>}>({
      query: ({ id, patch}) => ({
        url: `/api/tasks/${id}/`,
        method: "PATCH",
        data: patch,
      }),
      invalidatesTags: [{type: "Task", id: "LIST"}],
    }),

    // LEKKIE LISTY DO SELECTÓW (nazwa + id)
    pickProjects: b.query<{ id: number; name: string }[], void>({
      query: () => ({ url: "/api/projects/?ordering=name&page_size=100" }),
      transformResponse: (data: Paged<{ id: number; name: string }>) => data.results,
      providesTags: ["ProjectPick"],
    }),
    pickFundings: b.query<{ id: number; name: string }[], void>({
      query: () => ({ url: "/api/fundings/?ordering=name&page_size=100" }),
      transformResponse: (data: Paged<{ id: number; name: string }>) => data.results,
      providesTags: ["FundingPick"],
    }),
  }),
});

export const {
  useListTasksQuery,
  useCreateTaskMutation,
  usePickProjectsQuery,
  usePickFundingsQuery,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
} = tasksApi;
