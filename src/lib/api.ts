import { HAS_SUPABASE, supabase } from './supabase';
import { daysAgo, newDefectId, safePhotoUrl, errorMessage } from './utils';
import { shrinkPhoto } from './image';
import type { PhotoMeta } from './evidence';
import type {
  Defect, DBDefect, Contractor, Profile, RepairUpdate,
  DefectFilters, SignUpInput, SignInInput, CreateDefectInput,
  AppNotification, NotificationKind, Severity,
} from './types';

/* ─────────────────────────────────────────────────────────
   In-memory store used only when Supabase is not configured.
   Starts empty — no sample data.
   ───────────────────────────────────────────────────────── */
// Matches the demo contractor account (see setDemoRole) so jobs can be assigned in demo mode
const DEMO_CONTRACTORS: Contractor[] = [
  { id: 'demo-contractor', name: 'Demo Contractor', abbr: 'DC', crew_size: 1, rating: 0, created_at: new Date().toISOString() },
];
const DEMO_ROWS: Array<Omit<Defect, 'daysAgo' | 'mine'>> = [];
const DEMO_UPDATES: Record<string, Array<Omit<RepairUpdate, 'id'>>> = {};

function mapDefect(r: DBDefect, myUserId: string | null): Defect {
  return {
    ...r,
    photo_url: safePhotoUrl(r.photo_url),
    latitude: typeof r.latitude === 'string' ? parseFloat(r.latitude) : r.latitude,
    longitude: typeof r.longitude === 'string' ? parseFloat(r.longitude) : r.longitude,
    daysAgo: daysAgo(r.reported_at),
    mine: !!myUserId && r.reported_by === myUserId,
  };
}

function withDerived(row: Omit<Defect, 'daysAgo' | 'mine'>, myUserId: string | null): Defect {
  return {
    ...row,
    daysAgo: daysAgo(row.reported_at),
    mine: !!myUserId && row.reported_by === myUserId,
  };
}

/* Demo mode has one user, so show every timeline update as a notification */
const DEMO_KIND: Record<string, NotificationKind> = {
  'Report submitted': 'report', 'Assigned': 'assigned', 'Contractor accepted': 'accepted',
  'Contractor declined': 'declined', 'Work started': 'progress', 'Progress update': 'progress',
  'Repair complete': 'complete', 'Verified by council': 'verified', 'Rework requested': 'rework',
  'Report rejected': 'rejected',
};
let demoReadIds = new Set<string>();
function demoNotifications(userId: string): AppNotification[] {
  return Object.values(demoUpdates).flat()
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map(u => ({
      id: u.id, user_id: userId, defect_id: u.defect_id,
      defect_title: demoDefects.find(d => d.id === u.defect_id)?.title ?? null,
      kind: DEMO_KIND[u.action] || 'update', title: u.action, body: u.note,
      read_at: demoReadIds.has(u.id) ? u.created_at : null, created_at: u.created_at,
    }));
}

/* Runtime demo store (mutable copy) */
let demoDefects: Array<Omit<Defect, 'daysAgo' | 'mine'>> = DEMO_ROWS.map(r => ({ ...r }));
const demoUpdates: Record<string, RepairUpdate[]> = Object.fromEntries(
  Object.entries(DEMO_UPDATES).map(([k, arr]) => [k, arr.map((u, i) => ({ id: `${k}-${i}`, ...u }))])
);
const demoVotes = new Set<string>();      // `${defectId}:${userId}`
const demoFollows = new Set<string>();    // `${defectId}:${userId}`

/** Supabase returns at most 1,000 rows per request by default — fetch page by page so
 *  lists, maps and council reports never silently miss rows once the program grows. */
const PAGE = 1000;
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error instanceof Error ? error : new Error(errorMessage(error, 'Could not load data.'));
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════ */

