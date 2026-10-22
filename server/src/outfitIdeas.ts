// "Ideas con esta prenda": combinaciones con el PROPIO armario de la persona (reglas de color y de tipo de prenda).
// Si falta alguna pieza, se sugiere dibujada (catálogo de siluetas propio de la app, ExampleKind) en un color que
// combine. El armario privado solo se usa para dar ideas a su dueña; no se comparte con nadie ni sale del servidor.

export type Slot = 'top' | 'bottom' | 'dress' | 'outer' | 'shoes' | 'accessory';
export type ExampleKind =
  | 'tshirt' | 'shirt' | 'sweater' | 'blazer' | 'coat' | 'jeans' | 'trousers' | 'skirt' | 'sneakers' | 'boots' | 'loafers' | 'bag';

const SLOT_RULES: [RegExp, Slot][] = [
  [/^(dress|dresses|vestido|mono)/i, 'dress'],
  [/^(outer|outerwear|abrigo|chaqueta|cazadora|americana|blazer|gabardina|plumas|coat|jacket)/i, 'outer'],
  [/^(top|tops|camiseta|camisa|blusa|jersey|sudadera|polo|chaleco|parte de arriba|shirt|sweater)/i, 'top'],
  [/^(bottom|bottoms|pantal|falda|vaquero|short|mallas|parte de abajo|jeans|trousers|skirt)/i, 'bottom'],
  [/^(shoe|shoes|zapat|calzado|bota|deportiva|sandalia|tac[oó]n|mocas)/i, 'shoes'],
  [/^(acc|accesorio|bolso|joya|gorra|bufanda|cintur|sombrero|bag)/i, 'accessory'],
];

export function slotOf(category: string | null | undefined): Slot | null {
  const c = (category || '').trim();
  return SLOT_RULES.find(([re]) => re.test(c))?.[1] ?? null;
}

// Familias de color (los colores se guardan como texto libre en español)
const FAMILY: [RegExp, string][] = [
  [/negr/i, 'negro'], [/blanc|crudo|marfil/i, 'blanco'], [/gris/i, 'gris'], [/beige|arena|nude|crema|hueso/i, 'beige'],
  [/camel|tostado|mostaza/i, 'camel'], [/marr[oó]n|chocolate|café|cafe|caqui|kaki/i, 'marrón'], [/marino/i, 'azul marino'],
  [/vaquer|denim|tejano/i, 'vaquero'], [/azul|celeste|turquesa/i, 'azul'], [/burdeos|granate|vino/i, 'burdeos'],
  [/rojo/i, 'rojo'], [/rosa|fucsia/i, 'rosa'], [/verde|oliva/i, 'verde'], [/amarill/i, 'amarillo'], [/naranja|coral/i, 'naranja'],
  [/morad|lila|violeta/i, 'morado'], [/dorad|plata|platead/i, 'metal'],
];
export function colorFamily(color: string | null | undefined): string | null {
  const c = (color || '').trim();
  if (!c || /^(varios|sin color)$/i.test(c)) return null;
  return FAMILY.find(([re]) => re.test(c))?.[1] ?? null;
}

const NEUTRALS = new Set(['negro', 'blanco', 'gris', 'beige', 'camel', 'marrón', 'azul marino', 'vaquero', 'metal']);
// Parejas de color que funcionan bien juntas (además de neutros y tono sobre tono)
const PAIRS: [string, string][] = [
  ['burdeos', 'rosa'], ['burdeos', 'camel'], ['rojo', 'azul marino'], ['rosa', 'rojo'], ['verde', 'camel'], ['verde', 'rosa'],
  ['azul', 'amarillo'], ['naranja', 'azul'], ['morado', 'verde'], ['amarillo', 'morado'], ['azul', 'rosa'],
];

/** Puntuación de combinación de dos colores (0 = no combina, 3 = muy bien). Sin color conocido = neutral (1.5). */
export function colorScore(a: string | null, b: string | null): number {
  if (!a || !b) return 1.5;
  if (a === b) return 2.5; // tono sobre tono
  if (NEUTRALS.has(a) && NEUTRALS.has(b)) return 2.5;
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) return 3;
  if (PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 2;
  return 0.3;
}

