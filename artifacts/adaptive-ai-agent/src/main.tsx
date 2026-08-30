import { createRoot } from 'react-dom/client';
import { setAuthTokenGetter } from '@workspace/api-client-react';

import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const root = createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error('Adaptive caught a rendering error.', errorInfo.componentStack);
  },
});

function StartupFallback() {
  return (
    <main className="auth-page app-noise">
      <section className="auth-form-side">
        <div className="auth-form">
          <div className="eyebrow muted">Adaptive</div>
          <h1>Workspace configuration is incomplete.</h1>
          <p className="subcopy">The app could not start its secure browser session. Add the Firebase web settings, then reload.</p>
        </div>
      </section>
    </main>
  );
}

async function bootstrap() {
  try {
    const [{ default: App }, { AuthProvider }, { firebaseAuth }] = await Promise.all([
      import('./App'),
      import('@/components/auth-provider'),
      import('@/lib/firebase'),
    ]);
    setAuthTokenGetter(() => firebaseAuth.currentUser?.getIdToken() ?? null);
    root.render(
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>,
    );
  } catch {
    console.error('Adaptive could not initialize its browser session.');
    root.render(<StartupFallback />);
  }
}

void bootstrap();
