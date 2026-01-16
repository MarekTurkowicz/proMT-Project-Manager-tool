import { Navigate } from "react-router-dom";
import { useMeQuery } from "./authApi";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isError } = useMeQuery();

  if (isLoading) return <div style={{ padding: 24 }}>Ładowanie…</div>;
  if (isError) return <Navigate to="/login" replace />;

  return children;
}
