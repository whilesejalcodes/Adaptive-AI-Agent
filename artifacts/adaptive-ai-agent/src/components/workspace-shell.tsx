import { Brain, Compass, LogOut, Menu, MessageSquare, Plus, Sparkles, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getHealthCheckQueryKey, useHealthCheck } from '@workspace/api-client-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';

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

type WorkspaceShellProps = {
  children: ReactNode;
  mobilePanel?: (close: () => void) => ReactNode;
};

export function WorkspaceShell({ children, mobilePanel }: WorkspaceShellProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const displayName = user?.displayName || user?.email || 'Your workspace';
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  async function handleLogout() {
    setMobileMenuOpen(false);
    setLogoutError('');
    try {
      await logout();
      setLocation('/login');
    } catch {
      setLogoutError('Sign out could not be completed. Please try again.');
    }
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

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
             <span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--sidebar-primary)/.18)] text-[11px] font-semibold text-[hsl(var(--sidebar-primary))]">{initials}</span>
            <div className="min-w-0">
               <div className="truncate text-xs">{displayName}</div>
              <div className="font-mono text-[9px] text-[hsl(var(--sidebar-foreground)/.42)]">personal space</div>
            </div>
             <button className="icon-btn ml-auto opacity-60 hover:opacity-100" type="button" onClick={handleLogout} aria-label="Sign out" data-testid="button-logout"><LogOut size={15} /></button>
          </div>
           {logoutError && <div className="workspace-action-error" role="alert">{logoutError}</div>}
        </div>
      </aside>
      <div className="workspace-main">
        <header className="mobile-topbar">
          <Brand />
          <div className="mobile-topbar-actions">
            <ConnectionStatus />
            <button
              className="mobile-menu-toggle"
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-workspace-menu"
              aria-label={mobileMenuOpen ? 'Close workspace menu' : 'Open workspace menu'}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </header>
        {mobileMenuOpen && (
          <div className="mobile-drawer-backdrop" role="presentation" onClick={closeMobileMenu}>
            <aside
              className="mobile-drawer"
              id="mobile-workspace-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-workspace-menu-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-drawer-header">
                <div>
                  <div className="eyebrow rail-caption">Adaptive</div>
                  <h2 id="mobile-workspace-menu-title">Your workspace</h2>
                </div>
                <button className="icon-btn" type="button" onClick={closeMobileMenu} aria-label="Close workspace menu" data-testid="button-close-mobile-menu">
                  <X size={17} />
                </button>
              </div>
              <nav className="mobile-drawer-nav" aria-label="Mobile workspace navigation">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} onClick={closeMobileMenu} data-testid={`link-drawer-${label.toLowerCase()}`}>
                    <Icon size={17} strokeWidth={1.8} />
                    <span className="nav-label">{label}</span>
                    {location === href && <span className="mobile-drawer-current">Current</span>}
                  </Link>
                ))}
              </nav>
              {mobilePanel && <div className="mobile-drawer-panel">{mobilePanel(closeMobileMenu)}</div>}
              <button className="nav-link mobile-drawer-signout" type="button" onClick={handleLogout} data-testid="button-mobile-logout">
                <LogOut size={17} strokeWidth={1.8} />
                <span className="nav-label">Sign out</span>
              </button>
              {logoutError && <div className="workspace-action-error" role="alert">{logoutError}</div>}
            </aside>
          </div>
        )}
        {children}
        <MobileNavigation />
      </div>
    </div>
  );
}

export { ConnectionStatus };