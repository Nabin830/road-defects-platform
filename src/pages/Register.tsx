import { useState } from 'react';
import { BrandLogo } from '../components/Brand';
import sticker from '../Logos/sticker-icon.png';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homeFor } from '../components/ProtectedRoute';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { HAS_SUPABASE } from '../lib/supabase';
import { IconUser, IconTruck, IconAlert, IconCheck } from '../lib/icons';
import type { Role } from '../lib/types';

export function RegisterPage() {
  // Already signed in when the page opened → go to their own home instead of showing the form again
  const [alreadyIn] = useState(() => { const a = useAuth.getState(); return a.ready && a.authed ? a.role : null; });
  const nav = useNavigate();
  const { signUp, setDemoRole } = useAuth();
  const { toast } = useUI();

  const [role, setRole] = useState<Role>('citizen');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  const pwOk = password.length >= 8;
  const matches = password && confirm && password === confirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) return toast('warning', 'Terms required', 'Please accept the terms to continue.');
    if (!matches) return toast('warning', 'Passwords do not match', 'Please re-enter your password.');
    if (!pwOk) return toast('warning', 'Password too short', 'Use at least 8 characters.');

    setBusy(true);
    try {
      if (HAS_SUPABASE) {
        await signUp(email, password, name, role);
        toast('success', 'Account created', 'Welcome to RoadFix!');
        nav(role === 'contractor' ? '/contractor' : '/dashboard');
      } else {
        setDemoRole(role);
        toast('success', 'Account created (demo)', 'Configure Supabase to enable real accounts.');
        nav(role === 'contractor' ? '/contractor' : '/dashboard');
      }
    } catch (err: any) {
      toast('error', 'Registration failed', err.message || 'Try a different email.');
    } finally {
      setBusy(false);
    }
  }

  if (alreadyIn) return <Navigate to={homeFor(alreadyIn)} replace />;

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 hero-grad">
        <Link to="/" className="self-start hover:no-underline" aria-label="RoadFix home">
          <BrandLogo className="h-8" />
        </Link>
        <div>
          <img src={sticker} alt="RoadFix road-cone sticker" className="w-40 h-40 mb-6 drop-shadow-md" />
          <h2 className="text-3xl leading-tight mb-3">Free for residents and registered contractors.</h2>
          <p className="text-ink-2 max-w-md">Your reports go straight to council. No email chains, no wondering what happened.</p>
        </div>
        <div className="text-xs text-muted">Orange City Council · RoadFix</div>
      </div>

      <div className="flex flex-col justify-center p-8 md:p-12 overflow-y-auto">
        <div className="w-full max-w-[440px] mx-auto">
          <Link to="/" className="md:hidden inline-block mb-8" aria-label="RoadFix home"><BrandLogo className="h-7" /></Link>
          <h1 className="text-[27px]">Create your account</h1>
          <p className="text-muted mt-1.5">Free for residents and registered contractors.</p>

          <form onSubmit={onSubmit} className="grid gap-4 mt-6">
            <fieldset className="border-0 p-0 m-0">
              <legend className="label mb-2">I am registering as</legend>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { v: 'citizen' as Role, i: IconUser, t: "I'm a resident", s: 'Report and follow defects' },
                  { v: 'contractor' as Role, i: IconTruck, t: "I'm a contractor", s: 'Receive and complete council jobs' },
                ].map(({ v, i: Ic, t, s }) => (
                  <label key={v} onClick={() => setRole(v)}
                         className={`card p-3.5 cursor-pointer grid gap-1.5 ${role === v ? 'border-brand bg-brand-soft' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className={role === v ? 'text-brand' : 'text-muted'}><Ic size={19} /></span>
                      <input type="radio" name="rrole" value={v} checked={role === v} onChange={() => setRole(v)} className="accent-brand" />
                    </div>
                    <div>
                      <div className="text-[13.5px] font-bold">{t}</div>
                      <div className="text-[11.5px] text-muted">{s}</div>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-1.5">
              <label className="label" htmlFor="rg-n">{role === 'contractor' ? 'Company name' : 'Full name'}</label>
              <input id="rg-n" className="input" value={name} onChange={(e) => setName(e.target.value)}
                     placeholder={role === 'contractor' ? 'Company name, e.g. Summit Asphalt' : 'Your full name'} autoComplete="name" required />
            </div>

            <div className="grid gap-1.5">
              <label className="label" htmlFor="rg-e">Email address</label>
              <input id="rg-e" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="you@example.com" autoComplete="email" required />
              <span className="ok"><IconCheck size={13} /> We'll send repair updates here</span>
            </div>

            <div className="grid gap-1.5">
              <label className="label" htmlFor="rg-p">Password</label>
              <input id="rg-p" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="At least 8 characters" autoComplete="new-password" required />
              <span className="hint">{pwOk ? '✓ Strong enough' : 'Use 8+ characters.'}</span>
            </div>

            <div className="grid gap-1.5">
              <label className="label" htmlFor="rg-c">Confirm password</label>
              <input id="rg-c" type="password"
                     className={`input ${confirm && !matches ? 'border-rd-600' : ''}`}
                     value={confirm} onChange={(e) => setConfirm(e.target.value)}
                     placeholder="Re-enter password" autoComplete="new-password" required />
              {confirm && !matches && <span className="err"><IconAlert size={13} /> Passwords do not match yet</span>}
              {matches && <span className="ok"><IconCheck size={13} /> Match</span>}
            </div>

            <label className="flex items-start gap-2.5 text-[13px] text-ink-2 cursor-pointer">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
                     className="w-4 h-4 mt-0.5 accent-brand flex-none" required />
              <span>I agree to the <Link to="/terms" target="_blank">terms of use</Link> and <Link to="/privacy" target="_blank">privacy policy</Link>, and understand reports are shown on the public map.</span>
            </label>

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-[13.5px] text-muted mt-4">
            Already registered? <Link to="/login" className="font-bold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
