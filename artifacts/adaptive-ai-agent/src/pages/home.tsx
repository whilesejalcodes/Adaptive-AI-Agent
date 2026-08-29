import { ArrowRight, Brain, MessageSquare, MoveUpRight } from 'lucide-react';
import { Link } from 'wouter';

export function HomePage() {
  return (
    <main className="auth-page app-noise">
      <section className="auth-art" aria-label="Adaptive introduction">
        <Link href="/" className="flex w-fit items-center gap-3 no-underline" data-testid="link-home-brand">
          <span className="brand-mark" aria-hidden="true">a/</span>
          <span className="brand-word">adaptive</span>
        </Link>
        <div className="auth-copy">
          <div className="eyebrow text-[hsl(var(--sidebar-primary))]">A personal AI workspace</div>
          <h1 className="display">Think in threads, not tabs.</h1>
          <p>Conversations become more useful when the right details carry forward. Adaptive gives those details a place to live.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/chat" className="btn btn-primary" data-testid="link-home-chat">Open the workspace <ArrowRight size={15} /></Link>
            <Link href="/memories" className="btn border-[hsl(var(--sidebar-border))] text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))]" data-testid="link-home-memories">See memory <MoveUpRight size={14} /></Link>
          </div>
        </div>
        <div className="auth-note"><span className="grid h-5 w-5 place-items-center rounded border border-[hsl(var(--sidebar-primary)/.4)] font-mono text-[9px] text-[hsl(var(--sidebar-primary))]">01</span><span>Built for the thoughts you return to.</span></div>
      </section>
      <section className="auth-form-side">
        <div className="w-full max-w-[390px]">
          <div className="eyebrow muted">The idea</div>
          <h2 className="mt-2 text-[30px] leading-tight tracking-[-.06em]">A workspace that gets to know the shape of your thinking.</h2>
          <div className="mt-8 grid gap-3">
            <Link href="/chat" className="card flex items-start gap-4 p-4 no-underline transition-transform hover:-translate-y-0.5" data-testid="link-home-conversation-card">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><MessageSquare size={17} /></span>
              <span><strong className="block text-sm text-[hsl(var(--foreground))]">Have a conversation</strong><span className="mt-1 block text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">A calm place to work through the question in front of you.</span></span>
            </Link>
            <Link href="/memories" className="card flex items-start gap-4 p-4 no-underline transition-transform hover:-translate-y-0.5" data-testid="link-home-memory-card">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--accent)/.28)] text-[hsl(var(--primary))]"><Brain size={17} /></span>
              <span><strong className="block text-sm text-[hsl(var(--foreground))]">Inspect what carries forward</strong><span className="mt-1 block text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Memory stays visible, editable, and yours to decide.</span></span>
            </Link>
          </div>
          <div className="mt-8 border-t border-[hsl(var(--border))] pt-5 text-xs text-[hsl(var(--muted-foreground))]">Already have an account? <Link href="/login" className="font-semibold text-[hsl(var(--primary))]" data-testid="link-home-login">Sign in</Link></div>
        </div>
      </section>
    </main>
  );
}