import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

type HealthResponse = { status: string };

export const healthApi = createApi({
  reducerPath: "healthApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    health: builder.query<HealthResponse, void>({
      query: () => ({ url: "/api/health/" }),
    }),
  }),
});

export const { useHealthQuery } = healthApi;

