import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, ShieldCheck, ShieldX, Search } from 'lucide-react';
import { api } from '@/lib/api';

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <GraduationCap className="h-6 w-6 text-primary-600" />
          <span className="text-base font-bold text-foreground">E-Learning</span>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Verifikasi Sertifikat</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Masukkan kode sertifikat untuk memverifikasi keasliannya.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => { e.preventDefault(); navigate(`/verify/${input.trim().toUpperCase()}`); }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="mis. ABC123-XYZ789"
              aria-label="Kode sertifikat"
              className="h-10 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm uppercase text-foreground outline-none focus:border-primary-500"
            />
            <button type="submit" disabled={!input.trim()}
              className="inline-flex h-10 items-center gap-1 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300">
              <Search className="h-4 w-4" /> Verifikasi
            </button>
          </form>

          {/* Result */}
          {isLoading && (
            <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Memverifikasi...
            </div>
          )}

          {!isLoading && isError && normalizedCode.length >= 6 && (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4">
              <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-700">Sertifikat tidak ditemukan</p>
                <p className="mt-1 text-xs text-red-600">Periksa kembali kode sertifikat yang Anda masukkan.</p>
              </div>
            </div>
          )}

          {!isLoading && !isError && data?.valid && (
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-green-700">Sertifikat Valid</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Nama</dt>
                      <dd className="font-medium text-foreground">{data.userName}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Kursus</dt>
                      <dd className="font-medium text-foreground">{data.courseTitle}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Diterbitkan</dt>
                      <dd className="text-foreground">{data.issuedAt ? fmtDate(data.issuedAt) : '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Kode</dt>
                      <dd className="font-mono text-xs text-foreground">{data.code}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !isError && data && !data.valid && normalizedCode.length >= 6 && (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4">
              <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-semibold text-red-700">Sertifikat tidak valid</p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} E-Learning Platform
      </footer>
    </div>
  );
}
