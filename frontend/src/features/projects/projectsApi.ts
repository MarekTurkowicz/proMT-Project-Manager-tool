import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

/** Dokładnie według Twojego API */
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
      // po sukcesie odśwież listę
      invalidatesTags: ["Projects"],
    }),
  }),
});

export const { useListQuery: useProjectsQuery, useCreateMutation, } = projectsApi;
