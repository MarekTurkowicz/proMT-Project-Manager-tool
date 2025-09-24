import { configureStore } from "@reduxjs/toolkit";
import { healthApi } from "../features/health/healtsApi";

export const store = configureStore({
  reducer: {
    [healthApi.reducerPath]: healthApi.reducer, // ⬅️ rejestrujemy reducer RTKQ
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(healthApi.middleware), // ⬅️ middleware RTKQ
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
