import { configureStore } from "@reduxjs/toolkit";
import { healthApi } from "../features/health/healtsApi";
import { projectsApi } from "../features/projects/projectsApi";
import { authApi } from "../features/auth/authApi"; 
import { tasksApi } from "../features/tasks/tasksApi";
import { fundingsApi } from "../features/api/fundingApi";
import { projectFundingApi } from "../features/api/projectFundingApi";
import { usersApi } from "../features/api/usersApi";

export const store = configureStore({
  reducer: {
    [healthApi.reducerPath]: healthApi.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [tasksApi.reducerPath]: tasksApi.reducer,
    [fundingsApi.reducerPath]: fundingsApi.reducer,
    [projectFundingApi.reducerPath]: projectFundingApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      healthApi.middleware,
      projectsApi.middleware,
      authApi.middleware,
      tasksApi.middleware,
      fundingsApi.middleware,
      projectFundingApi.middleware,
      usersApi.middleware,)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;