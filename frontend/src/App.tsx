import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/ui/Toast';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireRole } from '@/components/auth/RequireRole';
import { RoleDashboard } from '@/components/auth/RoleDashboard';
import { useSession } from '@/hooks/useSession';
import { useAuthStore } from '@/store/authStore';

const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const GoogleCallback = lazy(() => import('@/pages/GoogleCallback'));
const Profile = lazy(() => import('@/pages/Profile'));
const CourseCatalog = lazy(() => import('@/pages/CourseCatalog'));
const CourseDetail = lazy(() => import('@/pages/CourseDetail'));
const CoursePlayer = lazy(() => import('@/pages/CoursePlayer'));
const StudentDashboard = lazy(() => import('@/pages/student/Dashboard'));
const MyCourses = lazy(() => import('@/pages/student/MyCourses'));
const Grades = lazy(() => import('@/pages/student/Grades'));
const TeacherDashboard = lazy(() => import('@/pages/teacher/Dashboard'));
const Gradebook = lazy(() => import('@/pages/teacher/Gradebook'));
const CourseEditor = lazy(() => import('@/pages/teacher/CourseEditor'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminCourses = lazy(() => import('@/pages/admin/Courses'));
const AdminCategories = lazy(() => import('@/pages/admin/Categories'));
const AdminAnalytics = lazy(() => import('@/pages/admin/Analytics'));
const TeacherStudents = lazy(() => import('@/pages/teacher/Students'));
const StudentCertificates = lazy(() => import('@/pages/student/Certificates'));
const VerifyCertificate = lazy(() => import('@/pages/VerifyCertificate'));
const SsoLaunch = lazy(() => import('@/pages/SsoLaunch'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const StudentLayout = lazy(() => import('@/layouts/StudentLayout'));
const TeacherLayout = lazy(() => import('@/layouts/TeacherLayout'));
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));

function FullPageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  );
}

function LoginGate() {
  const token = useAuthStore((s) => s.token);
  return token ? <Navigate to="/dashboard" replace /> : <Login />;
}

function LandingGate() {
  const token = useAuthStore((s) => s.token);
  return token ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  const { restoring } = useSession();

  if (restoring) return <FullPageLoader />;

  return (
    <Suspense fallback={<FullPageLoader />}>
      <main>
        <Routes>
              {/* Public */}
              <Route path="/" element={<LandingGate />} />
              <Route path="/login" element={<LoginGate />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/google/callback" element={<GoogleCallback />} />
              <Route path="/sso/launch" element={<SsoLaunch />} />
              <Route path="/courses" element={<CourseCatalog />} />
              <Route path="/courses/:slug" element={<CourseDetail />} />
              <Route path="/verify/:code" element={<VerifyCertificate />} />

              {/* Authenticated */}
              <Route
                path="/courses/:slug/learn"
                element={
                  <RequireAuth>
                    <CoursePlayer />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <RoleDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />

              {/* Student */}
              <Route
                path="/student/*"
                element={
                  <RequireAuth>
                    <RequireRole role="student">
                      <StudentLayout />
                    </RequireRole>
                  </RequireAuth>
                }
              >
                <Route index element={<StudentDashboard />} />
                <Route path="courses" element={<MyCourses />} />
                <Route path="grades" element={<Grades />} />
                <Route path="certificates" element={<StudentCertificates />} />
              </Route>

              {/* Teacher */}
              <Route
                path="/teacher/*"
                element={
                  <RequireAuth>
                    <RequireRole role="teacher">
                      <TeacherLayout />
                    </RequireRole>
                  </RequireAuth>
                }
              >
                <Route index element={<TeacherDashboard />} />
                <Route path="courses/new" element={<CourseEditor />} />
                <Route path="courses/:courseId/edit" element={<CourseEditor />} />
                <Route path="courses/:courseId/students" element={<TeacherStudents />} />
                <Route path="courses/:courseId/gradebook" element={<Gradebook />} />
              </Route>

              {/* Admin */}
              <Route
                path="/admin/*"
                element={
                  <RequireAuth>
                    <RequireRole role="admin">
                      <AdminLayout />
                    </RequireRole>
                  </RequireAuth>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="courses" element={<AdminCourses />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="analytics" element={<AdminAnalytics />} />
              </Route>

              {/* Fallback & Root */}
              <Route path="/unauth" element={<RequireAuth><Navigate to="/login" replace /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </Suspense>
  );
}
