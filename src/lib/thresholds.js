// Schwellen automatisch vorschlagen: aus Laktattests, Bestwerten (Puls/Watt) und dem Morgen-Ruhepuls.
// Nur Vorschläge – übernommen wird erst nach Bestätigung, danach werden alle Einheiten neu berechnet.
import { addDays } from './metrics.js';
import { analyzeLactate } from './lactate.js';
import { bestCurve, estimateFtp } from './analysis.js';

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function suggestThresholds(data, t) {
  const { activities = [], lactateTests = [], wellness = [], settings = {} } = data;
  const out = [];
  const cur = (k) => Number(settings[k]) || null;
  const push = (key, label, value, reason, unit = '') => {
    const c = cur(key);
    if (!value || (c && Math.abs(value - c) < (unit === 'W' ? Math.max(5, c * 0.03) : 2))) return;
    out.push({ key, label, current: c, value: Math.round(value), reason, unit });
  };

  // Maximalpuls: höchster plausibler Wert der letzten 2 Jahre. Einzelne Ausreißer (Messfehler, Brustgurt
  // trocken) zählen nicht – der Wert muss in einer zweiten Einheit bis auf 3 Schläge erreicht worden sein.
  const maxes = activities.filter((a) => a.date >= addDays(t, -730) && a.maxHr > 120 && a.maxHr < 230).map((a) => a.maxHr).sort((a, b) => b - a);
  const hrMax = maxes.find((m, i) => maxes[i + 1] != null && m - maxes[i + 1] <= 3);
  if (hrMax && hrMax > (cur('hrMax') || 0)) push('hrMax', 'Maximalpuls', hrMax, `Höchster Puls der letzten 2 Jahre (in mindestens zwei Einheiten erreicht). Der Maximalpuls sinkt nicht durch Training – nur nach oben korrigieren.`);

  // Schwellenpuls: neuester Laktattest (Dmax), sonst bester 30-min-Puls aus Rennen/harten Einheiten.
  const tests = [...lactateTests].filter((x) => x.date >= addDays(t, -180)).sort((a, b) => b.date.localeCompare(a.date));
  const lt = tests.map((x) => ({ x, r: analyzeLactate(x.steps || []) })).find(({ r }) => r.lt2?.hr);
  const recent = activities.filter((a) => a.date >= addDays(t, -120));
  if (lt) push('lthr', 'Schwellenpuls', lt.r.lt2.hr, `Laktattest vom ${new Date(lt.x.date + 'T12:00:00').toLocaleDateString('de-DE')}: Puls an der Schwelle (modifizierte Dmax, ${lt.r.lt2.lactate.toFixed(1).replace('.', ',')} mmol/l).`);
  else {
    const hr30 = bestCurve(recent, 'hrCurve')[1800];
    // Ø Puls über 30 min voller Belastung liegt nahe am Schwellenpuls (Friel); im Training meist darunter → nur nach oben.
    if (hr30?.value && hr30.value > (cur('lthr') || 0) && (!cur('hrMax') || hr30.value < cur('hrMax') * 0.97)) push('lthr', 'Schwellenpuls', hr30.value, `Bester 30-min-Puls der letzten 4 Monate (${new Date(hr30.date + 'T12:00:00').toLocaleDateString('de-DE')}). 30 min volle Belastung entsprechen ungefähr der Schwelle – genauer ist ein Laktattest.`);
  }

  // FTP je Sportart: 95 % der besten 20 min bzw. beste 60 min der letzten 3 Monate.
  const powerRecent = activities.filter((a) => a.date >= addDays(t, -90));
  for (const [key, label, sports] of [['ftp', 'FTP Rad', ['bike', 'bikeerg']], ['ftpSkierg', 'FTP SkiErg', ['skierg']], ['ftpRow', 'FTP Rudern', ['row']]]) {
    const curve = bestCurve(powerRecent.filter((a) => sports.includes(a.sport)), 'powerCurve');
    const ftp = estimateFtp(curve);
    if (ftp && ftp > (cur(key) || 0)) push(key, label, ftp, `Aus deiner Bestwertkurve der letzten 3 Monate (95 % der besten 20 min${curve[3600] ? ' bzw. beste 60 min' : ''}).`, 'W');
  }

  // Ruhepuls: Median der niedrigsten Morgenwerte der letzten 30 Tage.
  const rhs = wellness.filter((w) => w.date >= addDays(t, -30) && w.restHr).map((w) => w.restHr).sort((a, b) => a - b);
  if (rhs.length >= 7) push('hrRest', 'Ruhepuls', median(rhs.slice(0, Math.ceil(rhs.length / 2))), `Typischer niedriger Morgen-Ruhepuls der letzten 30 Tage (${rhs.length} Messungen).`);
  return out;
}
