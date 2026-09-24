import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { IconMail, IconLock, IconCheckCircle, IconLeft } from '../lib/icons';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full max-w-[440px] mx-auto px-4 sm:px-6 py-14">
      <div className="card p-6 sm:p-8">{children}</div>
    </main>
  );
}

/** Step 1: ask for the email address and send a reset link. */
export function ForgotPasswordPage() {
  const { toast } = useUI();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: any) {
      toast('error', 'Could not send reset email', err.message || 'Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <Shell>
      {sent ? (
        <div className="text-center">
          <span className="w-12 h-12 mx-auto rounded-full bg-em-50 text-em-600 grid place-items-center mb-4"><IconCheckCircle size={24} /></span>
          <h1 className="text-[22px]">Check your email</h1>
          <p className="text-muted mt-2 text-[14px]">If an account exists for <b className="text-ink">{email}</b>, we've sent a link to reset your password. Open it on this device.</p>
          <Link to="/login" className="btn btn-secondary btn-block mt-6 hover:no-underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <div>
            <h1 className="text-[22px]">Reset your password</h1>
            <p className="text-muted mt-1.5 text-[14px]">Enter your email and we'll send you a link to choose a new password.</p>
          </div>
          <div className="grid gap-1.5">
            <label className="label" htmlFor="fp-e">Email address</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconMail size={16} /></span>
              <input id="fp-e" type="email" required autoComplete="email" className="input !pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <Link to="/login" className="text-center text-[13.5px] font-semibold flex items-center justify-center gap-1"><IconLeft size={14} /> Back to sign in</Link>
        </form>
      )}
    </Shell>
  );
}

/** Step 2: user arrives from the email link (already signed in by Supabase) and sets a new password. */
export function ResetPasswordPage() {
  const nav = useNavigate();
  const { toast } = useUI();
  const { authed, role, setRecovery } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast('warning', 'Password too short', 'Use at least 8 characters.');
    if (pw !== pw2) return toast('warning', 'Passwords do not match', 'Please re-enter your new password.');
    setBusy(true);
    try {
      await api.changePassword(pw);
      setRecovery(false);
      // Drop the ?reset=1&code=… left by the email link
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      toast('success', 'Password updated', 'You are signed in with your new password.');
      nav(role === 'admin' ? '/admin' : role === 'contractor' ? '/contractor' : '/dashboard', { replace: true });
    } catch (err: any) {
      toast('error', 'Could not update password', err.message || 'The link may have expired — request a new one.');
    } finally { setBusy(false); }
  }

  if (!authed) {
    return (
      <Shell>
        <h1 className="text-[22px]">Link expired or already used</h1>
        <p className="text-muted mt-2 text-[14px]">Password reset links work once, on the device that requested them. Request a new one to continue.</p>
        <Link to="/forgot-password" className="btn btn-primary btn-block mt-6 hover:no-underline">Request a new link</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <h1 className="text-[22px]">Choose a new password</h1>
          <p className="text-muted mt-1.5 text-[14px]">Use at least 8 characters.</p>
        </div>
        <div className="grid gap-1.5">
          <label className="label" htmlFor="rp-1">New password</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"><IconLock size={16} /></span>
            <input id="rp-1" type="password" required autoComplete="new-password" className="input !pl-10" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <label className="label" htmlFor="rp-2">Confirm new password</label>
          <input id="rp-2" type="password" required autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </Shell>
  );
}
