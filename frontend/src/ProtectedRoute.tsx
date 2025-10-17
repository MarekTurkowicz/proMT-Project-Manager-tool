import { Navigate } from "react-router-dom";
import { useMeQuery } from "./features/auth/authApi";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isError } = useMeQuery();

  if (isLoading) return <div style={{ padding: 24 }}>Ładowanie…</div>;
  // jeśli endpoint me zwróci błąd (401/403), przekaż na /login
  if (isError) return <Navigate to="/login" replace />;

  // mamy użytkownika
  return children;
}
