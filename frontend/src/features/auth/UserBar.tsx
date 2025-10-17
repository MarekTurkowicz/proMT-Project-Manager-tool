import { useMeQuery, useLogoutMutation } from "./authApi";

export default function UserBar() {
  const { data: me } = useMeQuery();
  const [logout, { isLoading }] = useLogoutMutation();

  async function handleLogout() {
    try {
      await logout().unwrap();
      window.location.href = "/login";
    } catch {
      // tu możesz dodać toast
      alert("Logout failed");
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span style={{ fontSize: 14, color: "#000000ff" }}>
        Zalogowany jako: <strong>{me?.username ?? "…"}</strong>
      </span>
      <button onClick={handleLogout} disabled={isLoading}>
        {isLoading ? "Wylogowywanie…" : "Wyloguj"}
      </button>
    </div>
  );
}
