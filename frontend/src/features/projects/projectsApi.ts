import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

export type Project = {
  id: number;
  name: string;
  description: string;
  status: "new" | "active" | "closed";
  owner: number | null;
  owner_username?: string;
  start_date: string | null;
  end_date: string | null;
  funding_ids: number[];
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const projectsApi = createApi({
  reducerPath: "projectsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Projects"],
  endpoints: (b) => ({
    list: b.query<Paginated<Project>, void>({
      query: () => ({ url: "/api/projects/" }),
      providesTags: ["Projects"],
    }),

create: b.mutation<Project, Partial<Project>>({
      query: (body) => ({
        url: "/api/projects/",
        method: "post",
        data: body,
      }),
      invalidatesTags: ["Projects"],
    }),

delete: b.mutation<void, number>({
  query: (id) => ({ url: `/api/projects/${id}/`, method: "delete" }),
  invalidatesTags: ["Projects"],
}),
  }),


});

export const { useListQuery: useProjectsQuery, useCreateMutation, useDeleteMutation} = projectsApi;
