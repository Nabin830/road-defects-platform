// ─── Enums / literal types ───────────────────────────────────────────
export type Role = 'citizen' | 'contractor' | 'admin';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type DefectStatus = 'pending' | 'assigned' | 'progress' | 'completed' | 'rejected';
export type DefectType =
  | 'pothole' | 'crack' | 'edge' | 'flooding'
  | 'marking' | 'signage' | 'debris' | 'subside';

// ─── Domain models (as returned by API layer) ────────────────────────
export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  suburb: string | null;
  contractor_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contractor {
  id: string;
  name: string;
  abbr: string;
  crew_size: number;
  rating: number;
  created_at: string;
}

export interface Defect {
  id: string;
  title: string;
  description: string;
  defect_type: DefectType;
  severity: Severity;
  status: DefectStatus;
  road: string;
  suburb: string | null;
  latitude: number;
  longitude: number;
  depth: string | null;
  width: string | null;
  photo_url: string | null;
  votes: number;
  progress: number;
  reject_reason: string | null;
  reported_by: string | null;
  contractor_id: string | null;
  reported_at: string;
  updated_at: string;
  // Derived
  daysAgo: number;
  mine: boolean;
}

export interface RepairUpdate {
  id: string;
  defect_id: string;
  action: string;
  note: string | null;
  progress: number | null;
  photo_url: string | null;
  actor_id: string | null;
  actor_role: Role | null;
  created_at: string;
}

// ─── Filter shapes ────────────────────────────────────────────────────
export interface DefectFilters {
  status?: DefectStatus | 'all';
  severity?: Severity[];
  type?: DefectType | 'all';
  q?: string;
}

// ─── Auth payloads ────────────────────────────────────────────────────
export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
  suburb?: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface CreateDefectInput {
  title: string;
  description: string;
  defect_type: DefectType;
  severity: Severity;
  road: string;
  suburb?: string;
  latitude: number;
  longitude: number;
  photo_url?: string | null;
}

export interface PlatformStats {
  totalReported: number;
  totalCompleted: number;
  closureRate: number;      // 0-100
  avgDaysToFirstAction: number;
  activeResidents: number;
}

// ─── Analytics shape ──────────────────────────────────────────────────
export interface AdminStats {
  total: number;
  byStatus: Record<DefectStatus, number>;
  bySeverity: Record<Severity, number>;
  contractors: Contractor[];
}

// ─── Supabase row types (database shape, before mapping) ─────────────
export interface DBDefect {
  id: string;
  title: string;
  description: string;
  defect_type: DefectType;
  severity: Severity;
  status: DefectStatus;
  road: string;
  suburb: string | null;
  latitude: number | string;
  longitude: number | string;
  depth: string | null;
  width: string | null;
  photo_url: string | null;
  votes: number;
  progress: number;
  reject_reason: string | null;
  reported_by: string | null;
  contractor_id: string | null;
  reported_at: string;
  updated_at: string;
}