const REQUIRED: Record<Slot, Slot[]> = {
  top: ['bottom', 'shoes'], bottom: ['top', 'shoes'], dress: ['shoes'], outer: ['top', 'bottom', 'shoes'],
  shoes: ['top', 'bottom'], accessory: ['top', 'bottom', 'shoes'],
};
// Piezas opcionales: solo se añaden si están en el armario (no se dibujan)
const OPTIONAL: Record<Slot, Slot[]> = {
  top: ['outer', 'accessory'], bottom: ['outer', 'accessory'], dress: ['outer', 'accessory'], outer: ['accessory'],
  shoes: ['outer', 'accessory'], accessory: ['outer'],
};

const DRAWN_KIND: Record<Slot, ExampleKind[]> = {
  top: ['tshirt', 'shirt', 'sweater'], bottom: ['jeans', 'trousers', 'skirt'], dress: ['tshirt'],
  outer: ['blazer', 'coat', 'blazer'], shoes: ['sneakers', 'boots', 'loafers'], accessory: ['bag', 'bag', 'bag'],
};
const KIND_NOUN: Record<ExampleKind, string> = {
  tshirt: 'Una camiseta', shirt: 'Una camisa', sweater: 'Un jersey', blazer: 'Una americana', coat: 'Un abrigo', jeans: 'Unos vaqueros',
  trousers: 'Un pantalón', skirt: 'Una falda', sneakers: 'Unas zapatillas', boots: 'Unas botas', loafers: 'Unos mocasines', bag: 'Un bolso',
};
const COLOR_HEX: Record<string, string> = {
  negro: '#1F1F24', blanco: '#F4F4F2', gris: '#8C8F96', beige: '#D8C3A5', camel: '#B98A57', 'marrón': '#6B4430', 'azul marino': '#1F3A68',
  vaquero: '#4F6F9C', azul: '#3D6FD6', burdeos: '#7B1F35', rojo: '#C62828', rosa: '#F2A1C0', verde: '#5E8C61', amarillo: '#D9A31F',
  naranja: '#F07B26', morado: '#7B4FB8', metal: '#C9A227',
};
// Concordancia del adjetivo de color con el sustantivo (femenino/plural)
const ADJ: Record<string, [string, string, string, string]> = {
  negro: ['negro', 'negra', 'negros', 'negras'], blanco: ['blanco', 'blanca', 'blancos', 'blancas'], rojo: ['rojo', 'roja', 'rojos', 'rojas'],
  morado: ['morado', 'morada', 'morados', 'moradas'], amarillo: ['amarillo', 'amarilla', 'amarillos', 'amarillas'],
};
function colorWord(family: string, noun: string): string {
  const fem = /^Una /.test(noun) || /^Unas /.test(noun);
  const plural = /^Un(o|a)s /.test(noun);
  const forms = ADJ[family];
  if (forms) return forms[(plural ? 2 : 0) + (fem ? 1 : 0)];
  return family === 'vaquero' ? 'vaquero' : family;
}

export interface WardrobeItem { id: string; name: string; category: string; color: string | null; image: string | null }
export interface IdeaPiece { kind: 'own'; id: string; name: string; image: string | null; slot: Slot }
export interface DrawnPiece { kind: 'drawn'; slot: Slot; shape: ExampleKind; color: string; colorName: string; label: string }
export interface OutfitIdea { title: string; pieces: (IdeaPiece | DrawnPiece)[] }

const TITLES = ['Para el día a día', 'Con un toque de color', 'Más arreglado'];
// Colores sugeridos para las piezas que faltan, según el color de la prenda base
const SUGGEST_FOR_NEUTRAL = [['blanco', 'vaquero', 'negro'], ['burdeos', 'camel', 'verde'], ['negro', 'beige', 'azul marino']];
const SUGGEST_FOR_ACCENT = [['blanco', 'vaquero', 'blanco'], ['beige', 'camel', 'marrón'], ['negro', 'negro', 'gris']];

