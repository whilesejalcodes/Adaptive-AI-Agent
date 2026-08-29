import { Brain, CircleUserRound, Compass, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getHealthCheckQueryKey, useHealthCheck } from '@workspace/api-client-react';

function Brand() {
  return (
    <Link href="/chat" className="flex items-center gap-3 no-underline" data-testid="link-brand">
      <span className="brand-mark" aria-hidden="true">a/</span>
      <span className="brand-word">adaptive</span>
    </Link>
  );
}

function ConnectionStatus() {
  const { data, isLoading, isError } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), retry: false, staleTime: 30_000 },
  });
  const live = !isLoading && !isError && data;
  const label = isLoading ? 'checking connection' : isError ? 'offline preview' : `connected · ${data?.status ?? 'ready'}`;
  return (
    <div className="connection" data-testid="status-connection">
      <span className={`connection-dot ${isLoading ? 'loading' : isError ? 'error' : live ? 'live' : ''}`} />
      <span>{label}</span>
    </div>
  );
}

const navItems = [
  { href: '/chat', label: 'Conversations', icon: MessageSquare },
  { href: '/memories', label: 'Memory', icon: Brain },
];

export function MobileNavigation() {
  const [location] = useLocation();
  return (
    <nav className="mobile-bottomnav" aria-label="Mobile navigation">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={location === href ? 'active' : ''} data-testid={`link-mobile-${label.toLowerCase()}`}>
          <Icon size={18} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      ))}
      <Link href="/chat" data-testid="link-mobile-new">
        <Plus size={18} strokeWidth={1.8} />
        <span>New thought</span>
      </Link>
    </nav>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="page-shell app-noise">
      <aside className="side-rail" aria-label="Workspace navigation">
        <Brand />
        <div className="mt-12">
          <div className="eyebrow rail-caption">Your workspace</div>
          <nav className="grid gap-1" aria-label="Primary navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}>
                <Icon size={16} strokeWidth={1.8} />
                <span className="nav-label">{label}</span>
                {href === '/memories' && <span className="font-mono text-[10px] opacity-50">04</span>}
              </Link>
            ))}
          </nav>
        </div>
        <div className="rail-rule" />
        <div className="eyebrow rail-caption">Explore</div>
        <button className="nav-link w-full text-left" type="button" onClick={() => window.alert('Guided exploration is part of the next phase.')} data-testid="button-explore">
          <Compass size={16} strokeWidth={1.8} />
          <span className="nav-label">Explore ideas</span>
          <Sparkles size={13} className="opacity-50" />
        </button>
        <div className="mt-auto">
          <ConnectionStatus />
          <div className="mt-4 flex items-center gap-2 border-t border-[hsl(var(--sidebar-border))] pt-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--sidebar-primary)/.18)] text-[11px] font-semibold text-[hsl(var(--sidebar-primary))]">SC</span>
            <div className="min-w-0">
              <div className="truncate text-xs">Sam Carter</div>
              <div className="font-mono text-[9px] text-[hsl(var(--sidebar-foreground)/.42)]">personal space</div>
            </div>
            <CircleUserRound size={15} className="ml-auto opacity-40" />
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="mobile-topbar">
          <Brand />
          <ConnectionStatus />
        </header>
        {children}
        <MobileNavigation />
      </div>
    </div>
  );
}

export { ConnectionStatus };