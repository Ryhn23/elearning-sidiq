import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Jaring pengaman terakhir: mencegah white screen saat ada error render
 * yang tidak tertangani (mis. bug di halaman tertentu).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log ke konsol (di produksi bisa dialirkan ke service monitoring).
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 text-center">
          <p className="text-6xl font-bold text-primary-600">!</p>
          <h1 className="mt-4 text-xl font-semibold text-foreground">Terjadi kesalahan tak terduga</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Halaman ini gagal dimuat. Silakan muat ulang atau kembali ke beranda.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => window.location.reload()}>Muat Ulang</Button>
            <Button variant="outline" onClick={this.reset}>
              Kembali ke Beranda
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
