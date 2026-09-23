import type { DefectStatus, Severity, DefectType } from './types';

export const ORANGE = { lat: -33.2839, lng: 149.0988 };

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
  low:      { label: 'Low',      color: '#16A34A', rank: 1, sla: '20 business days' },
  medium:   { label: 'Medium',   color: '#EAB308', rank: 2, sla: '10 business days' },
  high:     { label: 'High',     color: '#EA580C', rank: 3, sla: '5 business days' },
  critical: { label: 'Critical', color: '#DC2626', rank: 4, sla: '24 hours' },
};

export const typeOf = (id: string) => TYPES.find(t => t.id === id) || { id: 'pothole' as DefectType, label: id };
