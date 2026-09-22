import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 text-center">
      <p className="text-6xl font-bold text-primary-600">404</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link to="/" className="mt-6">
        <Button>Kembali ke Beranda</Button>
      </Link>
    </div>
  );
}
