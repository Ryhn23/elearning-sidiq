import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Check, X, FolderOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useToast } from '@/components/ui/useToast';
import { PageHeader } from '@/components/layout/PageHeader';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Create form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSortOrder, setEditSortOrder] = useState(0);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<CategoryRow[]>('/categories');
      return res.data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const finalSlug = slug.trim() || slugify(name);
      await api.post('/categories', { name, slug: finalSlug, description: description || undefined });
    },
    onSuccess: () => {
      invalidate();
      setName(''); setSlug(''); setDescription(''); setSlugTouched(false);
      toast('Kategori berhasil ditambahkan');
    },
    onError: (err) => {
      const axErr = err as Error & { response?: { data?: { error?: string } } };
      toast(axErr.response?.data?.error ?? 'Gagal menambah kategori', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, description, sortOrder }: { id: string; name: string; description: string; sortOrder: number }) => {
      await api.put(`/categories/${id}`, { name, description, sortOrder });
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast('Kategori berhasil diperbarui');
    },
    onError: (err) => {
      const axErr = err as Error & { response?: { data?: { error?: string } } };
      toast(axErr.response?.data?.error ?? 'Gagal memperbarui kategori', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast('Kategori dihapus');
    },
    onError: (err) => {
      const axErr = err as Error & { response?: { data?: { error?: string } } };
      toast(axErr.response?.data?.error ?? 'Gagal menghapus kategori', 'error');
    },
  });

  const list = categories ?? [];

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Page Header */}
      <PageHeader
        title="Manajemen Kategori Kursus"
        subtitle="Kelola taksonomi rumpun ilmu, bidang studi, dan pengelompokan silabus pesantren."
        icon={FolderOpen}
      />

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-primary">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Kategori</span>
          <span className="text-2xl font-bold text-foreground">{list.length}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-emerald-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Status Taksonomi</span>
          <span className="text-2xl font-bold text-emerald-600">Aktif Terhubung</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-blue-500 col-span-2 md:col-span-1">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Sinkronisasi Mapel</span>
          <span className="text-2xl font-bold text-blue-600">SIDIQ Akademik</span>
        </div>
      </div>

      {/* Form Tambah Kategori */}
      <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Tambah Rumpun Kategori Baru
        </h3>
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end pt-1"
        >
          <div>
            <label htmlFor="cat-name" className="mb-1.5 block text-xs font-semibold text-foreground">
              Nama Kategori
            </label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }}
              placeholder="mis. Tahfidz & Al-Quran"
              className="rounded-xl"
            />
          </div>
          <div>
            <label htmlFor="cat-slug" className="mb-1.5 block text-xs font-semibold text-foreground">
              Slug URL
            </label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="tahfidz-al-quran"
              className="rounded-xl font-mono text-xs"
            />
          </div>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={!name.trim()}
            className="h-10 gap-1.5 shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Simpan
          </Button>
        </form>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-w-[calc(100vw-2rem)] md:max-w-full">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Belum ada kategori yang dibuat.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center font-semibold">No.</TableHead>
                  <TableHead className="font-semibold">Nama Kategori</TableHead>
                  <TableHead className="font-semibold">Slug URL</TableHead>
                  <TableHead className="font-semibold text-center">Urutan</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c, idx) => (
                  <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-medium text-muted-foreground w-12 text-xs">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      {editingId === c.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      ) : (
                        <p className="font-semibold text-foreground text-sm">{c.name}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{c.slug}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {editingId === c.id ? (
                        <Input
                          type="number"
                          value={editSortOrder}
                          onChange={(e) => setEditSortOrder(Number(e.target.value))}
                          className="h-8 w-16 text-xs mx-auto text-center"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">{c.sortOrder}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === c.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            className="h-8 w-8 p-0"
                            loading={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: c.id, name: editName, description: editDescription, sortOrder: editSortOrder })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditName(c.name);
                              setEditDescription(c.description || '');
                              setEditSortOrder(c.sortOrder);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            loading={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm(`Hapus kategori "${c.name}"?`)) deleteMutation.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
