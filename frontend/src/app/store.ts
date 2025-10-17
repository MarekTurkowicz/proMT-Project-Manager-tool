import { configureStore } from "@reduxjs/toolkit";
import { healthApi } from "../features/health/healtsApi";
import { projectsApi } from "../features/projects/projectsApi";
import { authApi } from "../features/auth/authApi"; 

export const store = configureStore({
  reducer: {
    [healthApi.reducerPath]: healthApi.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(healthApi.middleware, projectsApi.middleware, authApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;