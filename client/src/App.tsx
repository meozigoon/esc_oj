import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider } from "./auth";
import { RequireAdmin, RequireAuth } from "./components/RequireAuth";

const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const BenefitPage = lazy(() => import("./pages/BenefitPage"));
const ContestListPage = lazy(() => import("./pages/ContestListPage"));
const ContestDetailPage = lazy(() => import("./pages/ContestDetailPage"));
const ProblemDetailPage = lazy(() => import("./pages/ProblemDetailPage"));
const ProblemSubmissionsPage = lazy(
    () => import("./pages/ProblemSubmissionsPage"),
);
const SubmissionListPage = lazy(() => import("./pages/SubmissionListPage"));
const SubmissionDetailPage = lazy(() => import("./pages/SubmissionDetailPage"));
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage"));
const AdminContestsPage = lazy(() => import("./pages/admin/AdminContestsPage"));
const AdminContestDetailPage = lazy(
    () => import("./pages/admin/AdminContestDetailPage"),
);
const AdminProblemsPage = lazy(() => import("./pages/admin/AdminProblemsPage"));
const AdminProblemDetailPage = lazy(
    () => import("./pages/admin/AdminProblemDetailPage"),
);
const AdminSubmissionsPage = lazy(
    () => import("./pages/admin/AdminSubmissionsPage"),
);
const AdminSummaryPage = lazy(() => import("./pages/admin/AdminSummaryPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminAccessLogsPage = lazy(
    () => import("./pages/admin/AdminAccessLogsPage"),
);
const AdminMemoPage = lazy(() => import("./pages/admin/AdminMemoPage"));

export default function App() {
    return (
        <AuthProvider>
            <Suspense fallback={<div>Loading...</div>}>
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
                        <Route
                            path="problems/:id"
                            element={
                                <RequireAuth>
                                    <ProblemDetailPage />
                                </RequireAuth>
                            }
                        />
                        <Route
                            path="problems/:id/submissions"
                            element={
                                <RequireAuth>
                                    <ProblemSubmissionsPage />
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
                        <Route
                            path="admin/memo"
                            element={
                                <RequireAdmin>
                                    <AdminMemoPage />
                                </RequireAdmin>
                            }
                        />
                    </Route>
                </Routes>
            </Suspense>
        </AuthProvider>
    );
}
