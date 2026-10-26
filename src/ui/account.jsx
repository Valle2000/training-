import React, { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-react';
import { cloudConfigured } from '../lib/supabase.js';
import { useCloudStatus, syncNow, signIn, signUp, resetPassword, signOut } from '../lib/cloud-sync.js';
import { toast } from './common.jsx';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');

export function AccountCard() {
  const st = useCloudStatus();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!cloudConfigured) return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><CloudOff size={16} /> Konto & Abgleich</h3>
      <p className="muted small">Noch nicht eingerichtet: Bei Vercel <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> eintragen (dieselben Werte wie bei SkiWax) und neu veröffentlichen. Bis dahin liegen alle Daten nur in diesem Browser.</p>
    </div>
  );
  if (st.email) return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Cloud size={16} /> Konto & Abgleich</h3>
      <p style={{ margin: '4px 0' }}>Angemeldet als <b>{st.email}</b></p>
      <p className="muted small" style={{ margin: '4px 0' }}>{st.state === 'syncing' ? 'Gleiche ab …' : st.state === 'error' ? `Fehler: ${st.error}` : `Zuletzt abgeglichen: ${fmtTime(st.last)}`}</p>
      <p className="muted small">Deine Daten, Einstellungen und Verbindungen liegen in deinem Konto und sind auf allen Geräten gleich, auf denen du angemeldet bist.</p>
      <div className="row">
        <button className="secondary" onClick={() => syncNow()} disabled={st.state === 'syncing'}><RefreshCw size={16} className={st.state === 'syncing' ? 'spin' : ''} />Jetzt abgleichen</button>
        <button className="ghost" onClick={() => signOut()}><LogOut size={16} />Abmelden</button>
      </div>
    </div>
  );
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      if (mode === 'login') { await signIn(email, pw); toast('Angemeldet – Daten werden abgeglichen'); }
      else if (!(await signUp(email, pw))) setMsg('Konto angelegt. Bitte den Link in der Bestätigungs-E-Mail öffnen und dich dann hier anmelden.');
    } catch (err) { setMsg(err.message === 'Invalid login credentials' ? 'E-Mail oder Passwort falsch.' : err.message); }
    setBusy(false);
  };
  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}><Cloud size={16} /> Konto & Abgleich</h3>
      <p className="muted small">Melde dich mit deinem <b>SkiWax-Konto</b> an (gleiche E-Mail und gleiches Passwort). Dann sind deine Trainingsdaten auf allen Geräten gleich und gehen nicht verloren. Bereits eingetragene Daten auf diesem Gerät werden übernommen.</p>
      <label>E-Mail</label><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label>Passwort</label><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
      {msg && <p className="small" style={{ color: 'var(--bad)' }}>{msg}</p>}
      <button className="primary wide" disabled={busy} style={{ marginTop: 12 }}>{mode === 'login' ? 'Anmelden' : 'Konto anlegen'}</button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="ghost" style={{ flex: 'none' }} onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Neues Konto anlegen' : 'Ich habe schon ein Konto'}</button>
        {mode === 'login' && <button type="button" className="ghost" style={{ flex: 'none' }} onClick={async () => { if (!email.trim()) return setMsg('Bitte zuerst die E-Mail eingeben.'); try { await resetPassword(email); setMsg('E-Mail zum Zurücksetzen wurde gesendet.'); } catch (err) { setMsg(err.message); } }}>Passwort vergessen?</button>}
      </div>
    </form>
  );
}

// Kleine Anzeige im Kopfbereich.
export function SyncBadge({ onClick }) {
  const st = useCloudStatus();
  if (st.state === 'unconfigured') return null;
  const Icon = st.state === 'off' ? CloudOff : st.state === 'syncing' ? RefreshCw : Cloud;
  const label = st.state === 'off' ? 'Offline' : st.state === 'syncing' ? 'Sync' : st.state === 'error' ? 'Fehler' : 'Sync';
  return <button className="pill" onClick={onClick} aria-label={`Abgleich: ${label}`} style={st.state === 'error' ? { borderColor: '#e08a7c', color: '#ffc9bf' } : undefined}><Icon size={14} className={st.state === 'syncing' ? 'spin' : ''} />{label}</button>;
}
