import {
  useProjectsQuery,
  useCreateMutation,
  useDeleteMutation,
} from "./projectsApi";
import { useLogoutMutation } from "../auth/authApi";
import UserBar from "../auth/UserBar";
import { Link } from "react-router-dom";
import { useState } from "react";
import Spinner from "../../components/Spinner";

const STATUS_LABEL: Record<"new" | "active" | "closed", string> = {
  new: "New",
  active: "Active",
  closed: "Closed",
};

const fmtDate = (d: string | null) => d ?? "—";

export default function ProjectsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useProjectsQuery();
  const [createProject, { isLoading: isCreating }] = useCreateMutation();
  const [deleteProject] = useDeleteMutation();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  if (isLoading) return <div style={{ padding: 24 }}>Ładowanie…</div>;
  if (isError)
    return (
      <div style={{ padding: 24 }}>
        Błąd ładowania.{" "}
        <button onClick={() => refetch()}>Spróbuj ponownie</button>
      </div>
    );

  const items = data?.results ?? [];

  async function handleAdd() {
    try {
      await createProject({
        name: "Nowy projekt",
        description: "",
        status: "new",
        start_date: null,
        end_date: null,
        funding_ids: [],
        owner: null,
      }).unwrap();
    } catch (e) {
      console.error("Create project failed:", e);
      alert("Nie udało się utworzyć projektu (sprawdź autoryzację).");
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Na pewno usunąć ten projekt?");
    if (!ok) return;

    try {
      setDeletingId(id);
      await deleteProject(id).unwrap();
    } catch {
      alert("Nie udało się usunąć projektu.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Projekty</h1>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Zarządzaj projektami i finansowaniem
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link to="/projects/new">
            <button type="button">+ New</button>
          </Link>
          <UserBar />
        </div>
      </div>
      <h1 style={{ marginBottom: 8 }}>Projekty</h1>
      <button
        onClick={async () => {
          try {
            await logout().unwrap();
            window.location.href = "/login";
          } catch {
            alert("Nie udało się wylogować");
          }
        }}
      >
        {isLoggingOut ? "Wylogowywanie..." : "Wyloguj"}
      </button>
      ;
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ color: "#555" }}>
          Razem: <strong>{data?.count ?? 0}</strong>{" "}
          {isFetching && <span style={{ fontSize: 12 }}>(odświeżanie…)</span>}
        </div>
        <button onClick={handleAdd} disabled={isCreating}>
          {isCreating ? "Dodawanie…" : "+ Add"}
        </button>
      </div>
      {!items.length ? (
        <p>Brak projektów.</p>
      ) : (
        <ul style={{ lineHeight: 1.6 }}>
          {items.map((p) => (
            <li key={p.id} style={{ marginBottom: 10 }}>
              <div>
                <strong>{p.name}</strong>{" "}
                <small>
                  [status: {STATUS_LABEL[p.status]}] — {fmtDate(p.start_date)} →{" "}
                  {fmtDate(p.end_date)}
                  {p.owner_username ? ` • owner: ${p.owner_username}` : ""}
                </small>
              </div>
              {p.description && (
                <div style={{ color: "#555" }}>{p.description}</div>
              )}
              <Link to={`/projects/${p.id}/edit`}>
                <button type="button">Edytuj</button>
              </Link>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                title="Usuń projekt"
                style={{
                  color: deletingId === p.id ? "#b91c1c" : "#dc2626",
                  opacity: deletingId === p.id ? 0.6 : 1,
                }}
              >
                {deletingId === p.id ? (
                  <>
                    <Spinner size={16} />
                    Usuwanie…
                  </>
                ) : (
                  "Usuń"
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
