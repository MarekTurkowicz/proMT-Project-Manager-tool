import { useProjectsQuery, useCreateMutation } from "./projectsApi";

const STATUS_LABEL: Record<"new" | "active" | "closed", string> = {
  new: "New",
  active: "Active",
  closed: "Closed",
};

const fmtDate = (d: string | null) => d ?? "—";

export default function ProjectsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useProjectsQuery();
  const [createProject, { isLoading: isCreating }] = useCreateMutation(); // ⬅️ NOWE

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
      // po sukcesie lista sama się odświeży (invalidatesTags)
    } catch (e) {
      console.error("Create project failed:", e);
      alert("Nie udało się utworzyć projektu (sprawdź autoryzację).");
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ marginBottom: 8 }}>Projekty</h1>

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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
