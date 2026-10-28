import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, BookOpen, FolderOpen, UserCheck, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface OverviewData {
  totals: { users: number; teachers: number; publishedCourses: number; enrollments: number; completedEnrollments: number };
  thisMonth: { newUsers: number; newEnrollments: number };
  topCourses: { id: string; title: string; slug: string; totalEnrolled: number }[];
  recentEnrollments: { userId: string; courseTitle: string; enrolledAt: string }[];
}

interface UsersResponse {
  data: unknown[];
  pagination: { total: number; totalPages: number };
}

interface CoursesResponse {
  data: unknown[];
  pagination: { total: number; totalPages: number };
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await api.get<OverviewData>('/analytics/overview');
      return res.data;
    },
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users-count'],
    queryFn: async () => {
      const res = await api.get<UsersResponse>(`/users?page=1&limit=1`);
      return res.data;
    },
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['admin-courses-count'],
    queryFn: async () => {
      const res = await api.get<CoursesResponse>(`/courses/admin/all?status=published&limit=1`);
      return res.data;
    },
  });

  const totals = data?.totals;

  const stats = [
    { label: 'Total Pengguna', value: usersData?.pagination?.total ?? totals?.users ?? 0, icon: <Users className="h-5 w-5" />, color: 'text-primary-600 bg-primary-50', to: '/admin/users' },
    { label: 'Pengajar', value: totals?.teachers ?? 0, icon: <ShieldCheck className="h-5 w-5" />, color: 'text-purple-600 bg-purple-50', to: '/admin/users' },
    { label: 'Kursus Terbit', value: coursesData?.pagination?.total ?? totals?.publishedCourses ?? 0, icon: <BookOpen className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50', to: '/admin/courses' },
    { label: 'Total Enrollment', value: totals?.enrollments ?? 0, icon: <UserCheck className="h-5 w-5" />, color: 'text-green-600 bg-green-50', to: '/admin/analytics' },
  ];

  const quickActions = [
    { title: 'Manajemen User', description: 'Buat, edit, aktifkan & kelola akun pengguna.', to: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { title: 'Manajemen Kursus', description: 'Review, publish & kelola kurikulum kursus.', to: '/admin/courses', icon: <BookOpen className="h-5 w-5" /> },
    { title: 'Kategori', description: 'Kelola kategori & tag kursus.', to: '/admin/categories', icon: <FolderOpen className="h-5 w-5" /> },
    { title: 'Analitik', description: 'Pantau performa & metrik platform.', to: '/admin/analytics', icon: <UserCheck className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Dashboard Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan platform e-learning.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading || usersLoading || coursesLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
                  <div className="space-y-2">
                    <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </Card>
            ))}
          </>
        ) : (
          stats.map((s) => (
            <Link key={s.label} to={s.to} className="block rounded-lg">
              <Card className="p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md ${s.color}`}>{s.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Completion overview */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Penerimaan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <p className="text-2xl font-bold text-foreground">{data.totals.enrollments}</p>
                <p className="text-xs text-muted-foreground">Total Enrollment</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{data.totals.completedEnrollments}</p>
                <p className="text-xs text-muted-foreground">Selesai</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {data.totals.enrollments > 0 ? Math.round((data.totals.completedEnrollments / data.totals.enrollments) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Tingkat Kelulusan</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{data.thisMonth.newUsers}</p>
                <p className="text-xs text-muted-foreground">User Baru Bulan Ini</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manajemen Platform</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || usersLoading || coursesLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {quickActions.map((a) => (
                <Link key={a.title} to={a.to} className="group rounded-lg border border-border p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                      {a.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
