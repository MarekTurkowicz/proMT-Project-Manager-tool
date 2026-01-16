import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

export type ID = number;


export interface ProjectFunding {
  id: ID;
  project: ID;
  funding: ID;

  allocation_start?: string | null; 
  allocation_end?: string | null;   
  created_at?: string;              
}
interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface ProjectFundingListParams {
  project?: ID;
  funding?: ID;

  page?: number;
  page_size?: number;
  limit?: number;
  offset?: number;
}

export const projectFundingApi = createApi({
  reducerPath: "projectFundingApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["ProjectFunding"],
  endpoints: (b) => ({

    listProjectFundings: b.query<Paged<ProjectFunding>, ProjectFundingListParams | void>({
      query: (params) => {
        const p = new URLSearchParams();

        if (params?.project != null) {
          p.set("project", String(params.project));
        }
        if (params?.funding != null) {
          p.set("funding", String(params.funding));
        }

        if (params?.page != null) p.set("page", String(params.page));
        if (params?.page_size != null) p.set("page_size", String(params.page_size));
        if (params?.limit != null) p.set("limit", String(params.limit));
        if (params?.offset != null) p.set("offset", String(params.offset));

        const qs = p.toString();
        return {
          url: `/api/project-fundings/${qs ? `?${qs}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (res) =>
        res?.results
          ? [
              ...res.results.map((pf) => ({
                type: "ProjectFunding" as const,
                id: pf.id,
              })),
              { type: "ProjectFunding" as const, id: "LIST" },
            ]
          : [{ type: "ProjectFunding" as const, id: "LIST" }],
    }),

    createProjectFunding: b.mutation<ProjectFunding, { project: ID; funding: ID }>({
      query: (body) => ({
        url: "/api/project-fundings/",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "ProjectFunding", id: "LIST" }],
    }),

    deleteProjectFunding: b.mutation<void, ID>({
      query: (id) => ({
        url: `/api/project-fundings/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "ProjectFunding", id: "LIST" }],
    }),
  }),
});

export const {
  useListProjectFundingsQuery,
  useCreateProjectFundingMutation,
  useDeleteProjectFundingMutation,
} = projectFundingApi;
