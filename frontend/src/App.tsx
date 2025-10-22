import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./features/auth/LoginPage";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import DashboardLayout from "./features/dashboard/components/DashboardLayout";
import DashboardHome from "./features/dashboard/pages/DashboardHome";
import FundingsPlaceholder from "./features/fundings/pages/FundingsPlaceholder";
import TasksPage from "./features/tasks/pages/TaskPage";
import ProjectsPage from "./features/projects/ProjectsPage";

// ---
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Strona główna */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* domyślny ekran po zalogowaniu */}
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<DashboardHome />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="fundings" element={<FundingsPlaceholder />} />
          <Route path="tasks" element={<TasksPage />} />
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={<div style={{ padding: 24 }}>Not found</div>}
        />
      </Routes>
    </BrowserRouter>
  );
}
