import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

interface AuthState {
  user: User | null;
  token: string | null;
  /** Simpan sesi. `refreshToken` opsional — jika diberikan, disimpan ke localStorage. */
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  /** Logout: invalidate refresh token di server (fire-and-forget), lalu bersihkan state lokal. */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    set({ user, token });
  },
  logout: async () => {
    // Ambil kredensial SEBELUM membersihkan state — request dikirim eksplisit
    // agar tidak bergantung pada isi localStorage saat interceptor membaca.
    const token = get().token;
    const refreshToken = localStorage.getItem('refreshToken');

    if (token && refreshToken) {
      void api
        .post('/auth/logout', { refreshToken }, { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {
          /* abaikan — logout lokal tetap harus terjadi */
        });
    }

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null });
  },
}));
