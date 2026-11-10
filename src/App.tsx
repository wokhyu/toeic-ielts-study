import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider.tsx';
import { RequireAdmin, RequireAuth, RequireCourse } from './components/guards.tsx';
import { Layout } from './components/Layout.tsx';
import { Spinner } from './components/ui.tsx';
import type { Program } from './content/schema.ts';
import { LoginPage } from './pages/auth/LoginPage.tsx';
import { RegisterPage } from './pages/auth/RegisterPage.tsx';
import { CoursesPage } from './pages/CoursesPage.tsx';
import { OtLayout } from './pages/ot/OtLayout.tsx';
import { RoadmapLayout } from './pages/roadmap/RoadmapLayout.tsx';

// Course and admin pages load on demand so the first page stays small.
const AdminReviewPage = lazy(() =>
  import('./pages/admin/AdminReviewPage.tsx').then((m) => ({ default: m.AdminReviewPage })),
);
const AdminUserPage = lazy(() =>
  import('./pages/admin/AdminUserPage.tsx').then((m) => ({ default: m.AdminUserPage })),
);
const AdminUsersPage = lazy(() =>
  import('./pages/admin/AdminUsersPage.tsx').then((m) => ({ default: m.AdminUsersPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage.tsx').then((m) => ({ default: m.ResetPasswordPage })),
);
const OtExamPage = lazy(() => import('./pages/ot/OtExamPage.tsx').then((m) => ({ default: m.OtExamPage })));
const OtExamSetupPage = lazy(() =>
  import('./pages/ot/OtExamSetupPage.tsx').then((m) => ({ default: m.OtExamSetupPage })),
);
const OtHomePage = lazy(() => import('./pages/ot/OtHomePage.tsx').then((m) => ({ default: m.OtHomePage })));
const OtPracticePage = lazy(() =>
  import('./pages/ot/OtPracticePage.tsx').then((m) => ({ default: m.OtPracticePage })),
);
const OtResultPage = lazy(() =>
  import('./pages/ot/OtResultPage.tsx').then((m) => ({ default: m.OtResultPage })),
);
const OtReviewPage = lazy(() =>
  import('./pages/ot/OtReviewPage.tsx').then((m) => ({ default: m.OtReviewPage })),
);
const FlashcardsPage = lazy(() =>
  import('./pages/roadmap/FlashcardsPage.tsx').then((m) => ({ default: m.FlashcardsPage })),
);
const LeaderboardPage = lazy(() =>
  import('./pages/roadmap/LeaderboardPage.tsx').then((m) => ({ default: m.LeaderboardPage })),
);
const PlacementPage = lazy(() =>
  import('./pages/roadmap/PlacementPage.tsx').then((m) => ({ default: m.PlacementPage })),
);
const RoadmapPage = lazy(() =>
  import('./pages/roadmap/RoadmapPage.tsx').then((m) => ({ default: m.RoadmapPage })),
);
const ScoresPage = lazy(() =>
  import('./pages/roadmap/ScoresPage.tsx').then((m) => ({ default: m.ScoresPage })),
);
const TodayPage = lazy(() => import('./pages/roadmap/TodayPage.tsx').then((m) => ({ default: m.TodayPage })));

function roadmapRoutes(program: Program) {
  return (
    <>
      <Route
        path={`c/${program}`}
        element={
          <RequireAuth>
            <RequireCourse course={program}>
              <RoadmapLayout program={program} preview={false} />
            </RequireCourse>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="hom-nay" replace />} />
        <Route path="hom-nay" element={<TodayPage />} />
        <Route path="lo-trinh" element={<RoadmapPage />} />
        <Route path="bai-test" element={<PlacementPage />} />
        <Route path="flashcard" element={<FlashcardsPage />} />
        <Route path="diem-thi-thu" element={<ScoresPage />} />
        <Route path="xep-hang" element={<LeaderboardPage />} />
      </Route>
      <Route path={`xem-truoc/${program}`} element={<RoadmapLayout program={program} preview />}>
        <Route index element={<Navigate to="lo-trinh" replace />} />
        <Route path="lo-trinh" element={<RoadmapPage />} />
        <Route path="bai-test" element={<PlacementPage />} />
      </Route>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/khoa-hoc" replace />} />
              <Route path="khoa-hoc" element={<CoursesPage />} />
              <Route path="dang-nhap" element={<LoginPage />} />
              <Route path="dang-ky" element={<RegisterPage />} />
              <Route
                path="doi-mat-khau"
                element={
                  <RequireAuth>
                    <ResetPasswordPage />
                  </RequireAuth>
                }
              />

              {roadmapRoutes('toeic')}
              {roadmapRoutes('ielts')}

              <Route
                path="c/on-tap-11"
                element={
                  <RequireAuth>
                    <RequireCourse course="on-tap-11">
                      <OtLayout />
                    </RequireCourse>
                  </RequireAuth>
                }
              >
                <Route index element={<OtHomePage />} />
                <Route path="chu-de/:topicId" element={<OtPracticePage />} />
                <Route path="thi-thu" element={<OtExamSetupPage />} />
                <Route path="thi-thu/:attemptId" element={<OtExamPage />} />
                <Route path="ket-qua/:attemptId" element={<OtResultPage />} />
                <Route path="on-lai" element={<OtReviewPage />} />
              </Route>

              <Route
                path="admin"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <AdminUsersPage />
                    </RequireAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="admin/nguoi-dung/:userId"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <AdminUserPage />
                    </RequireAdmin>
                  </RequireAuth>
                }
              />
              <Route
                path="admin/duyet-dap-an"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <AdminReviewPage />
                    </RequireAdmin>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/khoa-hoc" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
  );
}
