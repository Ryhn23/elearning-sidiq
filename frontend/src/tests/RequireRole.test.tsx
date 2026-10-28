/**
 * RequireRole Component Tests
 * Verifies access control redirect behavior for role-based routes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock Zustand auth store
const mockAuthStore = {
  token: null as string | null,
  user: {
    id: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'teacher',
  } as any,
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthStore) => unknown) => selector(mockAuthStore),
}));

// Import AFTER mocking
import { RequireRole } from '@/components/auth/RequireRole';

function renderWith(user: any, requiredRole: 'teacher' | 'admin' | 'student', path: string) {
  mockAuthStore.user = user;

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/teacher" element={<div data-testid="teacher-dashboard">Teacher Dashboard</div>} />
        <Route path="/teacher/courses" element={<div data-testid="teacher-courses">Teacher Courses</div>} />
        <Route path="/admin" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
        <Route path="/student" element={<div data-testid="student-dashboard">Student Dashboard</div>} />
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
      </Routes>
      <RequireRole role={requiredRole}>
        <div data-testid="role-content">Content</div>
      </RequireRole>
    </MemoryRouter>
  );
}

describe('RequireRole Component', () => {
  beforeEach(() => {
    mockAuthStore.token = null;
  });

  it('should render children when role matches (teacher → teacher)', () => {
    renderWith({ ...mockAuthStore.user, role: 'teacher' }, 'teacher', '/teacher');
    expect(screen.getByTestId('role-content')).toBeTruthy();
    expect(screen.queryByTestId('login-page')).toBeNull();
  });

  it('should redirect admin to /admin (valid dashboard path) when accessing teacher route', () => {
    // Admin mencoba akses route guru → redirect ke /admin, BUKAN /admin/dashboard (yang tidak ada)
    renderWith({ ...mockAuthStore.user, role: 'admin' }, 'teacher', '/teacher');
    expect(screen.getByTestId('admin-dashboard')).toBeTruthy();
    expect(screen.queryByTestId('role-content')).toBeNull();
  });

  it('should redirect student to /student (valid dashboard path) when accessing teacher route', () => {
    renderWith({ ...mockAuthStore.user, role: 'student' }, 'teacher', '/teacher');
    expect(screen.getByTestId('student-dashboard')).toBeTruthy();
    expect(screen.queryByTestId('role-content')).toBeNull();
  });

  it('should redirect to /student (default) when user is null', () => {
    renderWith(null, 'teacher', '/teacher');
    expect(screen.getByTestId('student-dashboard')).toBeTruthy();
    expect(screen.queryByTestId('role-content')).toBeNull();
  });
});
