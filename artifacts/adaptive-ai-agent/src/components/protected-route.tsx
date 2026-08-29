import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/components/auth-provider';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    }
  }, [loading, setLocation, user]);

  if (loading) {
    return (
      <main className="auth-page app-noise">
        <div className="mx-auto flex min-h-screen w-full max-w-[390px] items-center justify-center p-6">
          <div className="notice w-full" role="status">Checking your workspace session…</div>
        </div>
      </main>
    );
  }

  return user ? children : null;
}