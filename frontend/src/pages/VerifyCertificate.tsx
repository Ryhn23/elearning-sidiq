import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldX, Search, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

interface VerifyResult {
  valid: boolean;
  code: string;
  userName: string;
  courseTitle: string;
  issuedAt: string | null;
  pdfUrl: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function VerifyCertificate() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [input, setInput] = useState(code ?? '');

  const normalizedCode = (code ?? '').trim().toUpperCase();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['verify-certificate', normalizedCode],
    enabled: !!normalizedCode && normalizedCode.length >= 6,
    queryFn: async () => {
      const res = await api.get<VerifyResult>(`/certificates/${normalizedCode}`);
      return res.data;
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Sidiq" className="h-8 w-8 object-contain" />
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground leading-tight">
                Sidiq <span className="text-primary">E-Learning</span>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">Verifikasi Sertifikat Resmi</span>
            </div>
          </Link>
          <Link to="/">
            <Button size="sm" variant="ghost">Beranda</Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Verifikasi Sertifikat Digital</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Masukkan kode verifikasi unik sertifikat untuk memastikan keabsahan dokumen.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`); }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="mis. SIDIQ-CERT-2026-XXXX"
              aria-label="Kode sertifikat"
              className="h-11 flex-1 rounded-xl border border-border bg-background px-4 font-mono text-xs uppercase text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <Button type="submit" disabled={!input.trim()} className="gap-1.5 shadow-xs">
              <Search className="h-4 w-4" /> Verifikasi
            </Button>
          </form>

          {/* Result */}
          {isLoading && (
            <Card className="rounded-2xl p-8 text-center text-xs text-muted-foreground">
              Memverifikasi data pada blockchain / database sertifikat...
            </Card>
          )}

          {!isLoading && isError && normalizedCode.length >= 6 && (
            <Card className="rounded-2xl border-destructive/20 bg-destructive/10 p-6">
              <div className="flex items-start gap-3">
                <ShieldX className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-bold text-destructive">Sertifikat Tidak Ditemukan</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kode sertifikat <code className="font-mono font-bold">{normalizedCode}</code> tidak terdaftar dalam basis data SIDIQ E-Learning. Periksa kembali karakter dan format kode.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {!isLoading && !isError && data?.valid && (
            <Card className="rounded-2xl border-primary/30 bg-card shadow-md overflow-hidden">
              <div className="bg-primary/10 border-b border-primary/20 p-5 flex items-center gap-3">
                <ShieldCheck className="h-7 w-7 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-bold text-primary">Sertifikat Sah & Terverifikasi</p>
                  <p className="text-xs text-muted-foreground">Dokumen diterbitkan resmi oleh Sidiq E-Learning.</p>
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Nama Peserta:</span>
                    <span className="font-bold text-foreground text-sm">{data.userName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Kursus / Materi:</span>
                    <span className="font-bold text-foreground text-sm">{data.courseTitle}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Nomor Seri:</span>
                    <span className="font-mono font-bold text-foreground">{data.code}</span>
                  </div>
                  {data.issuedAt && (
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Tanggal Terbit:</span>
                      <span className="font-medium text-foreground">{fmtDate(data.issuedAt)}</span>
                    </div>
                  )}
                </div>

                {data.pdfUrl && (
                  <div className="pt-2">
                    <a href={data.pdfUrl} target="_blank" rel="noreferrer">
                      <Button className="w-full gap-2 shadow-xs">
                        <Download className="h-4 w-4" /> Unduh Dokumen Asli (PDF)
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
