import type { DefectStatus, Severity, DefectType } from './types';

export const ORANGE = { lat: -33.2839, lng: 149.0988 };
/** Generous box around the Orange City Council area — reports outside it are for another council. */
export const COUNCIL_AREA = { north: -33.12, south: -33.48, west: 148.88, east: 149.30 };
export const inCouncilArea = (lat: number, lng: number) =>
  lat <= COUNCIL_AREA.north && lat >= COUNCIL_AREA.south && lng >= COUNCIL_AREA.west && lng <= COUNCIL_AREA.east;

export const TYPES: { id: DefectType; label: string }[] = [
  { id: 'pothole',  label: 'Pothole' },
  { id: 'crack',    label: 'Surface cracking' },
  { id: 'edge',     label: 'Edge break' },
  { id: 'flooding', label: 'Flooding / drainage' },
  { id: 'marking',  label: 'Faded line marking' },
  { id: 'signage',  label: 'Damaged signage' },
  { id: 'debris',   label: 'Debris on road' },
  { id: 'subside',  label: 'Subsidence' },
];

export const STATUS: Record<DefectStatus, { label: string; cls: string; color: string }> = {
  pending:   { label: 'Pending review', cls: 'b-pending',   color: '#F59E0B' },
  assigned:  { label: 'Assigned',       cls: 'b-assigned',  color: '#1E40AF' },
  progress:  { label: 'In progress',    cls: 'b-progress',  color: '#7C3AED' },
  completed: { label: 'Completed',      cls: 'b-completed', color: '#059669' },
  rejected:  { label: 'Rejected',       cls: 'b-rejected',  color: '#DC2626' },
};

export const SEVERITY: Record<Severity, { label: string; color: string; rank: number; sla: string }> = {
  low:      { label: 'Low',      color: '#16A34A', rank: 1, sla: '10 days' },
  medium:   { label: 'Medium',   color: '#EAB308', rank: 2, sla: '7 days' },
  high:     { label: 'High',     color: '#EA580C', rank: 3, sla: '3–5 days' },
  critical: { label: 'Critical', color: '#DC2626', rank: 4, sla: '24 hours' },
};

export const typeOf = (id: string) => TYPES.find(t => t.id === id) || { id: 'pothole' as DefectType, label: id };
