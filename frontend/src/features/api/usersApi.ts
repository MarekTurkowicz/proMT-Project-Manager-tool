import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";
import type { AppUser } from "../types/users";

type Paged<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["User"],
  endpoints: (b) => ({
    listUsers: b.query<AppUser[], void>({
      query: () => ({ url: "/api/users/", method: "GET" }),
      transformResponse: (data: Paged<AppUser> | AppUser[]) =>
        Array.isArray(data) ? data : data.results,
      providesTags: (res) =>
        res && res.length
          ? [
              ...res.map((u) => ({ type: "User" as const, id: u.id })),
              { type: "User" as const, id: "LIST" },
            ]
          : [{ type: "User" as const, id: "LIST" }],
    }),

    // GET /api/users/:id/
    getUser: b.query<AppUser, number>({
      query: (id) => ({ url: `/api/users/${id}/`, method: "GET" }),
      providesTags: (_res, _err, id) => [{ type: "User" as const, id }],
    }),
  }),
});

export const { useListUsersQuery, useGetUserQuery } = usersApi;
