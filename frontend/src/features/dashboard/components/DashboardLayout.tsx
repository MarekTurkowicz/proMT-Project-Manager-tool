import { NavLink, Outlet } from "react-router-dom";
import HeaderBar from "../../HeaderBar/components/headerBar";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  return (
    <div className="layout grid grid-cols-[240px_minmax(0,1fr)] min-h-screen bg-slate-50 text-slate-900">
      {/* LEWA KOLUMNA: sidebar */}
      <aside className="border-r border-slate-200 bg-white">
        <div className="p-6">
          <h2 className="text-xl font-semibold">Dashboard</h2>
        </div>

        <nav className="px-3 pb-6 space-y-1">
          <NavLink to="overview" className={navClass}>
            Przegląd
          </NavLink>
          <NavLink to="projects" className={navClass}>
            Projekty
          </NavLink>
          <NavLink to="fundings" className={navClass}>
            Finansowania
          </NavLink>
          <NavLink to="tasks" className={navClass}>
            Zadania
          </NavLink>
        </nav>
      </aside>

      {/* PRAWA KOLUMNA: header + content */}
      <div className="flex flex-col min-w-0 min-h-0">
        {/* ⬇️ globalny, lekki pasek użytkownika (sticky) */}
        <HeaderBar />

        {/* Główna zawartość stron dashboardu */}
        <main className="p-6 w-full min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "block px-3 py-2 rounded-md transition-colors",
    isActive
      ? "bg-slate-100 text-slate-900 font-medium"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}
