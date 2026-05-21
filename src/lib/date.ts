export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    // Try direct ISO parse first
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Try normalizing common SAP formats
      let s = dateStr.trim();
      // Replace space with T between date and time
      s = s.replace(' ', 'T');
      // If time is HHMMSS (e.g. 160327) convert to HH:MM:SS
      const timeOnly = s.split('T')[1] || '';
      if (/^\d{6}$/.test(timeOnly)) {
        const hh = timeOnly.slice(0, 2);
        const mm = timeOnly.slice(2, 4);
        const ss = timeOnly.slice(4, 6);
        s = s.split('T')[0] + 'T' + `${hh}:${mm}:${ss}`;
      }
      d = new Date(s);
      if (isNaN(d.getTime())) return '—';
    }

    // Format to `DD/MM/YYYY HH:MM:SS` (remove possible comma)
    return d
      .toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
      .replace(',', '');
  } catch (e) {
    return '—';
  }
}

export function parseToDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const normalized = (dateStr || '').replace(' ', 'T');
  const d2 = new Date(normalized);
  return isNaN(d2.getTime()) ? null : d2;
}
