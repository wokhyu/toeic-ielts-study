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
import { BankLayout } from './features/bank/BankLayout.tsx';
import { RoadmapLayout } from './pages/roadmap/RoadmapLayout.tsx';

// Course and admin pages load on demand so the first page stays small.
const AdminReviewPage = lazy(() =>
  import('./pages/admin/AdminReviewPage.tsx').then((m) => ({ default: m.AdminReviewPage })),
);
const AdminUserPage = lazy(() =>
  import('./pages/admin/AdminUserPage.tsx').then((m) => ({ default: m.AdminUserPage })),
);
const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout.tsx').then((m) => ({ default: m.AdminLayout })),
);
const AdminOverviewPage = lazy(() =>
  import('./pages/admin/AdminOverviewPage.tsx').then((m) => ({ default: m.AdminOverviewPage })),
);
const AdminLearnersPage = lazy(() =>
  import('./pages/admin/AdminLearnersPage.tsx').then((m) => ({ default: m.AdminLearnersPage })),
);
const AdminItemsPage = lazy(() =>
  import('./pages/admin/AdminItemsPage.tsx').then((m) => ({ default: m.AdminItemsPage })),
);
const AdminUsersPage = lazy(() =>
  import('./pages/admin/AdminUsersPage.tsx').then((m) => ({ default: m.AdminUsersPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage.tsx').then((m) => ({ default: m.ResetPasswordPage })),
);
const BankHomePage = lazy(() =>
  import('./features/bank/BankHomePage.tsx').then((m) => ({ default: m.BankHomePage })),
);
const ExamPage = lazy(() => import('./features/bank/ExamPage.tsx').then((m) => ({ default: m.ExamPage })));
const ExamSetupPage = lazy(() =>
  import('./features/bank/ExamSetupPage.tsx').then((m) => ({ default: m.ExamSetupPage })),
);
const PracticePage = lazy(() =>
  import('./features/bank/PracticePage.tsx').then((m) => ({ default: m.PracticePage })),
);
const ResultPage = lazy(() =>
  import('./features/bank/ResultPage.tsx').then((m) => ({ default: m.ResultPage })),
);
const ReviewPage = lazy(() =>
  import('./features/bank/ReviewPage.tsx').then((m) => ({ default: m.ReviewPage })),
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
const ProgressTab = lazy(() =>
  import('./pages/roadmap/ProgressTab.tsx').then((m) => ({ default: m.ProgressTab })),
);
const BankProgressPage = lazy(() =>
  import('./features/bank/BankProgressPage.tsx').then((m) => ({ default: m.BankProgressPage })),
);

/** Practice, exams and review of a course's question bank, under its own route prefix. */
function bankRoutes() {
  return (
    <>
      <Route index element={<BankHomePage />} />
      <Route path="chu-de/:topicId" element={<PracticePage />} />
      <Route path="the/:tag" element={<PracticePage />} />
      <Route path="thi-thu" element={<ExamSetupPage />} />
      <Route path="thi-thu/:attemptId" element={<ExamPage />} />
      <Route path="ket-qua/:attemptId" element={<ResultPage />} />
      <Route path="on-lai" element={<ReviewPage />} />
      <Route path="tien-bo" element={<BankProgressPage />} />
    </>
  );
}

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
        <Route path="tien-bo" element={<ProgressTab />} />
        <Route path="luyen" element={<BankLayout course={program} base={`/c/${program}/luyen`} />}>
          {bankRoutes()}
        </Route>
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
                      <BankLayout course="on-tap-11" base="/c/on-tap-11" title="Ôn tập Toán · Lý · Hóa 11" />
                    </RequireCourse>
                  </RequireAuth>
                }
              >
                {bankRoutes()}
              </Route>

              <Route
                path="admin"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <AdminLayout />
                    </RequireAdmin>
                  </RequireAuth>
                }
              >
                <Route index element={<AdminOverviewPage />} />
                <Route path="hoc-vien" element={<AdminLearnersPage />} />
                <Route path="cau-hoi" element={<AdminItemsPage />} />
                <Route path="tai-khoan" element={<AdminUsersPage />} />
                <Route path="duyet-dap-an" element={<AdminReviewPage />} />
                <Route path="nguoi-dung/:userId" element={<AdminUserPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/khoa-hoc" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
  );
}
