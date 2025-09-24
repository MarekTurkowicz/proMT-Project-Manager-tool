import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

/**
 * healthApi – jeden endpoint do sprawdzenia połączenia.
 * W DRF możesz mieć np. /api/health/ albo skorzystać z /api/ (cokolwiek zwraca 200/JSON).
 */
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

