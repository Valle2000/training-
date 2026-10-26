import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const fmtDuration = (s) => { if (!s) return '0:00'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}:${String(m).padStart(2, '0')}`; };
export const fmtNum = (v, d = 0) => (v == null || isNaN(v) ? '–' : Number(v).toFixed(d).replace('.', ','));
export const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', opts);
export const fmtKm = (m) => (m ? `${fmtNum(m / 1000, 1)} km` : '');

export function Sheet({ title, onClose, children }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, flex: 'none' }}>{title}</h2>
          <button className="ghost" style={{ flex: 'none' }} onClick={onClose} aria-label="Schließen"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

let toastSetter = null;
export const toast = (msg) => toastSetter?.(msg);
export function Toast() {
  const [msg, setMsg] = React.useState(null);
  useEffect(() => { toastSetter = setMsg; return () => { toastSetter = null; }; }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); }, [msg]);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Seg({ value, options, onChange }) {
  return <div className="seg">{options.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
