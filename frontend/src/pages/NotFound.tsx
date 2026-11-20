import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <img src="/logo.png" alt="Sidiq" className="h-10 w-10 object-contain" />
      </div>
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-4 text-xl font-bold text-foreground">Halaman Tidak Ditemukan</h1>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground">
        Halaman yang Anda tuju tidak ditemukan atau telah dipindahkan ke tautan lain.
      </p>
      <Link to="/" className="mt-6">
        <Button className="shadow-xs">Kembali ke Beranda</Button>
      </Link>
    </div>
  );
}
