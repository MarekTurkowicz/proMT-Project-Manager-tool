import { Link } from "react-router-dom";

export default function DashboardHome() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>Witaj w panelu</h1>
      <p>Tu będzie szybki przegląd (liczniki, skróty). Na start — linki:</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Card to="../projects" label="Przejdź do projektów →" />
        <Card to="../fundings" label="Przejdź do finansowań →" />
        <Card to="../tasks" label="Przejdź do zadań →" />
      </div>
    </div>
  );
}

function Card({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        padding: 16,
        border: "1px solid #eee",
        borderRadius: 8,
        textDecoration: "none",
        color: "#111",
      }}
    >
      {label}
    </Link>
  );
}
