import type { PhotoMeta } from './evidence';

/** Photo details saved with a report or timeline photo; photo_flags is set by the database. */
export type PhotoInfo = Partial<PhotoMeta> & {
  photo_flags?: string[] | null;
  captured_offline?: boolean | null;   // reports only: saved on the phone offline and sent later
};

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

export interface Defect extends PhotoInfo {
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
  accepted_at?: string | null;
  verified_at?: string | null;
  work_instructions?: string | null;   // council's work order: what the contractor must do
  due_at?: string | null;              // council-set fix-by date (overrides the severity default)
  reopen_requested_at?: string | null; // a resident says the verified repair isn't fixed
  merged_into?: string | null;         // closed as a duplicate of this report
  photo_hidden_at?: string | null;     // council took the photo off the public page
  reported_at: string;
  updated_at: string;
  // Derived
  daysAgo: number;
  mine: boolean;
}

export interface RepairUpdate extends PhotoInfo {
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
  captchaToken?: string;
}

export interface SignInInput {
  email: string;
  password: string;
  captchaToken?: string;
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
  photo?: PhotoMeta | null;
}

export interface PlatformStats {
  totalReported: number;
  totalCompleted: number;
  closureRate: number;      // 0-100
  inProgress: number;       // assigned, in progress, or awaiting council sign-off
  activeResidents: number;
}

// ─── Analytics shape ──────────────────────────────────────────────────

// ─── Supabase row types (database shape, before mapping) ─────────────
export interface DBDefect extends PhotoInfo {
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
  accepted_at?: string | null;
  verified_at?: string | null;
  work_instructions?: string | null;   // council's work order: what the contractor must do
  due_at?: string | null;              // council-set fix-by date (overrides the severity default)
  reopen_requested_at?: string | null; // a resident says the verified repair isn't fixed
  merged_into?: string | null;         // closed as a duplicate of this report
  photo_hidden_at?: string | null;     // council took the photo off the public page
  reported_at: string;
  updated_at: string;
}

// ─── In-app notifications ─────────────────────────────────────────────
export type NotificationKind =
  | 'report' | 'assigned' | 'accepted' | 'declined' | 'progress'
  | 'complete' | 'verified' | 'rework' | 'rejected' | 'reopen' | 'update';

export interface AppNotification {
  id: string;
  user_id: string;
  defect_id: string | null;
  defect_title: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}
