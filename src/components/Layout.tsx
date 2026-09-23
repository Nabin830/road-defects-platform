import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { api } from '../lib/api';
import { initialsOf, relativeTime } from '../lib/utils';
import { HAS_SUPABASE } from '../lib/supabase';
import { IconWrench, IconHome, IconList, IconChart, IconPlus, IconUser, IconLogout, IconSun, IconMoon, IconBell } from '../lib/icons';
import { useEffect, useState } from 'react';
import type { RepairUpdate } from '../lib/types';

export function Navbar() {
  const { authed, role, userId, profile, signOut } = useAuth();
  const { theme, toggleTheme, toast } = useUI();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [activity, setActivity] = useState<RepairUpdate[]>([]);

  const displayName = profile?.name || 'Your account';
  const sub = profile?.suburb || '';
  const initials = initialsOf(displayName);

  useEffect(() => {
    if (!authed || !userId) { setActivity([]); return; }
    api.recentActivity({ userId, role, contractorId: profile?.contractor_id || null }).then(setActivity).catch(() => {});
  }, [authed, userId, role, profile?.contractor_id]);

  const hideChrome = loc.pathname === '/login' || loc.pathname === '/register';
  if (hideChrome) return null;

  return (
    <header className="sticky top-0 z-[500] h-[60px] bg-surface/85 backdrop-saturate-150 backdrop-blur-md border-b border-border">
      <div className="w-full max-w-[1280px] mx-auto px-6 h-full flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 font-extrabold text-[15px] tracking-tight text-ink hover:no-underline">
          <span className="w-7 h-7 rounded-lg bg-brand text-brand-ink grid place-items-center">
            <IconWrench size={14} />
          </span>
          <span className="hidden sm:block">
            Road Defects
            <span className="block text-[9.5px] font-semibold tracking-widest uppercase text-muted leading-none mt-0.5">NSW Council Platform</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 ml-2">
          <NavLink to="/defects" className={({ isActive }) => `px-3 py-1.5 rounded-btn text-[13.5px] font-medium ${isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink'} hover:no-underline`}>
            All defects
          </NavLink>
          {authed && role === 'citizen' && (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => `px-3 py-1.5 rounded-btn text-[13.5px] font-medium ${isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink'} hover:no-underline`}>Dashboard</NavLink>
              <NavLink to="/my-reports" className={({ isActive }) => `px-3 py-1.5 rounded-btn text-[13.5px] font-medium ${isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink'} hover:no-underline`}>My reports</NavLink>
              <NavLink to="/report" className={({ isActive }) => `px-3 py-1.5 rounded-btn text-[13.5px] font-medium ${isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink'} hover:no-underline`}>Report</NavLink>
            </>
          )}
          {authed && role === 'contractor' && (
            <NavLink to="/contractor" className={({ isActive }) => `px-3 py-1.5 rounded-btn text-[13.5px] font-medium ${isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink'} hover:no-underline`}>Work queue</NavLink>
          )}
          {authed && role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `px-3 py-1.5 rounded-btn text-[13.5px] font-medium ${isActive ? 'bg-brand-soft text-brand font-semibold' : 'text-muted hover:bg-surface-2 hover:text-ink'} hover:no-underline`}>Admin</NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleTheme}
                  className="w-[34px] h-[34px] grid place-items-center rounded-btn border border-border bg-surface text-muted hover:text-ink hover:border-border-strong"
                  aria-label="Toggle theme">
            {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          {authed && (
            <div className="relative hidden sm:block">
              <button onClick={() => setBellOpen(!bellOpen)}
                      className="relative grid w-[34px] h-[34px] place-items-center rounded-btn border border-border bg-surface text-muted hover:text-ink hover:border-border-strong"
                      aria-label="Notifications">
                <IconBell size={16} />
                {activity.length > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rd-600" />}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[300px] max-w-[340px] p-1.5 bg-surface border border-border rounded-[10px] shadow-xl z-[600]"
                     onMouseLeave={() => setBellOpen(false)}>
                  <div className="px-2.5 pt-2 pb-2 text-[11px] font-bold uppercase tracking-widest text-muted">Recent activity</div>
                  {activity.length === 0 ? (
                    <div className="px-2.5 py-4 text-[13px] text-muted">Nothing yet.</div>
                  ) : (
                    <div className="max-h-[320px] overflow-y-auto">
                      {activity.map(u => (
                        <button key={u.id} onClick={() => { setBellOpen(false); nav(`/defect/${u.defect_id}`); }}
                                className="w-full text-left px-2.5 py-2 rounded-md hover:bg-surface-2">
                          <div className="text-[13px] font-semibold text-ink">{u.action}</div>
                          {u.note && <div className="text-[12px] text-muted mt-0.5 line-clamp-2">{u.note}</div>}
                          <div className="text-[11px] text-muted mt-1">{u.defect_id} · {relativeTime(u.created_at)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {authed ? (
            <div className="relative">
              <button onClick={() => setOpen(!open)}
                      className="flex items-center gap-2 px-2 py-0.5 pr-2.5 rounded-pill border border-border bg-surface hover:border-border-strong">
                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center font-bold text-xs">{initials}</span>
                <span className="hidden md:block text-sm font-semibold text-ink">{displayName.split(' ')[0]}</span>
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-2 min-w-[220px] p-1.5 bg-surface border border-border rounded-[10px] shadow-xl z-[600]"
                     onMouseLeave={() => setOpen(false)}>
                  <div className="px-2.5 pt-2 pb-2.5 border-b border-border mb-1.5">
                    <div className="text-[13.5px] font-semibold text-ink">{displayName}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">{sub}</div>
                    <div className="text-[10.5px] uppercase tracking-widest text-muted mt-1.5 font-bold">{role}</div>
                  </div>
                  <button className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13.5px] text-ink-2 hover:bg-surface-2 hover:text-ink text-left"
                          onClick={() => { setOpen(false); toast('info', 'Profile', 'Profile page not yet implemented in this prototype.'); }}>
                    <IconUser size={15} /> Profile
                  </button>
                  <button className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13.5px] text-ink-2 hover:bg-surface-2 hover:text-ink text-left"
                          onClick={async () => { setOpen(false); await signOut(); nav('/'); toast('info', 'Signed out', 'You can still browse the public map.'); }}>
                    <IconLogout size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm hidden sm:inline-flex">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function TabBar() {
  const { authed, role } = useAuth();
  const loc = useLocation();
  const hide = loc.pathname === '/login' || loc.pathname === '/register';
  if (hide) return null;

  const items = authed && role === 'contractor'
    ? [
        { to: '/contractor', icon: IconList, label: 'Queue' },
        { to: '/defects', icon: IconChart, label: 'Map' },
        { to: '/', icon: IconHome, label: 'Home' },
      ]
    : authed && role === 'admin'
    ? [
        { to: '/admin', icon: IconChart, label: 'Admin' },
        { to: '/defects', icon: IconList, label: 'Defects' },
        { to: '/', icon: IconHome, label: 'Home' },
      ]
    : [
        { to: '/', icon: IconHome, label: 'Home' },
        { to: '/defects', icon: IconList, label: 'Defects' },
        { to: '/report', icon: IconPlus, label: 'Report' },
        { to: authed ? '/my-reports' : '/login', icon: IconUser, label: authed ? 'Mine' : 'Sign in' },
      ];

  return (
    <nav className="md:hidden sticky bottom-0 z-[500] bg-surface/95 backdrop-blur-md border-t border-border grid grid-cols-4 py-1.5 px-1"
         style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink key={to + label} to={to}
                 className={({ isActive }) => `flex flex-col items-center gap-1 py-2 rounded-lg text-[10.5px] font-semibold ${isActive ? 'text-brand' : 'text-muted'} hover:no-underline`}>
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface py-11 mt-auto">
      <div className="w-full max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2.5 font-extrabold text-[15px] mb-3">
            <span className="w-7 h-7 rounded-lg bg-brand text-brand-ink grid place-items-center"><IconWrench size={14} /></span>
            Road Defects
          </div>
          <p className="text-[13px] text-muted">A civic infrastructure platform for NSW local councils. Central West pilot in production since Mar 2025.</p>
        </div>
        {[
          { h: 'Product', links: ['Report a defect', 'Public map', 'For contractors', 'For councils'] },
          { h: 'Support', links: ['Help centre', 'Contact council', 'Data & privacy', 'Accessibility'] },
          { h: 'About', links: ['Councils on board', 'Coverage area', 'Release notes', 'Status'] },
        ].map(col => (
          <div key={col.h}>
            <h5 className="section-label mb-3">{col.h}</h5>
            {col.links.map(l => (
              <a key={l} href="#" className="block py-1 text-[13.5px] text-ink-2 hover:text-brand hover:no-underline">{l}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="w-full max-w-[1280px] mx-auto px-6 mt-8 pt-6 border-t border-border text-xs text-muted flex justify-between">
        <span>© 2026 Orange City Council · Central West NSW</span>
        <span>{HAS_SUPABASE ? 'Connected to Supabase' : 'Demo mode'}</span>
      </div>
    </footer>
  );
}
