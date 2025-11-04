import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./features/auth/LoginPage";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import DashboardLayout from "./features/dashboard/components/DashboardLayout";
import DashboardHome from "./features/dashboard/pages/DashboardHome";
import TasksPage from "./features/tasks/pages/TaskPage";
import ProjectsPage from "./features/projects/pages/ProjectsPage";
import FundingsPage from "./features/fundings/pages/FundingPage";
import ProjectDetailLayout from "./features/projects/pages/ProjectDetailLayout";
import ProjectOverviewTab from "./features/projects/tabs/ProjectOverviewTab";
import ProjectFundingsTab from "./features/projects/tabs/ProjectFundingsTab";
import ProjectTasksTab from "./features/projects/tabs/ProjectTasksTab";
import ProjectKanbanTab from "./features/projects/tabs/ProjectKanbanTab";
import ProjectTimelineTab from "./features/projects/tabs/ProjectTimelineTab";
import ProjectMilestonesTab from "./features/projects/tabs/ProjectMilestonesTab";
import "vis-timeline/styles/vis-timeline-graph2d.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Strona główna */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Wszystko pod dashboardem (layout + ochrona) */}
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
          <Route path="fundings" element={<FundingsPage />} />
          <Route path="tasks" element={<TasksPage />} />

          {/* ✅ szczegóły projektu + zakładki (TU, wewnątrz /dashboard) */}
          <Route path="projects/:id" element={<ProjectDetailLayout />}>
            <Route index element={<ProjectOverviewTab />} />
            <Route path="overview" element={<ProjectOverviewTab />} />
            <Route path="fundings" element={<ProjectFundingsTab />} />
            <Route path="tasks" element={<ProjectTasksTab />} />
            <Route path="kanban" element={<ProjectKanbanTab />} />
            <Route path="timeline" element={<ProjectTimelineTab />} />
            <Route path="milestones" element={<ProjectMilestonesTab />} />
          </Route>
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
