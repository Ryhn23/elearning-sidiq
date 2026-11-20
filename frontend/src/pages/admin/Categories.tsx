import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Manajemen Kategori Kursus</h1>
        <p className="mt-1 text-xs text-muted-foreground">Kelola taksonomi kategori materi pembelajaran platform.</p>
      </div>

      {/* Form tambah */}
      <Card className="rounded-xl">
        <CardContent className="p-5">
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div>
              <label htmlFor="cat-name" className="mb-1.5 block text-xs font-semibold text-foreground">Nama Kategori</label>
              <input
                id="cat-name"
                value={name}
                onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }}
                placeholder="mis. Tahfidz & Quran"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label htmlFor="cat-slug" className="mb-1.5 block text-xs font-semibold text-foreground">Slug URL</label>
              <input
                id="cat-slug"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                placeholder="tahfidz-quran"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <Button type="submit" loading={createMutation.isPending} disabled={!name.trim()} className="h-10 gap-1.5 shadow-xs">
              <Plus className="h-4 w-4" /> Tambah Kategori
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">Belum ada kategori.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((cat) => (
                <li key={cat.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0">
                  {editingId === cat.id ? (
                    <div className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_80px_auto] sm:items-center">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Nama kategori"
                        className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" />
                      <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Deskripsi (opsional)" aria-label="Deskripsi kategori"
                        className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" />
                      <input type="number" min={0} value={editSortOrder} onChange={(e) => setEditSortOrder(Number(e.target.value))} aria-label="Urutan"
                        className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" />
                      <div className="flex gap-1.5">
                        <Button size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: cat.id, name: editName, description: editDescription, sortOrder: editSortOrder })}>
                          <Check className="h-3.5 w-3.5" /> Simpan
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" /> Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm">{cat.name}</p>
                        <p className="truncate text-xs text-muted-foreground">/{cat.slug}{cat.description ? ` — ${cat.description}` : ''}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">urutan {cat.sortOrder}</span>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditDescription(cat.description ?? ''); setEditSortOrder(cat.sortOrder); }}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(cat.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
