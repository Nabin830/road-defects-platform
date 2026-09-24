import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { useNotifications } from '../store/notifications';
import { initialsOf, relativeTime } from '../lib/utils';
import { HAS_SUPABASE } from '../lib/supabase';
import { BrandLogo } from './Brand';
import {
  IconHome, IconList, IconChart, IconPlus, IconUser, IconLogout, IconSun, IconMoon, IconBell,
  IconMap, IconFile, IconCheckCircle, IconAlert, IconTruck, IconClock, IconCheck, IconX, IconFlag, IconUsers,
} from '../lib/icons';
import type { AppNotification, NotificationKind, Role } from '../lib/types';

type NavItem = { to: string; label: string; icon: ComponentType<{ size?: number }> };

const ROLE_LABEL: Record<Role, string> = { citizen: 'Resident', contractor: 'Contractor', admin: 'Council' };

function navFor(authed: boolean, role: Role): NavItem[] {
  if (authed && role === 'admin') return [
    { to: '/admin', label: 'Overview', icon: IconHome },
    { to: '/admin/reports', label: 'Reports', icon: IconChart },
    { to: '/admin/people', label: 'People', icon: IconUsers },
    { to: '/defects', label: 'All defects', icon: IconMap },
  ];
  if (authed && role === 'contractor') return [
    { to: '/contractor', label: 'My jobs', icon: IconTruck },
    { to: '/defects', label: 'All defects', icon: IconMap },
  ];
  if (authed) return [
    { to: '/dashboard', label: 'Dashboard', icon: IconHome },
    { to: '/my-reports', label: 'My reports', icon: IconFile },
    { to: '/defects', label: 'All defects', icon: IconMap },
  ];
  return [{ to: '/defects', label: 'All defects', icon: IconMap }];
}

/** Close a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3 text-ink hover:no-underline hover:text-ink flex-none" aria-label="RoadFix home">
      <BrandLogo className="h-7" />
      <span className="hidden sm:block pl-3 border-l border-border text-[10.5px] font-semibold text-muted leading-tight">Orange City<br />Council</span>
    </Link>
  );
}

export function Navbar() {
  const { authed, role, userId, profile, signOut } = useAuth();
  const { theme, toggleTheme, toast } = useUI();
  const watch = useNotifications(s => s.watch);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => { watch(authed ? userId : null); }, [authed, userId, watch]);

  if (loc.pathname === '/login' || loc.pathname === '/register') return null;

  const items = navFor(authed, role);
  const showReport = !authed || role === 'citizen';

  return (
    <header className="glass sticky top-0 z-[500] border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-4 lg:gap-8">
        <Logo />

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end
              className={({ isActive }) => `flex items-center gap-2 h-9 px-3 rounded-lg text-[13.5px] font-semibold transition-colors hover:no-underline ${isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {showReport && (
            <Link to="/report" className="btn btn-primary btn-sm !h-9 hidden lg:inline-flex hover:no-underline">
              <IconPlus size={15} /> Report a defect
            </Link>
          )}
          <button onClick={toggleTheme} className="icon-btn" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
          </button>

          {authed ? (
            <>
              <NotificationBell />
              <UserMenu
                name={profile?.name || ROLE_LABEL[role]}
                email={profile?.email || ''}
                role={role}
                onSignOut={async () => { await signOut(); nav('/'); toast('info', 'Signed out', 'You can still browse the public map.'); }}
              />
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm !h-9 hover:no-underline">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm !h-9 hidden sm:inline-flex hover:no-underline">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─── Notifications ─────────────────────────────────────────────── */

