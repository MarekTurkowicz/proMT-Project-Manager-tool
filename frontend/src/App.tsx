import { useHealthQuery } from "./features/health/healtsApi";

export default function App() {
  const { data, isLoading, isError, refetch } = useHealthQuery();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Frontend działa ✅</h1>
      <p>Test połączenia z API:</p>
      {isLoading && <p>Ładowanie…</p>}
      {isError && (
        <p>
          Błąd połączenia.{" "}
          <button onClick={() => refetch()}>Spróbuj ponownie</button>
        </p>
      )}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
