// Nährwerte je 100 g (Richtwerte nach Bundeslebensmittelschlüssel/USDA, gerundet) und Tagesreferenzwerte.
// Damit rechnet der Rezeptkatalog Makros und Mikronährstoffe selbst aus, statt sie zu schätzen.
// Spalten: kcal, KH, Eiweiß, Fett, Ballaststoffe (g) · Eisen, Magnesium, Calcium, Kalium, Zink, Vitamin C, Natrium (mg)
//          · Folat, Vitamin D, B12 (µg) · Omega-3 (g)
const COLS = ['kcal', 'kh', 'eiweiss', 'fett', 'ballast', 'eisen', 'magnesium', 'calcium', 'kalium', 'zink', 'vitc', 'natrium', 'folat', 'vitd', 'b12', 'omega3'];

// name, Stückgewicht (g, optional), Werte in Spaltenreihenfolge
const RAW = {
  // Getreide, Brot, Beilagen (trocken bzw. roh)
  hafer: ['Haferflocken', 0, 370, 59, 13.5, 7, 10, 4.2, 140, 50, 360, 3.6, 0, 5, 30, 0, 0, 0.1],
  dinkelnudeln: ['Dinkel-Vollkornnudeln (trocken)', 0, 350, 66, 14, 2.5, 8, 3, 120, 30, 300, 2.5, 0, 5, 40, 0, 0, 0.05],
  nudeln: ['Nudeln (trocken)', 0, 355, 71, 12.5, 1.5, 3, 1.3, 50, 20, 200, 1.2, 0, 5, 20, 0, 0, 0],
  reis: ['Basmatireis (trocken)', 0, 350, 78, 7.5, 0.6, 1.3, 0.8, 25, 10, 100, 1.1, 0, 1, 10, 0, 0, 0],
  vollkornreis: ['Vollkornreis (trocken)', 0, 350, 73, 7.5, 2.7, 3.5, 1.5, 120, 10, 250, 2, 0, 5, 20, 0, 0, 0],
  hirse: ['Hirse (trocken)', 0, 360, 69, 11, 4, 4, 3, 115, 8, 195, 1.7, 0, 5, 85, 0, 0, 0],
  quinoa: ['Quinoa (trocken)', 0, 368, 64, 14, 6, 7, 4.6, 197, 47, 563, 3.1, 0, 5, 184, 0, 0, 0.26],
  couscous: ['Couscous (trocken)', 0, 360, 72, 13, 0.6, 5, 1.1, 44, 24, 166, 0.8, 0, 10, 20, 0, 0, 0],
  gnocchi: ['Gnocchi (Kühlregal)', 0, 160, 33, 4, 0.6, 2, 0.5, 15, 15, 250, 0.4, 3, 400, 10, 0, 0, 0],
  kartoffel: ['Kartoffeln', 0, 77, 17, 2, 0.1, 2.2, 0.8, 23, 12, 425, 0.3, 20, 6, 15, 0, 0, 0],
  suesskartoffel: ['Süßkartoffel', 0, 86, 20, 1.6, 0.1, 3, 0.6, 25, 30, 340, 0.3, 2.4, 55, 11, 0, 0, 0],
  roggenbrot: ['Roggenvollkornbrot', 50, 215, 41, 7, 1.2, 8, 2.5, 60, 30, 250, 1.7, 0, 450, 25, 0, 0, 0],
  dinkelbrot: ['Dinkelvollkornbrot', 50, 235, 43, 9, 2, 7, 2.5, 70, 25, 250, 2, 0, 450, 30, 0, 0, 0],
  broetchen: ['Weizenbrötchen', 60, 270, 53, 9, 1.5, 3, 1, 25, 25, 120, 0.8, 0, 550, 20, 0, 0, 0],
  toast: ['Toastbrot', 25, 265, 49, 8, 3.5, 3, 1, 25, 30, 120, 0.7, 0, 500, 20, 0, 0, 0],
  knaecke: ['Roggenknäckebrot', 10, 350, 67, 10, 1.5, 15, 3, 90, 30, 450, 2.5, 0, 450, 40, 0, 0, 0],
  cornflakes: ['Cornflakes', 0, 380, 84, 7.5, 0.9, 3, 2, 15, 5, 100, 0.3, 0, 700, 10, 0, 0, 0],
  reiswaffel: ['Reiswaffeln', 8, 390, 81, 8, 3, 4, 1, 100, 10, 250, 2, 0, 10, 20, 0, 0, 0],
  wraps: ['Weizen-Tortilla', 60, 300, 50, 8, 7, 3, 2, 25, 100, 150, 0.7, 0, 700, 30, 0, 0, 0],
  // Hülsenfrüchte, Soja
  linsen: ['Rote Linsen (trocken)', 0, 340, 50, 25, 2, 11, 7, 100, 48, 580, 3.6, 2, 5, 204, 0, 0, 0.1],
  kichererbsen: ['Kichererbsen (Dose, abgetropft)', 0, 120, 16, 7, 2.5, 6, 1.5, 30, 40, 170, 1, 0, 250, 60, 0, 0, 0.05],
  bohnen: ['Weiße Bohnen (Dose, abgetropft)', 0, 100, 13, 7, 0.5, 6, 2, 45, 60, 350, 0.9, 0, 250, 60, 0, 0, 0.1],
  kidney: ['Kidneybohnen (Dose, abgetropft)', 0, 100, 14, 7, 0.5, 7, 1.6, 35, 35, 350, 0.8, 1, 250, 50, 0, 0, 0.1],
  tofu: ['Tofu natur', 0, 125, 1.5, 13, 7.5, 0.5, 2.5, 60, 200, 150, 1.2, 0, 10, 20, 0, 0, 0.5],
  tempeh: ['Tempeh', 0, 190, 9, 19, 11, 4, 2.7, 81, 111, 412, 1.1, 0, 9, 24, 0, 0.1, 0.2],
  edamame: ['Edamame (TK)', 0, 120, 9, 11, 5, 5, 2.3, 64, 63, 436, 1.4, 6, 6, 311, 0, 0, 0.3],
  hummus: ['Hummus', 0, 170, 10, 8, 10, 6, 2.4, 70, 40, 230, 1.8, 0, 380, 80, 0, 0, 0.1],
  // Fleisch, Fisch, Eier
  huhn: ['Hähnchenbrust', 0, 110, 0, 23.5, 1.5, 0, 0.5, 27, 10, 370, 0.8, 0, 60, 4, 0, 0.3, 0.03],
  pute: ['Putenbrust', 0, 105, 0, 24, 1, 0, 0.7, 28, 10, 350, 1.5, 0, 50, 7, 0, 0.4, 0.02],
  rind: ['Rindersteak / mageres Rinderhack', 0, 125, 0, 21, 4.5, 0, 2.3, 22, 6, 350, 4.5, 0, 60, 6, 0, 2, 0.05],
  lachs: ['Lachs', 0, 200, 0, 20, 13, 0, 0.4, 27, 10, 360, 0.4, 0, 50, 10, 8, 3, 2.5],
  raeucherlachs: ['Räucherlachs', 0, 180, 0, 22, 10, 0, 0.6, 25, 15, 300, 0.4, 0, 1800, 10, 8, 3, 1.5],
  forelle: ['Forelle', 0, 110, 0, 20, 3, 0, 0.4, 25, 15, 400, 0.5, 0, 50, 13, 10, 4, 0.9],
  thunfisch: ['Thunfisch in Wasser (abgetropft)', 0, 110, 0, 25, 1, 0, 1, 30, 10, 250, 0.6, 0, 350, 5, 3, 2.5, 0.25],
  sardinen: ['Sardinen in Öl (abgetropft)', 0, 210, 0, 24, 12, 0, 2.5, 40, 380, 400, 1.4, 0, 400, 10, 5, 9, 1.5],
  ei: ['Eier', 60, 145, 1, 12.5, 10, 0, 1.9, 12, 55, 140, 1.3, 0, 140, 65, 2, 1, 0.1],
  // Milchprodukte und Alternativen
  quark: ['Magerquark', 0, 67, 4, 12, 0.3, 0, 0.4, 12, 90, 160, 0.5, 1, 40, 25, 0, 0.8, 0],
  skyr: ['Skyr natur', 0, 63, 4, 11, 0.2, 0, 0.1, 12, 150, 160, 0.5, 0, 40, 10, 0, 0.6, 0],
  joghurt: ['Naturjoghurt 3,5 %', 0, 65, 4.5, 3.5, 3.5, 0, 0.1, 12, 120, 160, 0.4, 1, 50, 10, 0.1, 0.4, 0.03],
  griechjoghurt: ['Griechischer Joghurt 10 %', 0, 120, 4, 4, 10, 0, 0.1, 12, 100, 150, 0.4, 0, 40, 10, 0.1, 0.4, 0.05],
  sojajoghurt: ['Sojajoghurt natur (mit Calcium)', 0, 50, 2, 4, 2.3, 1, 0.6, 20, 120, 150, 0.3, 0, 30, 10, 0, 0.4, 0.2],
  milch: ['Milch 1,5 %', 0, 47, 4.8, 3.4, 1.5, 0, 0, 12, 120, 155, 0.4, 1, 45, 5, 0, 0.4, 0],
  hafermilch: ['Haferdrink (mit Calcium)', 0, 45, 6.5, 0.5, 1.5, 0.8, 0.2, 5, 120, 40, 0.1, 0, 40, 5, 0, 0, 0],
  sojamilch: ['Sojadrink (mit Calcium, B12)', 0, 40, 2, 3.4, 1.8, 0.5, 0.4, 15, 120, 120, 0.2, 0, 40, 10, 0.75, 0.4, 0.2],
  kefir: ['Kefir', 0, 55, 4, 3.3, 3, 0, 0.1, 11, 120, 150, 0.4, 1, 40, 8, 0, 0.4, 0.02],
  buttermilch: ['Buttermilch', 0, 37, 4, 3.5, 0.5, 0, 0.1, 15, 110, 150, 0.4, 1, 55, 5, 0, 0.3, 0],
  mozzarella: ['Mozzarella', 125, 250, 1, 18, 19, 0, 0.2, 15, 400, 80, 2.5, 0, 400, 10, 0.3, 1.5, 0.1],
  feta: ['Feta / Schafskäse', 0, 260, 0.5, 17, 21, 0, 0.6, 20, 450, 100, 2.5, 0, 1100, 30, 0.4, 1, 0.1],
  parmesan: ['Parmesan', 0, 390, 0, 32, 28, 0, 0.8, 40, 1150, 100, 3.5, 0, 1600, 10, 0.5, 1.5, 0.2],
  huettenkaese: ['Hüttenkäse', 0, 100, 3, 12.5, 4.5, 0, 0.1, 8, 80, 90, 0.4, 0, 300, 12, 0, 0.5, 0],
  whey: ['Molkenprotein (Pulver)', 30, 380, 8, 78, 6, 0, 1, 90, 450, 500, 2, 0, 200, 20, 0, 1, 0],
  // Fette, Nüsse, Samen
  butter: ['Butter', 0, 740, 0.6, 0.7, 83, 0, 0, 2, 15, 20, 0, 0, 10, 0, 1.2, 0.2, 0.3],
  olivenoel: ['Olivenöl', 0, 884, 0, 0, 100, 0, 0.6, 0, 1, 1, 0, 0, 2, 0, 0, 0, 0.7],
  rapsoel: ['Rapsöl', 0, 884, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
  leinoel: ['Leinöl', 0, 884, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 53],
  mandelmus: ['Mandelmus', 0, 615, 9, 21, 55, 10, 3.5, 280, 260, 750, 3.3, 0, 5, 55, 0, 0, 0],
  erdnussmus: ['Erdnussmus', 0, 600, 13, 25, 50, 7, 1.9, 170, 45, 650, 3, 0, 10, 90, 0, 0, 0],
  mandeln: ['Mandeln', 0, 600, 6, 21, 52, 12, 3.7, 270, 250, 730, 3.1, 0, 1, 45, 0, 0, 0],
  walnuss: ['Walnüsse', 0, 670, 7, 15, 65, 6, 2.9, 160, 90, 440, 3, 1, 2, 98, 0, 0, 9],
  cashew: ['Cashewkerne', 0, 580, 30, 18, 44, 3, 6.7, 290, 40, 660, 5.8, 0, 12, 25, 0, 0, 0.1],
  paranuss: ['Paranüsse (Selen!)', 5, 690, 4, 14, 67, 7, 2.4, 375, 160, 660, 4, 1, 3, 22, 0, 0, 0],
  kuerbiskerne: ['Kürbiskerne', 0, 560, 5, 30, 49, 6, 8.8, 550, 46, 800, 7.8, 2, 7, 58, 0, 0, 0.1],
  sonnenblumen: ['Sonnenblumenkerne', 0, 580, 12, 21, 49, 8, 5.2, 325, 78, 645, 5, 1.4, 9, 227, 0, 0, 0.07],
  chia: ['Chiasamen', 0, 490, 8, 17, 31, 34, 7.7, 335, 630, 410, 4.6, 1.6, 16, 49, 0, 0, 17.8],
  leinsamen: ['Leinsamen (geschrotet)', 0, 530, 2, 18, 42, 39, 5.7, 390, 255, 810, 4.3, 0.6, 30, 87, 0, 0, 22.8],
  hanf: ['Hanfsamen (geschält)', 0, 560, 4, 32, 49, 4, 8, 700, 70, 1200, 10, 0.5, 5, 110, 0, 0, 9],
  tahin: ['Tahin (Sesammus)', 0, 600, 10, 18, 54, 9, 9, 360, 420, 410, 4.6, 0, 35, 98, 0, 0, 0.4],
  // Obst (frisch, ohne Schale/Kern) und Trockenobst
  banane: ['Banane', 120, 89, 20, 1.1, 0.3, 2.6, 0.3, 27, 5, 360, 0.2, 9, 1, 20, 0, 0, 0.03],
  apfel: ['Apfel', 150, 52, 12, 0.3, 0.2, 2.4, 0.1, 5, 6, 107, 0, 8, 1, 3, 0, 0, 0.01],
  birne: ['Birne', 160, 57, 12.4, 0.4, 0.1, 3.1, 0.2, 7, 9, 116, 0.1, 4, 1, 7, 0, 0, 0],
  orange: ['Orange', 150, 47, 9.4, 0.9, 0.1, 2.4, 0.1, 10, 40, 180, 0.1, 53, 0, 30, 0, 0, 0.01],
  kiwi: ['Kiwi', 75, 61, 11, 1.1, 0.5, 3, 0.3, 17, 34, 312, 0.1, 93, 3, 25, 0, 0, 0.04],
  blaubeeren: ['Heidelbeeren', 0, 57, 12, 0.7, 0.3, 2.4, 0.3, 6, 6, 77, 0.2, 10, 1, 6, 0, 0, 0.06],
  himbeeren: ['Himbeeren (TK)', 0, 52, 5.5, 1.2, 0.7, 6.5, 0.7, 22, 25, 151, 0.4, 26, 1, 21, 0, 0, 0.1],
  kirschen: ['Kirschen (TK)', 0, 63, 14, 1, 0.2, 2, 0.4, 11, 13, 222, 0.1, 7, 0, 4, 0, 0, 0.03],
  erdbeeren: ['Erdbeeren', 0, 32, 5.5, 0.7, 0.3, 2, 0.4, 13, 16, 153, 0.1, 59, 1, 24, 0, 0, 0.07],
  mango: ['Mango', 0, 60, 13, 0.8, 0.4, 1.6, 0.2, 10, 11, 170, 0.1, 36, 1, 43, 0, 0, 0.04],
  ananas: ['Ananas', 0, 50, 12, 0.5, 0.1, 1.4, 0.3, 12, 13, 109, 0.1, 48, 1, 18, 0, 0, 0.02],
  trauben: ['Weintrauben', 0, 69, 16, 0.7, 0.2, 0.9, 0.4, 7, 10, 190, 0.1, 3, 2, 2, 0, 0, 0.01],
  zitrone: ['Zitronensaft', 0, 22, 7, 0.4, 0.2, 0.3, 0.1, 6, 6, 103, 0.05, 39, 1, 20, 0, 0, 0],
  orangensaft: ['Orangensaft', 0, 45, 10, 0.7, 0.2, 0.2, 0.2, 11, 11, 200, 0.1, 50, 1, 30, 0, 0, 0],
  rosinen: ['Rosinen', 0, 300, 66, 3, 0.5, 4, 1.9, 32, 50, 750, 0.2, 2, 11, 5, 0, 0, 0],
  datteln: ['Datteln (getrocknet)', 8, 280, 65, 2.5, 0.4, 8, 1, 43, 64, 700, 0.3, 0.4, 2, 19, 0, 0, 0],
  aprikosen: ['Aprikosen (getrocknet)', 8, 240, 48, 3.4, 0.5, 7, 2.7, 32, 55, 1160, 0.4, 1, 10, 10, 0, 0, 0],
  // Gemüse (roh)
  brokkoli: ['Brokkoli', 0, 34, 2.7, 2.8, 0.4, 3, 0.7, 21, 47, 316, 0.4, 89, 33, 63, 0, 0, 0.02],
  spinat: ['Spinat (frisch)', 0, 23, 0.6, 2.9, 0.4, 2.2, 2.7, 79, 99, 558, 0.5, 28, 79, 194, 0, 0, 0.14],
  rucola: ['Rucola', 0, 25, 2, 2.6, 0.7, 1.6, 1.5, 47, 160, 370, 0.5, 15, 27, 97, 0, 0, 0.17],
  feldsalat: ['Feldsalat', 0, 21, 0.7, 1.8, 0.4, 1.5, 2, 13, 35, 420, 0.5, 35, 4, 145, 0, 0, 0.1],
  salat: ['Blattsalat', 0, 15, 1.5, 1.3, 0.2, 1.5, 0.8, 12, 35, 200, 0.2, 10, 10, 40, 0, 0, 0.05],
  gruenkohl: ['Grünkohl', 0, 49, 4, 4.3, 0.9, 4, 1.5, 47, 150, 490, 0.4, 120, 38, 141, 0, 0, 0.18],
  paprika: ['Paprika rot', 150, 31, 6, 1, 0.3, 2, 0.4, 12, 7, 211, 0.2, 128, 4, 46, 0, 0, 0.03],
  tomate: ['Tomaten', 80, 18, 3.9, 0.9, 0.2, 1.2, 0.3, 11, 10, 237, 0.2, 14, 5, 15, 0, 0, 0],
  gurke: ['Gurke', 0, 15, 3, 0.6, 0.1, 0.5, 0.3, 13, 16, 147, 0.2, 3, 2, 7, 0, 0, 0],
  zucchini: ['Zucchini', 0, 17, 2.7, 1.2, 0.3, 1, 0.4, 18, 16, 261, 0.3, 18, 8, 24, 0, 0, 0.04],
  karotte: ['Karotten', 80, 41, 7, 0.9, 0.2, 2.8, 0.3, 12, 33, 320, 0.2, 6, 69, 19, 0, 0, 0],
  rotebete: ['Rote Bete (gekocht)', 0, 44, 8, 1.7, 0.2, 2, 0.8, 23, 16, 305, 0.4, 4, 77, 80, 0, 0, 0],
  rotebetesaft: ['Rote-Bete-Saft', 0, 40, 9, 1, 0, 0, 0.5, 15, 15, 250, 0.2, 3, 30, 40, 0, 0, 0],
  pilze: ['Champignons', 0, 22, 0.5, 3.1, 0.3, 1, 0.5, 9, 3, 318, 0.5, 2, 5, 17, 0.2, 0.04, 0],
  zwiebel: ['Zwiebel', 80, 40, 8, 1.1, 0.1, 1.7, 0.2, 10, 23, 146, 0.2, 7, 4, 19, 0, 0, 0],
  erbsen: ['Erbsen (TK)', 0, 81, 9, 5.4, 0.4, 5, 1.5, 33, 25, 244, 1.2, 40, 5, 65, 0, 0, 0.03],
  mais: ['Mais (Dose)', 0, 85, 15, 3, 1.2, 2.5, 0.5, 20, 4, 200, 0.6, 6, 250, 40, 0, 0, 0],
  kuerbis: ['Hokkaido-Kürbis', 0, 40, 8, 1.7, 0.6, 2.5, 0.8, 14, 20, 380, 0.3, 15, 1, 30, 0, 0, 0],
  fenchel: ['Fenchel', 0, 31, 3, 1.2, 0.2, 3.1, 0.7, 17, 49, 414, 0.2, 12, 52, 27, 0, 0, 0],
  avocado: ['Avocado', 0, 160, 1.9, 2, 15, 6.7, 0.6, 29, 12, 485, 0.6, 10, 7, 81, 0, 0, 0.1],
  passata: ['Passierte Tomaten', 0, 24, 4, 1.4, 0.2, 1.5, 0.6, 15, 20, 350, 0.2, 10, 30, 10, 0, 0, 0],
  ingwer: ['Ingwer (frisch)', 0, 80, 15, 1.8, 0.8, 2, 0.6, 43, 16, 415, 0.3, 5, 13, 11, 0, 0, 0],
  // Süßes, Würze, Getränke, Sportnahrung
  honig: ['Honig', 0, 304, 82, 0.3, 0, 0, 0.4, 2, 6, 52, 0.2, 0.5, 4, 2, 0, 0, 0],
  ahornsirup: ['Ahornsirup', 0, 260, 67, 0, 0.1, 0, 0.1, 21, 102, 212, 1.5, 0, 12, 0, 0, 0, 0],
  marmelade: ['Konfitüre', 0, 250, 60, 0.4, 0.1, 1, 0.3, 5, 10, 60, 0, 5, 15, 0, 0, 0, 0],
  schoko: ['Zartbitterschokolade 85 %', 0, 600, 20, 11, 50, 12, 11.9, 230, 73, 715, 3.3, 0, 20, 10, 0, 0, 0],
  kakao: ['Backkakao', 0, 230, 11, 20, 13, 33, 13.9, 500, 128, 1500, 6.8, 0, 20, 30, 0, 0, 0],
  bruehe: ['Gemüsebrühe (zubereitet)', 0, 5, 0.7, 0.2, 0.1, 0, 0, 1, 2, 20, 0, 0, 350, 0, 0, 0, 0],
  salz: ['Salz', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 39000, 0, 0, 0, 0],
  sojasauce: ['Sojasauce', 0, 60, 5, 8, 0, 0, 2, 40, 20, 200, 0.4, 0, 5600, 15, 0, 0, 0],
  kokosmilch: ['Kokosmilch', 0, 200, 3, 2, 21, 0, 1.6, 40, 15, 220, 0.6, 1, 15, 15, 0, 0, 0],
  pesto: ['Pesto Genovese', 0, 450, 6, 5, 45, 2, 1, 40, 150, 200, 0.6, 1, 1000, 20, 0, 0, 0.3],
  kokoswasser: ['Kokoswasser', 0, 19, 3.7, 0.7, 0.2, 1.1, 0.3, 25, 24, 250, 0.1, 2.4, 105, 3, 0, 0, 0],
  sportpulver: ['Kohlenhydrat-Getränkepulver (Malto/Fruktose, mit Natrium)', 0, 380, 95, 0, 0, 0, 0, 10, 10, 100, 0, 0, 800, 0, 0, 0, 0],
  gel: ['Energiegel', 40, 270, 67, 0, 0, 0, 0, 0, 0, 30, 0, 0, 200, 0, 0, 0, 0],
  riegel: ['Haferriegel', 40, 400, 65, 6, 12, 5, 1.5, 60, 30, 250, 1.2, 0, 100, 20, 0, 0, 0.1],
  brezel: ['Salzbrezeln', 0, 380, 77, 10, 3, 3, 1.5, 30, 20, 150, 1, 0, 1700, 30, 0, 0, 0],
  wasser: ['Wasser', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export const FOODS = Object.fromEntries(Object.entries(RAW).map(([k, [name, piece, ...v]]) => [k, { name, piece, ...Object.fromEntries(COLS.map((c, i) => [c, v[i]])) }]));

// Tagesreferenz (DGE, Männer 19–50 J.; Natrium ohne festen Bedarf). Sportler brauchen bei Eisen
// teils bis zu 30–70 % mehr (IOC), bei Natrium je nach Schweißverlust deutlich mehr.
export const REFERENCE = {
  m: { ballast: 30, eisen: 11, magnesium: 350, calcium: 1000, kalium: 4000, zink: 14, vitc: 110, folat: 300, vitd: 20, b12: 4, omega3: 1.6 },
  f: { ballast: 30, eisen: 14, magnesium: 300, calcium: 1000, kalium: 4000, zink: 8, vitc: 95, folat: 300, vitd: 20, b12: 4, omega3: 1.3 },
};

export const NUTRIENTS = {
  ballast: { label: 'Ballaststoffe', unit: 'g' }, eisen: { label: 'Eisen', unit: 'mg' }, magnesium: { label: 'Magnesium', unit: 'mg' },
  calcium: { label: 'Calcium', unit: 'mg' }, kalium: { label: 'Kalium', unit: 'mg' }, zink: { label: 'Zink', unit: 'mg' },
  vitc: { label: 'Vitamin C', unit: 'mg' }, folat: { label: 'Folat', unit: 'µg' }, vitd: { label: 'Vitamin D', unit: 'µg' },
  b12: { label: 'Vitamin B12', unit: 'µg' }, omega3: { label: 'Omega-3', unit: 'g' }, natrium: { label: 'Natrium', unit: 'mg' },
};

// Summe der Nährwerte für [[Lebensmittel, Gramm], …].
export function nutrientsOf(items) {
  const sum = Object.fromEntries(COLS.map((c) => [c, 0]));
  for (const [key, g] of items) {
    const f = FOODS[key];
    if (!f) throw new Error(`Unbekanntes Lebensmittel: ${key}`);
    for (const c of COLS) sum[c] += (f[c] * g) / 100;
  }
  return sum;
}

// Menge lesbar: Stückzahl, wo sinnvoll („1 Banane (120 g)“), sonst Gramm bzw. ml bei Getränken.
const LIQUID = new Set(['milch', 'hafermilch', 'sojamilch', 'kefir', 'buttermilch', 'orangensaft', 'rotebetesaft', 'kokoswasser', 'wasser', 'bruehe', 'zitrone', 'kokosmilch', 'passata']);
export function amountText(key, g) {
  const f = FOODS[key];
  if (f.piece && g >= f.piece * 0.5) {
    const n = Math.round((g / f.piece) * 2) / 2;
    return `${String(n).replace('.', ',')} × ${f.name} (${Math.round(g)} g)`;
  }
  if (key === 'salz') return `${g < 1 ? 'eine Prise' : `${Math.round(g * 10) / 10} g`} ${f.name}`;
  const unit = LIQUID.has(key) ? 'ml' : 'g';
  const rounded = g >= 50 ? Math.round(g / 5) * 5 : Math.round(g);
  return `${rounded} ${unit} ${f.name}`;
}
