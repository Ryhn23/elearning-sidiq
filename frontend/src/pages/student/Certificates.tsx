import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Download, ExternalLink } from 'lucide-react';
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
        <p className="mt-1 text-xs text-muted-foreground">Sertifikat kelulusan digital resmi dengan kode verifikasi QR.</p>
      </div>

      {/* Tersedia untuk dibuat */}
      {available.length > 0 && (
        <Card className="rounded-xl border-primary/20 bg-primary-50/30 dark:bg-primary-950/20">
          <CardContent className="p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Sertifikat Siap Diterbitkan</h2>
            <ul className="divide-y divide-border">
              {available.map((e) => (
                <li key={e.courseId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{e.course.title}</p>
                    <p className="text-xs text-muted-foreground">Progress 100% — Seluruh materi telah diselesaikan</p>
                  </div>
                  <Button size="sm" loading={generateMutation.isPending} onClick={() => generateMutation.mutate(e.courseId)} className="gap-1.5 shadow-xs">
                    <Award className="h-3.5 w-3.5" /> Buat Sertifikat
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Daftar sertifikat */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          {certsLoading || enrollLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : certificates.length === 0 && available.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                <Award className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-foreground">Belum ada sertifikat</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Selesaikan semua materi dan ujian kursus hingga 100% untuk mendapatkan sertifikat kelulusan ber-QR resmi.
              </p>
            </div>
          ) : (
            <>
              {certificates.length > 0 && (
                <ul className="divide-y divide-border">
                  {certificates.map((c) => (
                    <li key={c.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Award className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="truncate text-sm font-bold text-foreground">{c.courseTitle}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>No: <code className="font-mono font-medium text-foreground">{c.code}</code></span>
                            <span>•</span>
                            <span>Terbit: {fmtDate(c.issuedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Link to={`/verify/${c.code}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="gap-1 text-xs">
                            <ExternalLink className="h-3.5 w-3.5" /> Verifikasi QR
                          </Button>
                        </Link>
                        {c.pdfUrl && (
                          <a href={c.pdfUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="gap-1 text-xs">
                              <Download className="h-3.5 w-3.5" /> Unduh PDF
                            </Button>
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