export const api = {
  /* ── auth ───────────────────────────────────────────────────── */
  async signUp(input: SignUpInput) {
    if (!HAS_SUPABASE) throw new Error('Configure Supabase to sign up (see README).');
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      // Leave suburb out when empty, so the profile stores "no suburb" rather than a blank string
      options: { data: { name: input.name, role: input.role || 'citizen', ...(input.suburb?.trim() ? { suburb: input.suburb.trim() } : {}) } },
    });
    if (error) throw error;
    return data;
  },

  async signIn(input: SignInInput) {
    if (!HAS_SUPABASE) throw new Error('Configure Supabase to sign in (see README).');
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!HAS_SUPABASE) return;
    await supabase.auth.signOut();
  },

  async updateProfile(userId: string, patch: { name: string; phone: string | null; suburb: string | null }): Promise<void> {
    if (!HAS_SUPABASE) return;
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Could not save your profile.');
  },

  /** Contractors can rename their own company (what council sees when assigning). */
  async renameCompany(contractorId: string, name: string): Promise<void> {
    if (!HAS_SUPABASE) {
      const c = DEMO_CONTRACTORS.find(x => x.id === contractorId);
      if (c) c.name = name;
      return;
    }
    const { data, error } = await supabase.from('contractors').update({ name }).eq('id', contractorId).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Could not rename the company.');
  },

  async changePassword(newPassword: string): Promise<void> {
    if (!HAS_SUPABASE) throw new Error('Configure Supabase to change passwords.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    if (!HAS_SUPABASE) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single<Profile>();
    if (error) return null;
    return data;
  },

  /* ── defects ────────────────────────────────────────────────── */
  async listDefects(filters: DefectFilters = {}, myUserId: string | null = null): Promise<Defect[]> {
    if (!HAS_SUPABASE) {
      let out = demoDefects.slice();
      if (filters.status && filters.status !== 'all') out = out.filter(d => d.status === filters.status);
      if (filters.severity && filters.severity.length) out = out.filter(d => filters.severity!.includes(d.severity));
      if (filters.type && filters.type !== 'all') out = out.filter(d => d.defect_type === filters.type);
      if (filters.q) {
        const q = filters.q.toLowerCase();
        out = out.filter(d => d.title.toLowerCase().includes(q) || d.road.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
      }
      return out.sort((a, b) => +new Date(b.reported_at) - +new Date(a.reported_at)).map(r => withDerived(r, myUserId));
    }
    const rows = await fetchAll<DBDefect>((from, to) => {
      let q = supabase.from('defects').select('*').order('reported_at', { ascending: false }).order('id').range(from, to);
      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters.severity && filters.severity.length) q = q.in('severity', filters.severity);
      if (filters.type && filters.type !== 'all') q = q.eq('defect_type', filters.type);
      if (filters.q) {
        // Quote the value so commas, brackets and dots in a search (e.g. "Summer St, Orange") don't break the filter
        const v = `"%${filters.q.replace(/[\\"]/g, '\\$&').replace(/[%_]/g, '\\$&')}%"`;
        q = q.or(`title.ilike.${v},road.ilike.${v},description.ilike.${v}`);
      }
      return q;
    });
    return rows.map(r => mapDefect(r, myUserId));
  },

  async getDefect(id: string, myUserId: string | null = null): Promise<Defect> {
    if (!HAS_SUPABASE) {
      const r = demoDefects.find(d => d.id === id);
      if (!r) throw new Error('Defect not found');
      return withDerived(r, myUserId);
    }
    const { data, error } = await supabase.from('defects').select('*').eq('id', id).single<DBDefect>();
    if (error) throw error;
    return mapDefect(data, myUserId);
  },

  async myReports(userId: string): Promise<Defect[]> {
    if (!HAS_SUPABASE) {
      return demoDefects.filter(d => d.reported_by === userId || d.reported_by === 'demo-citizen')
        .sort((a, b) => +new Date(b.reported_at) - +new Date(a.reported_at))
        .map(r => withDerived(r, userId));
    }
    const { data, error } = await supabase.from('defects').select('*').eq('reported_by', userId).order('reported_at', { ascending: false });
    if (error) throw error;
    return (data as DBDefect[] || []).map(r => mapDefect(r, userId));
  },

  async contractorQueue(contractorId: string, myUserId: string | null = null): Promise<Defect[]> {
    if (!HAS_SUPABASE) {
      return demoDefects.filter(d => d.contractor_id === contractorId && ['assigned', 'progress', 'completed'].includes(d.status))
        .sort((a, b) => +new Date(b.reported_at) - +new Date(a.reported_at))
        .map(r => withDerived(r, myUserId));
    }
    const rows = await fetchAll<DBDefect>((from, to) => supabase.from('defects').select('*')
      .eq('contractor_id', contractorId)
      .in('status', ['assigned', 'progress', 'completed'])
      .order('reported_at', { ascending: false }).order('id').range(from, to));
    return rows.map(r => mapDefect(r, myUserId));
  },

  /** `opts.id` fixes the report ID up front, so sending the same report twice (e.g. the connection
   *  dropped after it was saved) returns the saved one instead of creating a copy.
   *  `opts.offline` marks a report saved on the phone with no internet and sent later. */
  async createDefect(input: CreateDefectInput, userId: string, opts: { id?: string; offline?: boolean } = {}, attempt = 1): Promise<Defect> {
    const id = opts.id ?? newDefectId();
    if (!HAS_SUPABASE) {
      const row: Omit<Defect, 'daysAgo' | 'mine'> = {
        id, title: input.title, description: input.description,
        defect_type: input.defect_type, severity: input.severity, status: 'pending',
        road: input.road, suburb: input.suburb || 'Orange',
        latitude: input.latitude, longitude: input.longitude,
        depth: null, width: null, photo_url: input.photo_url ?? null, ...input.photo, photo_flags: [],
        votes: 0, progress: 0, reject_reason: null,
        reported_by: userId, contractor_id: null,
        reported_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      demoDefects = [row, ...demoDefects];
      demoUpdates[id] = [{
        id: `${id}-0`, defect_id: id, action: 'Report submitted',
        note: 'Report captured with location and description.', progress: 0, photo_url: null,
        actor_id: userId, actor_role: 'citizen', created_at: new Date().toISOString(),
      }];
      return withDerived(row, userId);
    }
    const insert = {
      id, title: input.title, description: input.description,
      defect_type: input.defect_type, severity: input.severity, status: 'pending' as const,
      road: input.road, suburb: input.suburb || 'Orange',
      latitude: input.latitude, longitude: input.longitude,
      photo_url: input.photo_url ?? null,
      ...input.photo,
      captured_offline: !!opts.offline,
      reported_by: userId,
    };
    const { data, error } = await supabase.from('defects').insert(insert).select().single<DBDefect>();
    if (error?.code === '23505' && attempt < 3) {
      // Already saved by an earlier try of this same report → that's success
      if (opts.id) {
        const { data: saved } = await supabase.from('defects').select('*').eq('id', id).maybeSingle<DBDefect>();
        if (saved?.reported_by === userId) return mapDefect(saved, userId);
      }
      // Someone else's report got the same ID in the same second — try again with a fresh one
      return this.createDefect(input, userId, { ...opts, id: undefined }, attempt + 1);
    }
    if (error) throw error;
    // The report is saved at this point — a failed timeline entry mustn't make it look like it failed
    await this.addUpdate(id, { action: 'Report submitted', note: 'Report captured with location and description.', progress: 0 }, userId, 'citizen')
      .catch(() => {});
    return mapDefect(data, userId);
  },

  async updateDefect(id: string, patch: Partial<DBDefect>): Promise<void> {
    if (!HAS_SUPABASE) {
      const i = demoDefects.findIndex(d => d.id === id);
      if (i >= 0) {
        // In-memory patch — preserve numeric lat/lng (patch could carry string decimals from DB shape)
        const current = demoDefects[i];
        const merged: Omit<Defect, 'daysAgo' | 'mine'> = {
          ...current,
          ...patch,
          latitude: typeof patch.latitude === 'number' ? patch.latitude : current.latitude,
          longitude: typeof patch.longitude === 'number' ? patch.longitude : current.longitude,
        };
        demoDefects[i] = merged;
      }
      return;
    }
    const { data, error } = await supabase.from('defects').update(patch).eq('id', id).select('id');
    if (error) throw error;
    // Row-level security silently skips rows you may not edit — report that instead of pretending it worked
    if (!data || data.length === 0) throw new Error("You don't have permission to change this defect.");
  },

  /** Council hands the job to a contractor with a work order (what to do) and a fix-by date. */
  async assignDefect(id: string, contractorId: string, workInstructions: string, dueAt: string): Promise<void> {
    return this.updateDefect(id, {
      contractor_id: contractorId, status: 'assigned', accepted_at: null, verified_at: null, progress: 0, reject_reason: null,
      work_instructions: workInstructions, due_at: dueAt,
    });
  },

  /** Accepting a job starts it: Assigned → In progress. */
  async acceptAssignment(id: string, actorId: string): Promise<void> {
    await this.updateDefect(id, { status: 'progress', accepted_at: new Date().toISOString() });
    await this.addUpdate(id, { action: 'Contractor accepted', note: 'Job accepted and in progress. Crew will be scheduled.', progress: 10 }, actorId, 'contractor');
  },

  /** Contractor finishes a job — a photo of the finished repair is required. Photo update + status change in one step. */
  async completeJob(id: string, note: string, photoUrl: string, photo: PhotoMeta, actorId: string): Promise<void> {
    if (!HAS_SUPABASE) {
      await this.addUpdate(id, { action: 'Repair complete', note: note || 'Site cleared. Waiting for council to verify.', progress: 100, photo_url: photoUrl, photo }, actorId, 'contractor');
      await this.updateDefect(id, { status: 'completed', progress: 100 });
      return;
    }
    const { error } = await supabase.rpc('complete_job', { p_defect_id: id, p_note: note, p_photo_url: photoUrl, p_photo: photo });
    if (error) throw error;
  },

  /** Contractor turns the job down — it goes back to the council as unassigned. */
  async declineAssignment(id: string, reason: string, actorId: string): Promise<void> {
    if (!HAS_SUPABASE) {
      await this.updateDefect(id, { status: 'pending', contractor_id: null, accepted_at: null, progress: 0 });
      await this.addUpdate(id, { action: 'Contractor declined', note: reason, progress: 0 }, actorId, 'contractor');
      return;
    }
    const { error } = await supabase.rpc('decline_assignment', { p_defect_id: id, p_reason: reason });
    if (error) throw error;
  },

  /** Council regrades a report during triage; logged on the timeline. */
  async changeSeverity(id: string, from: Severity, to: Severity, actorId: string): Promise<void> {
    await this.updateDefect(id, { severity: to });
    const label = (s: Severity) => s.charAt(0).toUpperCase() + s.slice(1);
    await this.addUpdate(id, { action: 'Severity changed', note: `${label(from)} → ${label(to)}` }, actorId, 'admin');
  },

  /** Council confirms the contractor's completed repair and closes the job. */
  async verifyDefect(id: string, actorId: string): Promise<void> {
    await this.updateDefect(id, { verified_at: new Date().toISOString() });
    await this.addUpdate(id, { action: 'Verified by council', note: 'Repair inspected and approved. Defect closed.', progress: 100 }, actorId, 'admin');
  },

  /** Council isn't satisfied — the job goes back to the contractor as in progress. */
  async requestRework(id: string, note: string, actorId: string): Promise<void> {
    await this.updateDefect(id, { status: 'progress', progress: 80, verified_at: null });
    await this.addUpdate(id, { action: 'Rework requested', note, progress: 80 }, actorId, 'admin');
  },

  async rejectDefect(id: string, reason: string, actorId: string): Promise<void> {
    await this.updateDefect(id, { status: 'rejected', reject_reason: reason, contractor_id: null, accepted_at: null });
    await this.addUpdate(id, { action: 'Report rejected', note: reason, progress: 0 }, actorId, 'admin');
  },

  /* ── updates ────────────────────────────────────────────────── */
  async listUpdates(defectId: string): Promise<RepairUpdate[]> {
    if (!HAS_SUPABASE) return demoUpdates[defectId] || [];
    const { data, error } = await supabase.from('repair_updates').select('*').eq('defect_id', defectId).order('created_at', { ascending: true });
    if (error) throw error;
    return ((data as RepairUpdate[]) || []).map(u => ({ ...u, photo_url: safePhotoUrl(u.photo_url) }));
  },

  async addUpdate(
    defectId: string,
    body: { action: string; note?: string; progress?: number | null; photo_url?: string | null; photo?: PhotoMeta | null },
    actorId: string,
    actorRole: 'citizen' | 'contractor' | 'admin' | null,
  ): Promise<void> {
    if (!HAS_SUPABASE) {
      const arr = demoUpdates[defectId] || (demoUpdates[defectId] = []);
      arr.push({
        id: `${defectId}-${arr.length}`, defect_id: defectId,
        action: body.action, note: body.note ?? null,
        progress: body.progress ?? null, photo_url: body.photo_url ?? null, ...body.photo, photo_flags: [],
        actor_id: actorId, actor_role: actorRole,
        created_at: new Date().toISOString(),
      });
      if (typeof body.progress === 'number') {
        const i = demoDefects.findIndex(d => d.id === defectId);
        if (i >= 0) demoDefects[i] = { ...demoDefects[i], progress: body.progress };
      }
      return;
    }
    const row = {
      defect_id: defectId,
      action: body.action,
      note: body.note ?? null,
      progress: body.progress ?? null,
      photo_url: body.photo_url ?? null,
      ...body.photo,
      actor_id: actorId,
      actor_role: actorRole,
    };
    const { error } = await supabase.from('repair_updates').insert(row);
    if (error) throw error;
    if (typeof body.progress === 'number') {
      await supabase.from('defects').update({ progress: body.progress }).eq('id', defectId);
    }
  },

  /* ── contractors ────────────────────────────────────────────── */
  async listContractors(): Promise<Contractor[]> {
    if (!HAS_SUPABASE) return DEMO_CONTRACTORS;
    const { data, error } = await supabase.from('contractors').select('*').order('name');
    if (error) throw error;
    return (data as Contractor[]) || [];
  },

  /* ── analytics ──────────────────────────────────────────────── */
  /** Public homepage figures, worked out from the defects already loaded (no fabricated numbers). */
  statsFrom(defects: Defect[]): import('./types').PlatformStats {
    const totalReported = defects.length;
    const totalCompleted = defects.filter(d => d.status === 'completed' && d.verified_at).length;
    const closureRate = totalReported ? Math.round((totalCompleted / totalReported) * 100) : 0;
    const inProgress = defects.filter(d => d.status === 'assigned' || d.status === 'progress' || (d.status === 'completed' && !d.verified_at)).length;
    const activeResidents = new Set(defects.map(d => d.reported_by).filter(Boolean)).size;
    return { totalReported, totalCompleted, closureRate, inProgress, activeResidents };
  },

  /* ── votes ("back this report") ────────────────────────────────── */
  async hasVoted(defectId: string, userId: string): Promise<boolean> {
    if (!userId) return false;
    if (!HAS_SUPABASE) return demoVotes.has(`${defectId}:${userId}`);
    const { data } = await supabase.from('votes').select('defect_id').eq('defect_id', defectId).eq('user_id', userId).maybeSingle();
    return !!data;
  },

  async vote(defectId: string, userId: string): Promise<void> {
    if (!HAS_SUPABASE) {
      demoVotes.add(`${defectId}:${userId}`);
      const i = demoDefects.findIndex(d => d.id === defectId);
      if (i >= 0) demoDefects[i] = { ...demoDefects[i], votes: demoDefects[i].votes + 1 };
      return;
    }
    const { error } = await supabase.from('votes').insert({ defect_id: defectId, user_id: userId });
    if (error && error.code !== '23505') throw error; // ignore duplicate-vote race
  },

  async unvote(defectId: string, userId: string): Promise<void> {
    if (!HAS_SUPABASE) {
      demoVotes.delete(`${defectId}:${userId}`);
      const i = demoDefects.findIndex(d => d.id === defectId);
      if (i >= 0) demoDefects[i] = { ...demoDefects[i], votes: Math.max(0, demoDefects[i].votes - 1) };
      return;
    }
    const { error } = await supabase.from('votes').delete().eq('defect_id', defectId).eq('user_id', userId);
    if (error) throw error;
  },

  /* ── follows ("follow updates") ────────────────────────────────── */
  async isFollowing(defectId: string, userId: string): Promise<boolean> {
    if (!userId) return false;
    if (!HAS_SUPABASE) return demoFollows.has(`${defectId}:${userId}`);
    const { data } = await supabase.from('followers').select('defect_id').eq('defect_id', defectId).eq('user_id', userId).maybeSingle();
    return !!data;
  },

  async follow(defectId: string, userId: string): Promise<void> {
    if (!HAS_SUPABASE) { demoFollows.add(`${defectId}:${userId}`); return; }
    const { error } = await supabase.from('followers').insert({ defect_id: defectId, user_id: userId });
    if (error && error.code !== '23505') throw error;
  },

  async unfollow(defectId: string, userId: string): Promise<void> {
    if (!HAS_SUPABASE) { demoFollows.delete(`${defectId}:${userId}`); return; }
    const { error } = await supabase.from('followers').delete().eq('defect_id', defectId).eq('user_id', userId);
    if (error) throw error;
  },

  /* ── council: people & companies ───────────────────────────────── */
  async listProfiles(): Promise<Profile[]> {
    if (!HAS_SUPABASE) {
      const now = new Date().toISOString();
      return (['admin', 'contractor', 'citizen'] as const).map(r => ({
        id: `demo-${r}`, email: `${r}@demo.local`, role: r, phone: null, suburb: null, avatar_url: null,
        name: r === 'admin' ? 'Council Officer' : r === 'contractor' ? 'Demo Contractor' : 'Demo Resident',
        contractor_id: r === 'contractor' ? 'demo-contractor' : null, created_at: now, updated_at: now,
      }));
    }
    return fetchAll<Profile>((from, to) =>
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).order('id').range(from, to));
  },

  /** Council changes a user's role; contractors are linked to a company (a new one if none given). */
  async setUserRole(userId: string, role: Profile['role'], contractorId: string | null = null): Promise<void> {
    if (!HAS_SUPABASE) throw new Error('Configure Supabase to manage users.');
    const { error } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role, p_contractor: contractorId });
    if (error) throw error;
  },

  async createCompany(name: string): Promise<Contractor> {
    const abbr = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    if (!HAS_SUPABASE) {
      const c: Contractor = { id: `demo-${Date.now()}`, name, abbr, crew_size: 1, rating: 0, created_at: new Date().toISOString() };
      DEMO_CONTRACTORS.push(c);
      return c;
    }
    const { data, error } = await supabase.from('contractors').insert({ name, abbr }).select().single<Contractor>();
    if (error) throw error;
    return data;
  },

  /** Timeline entries used by the council reports (assignment and completion times). */
  async listMilestones(): Promise<Pick<RepairUpdate, 'defect_id' | 'action' | 'created_at'>[]> {
    if (!HAS_SUPABASE) {
      return Object.values(demoUpdates).flat()
        .filter(u => u.action === 'Assigned' || u.action === 'Repair complete')
        .map(({ defect_id, action, created_at }) => ({ defect_id, action, created_at }));
    }
    return fetchAll<Pick<RepairUpdate, 'defect_id' | 'action' | 'created_at'>>((from, to) =>
      supabase.from('repair_updates').select('defect_id, action, created_at')
        .in('action', ['Assigned', 'Repair complete']).order('created_at', { ascending: true }).order('id').range(from, to));
  },

  /* ── notifications (header bell) ─────────────────────────────── */
  async listNotifications(userId: string): Promise<AppNotification[]> {
    if (!HAS_SUPABASE) return demoNotifications(userId);
    const { data, error } = await supabase.from('notifications').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    return (data as AppNotification[]) || [];
  },

  /** Mark the given notifications (or all of them) as read. */
  async markNotificationsRead(userId: string, ids: string[] | 'all'): Promise<void> {
    const now = new Date().toISOString();
    if (!HAS_SUPABASE) {
      demoReadIds = ids === 'all' ? new Set(demoNotifications(userId).map(n => n.id)) : new Set([...demoReadIds, ...ids]);
      return;
    }
    let q = supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
    if (ids !== 'all') q = q.in('id', ids);
    const { error } = await q;
    if (error) throw error;
  },

  /** Live feed of new notifications. Returns an unsubscribe function. */
  subscribeNotifications(userId: string, onNew: (n: AppNotification) => void): () => void {
    if (!HAS_SUPABASE) return () => {};
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => onNew(payload.new as AppNotification))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  },

  /* ── photo storage ──────────────────────────────────────────────── */
  /** Removes a photo this user uploaded (used when the report it was for is refused). Best effort. */
  async deletePhoto(publicUrl: string): Promise<void> {
    if (!HAS_SUPABASE) return;
    const marker = '/object/public/defect-photos/';
    const i = publicUrl.indexOf(marker);
    if (i < 0) return;
    await supabase.storage.from('defect-photos').remove([decodeURIComponent(publicUrl.slice(i + marker.length))]).catch(() => {});
  },

  /** `name` (letters, digits, - and _) fixes the file name, so retrying an upload that already
   *  went through reuses that file instead of storing the photo twice. */
  async uploadPhoto(original: File, userId: string, name?: string): Promise<string> {
    if (!HAS_SUPABASE) return URL.createObjectURL(original); // local preview only, not persisted
    const file = await shrinkPhoto(original);
    if (file.size > 8 * 1024 * 1024) throw new Error('That photo is too large to upload. Please choose a smaller one.');
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] || 'jpg';
    const path = `${userId}/${name ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}.${ext}`;
    const { error } = await supabase.storage.from('defect-photos').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
    });
    const alreadyThere = !!name && !!error && /already exists|duplicate/i.test(error.message);
    if (error && !alreadyThere) throw error;
    const { data } = supabase.storage.from('defect-photos').getPublicUrl(path);
    return data.publicUrl;
  },
};
