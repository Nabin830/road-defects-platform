import { HAS_SUPABASE, supabase } from './supabase';
import { daysAgo, newDefectId } from './utils';
import type {
  Defect, DBDefect, Contractor, Profile, RepairUpdate,
  DefectFilters, SignUpInput, SignInInput, CreateDefectInput, AdminStats,
} from './types';

/* ─────────────────────────────────────────────────────────
   Demo data used when Supabase is not configured.
   Enables the app to run standalone for previewing.
   ───────────────────────────────────────────────────────── */
const DEMO_CONTRACTORS: Contractor[] = [
  { id: 'c1', name: 'Central West Road Services', abbr: 'CW', crew_size: 6, rating: 4.8, created_at: new Date().toISOString() },
  { id: 'c2', name: 'Cabonne Civil',              abbr: 'CC', crew_size: 4, rating: 4.4, created_at: new Date().toISOString() },
  { id: 'c3', name: 'Summit Asphalt',             abbr: 'SA', crew_size: 8, rating: 4.9, created_at: new Date().toISOString() },
  { id: 'c4', name: 'Orange City Works Crew',     abbr: 'OW', crew_size: 5, rating: 4.2, created_at: new Date().toISOString() },
];

const DEMO_ROWS: Array<Omit<Defect, 'daysAgo' | 'mine'>> = [
  { id: 'RD-2041', title: 'Deep pothole in eastbound lane', description: 'Large pothole has opened in the eastbound lane approaching the Anson St lights. Water pooling in it after Tuesday rain. Two cars ahead of me hit it hard. Vehicle damage risk — this is on a bus route.', defect_type: 'pothole', severity: 'critical', status: 'progress', road: 'Summer St at Anson St', suburb: 'Orange', latitude: -33.28362, longitude: 149.09902, depth: '180 mm', width: '0.9 m', photo_url: null, votes: 23, progress: 60, reject_reason: null, reported_by: 'demo-citizen', contractor_id: 'c3', reported_at: new Date(Date.now() - 2 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2038', title: 'Sealed edge collapsing on shoulder', description: 'Bitumen edge has broken away along a 22 metre stretch on the southern shoulder. Heavy truck traffic is widening it daily.', defect_type: 'edge', severity: 'high', status: 'assigned', road: 'Mitchell Hwy, 1.4 km W of Lucknow', suburb: 'Lucknow', latitude: -33.31290, longitude: 149.16240, depth: '90 mm', width: '0.4 m × 22 m', photo_url: null, votes: 11, progress: 0, reject_reason: null, reported_by: 'other', contractor_id: 'c1', reported_at: new Date(Date.now() - 4 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2033', title: 'Stormwater pooling across both lanes', description: 'The grate is blocked with leaf litter so runoff crosses the full carriageway after any decent rain. Visibility of the kerb line is gone at night.', defect_type: 'flooding', severity: 'high', status: 'pending', road: 'Ophir St near Warrendine St', suburb: 'Orange', latitude: -33.27698, longitude: 149.09612, depth: null, width: '12 m', photo_url: null, votes: 17, progress: 0, reject_reason: null, reported_by: 'demo-citizen', contractor_id: null, reported_at: new Date(Date.now() - 1 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2029', title: 'Longitudinal cracking, 40 m section', description: 'Series of parallel cracks running with the direction of travel. Widening since winter.', defect_type: 'crack', severity: 'medium', status: 'completed', road: 'Byng St near Lords Place', suburb: 'Orange', latitude: -33.28118, longitude: 149.10140, depth: '25 mm', width: '40 m', photo_url: null, votes: 6, progress: 100, reject_reason: null, reported_by: 'demo-citizen', contractor_id: 'c3', reported_at: new Date(Date.now() - 21 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2026', title: 'Pothole cluster outside primary school', description: 'Three potholes in the drop-off zone. Parents are swerving into the opposing lane to avoid them at pickup time.', defect_type: 'pothole', severity: 'critical', status: 'assigned', road: 'McLachlan St at Kite St', suburb: 'Orange', latitude: -33.28902, longitude: 149.09338, depth: '140 mm', width: '3 potholes', photo_url: null, votes: 38, progress: 0, reject_reason: null, reported_by: 'other', contractor_id: 'c1', reported_at: new Date(Date.now() - 3 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2024', title: 'Give way sign knocked flat', description: 'Sign post sheared at the base, likely struck overnight. Intersection currently uncontrolled.', defect_type: 'signage', severity: 'critical', status: 'completed', road: 'Bathurst Rd at Hill St', suburb: 'Orange', latitude: -33.29470, longitude: 149.11180, depth: null, width: null, photo_url: null, votes: 14, progress: 100, reject_reason: null, reported_by: 'other', contractor_id: 'c4', reported_at: new Date(Date.now() - 9 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2021', title: 'Centre line completely worn away', description: 'Line marking is invisible in wet conditions along the whole stretch past the showground turnoff.', defect_type: 'marking', severity: 'medium', status: 'progress', road: 'Molong Rd, Orange to Borenore', suburb: 'Orange', latitude: -33.26830, longitude: 149.07420, depth: null, width: '2.1 km', photo_url: null, votes: 9, progress: 35, reject_reason: null, reported_by: 'demo-citizen', contractor_id: 'c2', reported_at: new Date(Date.now() - 12 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2018', title: 'Shallow pothole near roundabout', description: 'Minor surface loss on the approach to the roundabout.', defect_type: 'pothole', severity: 'low', status: 'completed', road: 'Peisley St at Kite St', suburb: 'Orange', latitude: -33.28770, longitude: 149.10480, depth: '40 mm', width: '0.3 m', photo_url: null, votes: 3, progress: 100, reject_reason: null, reported_by: 'demo-citizen', contractor_id: 'c3', reported_at: new Date(Date.now() - 27 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2015', title: 'Pavement subsidence over trench', description: 'Old service trench has settled. Noticeable dip that bottoms out low vehicles.', defect_type: 'subside', severity: 'high', status: 'progress', road: 'Icely Rd near Coronation Dr', suburb: 'Orange', latitude: -33.29510, longitude: 149.08130, depth: '110 mm dip', width: '6 m', photo_url: null, votes: 12, progress: 80, reject_reason: null, reported_by: 'other', contractor_id: 'c3', reported_at: new Date(Date.now() - 8 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2012', title: 'Fallen branch blocking bike lane', description: 'Large gum branch down across the marked bike lane after Thursday winds.', defect_type: 'debris', severity: 'medium', status: 'completed', road: 'Forest Rd near Emmaville Ln', suburb: 'Orange', latitude: -33.27040, longitude: 149.10810, depth: null, width: null, photo_url: null, votes: 5, progress: 100, reject_reason: null, reported_by: 'demo-citizen', contractor_id: 'c4', reported_at: new Date(Date.now() - 15 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2009', title: 'Crocodile cracking, full lane width', description: 'Interconnected cracking pattern suggesting base failure rather than a surface issue.', defect_type: 'crack', severity: 'high', status: 'assigned', road: 'Clergate Rd, 600 m N of Northern Distributor', suburb: 'Orange', latitude: -33.25310, longitude: 149.09010, depth: '30 mm', width: '18 m', photo_url: null, votes: 8, progress: 0, reject_reason: null, reported_by: 'other', contractor_id: 'c1', reported_at: new Date(Date.now() - 6 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2006', title: 'Drain grate sitting 60 mm proud', description: 'Grate has lifted above the road surface. Hazard for cyclists using the kerb lane.', defect_type: 'flooding', severity: 'medium', status: 'pending', road: 'Lords Place at Summer St', suburb: 'Orange', latitude: -33.28558, longitude: 149.10270, depth: '60 mm', width: '0.6 m', photo_url: null, votes: 4, progress: 0, reject_reason: null, reported_by: 'demo-citizen', contractor_id: null, reported_at: new Date(Date.now() - 1 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-2001', title: 'Pothole on heritage streetscape', description: 'Pothole outside the bakery. High pedestrian and tourist traffic on weekends.', defect_type: 'pothole', severity: 'medium', status: 'assigned', road: 'Pym St, Millthorpe', suburb: 'Millthorpe', latitude: -33.44520, longitude: 149.19320, depth: '75 mm', width: '0.5 m', photo_url: null, votes: 19, progress: 0, reject_reason: null, reported_by: 'other', contractor_id: 'c2', reported_at: new Date(Date.now() - 5 * 86400000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'RD-1998', title: 'Washout after culvert overflow', description: 'Creek overtopped the culvert and scoured out the downstream shoulder. One lane effectively unusable.', defect_type: 'flooding', severity: 'critical', status: 'progress', road: 'Cargo Rd near Borenore Ck', suburb: 'Borenore', latitude: -33.27620, longitude: 148.94510, depth: '300 mm scour', width: '4 m', photo_url: null, votes: 16, progress: 25, reject_reason: null, reported_by: 'other', contractor_id: 'c1', reported_at: new Date(Date.now() - 3 * 86400000).toISOString(), updated_at: new Date().toISOString() },
];

const DEMO_UPDATES: Record<string, Array<Omit<RepairUpdate, 'id'>>> = {
  'RD-2041': [
    { defect_id: 'RD-2041', action: 'Report submitted', note: 'Photo and location captured on Summer St, eastbound lane.', progress: 0, photo_url: null, actor_id: 'demo-citizen', actor_role: 'citizen', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { defect_id: 'RD-2041', action: 'Triaged as Critical', note: 'Bus route and vehicle damage risk. 24 hour SLA applied.', progress: 0, photo_url: null, actor_id: 'demo-admin', actor_role: 'admin', created_at: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString() },
    { defect_id: 'RD-2041', action: 'Assigned to crew', note: 'Crew 2 scheduled for the 6am window.', progress: 10, photo_url: null, actor_id: 'demo-admin', actor_role: 'admin', created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
    { defect_id: 'RD-2041', action: 'Cold-mix patch placed', note: 'Interim patch down and compacted. Hazard removed.', progress: 60, photo_url: 'photo', actor_id: 'demo-contractor', actor_role: 'contractor', created_at: new Date(Date.now() - 19 * 3600000).toISOString() },
  ],
};

/* Convert DB row (possibly with string decimals) into our Defect shape */
function mapDefect(r: DBDefect, myUserId: string | null): Defect {
  return {
    ...r,
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

/* Runtime demo store (mutable copy) */
let demoDefects: Array<Omit<Defect, 'daysAgo' | 'mine'>> = DEMO_ROWS.map(r => ({ ...r }));
const demoUpdates: Record<string, RepairUpdate[]> = Object.fromEntries(
  Object.entries(DEMO_UPDATES).map(([k, arr]) => [k, arr.map((u, i) => ({ id: `${k}-${i}`, ...u }))])
);
const demoVotes = new Set<string>();      // `${defectId}:${userId}`
const demoFollows = new Set<string>();    // `${defectId}:${userId}`

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
      options: { data: { name: input.name, role: input.role || 'citizen', suburb: input.suburb || '' } },
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

  async getProfile(userId: string): Promise<Profile | null> {
    if (!HAS_SUPABASE) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return data as Profile;
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
    let q = supabase.from('defects').select('*').order('reported_at', { ascending: false });
    if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters.severity && filters.severity.length) q = q.in('severity', filters.severity);
    if (filters.type && filters.type !== 'all') q = q.eq('defect_type', filters.type);
    if (filters.q) q = q.or(`title.ilike.%${filters.q}%,road.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data as DBDefect[] || []).map(r => mapDefect(r, myUserId));
  },

  async getDefect(id: string, myUserId: string | null = null): Promise<Defect> {
    if (!HAS_SUPABASE) {
      const r = demoDefects.find(d => d.id === id);
      if (!r) throw new Error('Defect not found');
      return withDerived(r, myUserId);
    }
    const { data, error } = await supabase.from('defects').select('*').eq('id', id).single();
    if (error) throw error;
    return mapDefect(data as DBDefect, myUserId);
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
    const { data, error } = await supabase.from('defects').select('*')
      .eq('contractor_id', contractorId)
      .in('status', ['assigned', 'progress', 'completed'])
      .order('reported_at', { ascending: false });
    if (error) throw error;
    return (data as DBDefect[] || []).map(r => mapDefect(r, myUserId));
  },

  async createDefect(input: CreateDefectInput, userId: string): Promise<Defect> {
    const id = newDefectId();
    if (!HAS_SUPABASE) {
      const row: Omit<Defect, 'daysAgo' | 'mine'> = {
        id, title: input.title, description: input.description,
        defect_type: input.defect_type, severity: input.severity, status: 'pending',
        road: input.road, suburb: input.suburb || 'Orange',
        latitude: input.latitude, longitude: input.longitude,
        depth: null, width: null, photo_url: input.photo_url ?? null,
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
      reported_by: userId,
    };
    const { data, error } = await supabase.from('defects').insert(insert).select().single();
    if (error) throw error;
    await this.addUpdate(id, { action: 'Report submitted', note: 'Report captured with location and description.', progress: 0 }, userId, 'citizen');
    return mapDefect(data as DBDefect, userId);
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
    const { error } = await supabase.from('defects').update(patch).eq('id', id);
    if (error) throw error;
  },

  async assignDefect(id: string, contractorId: string): Promise<void> {
    return this.updateDefect(id, { contractor_id: contractorId, status: 'assigned' });
  },

  async rejectDefect(id: string, reason: string, actorId: string): Promise<void> {
    await this.updateDefect(id, { status: 'rejected', reject_reason: reason });
    await this.addUpdate(id, { action: 'Report rejected', note: reason, progress: 0 }, actorId, 'admin');
  },

  /* ── updates ────────────────────────────────────────────────── */
  async listUpdates(defectId: string): Promise<RepairUpdate[]> {
    if (!HAS_SUPABASE) return demoUpdates[defectId] || [];
    const { data, error } = await supabase.from('repair_updates').select('*').eq('defect_id', defectId).order('created_at', { ascending: true });
    if (error) throw error;
    return (data as RepairUpdate[]) || [];
  },

  async addUpdate(
    defectId: string,
    body: { action: string; note?: string; progress?: number | null; photo_url?: string | null },
    actorId: string,
    actorRole: 'citizen' | 'contractor' | 'admin' | null,
  ): Promise<void> {
    if (!HAS_SUPABASE) {
      const arr = demoUpdates[defectId] || (demoUpdates[defectId] = []);
      arr.push({
        id: `${defectId}-${arr.length}`, defect_id: defectId,
        action: body.action, note: body.note ?? null,
        progress: body.progress ?? null, photo_url: body.photo_url ?? null,
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
  async adminStats(): Promise<AdminStats> {
    const [defects, contractors] = await Promise.all([this.listDefects({}), this.listContractors()]);
    const byStatus: AdminStats['byStatus'] = { pending: 0, assigned: 0, progress: 0, completed: 0, rejected: 0 };
    const bySeverity: AdminStats['bySeverity'] = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const d of defects) {
      byStatus[d.status]++;
      bySeverity[d.severity]++;
    }
    return { total: defects.length, byStatus, bySeverity, contractors };
  },

  /** Real, publicly-derivable platform stats for the homepage (no fabricated numbers). */
  async platformStats(): Promise<import('./types').PlatformStats> {
    const defects = await this.listDefects({});
    const totalReported = defects.length;
    const completed = defects.filter(d => d.status === 'completed');
    const totalCompleted = completed.length;
    const closureRate = totalReported ? Math.round((totalCompleted / totalReported) * 100) : 0;
    // Proxy for "time to first action": days between report and first status change
    // (best available signal without pulling every repair_updates row).
    const acted = defects.filter(d => d.status !== 'pending');
    const avgDaysToFirstAction = acted.length
      ? Math.round((acted.reduce((sum, d) => sum + Math.max(0, (+new Date(d.updated_at) - +new Date(d.reported_at)) / 86400000), 0) / acted.length) * 10) / 10
      : 0;
    const activeResidents = new Set(defects.map(d => d.reported_by).filter(Boolean)).size;
    return { totalReported, totalCompleted, closureRate, avgDaysToFirstAction, activeResidents };
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

  /* ── activity feed (notifications bell) ────────────────────────── */
  async recentActivity(opts: { userId: string; role: 'citizen' | 'contractor' | 'admin'; contractorId?: string | null }): Promise<RepairUpdate[]> {
    if (!HAS_SUPABASE) {
      const all = Object.values(demoUpdates).flat();
      return all.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6);
    }
    let defectIds: string[] | null = null;
    if (opts.role === 'citizen') {
      const [mineRes, followRes] = await Promise.all([
        supabase.from('defects').select('id').eq('reported_by', opts.userId),
        supabase.from('followers').select('defect_id').eq('user_id', opts.userId),
      ]);
      defectIds = Array.from(new Set([
        ...((mineRes.data as { id: string }[] | null) || []).map(d => d.id),
        ...((followRes.data as { defect_id: string }[] | null) || []).map(f => f.defect_id),
      ]));
    } else if (opts.role === 'contractor') {
      if (!opts.contractorId) return [];
      const { data } = await supabase.from('defects').select('id').eq('contractor_id', opts.contractorId);
      defectIds = ((data as { id: string }[] | null) || []).map(d => d.id);
    }
    // admin sees the global feed — defectIds stays null
    if (defectIds && defectIds.length === 0) return [];
    let q = supabase.from('repair_updates').select('*').order('created_at', { ascending: false }).limit(8);
    if (defectIds) q = q.in('defect_id', defectIds);
    const { data, error } = await q;
    if (error) throw error;
    return (data as RepairUpdate[]) || [];
  },

  /* ── photo storage ──────────────────────────────────────────────── */
  async uploadPhoto(file: File, userId: string): Promise<string> {
    if (!HAS_SUPABASE) return URL.createObjectURL(file); // local preview only, not persisted
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('defect-photos').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
    });
    if (error) throw error;
    const { data } = supabase.storage.from('defect-photos').getPublicUrl(path);
    return data.publicUrl;
  },
};
