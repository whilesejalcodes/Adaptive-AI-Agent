import { ArrowRight, Eye, EyeOff, LockKeyhole, Waves, LoaderCircle } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';

type AuthMode = 'login' | 'signup';

export function AuthPage({ mode }: { mode: AuthMode }) {
  const [, setLocation] = useLocation();
  const { user, loading, login, signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === 'signup';

  useEffect(() => {
    if (!loading && user) setLocation('/chat');
  }, [loading, setLocation, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    setError('');
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      setLocation('/chat');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page app-noise">
      <section className="auth-art" aria-label="About adaptive">
        <Link href="/" className="flex w-fit items-center gap-3 no-underline" data-testid="link-auth-brand">
          <span className="brand-mark" aria-hidden="true">a/</span>
          <span className="brand-word">adaptive</span>
        </Link>
        <div className="auth-copy">
          <div className="eyebrow text-[hsl(var(--sidebar-primary))]">A quieter kind of AI</div>
          <h1 className="display">Keep the thread.</h1>
          <p>Adaptive remembers the details worth returning to, so each conversation can start a little further along.</p>
        </div>
        <div className="auth-note"><Waves size={14} /> <span>Your thoughts stay yours. You choose what becomes memory.</span></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <div className="eyebrow muted">{isSignup ? 'Begin here' : 'Welcome back'}</div>
          <h2>{isSignup ? 'Make room for better thinking.' : 'Pick up where you left off.'}</h2>
          <p className="subcopy">{isSignup ? 'Create a personal workspace for conversations that compound.' : 'Your workspace is ready when you are.'}</p>
           {error && (
             <div className="notice border-[hsl(var(--destructive)/.35)] text-[hsl(var(--destructive))]" role="alert" data-testid="status-auth-error">
              <LockKeyhole size={15} />
               <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            {isSignup && (
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input id="name" name="name" type="text" placeholder="What should we call you?" autoComplete="name" data-testid="input-name" required />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" data-testid="input-email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder={isSignup ? 'At least 8 characters' : 'Your password'} autoComplete={isSignup ? 'new-password' : 'current-password'} data-testid="input-password" minLength={8} required />
                <button className="icon-btn input-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} data-testid="button-toggle-password">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
             <button className="btn btn-primary mt-1 w-full" type="submit" disabled={submitting} data-testid={`button-submit-${mode}`}>
               {submitting ? <LoaderCircle size={15} className="animate-spin" /> : <><span>{isSignup ? 'Create workspace' : 'Sign in'}</span><ArrowRight size={15} /></>}
            </button>
          </form>
          <div className="auth-foot">
            {isSignup ? 'Already have a workspace?' : 'New to adaptive?'}{' '}
            <button className="btn btn-link" type="button" onClick={() => setLocation(isSignup ? '/login' : '/signup')} data-testid={`button-switch-${mode}`}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}