const KIND_STYLE: Record<NotificationKind, { icon: ComponentType<{ size?: number }>; cls: string }> = {
  report:   { icon: IconFlag,        cls: 'bg-am-50 text-am-700' },
  assigned: { icon: IconTruck,       cls: 'bg-blue-50 text-blue-700' },
  accepted: { icon: IconCheck,       cls: 'bg-blue-50 text-blue-700' },
  declined: { icon: IconX,           cls: 'bg-rd-50 text-rd-700' },
  progress: { icon: IconClock,       cls: 'bg-pu-50 text-pu-700' },
  complete: { icon: IconCheckCircle, cls: 'bg-em-50 text-em-700' },
  verified: { icon: IconCheckCircle, cls: 'bg-em-50 text-em-700' },
  rework:   { icon: IconAlert,       cls: 'bg-am-50 text-am-700' },
  rejected: { icon: IconAlert,       cls: 'bg-rd-50 text-rd-700' },
  update:   { icon: IconBell,        cls: 'bg-surface-2 text-muted' },
};

function NotificationBell() {
  const { items, markRead, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const nav = useNavigate();
  const unread = items.filter(i => !i.read_at).length;

  function openItem(n: AppNotification) {
    setOpen(false);
    markRead(n.id);
    if (n.defect_id) nav(`/defect/${n.defect_id}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { if (!open) refresh(); setOpen(!open); }} className="icon-btn relative"
              aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open}>
        <IconBell size={17} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rd-600 text-white text-[10.5px] font-bold grid place-items-center ring-2 ring-[var(--surface)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="popover fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[68px] sm:top-full sm:mt-2 sm:w-[380px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <div className="text-[14px] font-bold text-ink">Notifications</div>
              <div className="text-[11.5px] text-muted">{unread ? `${unread} unread` : 'You’re all caught up'}</div>
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[12.5px] font-semibold text-brand hover:underline">Mark all as read</button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <span className="w-11 h-11 mx-auto rounded-full bg-surface-2 text-muted grid place-items-center mb-3"><IconBell size={20} /></span>
              <div className="text-[13.5px] font-semibold text-ink">No notifications yet</div>
              <div className="text-[12.5px] text-muted mt-1">Updates on your reports and jobs will appear here.</div>
            </div>
          ) : (
            <ul className="max-h-[min(440px,70vh)] overflow-y-auto divide-y divide-border">
              {items.map(n => {
                const k = KIND_STYLE[n.kind] || KIND_STYLE.update;
                return (
                  <li key={n.id}>
                    <button onClick={() => openItem(n)}
                            className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-surface-2 transition-colors ${n.read_at ? '' : 'unread'}`}>
                      <span className={`w-9 h-9 rounded-full grid place-items-center flex-none ${k.cls}`}><k.icon size={16} /></span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[13.5px] ${n.read_at ? 'font-medium text-ink-2' : 'font-bold text-ink'}`}>{n.title}</span>
                        {n.defect_title && <span className="block text-[12.5px] text-ink-2 truncate">{n.defect_title}</span>}
                        {n.body && <span className="block text-[12px] text-muted mt-0.5 line-clamp-2">{n.body}</span>}
                        <span className="block text-[11px] text-muted mt-1">{n.defect_id} · {relativeTime(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-none" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Account menu ─────────────────────────────────────────────── */

function UserMenu({ name, email, role, onSignOut }: { name: string; email: string; role: Role; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const home = role === 'admin' ? '/admin' : role === 'contractor' ? '/contractor' : '/dashboard';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu"
              className="flex items-center gap-2 h-9 pl-1 pr-1 md:pr-3 rounded-full border border-border bg-surface hover:border-border-strong transition-colors">
        <span className="w-7 h-7 rounded-full bg-brand text-brand-ink grid place-items-center font-bold text-[11px]">{initialsOf(name)}</span>
        <span className="hidden md:block text-left leading-tight">
          <span className="block text-[12.5px] font-semibold text-ink max-w-[140px] truncate">{name}</span>
          <span className="block text-[10.5px] text-muted">{ROLE_LABEL[role]}</span>
        </span>
      </button>
      {open && (
        <div className="popover absolute right-0 top-full mt-2 w-[250px] p-1.5">
          <div className="px-3 py-2.5 mb-1 border-b border-border">
            <div className="text-[13.5px] font-bold text-ink truncate">{name}</div>
            {email && <div className="text-[12px] text-muted truncate">{email}</div>}
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10.5px] font-bold uppercase tracking-wider">{ROLE_LABEL[role]}</span>
          </div>
          <Link to={home} onClick={() => setOpen(false)} className="menu-item hover:no-underline">
            {role === 'admin' ? <IconChart size={15} /> : role === 'contractor' ? <IconTruck size={15} /> : <IconHome size={15} />}
            {role === 'admin' ? 'Council overview' : role === 'contractor' ? 'My jobs' : 'My dashboard'}
          </Link>
          {role === 'citizen' && (
            <Link to="/report" onClick={() => setOpen(false)} className="menu-item hover:no-underline"><IconPlus size={15} /> Report a defect</Link>
          )}
          <Link to="/profile" onClick={() => setOpen(false)} className="menu-item hover:no-underline"><IconUser size={15} /> Profile &amp; settings</Link>
          <div className="h-px bg-border my-1" />
          <button onClick={() => { setOpen(false); onSignOut(); }} className="menu-item w-full text-rd-600 hover:text-rd-700">
            <IconLogout size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Mobile bottom bar ────────────────────────────────────────── */

export function TabBar() {
  const { authed, role } = useAuth();
  const loc = useLocation();
  if (loc.pathname === '/login' || loc.pathname === '/register') return null;

  const items: NavItem[] = authed && role === 'contractor'
    ? [
        { to: '/contractor', icon: IconTruck, label: 'My jobs' },
        { to: '/defects', icon: IconMap, label: 'Map' },
        { to: '/', icon: IconHome, label: 'Home' },
      ]
    : authed && role === 'admin'
    ? [
        { to: '/admin', icon: IconHome, label: 'Overview' },
        { to: '/admin/reports', icon: IconChart, label: 'Reports' },
        { to: '/admin/people', icon: IconUsers, label: 'People' },
        { to: '/defects', icon: IconMap, label: 'Defects' },
      ]
    : [
        { to: authed ? '/dashboard' : '/', icon: IconHome, label: 'Home' },
        { to: '/defects', icon: IconList, label: 'Defects' },
        { to: '/report', icon: IconPlus, label: 'Report' },
        { to: authed ? '/my-reports' : '/login', icon: IconUser, label: authed ? 'Mine' : 'Sign in' },
      ];

  return (
    <nav className="glass md:hidden sticky bottom-0 z-[500] border-t border-border grid py-1.5 px-1"
         style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))' }}
         aria-label="Mobile">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink key={to + label} to={to} end
                 className={({ isActive }) => `flex flex-col items-center gap-1 py-1.5 rounded-lg text-[10.5px] font-semibold ${isActive ? 'text-brand' : 'text-muted'} hover:no-underline`}>
          <Icon size={19} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/* ─── Footer ───────────────────────────────────────────────────── */

export function Footer() {
  const { authed, role } = useAuth();
  const links = authed
    ? [
        { to: '/defects', l: 'Public map' },
        ...(role === 'citizen' ? [{ to: '/report', l: 'Report a defect' }, { to: '/my-reports', l: 'My reports' }] : []),
        ...(role === 'contractor' ? [{ to: '/contractor', l: 'My jobs' }] : []),
        ...(role === 'admin' ? [{ to: '/admin', l: 'Council overview' }, { to: '/admin/reports', l: 'Reports' }, { to: '/admin/people', l: 'People' }] : []),
      ]
    : [
        { to: '/report', l: 'Report a defect' },
        { to: '/defects', l: 'Public map' },
        { to: '/register', l: 'Create an account' },
        { to: '/login', l: 'Sign in' },
      ];
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row gap-8 md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="text-[13px] text-muted mt-3">RoadFix sends your road defect reports to council and lets you follow each repair from report to verified fix.</p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-2" aria-label="Footer">
          {links.map(({ to, l }) => (
            <Link key={to} to={to} className="text-[13.5px] font-medium text-ink-2 hover:text-brand hover:no-underline">{l}</Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-4 text-xs text-muted flex flex-wrap gap-2 justify-between">
          <span>© {new Date().getFullYear()} Orange City Council</span>
          {!HAS_SUPABASE && <span>Demo mode — not connected to a database</span>}
        </div>
      </div>
    </footer>
  );
}
