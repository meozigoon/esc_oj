import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider } from './auth';
import { RequireAdmin, RequireAuth } from './components/RequireAuth';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import BenefitPage from './pages/BenefitPage';
import ContestListPage from './pages/ContestListPage';
import ContestDetailPage from './pages/ContestDetailPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import ProblemSubmissionsPage from './pages/ProblemSubmissionsPage';
import SubmitPage from './pages/SubmitPage';
import SubmissionListPage from './pages/SubmissionListPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage';
import AdminHomePage from './pages/admin/AdminHomePage';
import AdminContestsPage from './pages/admin/AdminContestsPage';
import AdminContestDetailPage from './pages/admin/AdminContestDetailPage';
import AdminProblemsPage from './pages/admin/AdminProblemsPage';
import AdminProblemDetailPage from './pages/admin/AdminProblemDetailPage';
import AdminSubmissionsPage from './pages/admin/AdminSubmissionsPage';
import AdminSummaryPage from './pages/admin/AdminSummaryPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAccessLogsPage from './pages/admin/AdminAccessLogsPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route
            path="benefit"
            element={
              <RequireAuth>
                <BenefitPage />
              </RequireAuth>
            }
          />
          <Route
            path="contests"
            element={
              <RequireAuth>
                <ContestListPage />
              </RequireAuth>
            }
          />
          <Route
            path="contests/:id"
            element={
              <RequireAuth>
                <ContestDetailPage />
              </RequireAuth>
            }
          />
          <Route path="problems/:id" element={<ProblemDetailPage />} />
          <Route
            path="problems/:id/submissions"
            element={
              <RequireAuth>
                <ProblemSubmissionsPage />
              </RequireAuth>
            }
          />
          <Route
            path="submit/:problemId"
            element={
              <RequireAuth>
                <SubmitPage />
              </RequireAuth>
            }
          />
          <Route
            path="submissions"
            element={
              <RequireAuth>
                <SubmissionListPage />
              </RequireAuth>
            }
          />
          <Route
            path="submissions/:id"
            element={
              <RequireAuth>
                <SubmissionDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminHomePage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/contests"
            element={
              <RequireAdmin>
                <AdminContestsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/contests/:id"
            element={
              <RequireAdmin>
                <AdminContestDetailPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/problems"
            element={
              <RequireAdmin>
                <AdminProblemsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/problems/:id"
            element={
              <RequireAdmin>
                <AdminProblemDetailPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/submissions"
            element={
              <RequireAdmin>
                <AdminSubmissionsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/summary"
            element={
              <RequireAdmin>
                <AdminSummaryPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/users"
            element={
              <RequireAdmin>
                <AdminUsersPage />
              </RequireAdmin>
            }
          />
          <Route
            path="admin/access-logs"
            element={
              <RequireAdmin>
                <AdminAccessLogsPage />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
