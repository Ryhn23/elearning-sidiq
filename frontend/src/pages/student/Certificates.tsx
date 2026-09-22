import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Download, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';

interface CertRow {
  id: string;
  code: string;
  pdfUrl: string | null;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  instructorName: string | null;
}

interface EnrollmentRow {
  courseId: string;
  progress: number;
  status: string;
  course: { id: string; title: string };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function StudentCertificates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: certData, isLoading: certsLoading } = useQuery({
    queryKey: ['my-certificates'],
    queryFn: async () => {
      const res = await api.get<{ certificates: CertRow[] }>('/certificates/my');
      return res.data;
    },
  });

  const { data: enrollData, isLoading: enrollLoading } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const res = await api.get<{ data: EnrollmentRow[] }>('/enrollments/my');
      return res.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (courseId: string) => {
      await api.post(`/certificates/courses/${courseId}/generate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-certificates'] });
      toast('Sertifikat berhasil dibuat');
    },
    onError: (err) => {
      const axErr = err as Error & { response?: { data?: { error?: string } } };
      toast(axErr.response?.data?.error ?? 'Gagal membuat sertifikat', 'error');
    },
  });

  const certificates = certData?.certificates ?? [];
  const enrollments = enrollData?.data ?? [];
  const available = enrollments.filter(
    (e) => e.progress >= 100 && !certificates.some((c) => c.courseId === e.courseId),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Sertifikat Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sertifikat kelulusan kursus yang telah kamu selesaikan.</p>
      </div>

      {/* Tersedia untuk dibuat */}
      {available.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Sertifikat Tersedia</h2>
            <ul className="divide-y divide-border">
              {available.map((e) => (
                <li key={e.courseId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{e.course.title}</p>
                    <p className="text-xs text-muted-foreground">Progress 100% — siap dibuat</p>
                  </div>
                  <Button size="sm" loading={generateMutation.isPending} onClick={() => generateMutation.mutate(e.courseId)}>
                    <Award className="h-3.5 w-3.5" /> Buat Sertifikat
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Daftar sertifikat */}
      <Card>
        <CardContent>
          {certsLoading || enrollLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : certificates.length === 0 && available.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Award className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Belum ada sertifikat</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Selesaikan kursus hingga 100% untuk mendapatkan sertifikat kelulusan.
              </p>
            </div>
          ) : (
            <>
              {certificates.length > 0 && (
                <ul className="divide-y divide-border">
                  {certificates.map((c) => (
                    <li key={c.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{c.courseTitle}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Diterbitkan {fmtDate(c.issuedAt)} · Kode: <span className="font-mono">{c.code}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {c.pdfUrl && (
                          <a href={c.pdfUrl} target="_blank" rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted">
                            <Download className="h-3.5 w-3.5" /> Unduh PDF
                          </a>
                        )}
                        <Link to={`/verify/${c.code}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-primary-600 hover:bg-muted">
                          <ExternalLink className="h-3.5 w-3.5" /> Verifikasi
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {available.length === 0 && certificates.length > 0 && (
                <p className="mt-4 flex items-center gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Semua kursus selesai sudah memiliki sertifikat.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
