import { configureStore } from "@reduxjs/toolkit";
import { healthApi } from "../features/health/healtsApi";
import { projectsApi } from "../features/projects/projectsApi";

export const store = configureStore({
  reducer: {
    [healthApi.reducerPath]: healthApi.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer, 
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(healthApi.middleware, projectsApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
