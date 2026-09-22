import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserCog, ShieldCheck, ShieldX, Plus, Download, Pencil, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
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
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Manajemen User</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola akun dan otorisasi pengguna platform.</p>
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
            className="gap-1.5"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4" /> Tambah User
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama atau email..."
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary-500"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value as typeof role); setPage(1); }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary-500"
        >
          <option value="all">Semua Role</option>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : users.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada user yang cocok.</p>
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto sm:-mx-6">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium sm:px-6">Nama & Email</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Terdaftar</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-6">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 sm:px-6">
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'teacher' ? 'primary' : 'default'}>{u.role}</Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                        <td className="px-3 py-3">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><ShieldCheck className="h-3.5 w-3.5" /> Aktif</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500"><ShieldX className="h-3.5 w-3.5" /> Nonaktif</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right sm:px-6">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">{data?.pagination.total ?? 0} user</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
                  <span className="self-center text-xs text-muted-foreground">{page}/{totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl text-card-foreground animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-foreground">Tambah Pengguna Baru</h3>
            <p className="mt-1 text-xs text-muted-foreground">Buat akun untuk siswa atau pengajar baru.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="mt-4 space-y-4"
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
                <label className="text-sm font-medium text-foreground">Peran / Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary-500"
                >
                  <option value="student">Student (Siswa)</option>
                  <option value="teacher">Teacher (Pengajar)</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" loading={createMutation.isPending}>
                  Simpan User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl text-card-foreground animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-foreground">Edit Data Pengguna</h3>
            <p className="mt-1 text-xs text-muted-foreground">{editingUser.email}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <Input
                label="Nama Lengkap"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
              <div>
                <label className="text-sm font-medium text-foreground">Peran / Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as typeof editRole)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary-500"
                >
                  <option value="student">Student (Siswa)</option>
                  <option value="teacher">Teacher (Pengajar)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" loading={editMutation.isPending}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
