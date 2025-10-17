import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../../app/axiosBaseQuery";

type LoginBody = { username: string; password: string };
type User = { id: number; username: string; email: string; is_staff: boolean };

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (b) => ({
    csrf: b.query<{ detail: string }, void>({
      query: () => ({ url: "/api/auth/csrf/" }),
    }),
    login: b.mutation<User, LoginBody>({
      query: (body) => ({ url: "/api/auth/login/", method: "post", data: body }),
    }),
    logout: b.mutation<void, void>({
      query: () => ({ url: "/api/auth/logout/", method: "post" }),
    }),
    me: b.query<User, void>({
      query: () => ({ url: "/api/auth/me/" }),
    }),
  }),
});

export const { useCsrfQuery, useLoginMutation, useLogoutMutation, useMeQuery } = authApi;
