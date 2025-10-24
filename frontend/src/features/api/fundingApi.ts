import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";
// Jeśli wolisz, możesz podmienić importy typów na swoje ścieżki.
// Dla pełnej kompatybilności (żeby nie było problemów z aliasem "@/") robię lokalny Paged i Params.
import type { Funding, FundingCreate, FundingUpdate } from "../types/funding";

type Paged<T> = { count: number; next: string | null; previous: string | null; results: T[] };

// Parametry zgodne z Twoim FundingViewSet (search + ordering + paginacja)
export type FundingsListParams = {
  search?: string;
  ordering?:
    | "created_at" | "-created_at"
    | "start_date" | "-start_date"
    | "end_date"   | "-end_date"
    | "amount_total" | "-amount_total"
    | "name" | "-name";
  // użyj jednego trybu paginacji zgodnie z DRF config:
  page?: number;
  page_size?: number;
  limit?: number;
  offset?: number;
};

export const fundingsApi = createApi({
  reducerPath: "fundingsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Funding", "FundingPick"],
  endpoints: (b) => ({

    // LIST
    listFundings: b.query<Paged<Funding>, FundingsListParams | void>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.search) p.set("search", params.search);
        if (params?.ordering) p.set("ordering", params.ordering);
        if (params?.page != null) p.set("page", String(params.page));
        if (params?.page_size != null) p.set("page_size", String(params.page_size));
        if (params?.limit != null) p.set("limit", String(params.limit));
        if (params?.offset != null) p.set("offset", String(params.offset));
        const qs = p.toString();
        return { url: `/api/fundings/${qs ? `?${qs}` : ""}`, method: "GET" };
      },
      providesTags: (res) =>
        res?.results
          ? [
              ...res.results.map((f) => ({ type: "Funding" as const, id: f.id })),
              { type: "Funding" as const, id: "LIST" },
            ]
          : [{ type: "Funding" as const, id: "LIST" }],
    }),

    // DETAIL
    getFunding: b.query<Funding, number>({
      query: (id) => ({ url: `/api/fundings/${id}/`, method: "GET" }),
      providesTags: (_res, _err, id) => [{ type: "Funding", id }],
    }),

    // CREATE
    createFunding: b.mutation<Funding, FundingCreate>({
      query: (body) => ({ url: "/api/fundings/", method: "POST", data: body }),
      invalidatesTags: [{ type: "Funding", id: "LIST" }],
    }),

    // UPDATE (partial PATCH)
    updateFunding: b.mutation<Funding, { id: number; patch: FundingUpdate }>({
      query: ({ id, patch }) => ({
        url: `/api/fundings/${id}/`,
        method: "PATCH",
        data: patch,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: "Funding", id },
        { type: "Funding", id: "LIST" },
      ],
    }),

    // DELETE
    deleteFunding: b.mutation<void, number>({
      query: (id) => ({ url: `/api/fundings/${id}/`, method: "DELETE" }),
      invalidatesTags: [{ type: "Funding", id: "LIST" }],
    }),

    // LEKKI PICK (do selectów)
    pickFundings: b.query<{ id: number; name: string }[], void>({
      query: () => ({ url: "/api/fundings/?ordering=name&page_size=100", method: "GET" }),
      transformResponse: (data: Paged<{ id: number; name: string }>) => data.results,
      providesTags: ["FundingPick"],
    }),
  }),
});

export const {
  useListFundingsQuery,
  useGetFundingQuery,
  useCreateFundingMutation,
  useUpdateFundingMutation,
  useDeleteFundingMutation,
  usePickFundingsQuery,
} = fundingsApi;
