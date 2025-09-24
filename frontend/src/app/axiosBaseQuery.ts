import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosRequestConfig, AxiosError } from "axios";
import api from "./axios";

type AxiosArgs = {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: AxiosRequestConfig["data"];
  params?: AxiosRequestConfig["params"];
};

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosArgs, unknown, { status?: number; data?: unknown }> =>
  async ({ url, method = "get", data, params }) => {
    try {
      const result = await api({ url, method, data, params });
      return { data: result.data };
    } catch (axiosError) {
      const err = axiosError as AxiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data,
        },
      };
    }
  };
