import { useState } from 'react';
import { BrandLogo } from '../components/Brand';
import sticker from '../Logos/sticker-lockup.png';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { HAS_SUPABASE } from '../lib/supabase';
import { IconMail, IconLock, IconEye, IconShield } from '../lib/icons';

export function LoginPage() {
  const nav = useNavigate();
  // Page the user was sent here from (e.g. /report), so we can return them after sign-in
  const from = (useLocation().state as { from?: string } | null)?.from;
  const { signIn, setDemoRole, role } = useAuth();
  const { toast } = useUI();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (HAS_SUPABASE) {
        await signIn(email, password);
        // role will be updated by store; read it fresh
        const r = useAuth.getState().role;
        toast('success', 'Welcome back', 'Signed in successfully.');
        nav(from || (r === 'admin' ? '/admin' : r === 'contractor' ? '/contractor' : '/dashboard'));
      } else {
        // Demo mode: pick role by email prefix
        const inferred = email.startsWith('admin') ? 'admin' : email.startsWith('contractor') ? 'contractor' : 'citizen';
        setDemoRole(inferred);
        toast('success', 'Signed in (demo)', 'Configure Supabase for real accounts.');
        nav(inferred === 'admin' ? '/admin' : inferred === 'contractor' ? '/contractor' : '/dashboard');
      }
    } catch (err: any) {
      toast('error', 'Sign in failed', err.message || 'Check your email and password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden md:flex flex-col justify-between p-10 hero-grad">
        <Link to="/" className="self-start hover:no-underline" aria-label="RoadFix home">
          <BrandLogo className="h-8" />
        </Link>
        <div>
          <img src={sticker} alt="RoadFix sticker" className="w-40 h-40 mb-6 drop-shadow-md" />
          <h2 className="text-3xl leading-tight mb-3">Every pothole reported gets closer to fixed.</h2>
          <p className="text-ink-2 max-w-md">Sign in to track your reports, follow repair progress, and back defects nearby.</p>
        </div>
        <div className="text-xs text-muted">Orange City Council · RoadFix</div>
      </div>

      {/* Right form */}
      <div className="flex flex-col justify-center p-8 md:p-12">
        <div className="w-full max-w-[400px] mx-auto">
          <Link to="/" className="md:hidden inline-block mb-8" aria-label="RoadFix home"><BrandLogo className="h-7" /></Link>
          <h1 className="text-[27px]">Sign in</h1>
          <p className="text-muted mt-1.5">Track your reports and get repair updates.</p>

          <form onSubmit={onSubmit} className="grid gap-4 mt-6">
            <div className="grid gap-1.5">
              <label className="label" htmlFor="li-e">Email address</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconMail size={16} /></span>
                <input id="li-e" type="email" required autoComplete="email"
                       className="input !pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="label" htmlFor="li-p">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconLock size={16} /></span>
                <input id="li-p" type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                       className="input !pl-10 !pr-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center text-muted hover:text-ink"
                        aria-label={showPw ? 'Hide password' : 'Show password'}>
                  <IconEye size={16} />
                </button>
              </div>
            </div>
            <div className="-mt-1 text-right">
              <Link to="/forgot-password" className="text-[13px] font-semibold">Forgot password?</Link>
            </div>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-[13.5px] text-muted mt-5">
            No account yet? <Link to="/register" className="font-bold">Create one</Link>
          </p>

          <div className="mt-6 p-3.5 rounded-lg bg-surface-2 border border-border flex gap-2.5">
            <span className="text-em-600 mt-0.5"><IconShield size={15} /></span>
            <p className="text-xs text-muted">
              {HAS_SUPABASE
                ? 'Encrypted in transit and at rest. Your address is never shown publicly.'
                : 'Running in demo mode — no real backend. Configure Supabase to enable real accounts.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
