import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { HAS_SUPABASE } from '../lib/supabase';
import { initialsOf } from '../lib/utils';
import { IconCheck, IconLock, IconUser, IconTruck } from '../lib/icons';
import type { Contractor } from '../lib/types';

const ROLE_LABEL = { citizen: 'Resident', contractor: 'Contractor', admin: 'Council' } as const;

export function ProfilePage() {
  const { profile, userId, role, refreshProfile } = useAuth();
  const { toast } = useUI();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [suburb, setSuburb] = useState('');
  const [company, setCompany] = useState<Contractor | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    setName(profile?.name || '');
    setPhone(profile?.phone || '');
    setSuburb(profile?.suburb || '');
  }, [profile]);

  useEffect(() => {
    if (!profile?.contractor_id) return;
    api.listContractors().then(list => {
      const c = list.find(x => x.id === profile.contractor_id) || null;
      setCompany(c);
      setCompanyName(c?.name || '');
    }).catch(() => {});
  }, [profile?.contractor_id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !name.trim()) return toast('warning', 'Name required', 'Please enter your name.');
    setSaving(true);
    try {
      await api.updateProfile(userId, { name: name.trim(), phone: phone.trim() || null, suburb: suburb.trim() || null });
      if (company && companyName.trim() && companyName.trim() !== company.name) {
        await api.renameCompany(company.id, companyName.trim());
        setCompany({ ...company, name: companyName.trim() });
      }
      await refreshProfile();
      toast('success', 'Profile saved', 'Your details have been updated.');
    } catch (err: any) {
      toast('error', 'Could not save', err.message || 'Please try again.');
    } finally { setSaving(false); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast('warning', 'Password too short', 'Use at least 8 characters.');
    if (pw !== pw2) return toast('warning', 'Passwords do not match', 'Please re-enter your new password.');
    setPwBusy(true);
    try {
      await api.changePassword(pw);
      setPw(''); setPw2('');
      toast('success', 'Password changed', 'Use your new password next time you sign in.');
    } catch (err: any) {
      toast('error', 'Could not change password', err.message || 'Please try again.');
    } finally { setPwBusy(false); }
  }

  return (
    <main className="w-full max-w-[760px] mx-auto px-4 sm:px-6 py-8">
      <span className="section-label">Account</span>
      <h1 className="mt-1 mb-6">Profile &amp; settings</h1>

      <div className="card p-5 mb-5 flex items-center gap-4">
        <span className="w-14 h-14 rounded-full bg-brand text-brand-ink grid place-items-center font-bold text-lg flex-none">{initialsOf(profile?.name || '')}</span>
        <div className="min-w-0">
          <div className="text-[16px] font-bold text-ink truncate">{profile?.name}</div>
          <div className="text-[13px] text-muted truncate">{profile?.email}</div>
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10.5px] font-bold uppercase tracking-wider">{ROLE_LABEL[role]}</span>
        </div>
      </div>

      <form onSubmit={saveProfile} className="card mb-5">
        <div className="card-head"><IconUser size={17} /><h3 className="text-[17px]">Your details</h3></div>
        <div className="card-body grid gap-4">
          <div className="grid gap-1.5">
            <label className="label" htmlFor="pf-name">Full name</label>
            <input id="pf-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="label" htmlFor="pf-phone">Phone <span className="text-muted font-normal">(optional)</span></label>
              <input id="pf-phone" className="input" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
            </div>
            <div className="grid gap-1.5">
              <label className="label" htmlFor="pf-suburb">Suburb <span className="text-muted font-normal">(optional)</span></label>
              <input id="pf-suburb" className="input" maxLength={80} value={suburb} onChange={(e) => setSuburb(e.target.value)} autoComplete="address-level2" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <label className="label" htmlFor="pf-email">Email</label>
            <input id="pf-email" className="input opacity-70" value={profile?.email || ''} disabled />
            <span className="hint">Your sign-in email can't be changed here.</span>
          </div>
          {company && (
            <div className="grid gap-1.5 pt-2 border-t border-border">
              <label className="label flex items-center gap-1.5" htmlFor="pf-company"><IconTruck size={14} /> Company name</label>
              <input id="pf-company" className="input" maxLength={80} minLength={2} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <span className="hint">This is the name council sees when assigning jobs.</span>
            </div>
          )}
        </div>
        <footer className="flex justify-end p-4 bg-surface-2 border-t border-border rounded-b-card">
          <button className="btn btn-primary" disabled={saving}><IconCheck size={15} /> {saving ? 'Saving…' : 'Save changes'}</button>
        </footer>
      </form>

      <form onSubmit={savePassword} className="card">
        <div className="card-head"><IconLock size={17} /><h3 className="text-[17px]">Change password</h3></div>
        <div className="card-body grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <label className="label" htmlFor="pf-pw">New password</label>
            <input id="pf-pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
          </div>
          <div className="grid gap-1.5">
            <label className="label" htmlFor="pf-pw2">Confirm new password</label>
            <input id="pf-pw2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <footer className="flex justify-end p-4 bg-surface-2 border-t border-border rounded-b-card">
          <button className="btn btn-secondary" disabled={pwBusy || !pw || !HAS_SUPABASE}>{pwBusy ? 'Updating…' : 'Update password'}</button>
        </footer>
      </form>
    </main>
  );
}
