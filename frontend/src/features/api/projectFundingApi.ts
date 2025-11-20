import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

export type ID = number;

/**
 * ProjectFunding = rekord z tabeli łączącej projekt z finansowaniem.
 * Pola dodatkowe (allocation_start, allocation_end itd.) zostawiłem opcjonalne.
 * Jak dopiszesz coś w serializerze, po prostu rozbudujesz ten interface.
 */
export interface ProjectFunding {
  id: ID;
  project: ID;
  funding: ID;

  allocation_start?: string | null; // "YYYY-MM-DD" jeśli masz
  allocation_end?: string | null;   // jw.
  created_at?: string;              // ISO, jeśli serializer zwraca
}

/** Standardowa paginacja DRF. */
interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Parametry listy powiązań projekt–finansowanie.
 * Najczęstsze use-case’y:
 *  - project: pokaż wszystkie fundings dla projektu
 *  - funding: pokaż wszystkie projekty dla danego fundingu
 */
export interface ProjectFundingListParams {
  project?: ID;
  funding?: ID;

  // jeśli używasz paginacji page/page_size lub limit/offset – zostawiam oba
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
    /**
     * LISTA powiązań project_funding (opcjonalnie filtrowana po project / funding).
     * Na froncie nie musisz z tego korzystać wszędzie – ale przy unlinku może się przydać,
     * żeby mieć `id` konkretnego powiązania.
     */
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

    /**
     * LINK – utworzenie ProjectFunding (project + funding).
     * Tutaj odpala się Twój post_save signal → kopiuje taski itd.
     */
    createProjectFunding: b.mutation<ProjectFunding, { project: ID; funding: ID }>({
      query: (body) => ({
        url: "/api/project-fundings/",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "ProjectFunding", id: "LIST" }],
    }),

    /**
     * UNLINK – usunięcie ProjectFunding.
     * Twój post_delete signal wyczyści sklonowane taski przypięte do tego PF.
     */
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
