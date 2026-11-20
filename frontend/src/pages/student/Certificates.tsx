import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Download, ExternalLink, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';
import { PageHeader } from '@/components/layout/PageHeader';

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
    <div className="space-y-6 w-full pb-8">
      {/* Standard Page Header */}
      <PageHeader
        title="Sertifikat Digital Saya"
        subtitle="Unduh dan cetak sertifikat kelulusan digital resmi dengan kode verifikasi QR terintegrasi SIDIQ."
        icon={Award}
        breadcrumbs={
          <Link to="/student" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Dasbor Santri
          </Link>
        }
      />

      {/* Tersedia untuk dibuat */}
      {available.length > 0 && (
        <Card className="rounded-xl border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Sertifikat Siap Diterbitkan</h2>
            <ul className="divide-y divide-border/60">
              {available.map((e) => (
                <li key={e.courseId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{e.course.title}</p>
                    <p className="text-xs text-muted-foreground">Progress 100% — Seluruh silabus telah tuntas diselesaikan</p>
                  </div>
                  <Button size="sm" loading={generateMutation.isPending} onClick={() => generateMutation.mutate(e.courseId)} className="gap-1.5 shadow-sm font-semibold">
                    <Award className="h-3.5 w-3.5" /> Terbitkan Sertifikat
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Daftar sertifikat */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          {certsLoading || enrollLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : certificates.length === 0 && available.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                <Award className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-foreground">Belum ada sertifikat</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Selesaikan semua materi dan ujian kursus hingga 100% untuk mendapatkan sertifikat kelulusan ber-QR resmi.
              </p>
              <Link to="/courses" className="mt-4">
                <Button size="sm">Jelajahi Kursus</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {certificates.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{c.courseTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Pengajar: {c.instructorName ?? 'Ustadz Pembimbing'} • Diterbitkan: {fmtDate(c.issuedAt)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-primary">ID: {c.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/verify/${c.code}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs font-semibold">
                        <ExternalLink className="h-3.5 w-3.5" /> Verifikasi
                      </Button>
                    </Link>
                    {c.pdfUrl && (
                      <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" download>
                        <Button size="sm" className="gap-1.5 text-xs font-semibold">
                          <Download className="h-3.5 w-3.5" /> Unduh PDF
                        </Button>
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
