import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Clock, FileUp, Paperclip, UploadCloud } from 'lucide-react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';
import { cn, formatDate, formatRelative } from '@/lib/utils';

interface AssignmentMeta {
  id: string;
  dueDate: string | null;
  maxScore: number;
  maxFileSizeMb: number;
  allowedFileTypes: string[] | null;
}

interface Submission {
  id: string;
  fileUrl: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  status: 'submitted' | 'graded';
  score: number | null;
  feedback: string | null;
  submittedAt: string;
}

interface AssignmentData {
  assignment: AssignmentMeta & { instructions?: string | null };
  mySubmission: Submission | null;
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AssignmentWidget({ lesson, assignment }: { lesson: any; assignment: AssignmentMeta }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assignment', assignment.id],
    queryFn: async () => {
      const { data } = await api.get<AssignmentData>(`/assignments/${assignment.id}`);
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`/assignments/${assignment.id}/submissions`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment', assignment.id] });
      setSelectedFile(null);
      toast('Tugas berhasil dikirim');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.error ?? 'Gagal mengirim tugas');
    },
  });

  const submission = data?.mySubmission;
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const isOverdue = !!dueDate && dueDate < new Date();
  const allowedTypes = assignment.allowedFileTypes ?? ['pdf', 'docx', 'zip'];

  const validateAndSelect = (file: File | undefined | null) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowedTypes.includes(ext)) {
      toast(`Tipe file .${ext} tidak diizinkan. Yang diizinkan: ${allowedTypes.join(', ')}`);
      return;
    }
    if (file.size > assignment.maxFileSizeMb * 1024 * 1024) {
      toast(`Ukuran file melebihi batas ${assignment.maxFileSizeMb} MB`);
      return;
    }
    setSelectedFile(file);
  };

  const instructions = lesson.content?.assignmentInstructions;

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Instruksi */}
      {instructions && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Instruksi Tugas</h2>
          <div className="text-sm leading-relaxed text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
            <div dangerouslySetInnerHTML={{ __html: instructions }} />
          </div>
        </Card>
      )}

      {/* Info tenggat */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {dueDate ? (
          <span className={cn('flex items-center gap-1.5', isOverdue && 'text-red-600')}>
            <CalendarClock className="h-3.5 w-3.5" /> Tenggat: {formatDate(dueDate)}
          </span>
        ) : (
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Tanpa tenggat</span>
        )}
        <span>Berformat: {allowedTypes.join(', ').toUpperCase()}</span>
        <span>Maks. {assignment.maxFileSizeMb} MB</span>
      </div>

      {/* Status submission */}
      {submission ? (
        <Card className={cn('p-5', submission.status === 'graded' && 'border-green-200 bg-green-50/40')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Paperclip className="h-5 w-5 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-foreground">{submission.fileName ?? 'File tugas'}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtSize(submission.fileSizeBytes ?? 0)} • dikirim {formatRelative(submission.submittedAt)}
                </p>
              </div>
            </div>
            {submission.status === 'graded' ? (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Dinilai: {submission.score}/{assignment.maxScore}
              </Badge>
            ) : (
              <Badge variant="warning">Menunggu penilaian</Badge>
            )}
          </div>

          {submission.status === 'graded' && submission.feedback && (
            <div className="mt-3 rounded-md border border-green-200 bg-background p-3 text-sm text-foreground">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Umpan balik pengajar</p>
              {submission.feedback}
            </div>
          )}

          <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline">
            Unduh file saya
          </a>
        </Card>
      ) : isOverdue ? (
        <Card className="border-red-200 bg-red-50/40 p-5 text-center">
          <p className="text-sm font-medium text-red-700">Tenggat submission sudah lewat.</p>
          <p className="mt-1 text-xs text-red-600">Hubungi pengajar jika Anda perlu perpanjangan waktu.</p>
        </Card>
      ) : (
        <>
          {/* Area upload */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); validateAndSelect(e.dataTransfer.files?.[0]); }}
            className={cn(
              'flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center transition-colors',
              dragOver ? 'border-primary-400 bg-primary-50' : 'border-border bg-muted/30',
            )}
          >
            <UploadCloud className="mb-2 h-10 w-10 text-muted-foreground" />
            {selectedFile ? (
              <>
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtSize(selectedFile.size)}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Seret file ke sini atau</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="h-4 w-4" /> Pilih File
                </Button>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={allowedTypes.map((t) => `.${t}`).join(',')}
            className="hidden"
            onChange={(e) => validateAndSelect(e.target.files?.[0])}
          />

          {selectedFile && (
            <div className="flex justify-end">
              <Button loading={submitMutation.isPending} onClick={() => submitMutation.mutate(selectedFile)}>
                Kirim Tugas
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
