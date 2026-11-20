import { Link } from 'react-router-dom';
import { Award, Video, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-sm text-card-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Sidiq Logo" className="h-8 w-8 object-contain" />
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-foreground leading-tight">
                  Sidiq <span className="text-primary-600">E-Learning</span>
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">Platform Pembelajaran Terpadu</span>
              </div>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Platform pembelajaran digital terstruktur yang terintegrasi dengan ekosistem SIDIQ Pesantren. Belajar mandiri, interaktif, dan teruji.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
              <span>Sertifikat Digital Terverifikasi QR</span>
            </div>
          </div>

          {/* Navigasi Utama */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Navigasi
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/courses" className="hover:text-primary-600 transition-colors">
                  Katalog Kursus
                </Link>
              </li>
              <li>
                <Link to="/verify/demo" className="hover:text-primary-600 transition-colors">
                  Verifikasi Sertifikat
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-primary-600 transition-colors">
                  Masuk Akun
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-primary-600 transition-colors">
                  Daftar Peserta Baru
                </Link>
              </li>
            </ul>
          </div>

          {/* Fitur LMS */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Fitur Pembelajaran
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-primary-500" />
                <span>Video Streaming Adaptif</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary-500" />
                <span>Kuis Pilihan Ganda & Essay</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary-500" />
                <span>Pengumpulan Tugas Mandiri</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-primary-500" />
                <span>Sertifikat Otomatis</span>
              </li>
            </ul>
          </div>

          {/* Dukungan & Standar */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Standar Platform
            </h3>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Dirancang untuk mendukung hingga ratusan pengguna simultan dengan arsitektur async, integrasi kelas Zoom, dan keamanan berlapis.
            </p>
            <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground">Butuh bantuan?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hubungi administrator institusi Anda untuk kendala akun dan pendaftaran.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} E-Learning Platform. Hak cipta dilindungi undang-undang.</p>
          <div className="flex gap-4">
            <Link to="/courses" className="hover:underline">Katalog</Link>
            <Link to="/login" className="hover:underline">Login Pengajar</Link>
            <Link to="/login" className="hover:underline">Login Siswa</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
