import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';

interface AnnouncementItem {
  id: string; title: string; body: string; isPinned: boolean;
  createdAt: string; updatedAt: string; authorName?: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function AnnouncementPanel({ courseId, canManage }: { courseId: string; canManage: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['announcements', courseId] });

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', courseId],
    queryFn: async () => (await api.get(`/announcements/courses/${courseId}`)).data,
  });
  const announcements: AnnouncementItem[] = data?.announcements ?? [];

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setBody('');
    setIsPinned(false);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        await api.put(`/announcements/${editingId}`, { title, body, isPinned });
      } else {
        await api.post(`/announcements/courses/${courseId}`, { title, body, isPinned });
      }
    },
    onSuccess: () => {
      invalidate();
      resetForm();
      toast(editingId ? 'Pengumuman diperbarui' : 'Pengumuman dipublikasikan');
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan pengumuman', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      invalidate();
      toast('Pengumuman dihapus');
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menghapus', 'error'),
  });

  function startEdit(a: AnnouncementItem) {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setIsPinned(a.isPinned);
    setShowForm(true);
  }

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {canManage && !showForm && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Pengumuman Baru
          </Button>
        </div>
      )}

      {showForm && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{editingId ? 'Edit Pengumuman' : 'Pengumuman Baru'}</h3>
          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengumuman" />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Isi pengumuman..."
              rows={4}
              className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary-500 focus:outline-none"
            />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded border-border" />
              Sematkan di atas
            </label>
            <div className="flex gap-2">
              <Button size="sm" loading={saveMutation.isPending} disabled={!title.trim() || !body.trim()} onClick={() => saveMutation.mutate()}>
                {editingId ? 'Simpan Perubahan' : 'Publikasikan'}
              </Button>
              <Button variant="outline" size="sm" onClick={resetForm}>Batal</Button>
            </div>
          </div>
        </Card>
      )}

      {announcements.length === 0 ? (
        <Card className="flex flex-col items-center p-8 text-center">
          <Megaphone className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Belum ada pengumuman untuk kursus ini.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {a.isPinned && (
                        <Badge variant="warning" className="flex items-center gap-1"><Pin className="h-3 w-3" /> Disematkan</Badge>
                      )}
                      <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground/70">{fmtDate(a.createdAt)}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => startEdit(a)} aria-label="Edit" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm('Hapus pengumuman ini?')) deleteMutation.mutate(a.id); }}
                        aria-label="Hapus"
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
