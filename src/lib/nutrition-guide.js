// Ernährungswissen für Ausdauer (Skilanglauf): kurz, praktisch, mit Quellen. Stand der Positionspapiere
// und Konsensus-Statements bis 2023/24. Richtwerte, keine medizinische Beratung.

export const NUTRITION_SOURCES = {
  thomas16: { text: 'Thomas, Erdman & Burke 2016 – ACSM/AND/DC Positionspapier Ernährung und sportliche Leistung', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Nutrition+and+Athletic+Performance+Thomas+Erdman+Burke+2016' },
  ioc18: { text: 'Maughan et al. 2018 – IOC-Konsens Nahrungsergänzungsmittel bei Spitzensportlern (BJSM)', url: 'https://bjsm.bmj.com/content/52/7/439' },
  reds23: { text: 'Mountjoy et al. 2023 – IOC-Konsens REDs (relativer Energiemangel im Sport, BJSM)', url: 'https://bjsm.bmj.com/content/57/17/1073' },
  jeuk14: { text: 'Jeukendrup 2014 – Kohlenhydrate während des Trainings, mehrere Transporter (Sports Med)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Jeukendrup+step+towards+personalized+sports+nutrition+carbohydrate+intake+during+exercise' },
  gssi108: { text: 'GSSI Sports Science Exchange 108 – Multiple transportable carbohydrates', url: 'https://www.gssiweb.org/sports-science-exchange/article/sse-108-multiple-transportable-carbohydrates-and-their-benefits' },
  racinais15: { text: 'Racinais et al. 2015 – Konsens Training und Wettkampf in der Hitze (BJSM)', url: 'https://bjsm.bmj.com/content/49/18/1164' },
  racinais23: { text: 'Racinais et al. 2023 – IOC-Konsens Sportveranstaltungen bei Hitze (BJSM)', url: 'https://bjsm.bmj.com/content/57/1/8' },
  sawka07: { text: 'Sawka et al. 2007 – ACSM Positionspapier Flüssigkeitsersatz', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=American+College+of+Sports+Medicine+position+stand+exercise+and+fluid+replacement+Sawka' },
  mccormick20: { text: 'McCormick et al. 2020 – Eisenaufnahme, Hepcidin und Einnahmezeitpunkt bei Sportlern (Sports Med)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=McCormick+Refining+treatment+strategies+for+iron+deficient+athletes' },
  heikura21: { text: 'Heikura et al. 2021 – Energiebedarf und Ernährung von Elite-Langläufern bei der Tour de Ski (JSSE)', url: 'https://jyx.jyu.fi/jyx/Record/jyx_123456789_78356' },
  morton18: { text: 'Morton et al. 2018 – Metaanalyse Protein und Krafttraining (BJSM)', url: 'https://bjsm.bmj.com/content/52/6/376' },
  impey18: { text: 'Impey et al. 2018 – „Fuel for the work required“: Kohlenhydrat-Periodisierung (Sports Med)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Impey+Fuel+for+the+work+required+carbohydrate+periodization' },
  burke17: { text: 'Burke et al. 2017 – Low-Carb/High-Fat verschlechtert die Laufökonomie bei Elite-Gehern (J Physiol)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Burke+low+carbohydrate+high+fat+diet+impairs+exercise+economy+elite+race+walkers' },
  guest21: { text: 'Guest et al. 2021 – ISSN-Positionspapier Koffein', url: 'https://jissn.biomedcentral.com/articles/10.1186/s12970-020-00383-4' },
  jones18: { text: 'Jones et al. 2018 – Nitrat aus der Nahrung und Leistung (Annu Rev Nutr)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Jones+dietary+nitrate+and+physical+performance+Annual+Review+of+Nutrition' },
  owens18: { text: 'Owens, Allison & Close 2018 – Vitamin D und Sportler (Sports Med)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Owens+Allison+Close+Vitamin+D+and+the+athlete+current+perspectives' },
  merry16: { text: 'Merry & Ristow 2016 – Antioxidantien können Trainingsanpassungen dämpfen (J Physiol)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Merry+Ristow+antioxidant+supplements+interfere+skeletal+muscle+adaptation' },
  gut17: { text: 'Jeukendrup 2017 – Training the gut for athletes (Sports Med)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Jeukendrup+Training+the+gut+for+athletes' },
  koelner: { text: 'Kölner Liste – Nahrungsergänzungsmittel mit geringerem Dopingrisiko', url: 'https://www.koelnerliste.com' },
};

// Abschnitte: id, Titel, Kernaussagen (Liste), Praxis, Quellen.
export const GUIDE = [
  {
    id: 'basis', title: 'Grundsatz: Essen nach Trainingsaufgabe', sources: ['thomas16', 'impey18'],
    points: [
      'Kohlenhydrate folgen dem Training: ruhige Tage 3–5 g/kg, 1–1,5 h moderat 5–7 g/kg, 2–4 h oder harte Tage 6–10 g/kg, sehr lange Tage oder Carboloading 8–12 g/kg.',
      'Eiweiß 1,6–2,0 g/kg pro Tag, auf 4–5 Mahlzeiten mit je ca. 0,3–0,4 g/kg (20–40 g) verteilt.',
      'Fett ca. 20–35 % der Energie, vor allem aus Olivenöl, Rapsöl, Nüssen, Samen und Fisch.',
      '„Fuel for the work required“: vor und bei harten Einheiten (Schwelle, Intervalle, Double Threshold) gut versorgt; einzelne lockere Einheiten dürfen mit weniger Kohlenhydraten stattfinden.',
    ],
    practice: 'Der Bedarf oben auf der Seite rechnet das für jeden Tag aus deinem Kalender aus. Bei Double-Threshold-Tagen zählt beides: Zwischen den Einheiten kohlenhydratreich essen, damit die zweite Einheit nicht leer startet.',
  },
  {
    id: 'timing', title: 'Vorher, währenddessen, danach', sources: ['thomas16', 'jeuk14', 'gssi108', 'gut17'],
    points: [
      '2–4 h vorher: 1–4 g KH/kg, wenig Fett und Ballaststoffe. 30–60 min vorher reicht ein kleiner Snack (Banane, Toast).',
      'Während: unter 60 min nichts nötig. 1–2 h: 30–60 g/h. Über 2,5 h: bis 90 g/h mit Glukose + Fruktose. Gut trainierte Athleten mit trainiertem Darm vertragen teils bis 120 g/h – ein Leistungsvorteil gegenüber 90 g/h ist aber nicht belegt.',
      'Danach: wenn die nächste Einheit innerhalb von 8 h ansteht (z. B. Double Threshold), in den ersten Stunden ca. 1–1,2 g KH/kg pro Stunde plus 0,3 g Eiweiß/kg. Sonst reicht die nächste normale Mahlzeit.',
      'Darmtraining: hohe KH-Mengen pro Stunde regelmäßig in langen Einheiten üben – nach 2–4 Wochen werden sie deutlich besser vertragen.',
    ],
    practice: 'Im Katalog findest du passende Rezepte unter „Vor dem Training“, „Während“ und „Direkt danach“.',
  },
  {
    id: 'trainlow', title: 'Train Low und Fettstoffwechsel – richtig dosiert', sources: ['impey18', 'burke17'],
    points: [
      'Gezielt einzelne lockere Einheiten mit wenig Glykogen (z. B. nüchtern bis 60–90 min GA1 oder „Sleep Low“: abends wenig KH nach einer harten Einheit, morgens locker) können Anpassungen im Fettstoffwechsel verstärken.',
      'Dauerhaft wenig Kohlenhydrate (Low Carb/High Fat) verschlechtert bei Spitzensportlern die Ökonomie bei hoher Intensität – für Rennen schlecht.',
      'Nie vor oder während Schwelle, Intervallen oder Rennen; 1–2× pro Woche reicht. In Phasen mit sehr viel Umfang, bei Infektneigung oder Gewichtsverlust eher weglassen.',
    ],
    practice: 'Im Katalog: Kontext „Train Low“ für Frühstück, Mittag und Abend.',
  },
  {
    id: 'protein', title: 'Eiweiß für Anpassung und Krafttraining', sources: ['morton18', 'thomas16'],
    points: [
      'Über 1,6 g/kg pro Tag bringt für Muskelzuwachs kaum noch mehr; bei Energiedefizit und sehr viel Umfang eher 1,8–2,2 g/kg.',
      'Pro Mahlzeit 20–40 g hochwertiges Eiweiß (leucinreich: Milch, Quark, Skyr, Eier, Fisch, Fleisch, Soja).',
      'Vor dem Schlafen 30–40 g (z. B. Magerquark) unterstützt die nächtliche Muskelproteinsynthese.',
      'Pflanzlich: Kombinationen (Hülsenfrüchte + Getreide) und etwas größere Mengen wählen.',
    ],
    practice: 'Rezeptideen: Abendquark, Skyr mit Beeren, Recovery-Kakao, Tofu-Scramble.',
  },
  {
    id: 'mikro', title: 'Mikronährstoffe, die bei Ausdauersportlern zählen', sources: ['mccormick20', 'owens18', 'merry16', 'thomas16'],
    points: [
      'Eisen: Langläufer verlieren mehr (Schweiß, Darm, Fußaufprall beim Laufen) und bilden in der Höhe mehr Blut. Ferritin regelmäßig messen (Richtwert für Ausdauersportler meist über 35–50 µg/l). Eisenreich: rotes Fleisch, Linsen, Hirse, Kürbiskerne, Spinat, Haferflocken. Mit Vitamin C kombinieren, Tee/Kaffee 1 h Abstand.',
      'Eisenpräparate nur nach Blutwert und ärztlicher Absprache. Wenn, dann morgens, möglichst bis 30 min nach einer Morgeneinheit (Hepcidin steigt erst einige Stunden nach Belastung), bei Magenproblemen jeden zweiten Tag.',
      'Vitamin D: Von Oktober bis März bildet die Haut in Deutschland kaum Vitamin D. Spiegel (25-OH-D) messen lassen; bei Mangel nach Rücksprache 1000–2000 IE/Tag. Quellen: Lachs, Forelle, Sardinen, Eier.',
      'Calcium (1000 mg) und genug Energie schützen die Knochen – Milchprodukte, angereicherte Pflanzendrinks, Sardinen, Grünkohl, Mandeln.',
      'Magnesium, Kalium, Zink: Vollkorn, Haferflocken, Nüsse, Kerne, Hülsenfrüchte, Kartoffeln, Bananen. Krämpfe sind meist keine Magnesiumfrage, sondern Ermüdung.',
      'Omega-3 (EPA/DHA): 1–2× Fisch pro Woche; pflanzlich Leinöl, Walnüsse, Chia (wird nur teilweise umgewandelt).',
      'Folat und B12: Grünes Gemüse und Hülsenfrüchte für Folat; B12 kommt fast nur aus tierischen Lebensmitteln – vegan unbedingt ergänzen.',
      'Antioxidantien als hochdosierte Präparate (Vitamin C ≥ 1 g, Vitamin E) können Trainingsanpassungen dämpfen. Lieber bunt essen: Obst, Gemüse, Beeren.',
    ],
    practice: 'Jedes Katalogrezept zeigt, welche Mikronährstoffe es gut abdeckt. Lass einmal im Jahr (vor der Saison) Ferritin, Hb, Vitamin D und B12 bestimmen.',
  },
  {
    id: 'trinken', title: 'Trinken und Elektrolyte', sources: ['sawka07', 'thomas16'],
    points: [
      'Ziel: Gewichtsverlust durch Schwitzen in einer Einheit unter ca. 2 % halten. Mehr zu trinken als man verliert (Gewichtszunahme) ist ebenfalls schlecht (Hyponatriämie).',
      'Schweißrate bestimmen: vor und nach einer Stunde Training wiegen (nackt, abgetrocknet), Getrunkenes dazurechnen. Typisch 0,5–1,5 l/h, bei Hitze bis über 2 l/h.',
      'Natrium: Schweiß enthält im Mittel ca. 900–1000 mg Natrium pro Liter (große Unterschiede). Bei langen Einheiten und viel Schweiß 300–1000 mg Natrium pro Liter Getränk.',
      'Danach: ca. 1,25–1,5 l pro kg Gewichtsverlust, zusammen mit Natrium (salzige Mahlzeit, Brezeln, Brühe).',
      'Urin hellgelb = meist gut versorgt.',
    ],
    practice: 'Nutze den Schweißraten-Rechner unten – die App passt die Tipps dann an deine Werte an.',
  },
  {
    id: 'hitze', title: 'Hitze: Sommertraining, Rollski, Trainingslager', sources: ['racinais15', 'racinais23', 'sawka07'],
    points: [
      'Hitzeakklimatisation ist die wirksamste Maßnahme: 1–2 Wochen täglich 60–90 min Belastung in der Wärme; die Schweißrate steigt, der Schweiß wird salzärmer, Puls und Körpertemperatur sinken.',
      'Gut hydriert starten: 2–4 h vorher 5–7 ml/kg trinken, mit etwas Salz.',
      'Vorkühlen bei harten Einheiten oder Rennen: Eisslush (ca. 7,5 g/kg in 30 min vorher), kalte Getränke, Kühlweste oder kalte Tücher.',
      'Währenddessen: kühle Getränke, nach Schweißrate 0,4–0,8 l/h oder mehr, mit Natrium. Kohlenhydrate weiter einplanen – bei Hitze verbrennt der Körper mehr davon.',
      'Puls steigt bei Hitze bei gleicher Leistung deutlich – nach Gefühl/Watt dosieren, harte Einheiten in die kühleren Morgenstunden legen.',
      'Warnzeichen für Hitzeerkrankung: Verwirrtheit, Schwindel, Gänsehaut/Frösteln trotz Hitze, Übelkeit, Aufhören zu schwitzen → sofort abbrechen und kühlen.',
    ],
    practice: 'Bei Hitze den Schalter „Heute heiß“ aktivieren – Tagestipp und Getränkeempfehlung passen sich an.',
  },
  {
    id: 'kaelte', title: 'Kälte und Höhe: Winter, Langlauf, Trainingslager', sources: ['heikura21', 'thomas16'],
    points: [
      'In der Kälte wird oft zu wenig getrunken: weniger Durst, mehr Wasserverlust über die trockene Atemluft, kältebedingt mehr Harndrang. Warme Getränke in der Isolierflasche helfen.',
      'Energiebedarf steigt in Kälte und Höhe (Zittern, Ausrüstung, Schnee, höherer Grundumsatz); Appetit sinkt in der Höhe oft – bewusst genug essen, vor allem Kohlenhydrate.',
      'Höhe: mehr Blutbildung braucht Eisen – Ferritin vor dem Höhentrainingslager prüfen.',
      'Rennserien (z. B. Tour de Ski): zwischen den Rennen konsequent Kohlenhydrate auffüllen, Energiemangel und Infekte sind die größten Risiken.',
      'Riegel und Gels werden in der Kälte hart – nah am Körper tragen; Reisküchlein, weiche Riegel oder Gels in der Innentasche.',
    ],
    practice: 'Im Katalog: Kontext „Kälte“ (warmer Honig-Ingwer-Tee, Eintöpfe, Reisküchlein).',
  },
  {
    id: 'wettkampf', title: 'Wettkampf: Carboloading und Renntag', sources: ['thomas16', 'jeuk14'],
    points: [
      'Rennen über 90 min: 36–48 h vorher 10–12 g KH/kg pro Tag, wenig Ballaststoffe und Fett, Training reduziert.',
      'Kürzere Rennen (Sprint, 10–15 km): 7–8 g/kg am Vortag reichen, kein großes Carboloading nötig.',
      'Renntag: 3–4 h vorher 1–4 g KH/kg (Porridge, Weißbrot, Milchreis), danach Snack bis 60 min vor dem Start.',
      'Sprinttage mit mehreren Läufen: zwischen den Läufen kleine, schnelle Kohlenhydrate und Getränk.',
      'Nichts Neues am Renntag – alles im Training getestet.',
    ],
    practice: 'Rennen im Saisonplan eintragen – der Tagestipp erinnert dich ans Auffüllen.',
  },
  {
    id: 'reds', title: 'Genug essen: Energiemangel (REDs) vermeiden', sources: ['reds23', 'heikura21'],
    points: [
      'Zu wenig Energie im Verhältnis zum Training (unter ca. 30 kcal pro kg fettfreier Masse und Tag) stört Hormone, Knochen, Immunsystem und Leistung – bei Männern wie bei Frauen.',
      'Warnzeichen: stagnierende Leistung trotz Training, häufige Infekte, Verletzungen (Stressfrakturen), schlechter Schlaf, Reizbarkeit, sinkende Libido, bei Frauen Zyklusstörungen.',
      'Gewicht verlieren nie in Phasen mit viel Umfang oder vor wichtigen Rennen; wenn, dann langsam (max. ca. 0,5 kg/Woche) und an harten Tagen trotzdem gut versorgt.',
    ],
    practice: 'Der Morgen-Check und das Gesundheitslog zeigen dir Warnzeichen früh.',
  },
  {
    id: 'supps', title: 'Nahrungsergänzung: was belegt ist', sources: ['ioc18', 'guest21', 'jones18', 'koelner'],
    points: [
      'Koffein: 3 mg/kg ca. 60 min vor harten Einheiten oder Rennen verbessert die Ausdauerleistung; schon 1–2 mg/kg wirken. Nicht abends (Schlaf).',
      'Nitrat (Rote-Bete-Saft-Konzentrat): ca. 6–8 mmol 2–3 h vorher; Effekt bei Freizeit- und Leistungssportlern größer als bei Weltklasse.',
      'Natriumbicarbonat: wirkt bei kurzen, sehr harten Belastungen (Sprint), oft Magenprobleme – nur getestet einsetzen.',
      'Kreatin: für Krafttraining und Sprints belegt; im Langlauf vor allem in Kraftblöcken interessant (leichte Gewichtszunahme durch Wasser).',
      'Medizinisch nur bei Mangel: Eisen, Vitamin D, B12 (vegan). Vorher Blutwerte.',
      'Dopingrisiko: Nur Produkte mit geprüfter Charge (Kölner Liste) verwenden, wenn du an Wettkämpfen teilnimmst.',
    ],
    practice: 'Für Rennen: Koffein und Nitrat im Training ausprobieren, nie zum ersten Mal am Renntag.',
  },
  {
    id: 'immun', title: 'Infekte vermeiden', sources: ['thomas16', 'heikura21'],
    points: [
      'Kohlenhydrate in langen und harten Einheiten senken die Stresshormone und entlasten das Immunsystem.',
      'Genug Energie und Eiweiß, Vitamin D im Normbereich, viel Obst und Gemüse.',
      'Bei ersten Erkältungszeichen: Zink-Lutschtabletten (> 75 mg/Tag, nur kurz) können die Dauer verkürzen; Vitamin C regelmäßig (nicht hochdosiert) verkürzt bei hoher Belastung Erkältungen etwas.',
      'Probiotika (z. B. Kefir, Joghurt) können Atemwegsinfekte bei Sportlern leicht reduzieren.',
    ],
    practice: 'Symptome im Morgen-Check eintragen – die App bremst dann die Belastung.',
  },
];

// Schweißrate (l/h) aus Gewicht vor/nach, Getrunkenem und Dauer; Natriumempfehlung je Liter.
export function sweatRate({ before, after, drankMl = 0, minutes, salty = false }) {
  const b = Number(before), a = Number(after), m = Number(minutes);
  if (!(b > 0 && a > 0 && m > 0)) return null;
  const lossL = b - a + (Number(drankMl) || 0) / 1000;
  const perHour = lossL / (m / 60);
  const lossPct = ((b - a) / b) * 100;
  const sodiumPerL = salty ? 900 : perHour > 1.2 ? 700 : 500;
  return {
    perHour: Math.round(perHour * 100) / 100, lossPct: Math.round(lossPct * 10) / 10,
    drinkPerHour: Math.round(Math.min(perHour * 0.8, 1.2) * 10) / 10, // ca. 70–80 % ersetzen, max. ~1,2 l/h
    sodiumPerL, sodiumPerHour: Math.round(Math.min(perHour * 0.8, 1.2) * sodiumPerL),
    rehydrateL: Math.round(Math.max(0, b - a) * 1.5 * 10) / 10,
  };
}
