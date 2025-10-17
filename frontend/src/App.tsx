import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import ProjectsPage from "./features/projects/ProjectsPage";
import LoginPage from "./features/auth/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import ProjectEditPage from "./features/projects/ProjectEditPage";
import { Toaster } from "react-hot-toast";

function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Home</h1>
      <p>
        <Link to="/projects">Idź do projektów →</Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id/edit"
          element={
            <ProtectedRoute>
              <ProjectEditPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}
