import type { FormEvent } from "react";
import { useCsrfQuery, useLoginMutation, useMeQuery } from "./authApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useState } from "react"; // tylko do błędu UX

const FAIL_KEY = "login_fail_count";
const MAX_BACKOFF_MS = 5000;

function getHttpStatus(e: unknown): number {
  if (typeof e === "object" && e && "status" in e) {
    const s = (e as { status?: unknown }).status;
    return typeof s === "number" ? s : 0;
  }
  return 0;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LoginPage() {
  useCsrfQuery();
  const navigate = useNavigate();
  const { data: me, isLoading: meLoading, isError: meError } = useMeQuery();
  const [login, { isLoading }] = useLoginMutation();
  const [formError, setFormError] = useState<string | null>(null);

  if (meLoading) return <div style={{ padding: 24 }}>Ładowanie…</div>;
  if (me && !meError) {
    navigate("/projects", { replace: true });
    return null;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "");
    const password = String(fd.get("password") ?? "");

    const fails = Number(sessionStorage.getItem(FAIL_KEY) ?? 0);
    const delay = Math.min(MAX_BACKOFF_MS, fails * 500);
    if (delay > 0) {
      toast("Zbyt wiele prób, chwilka…", { id: "backoff", duration: 1000 });
      await sleep(delay);
    }

    try {
      await login({ username, password }).unwrap();
      sessionStorage.removeItem(FAIL_KEY);
      toast.success("Zalogowano!");
      navigate("/projects", { replace: true });
    } catch (err: unknown) {
      const status = getHttpStatus(err);
      const nextFails = fails + 1;
      sessionStorage.setItem(FAIL_KEY, String(nextFails));

      if (status === 429) {
        setFormError("Zbyt wiele prób logowania. Spróbuj za chwilę.");
        toast.error("Zbyt wiele prób. Spróbuj za chwilę.");
      } else if (status === 400) {
        setFormError("Nieprawidłowy login lub hasło.");
        toast.error("Nieprawidłowy login lub hasło.");
      } else {
        setFormError("Logowanie nieudane. Spróbuj ponownie.");
        toast.error("Logowanie nieudane.");
      }
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Zaloguj się</h1>
        <p style={{ margin: "0 0 16px", color: "#6b7280" }}>
          Wprowadź dane dostępowe, aby przejść do projektów.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <label
              htmlFor="username"
              style={{ display: "block", fontSize: 14, marginBottom: 6 }}
            >
              Login
            </label>
            <input
              id="username"
              name="username"
              required
              autoComplete="username"
              style={inputStyle}
              placeholder="np. pm"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: "block", fontSize: 14, marginBottom: 6 }}
            >
              Hasło
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={inputStyle}
              placeholder="Twoje hasło"
            />
          </div>

          {formError && (
            <div style={{ color: "crimson", fontSize: 14 }}>{formError}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              height: 40,
              borderRadius: 10,
              border: "1px solid #111827",
              background: isLoading ? "#f3f4f6" : "#111827",
              color: isLoading ? "#111827" : "white",
              fontWeight: 600,
            }}
          >
            {isLoading ? "Logowanie…" : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  outline: "none",
};
