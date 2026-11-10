// Display helpers. All timestamps are stored in UTC (PRD NFR-12) and shown in
// the viewer's zone (Asia/Dhaka for MedSwift staff).

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatTime = (iso: string | null | undefined): string => (iso ? timeFmt.format(new Date(iso)) : '—');

export const formatDate = (iso: string | null | undefined): string => (iso ? dateFmt.format(new Date(iso)) : '—');

export const formatTemp = (c: number | null | undefined, digits = 1): string =>
  c === null || c === undefined || Number.isNaN(c) ? '--.-' : c.toFixed(digits);

/** "12:04" for a duration in ms. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} m`;
  return `${Math.floor(min / 60)} h ${Math.round(min % 60)} m`;
}

export const shortHash = (hash: string): string => (hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-5)}` : hash);

export function secondsAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}