/** Hasta 3 combinaciones con la prenda [base] y el resto del armario; lo que falta se sugiere dibujado. */
export function buildIdeas(base: WardrobeItem, wardrobe: WardrobeItem[]): OutfitIdea[] {
  const baseSlot = slotOf(base.category) ?? 'top';
  const baseFamily = colorFamily(base.color);
  const others = wardrobe.filter((w) => w.id !== base.id).map((w) => ({ ...w, slot: slotOf(w.category), family: colorFamily(w.color) }));
  const ideas: OutfitIdea[] = [];
  for (let i = 0; i < 3; i++) {
    const pieces: (IdeaPiece | DrawnPiece)[] = [{ kind: 'own', id: base.id, name: base.name, image: base.image, slot: baseSlot }];
    const chosenFamilies = [baseFamily];
    const fill = (slot: Slot, drawIfMissing: boolean) => {
      const ranked = others
        .filter((o) => o.slot === slot)
        .map((o) => ({ o, score: chosenFamilies.reduce((s, f) => s + colorScore(f, o.family), 0) }))
        .filter((x) => x.score >= chosenFamilies.length * 1.4)
        .sort((a, b) => b.score - a.score || a.o.name.localeCompare(b.o.name));
      const pick = ranked[i % Math.max(1, ranked.length)]?.o;
      if (pick) {
        pieces.push({ kind: 'own', id: pick.id, name: pick.name, image: pick.image, slot });
        chosenFamilies.push(pick.family);
        return;
      }
      if (!drawIfMissing) return;
      const palette = (baseFamily && !NEUTRALS.has(baseFamily) ? SUGGEST_FOR_ACCENT : SUGGEST_FOR_NEUTRAL)[i];
      const colorName = palette[REQUIRED[baseSlot].concat(OPTIONAL[baseSlot]).indexOf(slot) % palette.length] || 'negro';
      const shape = DRAWN_KIND[slot][i % DRAWN_KIND[slot].length];
      const noun = KIND_NOUN[shape];
      pieces.push({ kind: 'drawn', slot, shape, color: COLOR_HEX[colorName] || '#1F1F24', colorName, label: `${noun} ${colorWord(colorName, noun)}` });
      chosenFamilies.push(colorName);
    };
    for (const s of REQUIRED[baseSlot]) fill(s, true);
    for (const s of OPTIONAL[baseSlot]) fill(s, false);
    ideas.push({ title: TITLES[i], pieces });
  }
  // Sin combinaciones repetidas
  const seen = new Set<string>();
  return ideas.filter((idea) => {
    const key = idea.pieces.map((p) => (p.kind === 'own' ? p.id : `${p.shape}:${p.colorName}`)).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Palabras de la semana (titulares de revistas + prendas de los looks públicos) ──
// Solo palabras sueltas de un vocabulario de moda propio: no se reproduce texto ajeno.
const VOCAB: [RegExp, string][] = [
  [/vaquer|denim/i, 'Vaqueros'], [/abrig/i, 'Abrigos'], [/chaquet|cazador|bomber/i, 'Chaquetas'], [/blazer|americana/i, 'Americanas'],
  [/gabardin|trench/i, 'Gabardinas'], [/plumas|plumífero/i, 'Plumas'], [/jersey|punto|lana|cárdigan|cardigan/i, 'Punto'],
  [/falda/i, 'Faldas'], [/vestido/i, 'Vestidos'], [/pantal[oó]n/i, 'Pantalones'], [/camisa/i, 'Camisas'], [/camiseta/i, 'Camisetas'],
  [/zapatilla|sneaker/i, 'Zapatillas'], [/bailarina/i, 'Bailarinas'], [/n[aá]utico/i, 'Náuticos'], [/mocas[ií]n/i, 'Mocasines'],
  [/bota/i, 'Botas'], [/tac[oó]n|stiletto/i, 'Tacones'], [/bolso/i, 'Bolsos'], [/reloj/i, 'Relojes'], [/gafas/i, 'Gafas de sol'],
  [/burdeos|granate/i, 'Burdeos'], [/chocolate|marr[oó]n/i, 'Marrón'], [/camel/i, 'Camel'], [/beige|arena/i, 'Beige'],
  [/negr/i, 'Negro'], [/blanc/i, 'Blanco'], [/\brojo|\broja/i, 'Rojo'], [/\brosa\b/i, 'Rosa'], [/verde|oliva/i, 'Verde'],
  [/azul marino|marino/i, 'Azul marino'], [/paisley/i, 'Paisley'], [/cuadros/i, 'Cuadros'], [/rayas/i, 'Rayas'], [/lunares/i, 'Lunares'],
  [/leopardo|animal print/i, 'Animal print'], [/terciopelo/i, 'Terciopelo'], [/cuero|piel\b|efecto piel/i, 'Piel'], [/tweed/i, 'Tweed'],
  [/oversize/i, 'Oversize'], [/\bmidi\b/i, 'Midi'], [/vintage|segunda mano|upcycling/i, 'Vintage'], [/minimalis/i, 'Minimalismo'],
];

export function weeklyKeywords(texts: string[], limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const seen = new Set<string>();
    for (const [re, word] of VOCAB) if (re.test(t) && !seen.has(word)) { seen.add(word); counts.set(word, (counts.get(word) || 0) + 1); }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([w]) => w);
}
