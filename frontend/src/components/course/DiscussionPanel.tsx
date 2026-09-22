import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Pin, Plus, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';

interface AuthorRef { id: string; name: string }
interface ReplyItem {
  id: string; content: string; createdAt: string;
  author: AuthorRef; isEdited?: boolean;
}
interface ThreadItem {
  id: string; title: string; content: string; lessonId: string | null;
  lessonTitle: string | null; isPinned: boolean; replyCount: number;
  createdAt: string; updatedAt: string; author: AuthorRef;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DiscussionPanel({ courseId, canModerate }: { courseId: string; canModerate: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['discussions', courseId] });

  // List threads
  const { data: listData, isLoading } = useQuery({
    queryKey: ['discussions', courseId],
    queryFn: async () => (await api.get(`/discussions/courses/${courseId}`)).data,
    enabled: !selectedId,
  });
  const threads: ThreadItem[] = listData?.threads ?? [];

  // Detail thread + replies
  const { data: detailData } = useQuery({
    queryKey: ['discussion', selectedId],
    queryFn: async () => (await api.get(`/discussions/${selectedId}`)).data,
    enabled: !!selectedId,
  });
  const thread: ThreadItem | undefined = detailData?.thread;
  const replies: ReplyItem[] = detailData?.replies ?? [];

  // Create thread
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const createMutation = useMutation({
    mutationFn: () => api.post(`/discussions/courses/${courseId}`, { title, content }),
    onSuccess: (res) => {
      invalidate();
      setShowNewForm(false);
      setTitle('');
      setContent('');
      toast('Thread berhasil dibuat');
      setSelectedId(res.data.id as string);
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal membuat thread', 'error'),
  });

  // Reply
  const [replyText, setReplyText] = useState('');
  const replyMutation = useMutation({
    mutationFn: () => api.post(`/discussions/${selectedId}/replies`, { content: replyText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussion', selectedId] });
      setReplyText('');
      toast('Balasan terkirim');
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal mengirim balasan', 'error'),
  });

  // Pin toggle
  const pinMutation = useMutation({
    mutationFn: () => api.patch(`/discussions/${selectedId}/pin`),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['discussion', selectedId] });
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  // ===== View detail thread =====
  if (selectedId && thread) {
    return (
      <Card className="p-5">
        <button onClick={() => setSelectedId(null)} className="mb-4 flex items-center gap-1 text-sm text-primary-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar diskusi
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            {thread.isPinned && (
              <Badge variant="warning" className="mb-2 flex items-center gap-1"><Pin className="h-3 w-3" /> Disematkan</Badge>
            )}
            <h3 className="text-lg font-semibold text-foreground">{thread.title}</h3>
            {thread.lessonTitle && (
              <p className="mt-1 text-xs text-muted-foreground">Pelajaran: {thread.lessonTitle}</p>
            )}
          </div>
          {canModerate && (
            <Button variant="outline" size="sm" loading={pinMutation.isPending} onClick={() => pinMutation.mutate()}>
              <Pin className="h-3.5 w-3.5" /> {thread.isPinned ? 'Lepas Sematan' : 'Sematkan'}
            </Button>
          )}
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Oleh <span className="font-medium text-foreground">{thread.author.name}</span> • {fmtDate(thread.createdAt)}
        </p>
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
          {thread.content}
        </p>

        {/* Replies */}
        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold text-foreground">{replies.length} Balasan</h4>
          <ul className="space-y-3">
            {replies.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-3">
                <p className="text-xs font-medium text-foreground">{r.author.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(r.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{r.content}</p>
              </li>
            ))}
          </ul>

          {/* Form balasan */}
          <div className="mt-4">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Tulis balasan..."
              rows={3}
              className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary-500 focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" loading={replyMutation.isPending} disabled={!replyText.trim()} onClick={() => replyMutation.mutate()}>
                <Send className="h-3.5 w-3.5" /> Kirim Balasan
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ===== View list threads =====
  return (
    <div className="space-y-4">
      {showNewForm ? (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Thread Baru</h3>
          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pertanyaan" />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis pertanyaan atau diskusi Anda..."
              rows={4}
              className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <Button size="sm" loading={createMutation.isPending} disabled={!title.trim() || !content.trim()} onClick={() => createMutation.mutate()}>
                Kirim Thread
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowNewForm(false)}>Batal</Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{threads.length} thread diskusi</p>
          <Button size="sm" onClick={() => setShowNewForm(true)}>
            <Plus className="h-4 w-4" /> Thread Baru
          </Button>
        </div>
      )}

      {threads.length === 0 && !showNewForm ? (
        <Card className="flex flex-col items-center p-8 text-center">
          <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Belum ada diskusi. Jadilah yang pertama bertanya!</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.id}>
              <button onClick={() => setSelectedId(t.id)} className="w-full rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/30">
                <div className="flex items-center gap-2">
                  {t.isPinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  <p className="flex-1 truncate text-sm font-medium text-foreground">{t.title}</p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" /> {t.replyCount}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.content}</p>
                <p className="mt-2 text-xs text-muted-foreground/70">
                  {t.author.name} • {fmtDate(t.createdAt)}
                  {t.lessonTitle && ` • ${t.lessonTitle}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
