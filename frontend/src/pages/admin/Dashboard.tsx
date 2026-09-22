import { Users, BookOpen, FolderOpen, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function AdminDashboard() {
  const stats = [
    { label: 'Total Pengguna', value: '—', icon: <Users className="h-5 w-5" /> },
    { label: 'Total Kursus', value: '—', icon: <BookOpen className="h-5 w-5" /> },
    { label: 'Kategori', value: '—', icon: <FolderOpen className="h-5 w-5" /> },
    { label: 'Enrollment Aktif', value: '—', icon: <UserCheck className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Dashboard Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan platform e-learning.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manajemen Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Panel administrasi akan tersedia segera</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Manajemen pengguna, kategori, dan kursus platform sedang dalam pengembangan.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
