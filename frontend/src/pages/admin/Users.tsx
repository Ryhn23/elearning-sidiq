import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserCog, ShieldCheck, ShieldX, Plus, Download, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/useToast';

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
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Manajemen Pengguna (User)</h1>
          <p className="mt-1 text-xs text-muted-foreground">Kelola akun, peran, dan otorisasi pengguna seluruh platform.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            loading={exporting}
            onClick={handleExportCsv}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            size="sm"
            className="gap-1.5 shadow-xs"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4" /> Tambah User
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama atau email..."
            className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value as typeof role); setPage(1); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors"
        >
          <option value="all">Semua Role</option>
          <option value="student">Student (Santri / Siswa)</option>
          <option value="teacher">Teacher (Pengajar)</option>
          <option value="admin">Administrator</option>
        </select>
      </div>

      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : users.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada user yang cocok dengan pencarian.</p>
          ) : (
            <>
              <Table className="border-0 rounded-none">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama & Email</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-semibold text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'teacher' ? 'primary' : 'default'} className="capitalize">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                            <ShieldCheck className="h-3.5 w-3.5" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                            <ShieldX className="h-3.5 w-3.5" /> Nonaktif
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingUser(u);
                              setEditName(u.name);
                              setEditRole(u.role);
                            }}
                            title="Edit data user"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {u.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant={u.isActive ? 'outline' : 'secondary'}
                              disabled={toggleMutation.isPending}
                              onClick={() => toggleMutation.mutate(u)}
                            >
                              <UserCog className="h-3.5 w-3.5" /> {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border p-4">
                <p className="text-xs text-muted-foreground">Total {data?.pagination.total ?? 0} pengguna</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>
                    Sebelumnya
                  </Button>
                  <span className="text-xs font-semibold text-foreground px-2">{page} / {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>
                    Berikutnya
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah User using Radix Dialog */}
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
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors"
              >
                <option value="student">Student (Santri / Siswa)</option>
                <option value="teacher">Teacher (Pengajar)</option>
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

      {/* Modal Edit User using Radix Dialog */}
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
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors"
                >
                  <option value="student">Student (Santri / Siswa)</option>
                  <option value="teacher">Teacher (Pengajar)</option>
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
