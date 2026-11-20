import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function SsoLaunch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const ticket = searchParams.get('ticket');

  useEffect(() => {
    if (!ticket) {
      setStatus('error');
      setErrorMessage('Tiket peluncuran SSO tidak ditemukan dalam URL.');
      return;
    }

    let isCancelled = false;

    async function consumeTicket() {
      try {
        const { data } = await api.post('/integrations/sidiq/sso/consume', { ticket });
        if (isCancelled) return;

        if (data.accessToken && data.user) {
          setAuth(data.user, data.accessToken, data.refreshToken);
          navigate('/dashboard', { replace: true });
        } else {
          setStatus('error');
          setErrorMessage('Data sesi tidak valid dari server.');
        }
      } catch (err: any) {
        if (isCancelled) return;
        setStatus('error');
        setErrorMessage(
          err.response?.data?.error || err.message || 'Gagal menghubungkan sesi akun dari SIDIQ.'
        );
      }
    }

    void consumeTicket();

    return () => {
      isCancelled = true;
    };
  }, [ticket, setAuth, navigate]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6 text-center border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Autentikasi SSO Gagal</h2>
          <p className="text-sm text-gray-600 mb-6">{errorMessage}</p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center border border-gray-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Menghubungkan Akun SIDIQ...</h2>
        <p className="text-sm text-gray-500">Mempersiapkan sesi belajar Anda, mohon tunggu sebentar.</p>
      </div>
    </div>
  );
}
