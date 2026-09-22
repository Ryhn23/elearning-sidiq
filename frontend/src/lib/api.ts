import axios, { type AxiosRequestConfig } from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// Auto-refresh access token saat 401 (single-flight)
// - Refresh token disimpan di localStorage ('refreshToken')
// - Hanya satu request /auth/refresh berjalan sekaligus
// - Endpoint auth publik (login/register/forgot/reset) tidak dicoba refresh
// ============================================================

const AUTH_ENDPOINT_MARKERS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

let refreshInFlight: Promise<string | null> | null = null;

function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return Promise.resolve(null);

  return fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
      if (!data.accessToken || !data.refreshToken) return null;
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return data.accessToken;
    })
    .catch(() => null);
}

function getRefreshedToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original: RetryableConfig | undefined = error.config;
    if (error.response?.status !== 401 || !original) return Promise.reject(error);

    const url: string = original.url ?? '';
    const isAuthEndpoint = AUTH_ENDPOINT_MARKERS.some((m) => url.includes(m));

    // Coba refresh sekali, lalu ulangi request asli dengan token baru
    if (!isAuthEndpoint && !original._retry) {
      original._retry = true;
      const newToken = await getRefreshedToken();
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      }
    }

    // Refresh gagal / tidak ada refresh token → bersihkan sesi
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');

    // Jangan redirect jika user sudah berada di halaman auth (hindari reload form)
    const path = window.location.pathname;
    if (!AUTH_PAGES.some((p) => path.startsWith(p))) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
