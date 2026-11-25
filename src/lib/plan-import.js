// Plan der Trainerin aus Screenshot/Foto oder Text (über die KI) in Plan-Einheiten umwandeln.
// Ohne TrainingPeaks-Premium: Screenshot vom TrainingPeaks- oder Polar-Flow-Kalender, Text aus der täglichen Mail.
import { estimatePlanLoad } from './activities.js';
import { SPORTS } from './sports.js';

const SPORT_IDS = new Set(SPORTS.map((s) => s.id));
const ZONES = new Set(['I1', 'I2', 'I3', 'I4', 'I5', 'Kraft']);

// Antwort der KI → Plan-Einheiten mit source 'trainingpeaks' (damit gilt: Plan der Trainerin hat Vorrang).
export function aiToPlan(einheiten = []) {
  return einheiten
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e?.datum || '') && e.sport !== 'rest')
    .map((e, i) => {
      const minutes = Math.max(0, Math.min(600, Math.round(Number(e.minuten) || 0)));
      const zone = ZONES.has(e.zone) ? e.zone : null;
      const sport = SPORT_IDS.has(e.sport) ? e.sport : 'other';
      const title = String(e.titel || '').trim() || 'Einheit der Trainerin';
      return {
        externalId: `img-${e.datum}-${title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').slice(0, 40)}-${i}`,
        source: 'trainingpeaks', date: e.datum, title, sport, minutes, zone,
        description: String(e.beschreibung || '').trim(), notes: String(e.beschreibung || '').trim(),
        minutesGuessed: !!e.dauerGeschaetzt,
        load: zone === 'Kraft' ? Math.round(minutes * 0.75) : minutes ? estimatePlanLoad(minutes, zone || 'I1') : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Bild verkleinern (lange Seite max. 1600 px, JPEG) – spart Übertragung und KI-Kosten, Text bleibt lesbar.
export async function shrinkImage(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error(`${file.name}: kein lesbares Bild`)); i.src = url; });
    const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.85).split(',')[1];
    return { type: 'image/jpeg', data, name: file.name };
  } finally { URL.revokeObjectURL(url); }
}
