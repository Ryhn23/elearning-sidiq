import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserCog, ShieldCheck, ShieldX, Plus, Download, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/useToast';
import { PageHeader } from '@/components/layout/PageHeader';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Modal create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher'>('student');

  // Modal edit
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'student' | 'teacher' | 'admin'>('student');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, role, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (role !== 'all') params.set('role', role);
      const res = await api.get<{ data: UserRow[]; pagination: { total: number; totalPages: number } }>(`/users?${params}`);
      return res.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (u: UserRow) => {
      const endpoint = u.isActive ? `/users/${u.id}/deactivate` : `/users/${u.id}/activate`;
      await api.patch(endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('Status user diperbarui');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal memperbarui status', 'error');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/users', {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      toast('User baru berhasil ditambahkan');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal menambahkan user', 'error');
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      await api.put(`/users/${editingUser.id}`, {
        name: editName.trim(),
        role: editRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      toast('Data user berhasil diperbarui');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal memperbarui user', 'error');
    },
  });

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await api.get('/users/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'users.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast('File CSV user berhasil diunduh');
    } catch {
      toast('Gagal mengunduh CSV user', 'error');
    } finally {
      setExporting(false);
    }
  };

  const users = data?.data ?? [];
  const totalUsers = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  const countStudents = users.filter((u) => u.role === 'student').length;
  const countTeachers = users.filter((u) => u.role === 'teacher').length;
  const countAdmins = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Standardized SIDIQ Page Header */}
      <PageHeader
        title="Manajemen Pengguna (User)"
        subtitle="Kelola akun, peran, dan otorisasi pengguna seluruh ekosistem pembelajaran SIDIQ."
        icon={UserCog}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold"
              loading={exporting}
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              className="gap-1.5 shadow-sm font-semibold"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" /> Tambah User
            </Button>
          </>
        }
      />

      {/* SIDIQ Metric Stat Tiles (Colored Left Border Pattern) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-primary">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Pengguna</span>
          <span className="text-2xl font-bold text-foreground">{totalUsers}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-emerald-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Santri / Siswa</span>
          <span className="text-2xl font-bold text-emerald-600">{role === 'student' ? totalUsers : countStudents}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-blue-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Asatidz / Guru</span>
          <span className="text-2xl font-bold text-blue-600">{role === 'teacher' ? totalUsers : countTeachers}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-amber-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Administrator</span>
          <span className="text-2xl font-bold text-amber-600">{role === 'admin' ? totalUsers : countAdmins}</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama atau email..."
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value as typeof role); setPage(1); }}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors h-10 w-full sm:w-auto"
          >
            <option value="all">Semua Peran (All)</option>
            <option value="student">Student (Santri / Siswa)</option>
            <option value="teacher">Teacher (Asatidz / Guru)</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {/* Table Container in SIDIQ Card Style */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-w-[calc(100vw-2rem)] md:max-w-full">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Tidak ada data pengguna yang cocok dengan kriteria pencarian.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center font-semibold">No.</TableHead>
                  <TableHead className="font-semibold">Nama Lengkap & Akun</TableHead>
                  <TableHead className="font-semibold">Peran</TableHead>
                  <TableHead className="font-semibold">Terdaftar</TableHead>
                  <TableHead className="font-semibold">Status Akun</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, idx) => (
                  <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-medium text-muted-foreground w-12 text-xs">
                      {(page - 1) * 15 + idx + 1}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-foreground text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === 'admin' ? 'destructive' : u.role === 'teacher' ? 'primary' : 'default'}
                        className="capitalize text-xs font-semibold"
                      >
                        {u.role === 'student' ? 'Santri' : u.role === 'teacher' ? 'Asatidz' : 'Admin'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {fmtDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                          <ShieldCheck className="h-3.5 w-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                          <ShieldX className="h-3.5 w-3.5" /> Nonaktif
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingUser(u);
                            setEditName(u.name);
                            setEditRole(u.role);
                          }}
                          title="Edit data pengguna"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        {u.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant={u.isActive ? 'outline' : 'secondary'}
                            className="h-8 text-xs font-semibold"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate(u)}
                          >
                            <UserCog className="mr-1 h-3.5 w-3.5" />
                            {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Standard Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border p-4 gap-3 text-xs text-muted-foreground">
          <p>
            Menampilkan <span className="font-semibold text-foreground">{users.length}</span> dari{' '}
            <span className="font-semibold text-foreground">{totalUsers}</span> pengguna
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs"
            >
              Sebelumnya
            </Button>
            <span className="text-xs font-semibold text-foreground px-2">
              Halaman {page} dari {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Tambah User */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4 pt-2"
          >
            <Input
              label="Nama Lengkap"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              required
            />
            <Input
              label="Alamat Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="budi@example.com"
              required
            />
            <Input
              label="Password Akun"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
            />
            <div>
              <label className="text-xs font-semibold text-foreground">Peran / Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors h-10"
              >
                <option value="student">Student (Santri / Siswa)</option>
                <option value="teacher">Teacher (Asatidz / Guru)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" loading={createMutation.isPending}>
                Simpan User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit User */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        {editingUser && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Data Pengguna</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate();
              }}
              className="space-y-4 pt-2"
            >
              <Input
                label="Nama Lengkap"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
              <div>
                <label className="text-xs font-semibold text-foreground">Peran / Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as typeof editRole)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors h-10"
                >
                  <option value="student">Student (Santri / Siswa)</option>
                  <option value="teacher">Teacher (Asatidz / Guru)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" loading={editMutation.isPending}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
