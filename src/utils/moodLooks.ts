// Look de ejemplo según el estado de ánimo (catálogo propio de prendas ilustradas). Igual que MoodLook.kt de la app.

export type ExampleKind =
  | 'tshirt' | 'shirt' | 'sweater' | 'hoodie' | 'blazer' | 'jacket' | 'coat' | 'dress' | 'skirt' | 'trousers'
  | 'jeans' | 'shorts' | 'leggings' | 'sneakers' | 'boots' | 'heels' | 'loafers' | 'bag' | 'cap' | 'scarf';

const NOUN: Record<ExampleKind, string> = {
  tshirt: 'Camiseta', shirt: 'Camisa', sweater: 'Jersey', hoodie: 'Sudadera', blazer: 'Americana', jacket: 'Chaqueta',
  coat: 'Abrigo', dress: 'Vestido', skirt: 'Falda', trousers: 'Pantalón', jeans: 'Vaqueros', shorts: 'Pantalón corto',
  leggings: 'Mallas', sneakers: 'Zapatillas', boots: 'Botas', heels: 'Tacones', loafers: 'Mocasines', bag: 'Bolso',
  cap: 'Gorra', scarf: 'Bufanda',
};

/** Siluetas (lienzo 24×24), iguales que en la app. */
export const GARMENT_PATHS: Record<ExampleKind, string> = {
  tshirt: 'M8 3L5 4.5L2 8L4.5 10L6 9L6 21L18 21L18 9L19.5 10L22 8L19 4.5L16 3C15.3 4.4 13.8 5.3 12 5.3C10.2 5.3 8.7 4.4 8 3Z',
  shirt: 'M8 3L4 4.5L2 14L4.5 14.6L6 9L6 21L18 21L18 9L19.5 14.6L22 14L20 4.5L16 3L14 5.5L12 4L10 5.5Z',
  sweater: 'M8.5 3L4.5 4.5L2.5 15L5 15.5L6.5 9.5L6 20L7 21L17 21L18 20L17.5 9.5L19 15.5L21.5 15L19.5 4.5L15.5 3C14.8 4.2 13.5 4.8 12 4.8C10.5 4.8 9.2 4.2 8.5 3Z',
  hoodie: 'M8.5 3.5L4.5 5L2.5 15.5L5 16L6.5 10L6 20L7 21L17 21L18 20L17.5 10L19 16L21.5 15.5L19.5 5L15.5 3.5C15.5 1.3 8.5 1.3 8.5 3.5ZM10 3.6C10 5.6 14 5.6 14 3.6C14 2.6 10 2.6 10 3.6Z',
  blazer: 'M8 3L4 4.8L2.5 16L5 16.5L6.3 10L6 21L11.3 21L11.3 9.5L9 3ZM16 3L20 4.8L21.5 16L19 16.5L17.7 10L18 21L12.7 21L12.7 9.5L15 3Z',
  jacket: 'M8 3L4 4.6L2.5 15L5 15.5L6.3 10L6.2 19.5L11.3 19.5L11.3 7L9.5 3ZM16 3L20 4.6L21.5 15L19 15.5L17.7 10L17.8 19.5L12.7 19.5L12.7 7L14.5 3Z',
  coat: 'M8 2.5L4 4.3L2.5 16L5 16.5L6.3 10L5.7 22.5L11.3 22.5L11.3 9.5L9 2.5ZM16 2.5L20 4.3L21.5 16L19 16.5L17.7 10L18.3 22.5L12.7 22.5L12.7 9.5L15 2.5Z',
  dress: 'M9 2L15 2L15.5 6C15.5 7 14.8 8 14.8 9L19 22L5 22L9.2 9C9.2 8 8.5 7 8.5 6Z',
  skirt: 'M7 5L17 5L17.5 7L20 19L4 19L6.5 7Z',
  trousers: 'M6.5 2.5L17.5 2.5L18.5 21.5L14 21.5L12 8.5L10 21.5L5.5 21.5Z',
  jeans: 'M6.5 2.5L17.5 2.5L18.8 21.5L14.2 21.5L12 8.5L9.8 21.5L5.2 21.5Z',
  shorts: 'M5.5 5L18.5 5L19.5 16L13.5 16.5L12 10.5L10.5 16.5L4.5 16Z',
  leggings: 'M7.5 2.5L16.5 2.5L16 21.5L13 21.5L12 9L11 21.5L8 21.5Z',
  sneakers: 'M2 15C2 12 4 11 5.5 11L8 11L11 13.5C13 14.5 17 14.5 19.5 15C21.5 15.5 22 16.5 22 17.5L22 18.5L2 18.5Z',
  boots: 'M7 3L13 3L13 13C15.5 13.5 19.5 14.5 20.5 16L20.5 19L5.5 19L6.5 14Z',
  heels: 'M3 14C5 13 8 12.5 10 13.5L16 17.5L19.5 13L21 13.5L20.2 19L18.8 19L18.6 16.8L16 19L3.5 19C2.5 18 2.5 15 3 14Z',
  loafers: 'M2.5 15.5C2.5 13.5 4.5 12.5 7 12.5L14 12.8C17.5 13 21.5 14 21.5 16.5L21.5 18L2.5 18Z',
  bag: 'M5 9L19 9L20 21L4 21ZM9 9C9 4.5 15 4.5 15 9L13.6 9C13.6 6.4 10.4 6.4 10.4 9Z',
  cap: 'M4 15C4 9 8 6 12 6C16 6 19 9 19.5 13.5L22.5 15C22.5 16.2 20.5 16.6 18 16Z',
  scarf: 'M6 5C6 3.4 18 3.4 18 5L18 7.5C18 9.4 6 9.4 6 7.5ZM8 8.6L11.2 9L10.4 20.5L7.2 20ZM12.8 9L16 8.6L16.8 20L13.6 20.5Z',
};

export interface ExampleGarment { kind: ExampleKind; name: string; color: string }
export interface MoodLook { title: string; phrase: string; items: ExampleGarment[]; moodLabel?: string }

const C = {
  black: '#1F1F24', white: '#F4F4F2', red: '#C62828', burgundy: '#7B1F35', navy: '#1F3A68', denim: '#4F6F9C',
  lightDenim: '#8AA8CC', grey: '#8C8F96', beige: '#D8C3A5', camel: '#B98A57', sage: '#97AE8F', mustard: '#D9A31F',
  teal: '#14A89A', coral: '#FF6F61', lilac: '#B39DDB', nude: '#E3BFA6', sky: '#A9C8E8',
};

const g = (kind: ExampleKind, detail: string, color: string): ExampleGarment => ({ kind, name: `${NOUN[kind]} ${detail}`, color });

const LABELS: Record<string, [string, string]> = {
  confident: ['Segura', 'Seguro'], sport: ['Sport', 'Sport'], creative: ['Creativa', 'Creativo'], relaxed: ['Relajada', 'Relajado'],
  powerful: ['Poderosa', 'Poderoso'], elegant: ['Elegante', 'Elegante'], casual: ['Casual', 'Casual'],
};

const PHRASES: Record<string, [string, string][]> = {
  confident: [['Hoy pisas fuerte: un color potente y una pieza que te haga sentir imparable.', 'Hoy pisas fuerte: líneas limpias y un toque de color que se note.'], ['Ponte lo que te haga sentir la mejor versión de ti.', 'Ponte lo que te haga sentir la mejor versión de ti.']],
  sport: [['Cómoda, ligera y lista para moverte: hoy manda la energía.', 'Cómodo, ligero y listo para moverte: hoy manda la energía.'], ['Prendas que respiran y zapatillas que acompañan cada paso.', 'Prendas que respiran y zapatillas que acompañan cada paso.']],
  creative: [['Hoy toca jugar: mezcla colores y estampados sin miedo.', 'Hoy toca jugar: mezcla colores y texturas sin miedo.'], ['Un color inesperado convierte un look normal en uno tuyo.', 'Un color inesperado convierte un look normal en uno tuyo.']],
  relaxed: [['Tejidos suaves y formas amplias: hoy va de estar a gusto.', 'Tejidos suaves y formas amplias: hoy va de estar a gusto.'], ['Nada que apriete, todo que abrace.', 'Nada que apriete, todo que abrace.']],
  powerful: [['Sastrería y contraste: entra en la sala como si fuera tuya.', 'Sastrería y contraste: entra en la sala como si fuera tuya.'], ['Hombros marcados, paso firme y cero dudas.', 'Hombros marcados, paso firme y cero dudas.']],
  elegant: [['Tonos sobrios y una pieza especial: elegancia sin esfuerzo.', 'Tonos sobrios y buenos tejidos: elegancia sin esfuerzo.'], ['Menos es más: deja que la calidad hable por ti.', 'Menos es más: deja que la calidad hable por ti.']],
  casual: [['Básicos que nunca fallan para un día sin complicaciones.', 'Básicos que nunca fallan para un día sin complicaciones.'], ['Camiseta, vaqueros y a disfrutar del día.', 'Camiseta, vaqueros y a disfrutar del día.']],
};

const dayOfYear = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);

export function moodLook(moodId: string, gender: string | undefined, temp: number | null | undefined, rainy = false, today = new Date()): MoodLook {
  const female = gender === 'female';
  const male = gender === 'male';
  const band = temp == null ? 'mild' : temp >= 24 ? 'hot' : temp >= 15 ? 'mild' : 'cold';
  const items: ExampleGarment[] = [];
  const add = (...x: ExampleGarment[]) => items.push(...x);
  switch (moodId.toLowerCase()) {
    case 'confident':
      if (female) {
        add(g('dress', 'rojo', C.red));
        if (band !== 'hot') add(g('blazer', 'negra', C.black));
        add(band === 'cold' || rainy ? g('boots', 'negras', C.black) : g('heels', 'negros', C.black), g('bag', 'dorado', C.mustard));
      } else {
        add(g('shirt', 'blanca', C.white), g('trousers', 'negro', C.black));
        if (band !== 'hot') add(g('blazer', 'burdeos', C.burgundy));
        add(band === 'cold' || rainy ? g('boots', 'negras', C.black) : g('loafers', 'negros', C.black));
      }
      break;
    case 'sport':
      add(g('tshirt', 'técnica turquesa', C.teal));
      add(band === 'hot' ? g('shorts', 'negro', C.black) : female ? g('leggings', 'negras', C.black) : g('trousers', 'de chándal gris', C.grey));
      if (band !== 'hot') add(g('hoodie', 'gris', C.grey));
      add(g('sneakers', 'blancas', C.white));
      if (band === 'hot') add(g('cap', 'blanca', C.white));
      break;
    case 'creative':
      if (female) {
        add(g('shirt', 'estampada verde', C.sage), g('skirt', 'mostaza', C.mustard));
        if (band === 'cold') add(g('coat', 'lila', C.lilac)); else if (band === 'mild') add(g('jacket', 'vaquera', C.denim));
        add(g('sneakers', 'coral', C.coral));
      } else {
        add(g('shirt', 'mostaza', C.mustard), g('jeans', 'claros', C.lightDenim));
        if (band === 'cold') add(g('coat', 'verde', C.sage)); else if (band === 'mild') add(g('jacket', 'coral', C.coral));
        add(g('sneakers', 'blancas', C.white), g('cap', 'turquesa', C.teal));
      }
      break;
    case 'relaxed':
      add(band === 'hot' ? g('tshirt', 'amplia beige', C.beige) : g('sweater', female ? 'de punto beige' : 'de punto verde salvia', female ? C.beige : C.sage));
      add(band === 'hot' ? g('shorts', 'de lino', C.white) : g('jeans', 'anchos', C.lightDenim));
      if (band === 'cold') add(g('scarf', 'camel', C.camel));
      add(g('sneakers', 'blancas', C.white));
      break;
    case 'powerful':
      add(g('blazer', female ? 'negra entallada' : 'azul marino', female ? C.black : C.navy));
      add(g(female ? 'tshirt' : 'shirt', 'blanca', C.white));
      add(g('trousers', female ? 'negro de pinzas' : 'azul marino', female ? C.black : C.navy));
      add(female ? g('heels', 'rojos', C.red) : g('loafers', 'marrones', C.camel));
      if (female) add(g('bag', 'negro', C.black));
      break;
    case 'elegant':
      if (female) {
        add(g('dress', 'azul marino', C.navy));
        if (band === 'cold') add(g('coat', 'camel', C.camel));
        add(g('heels', 'nude', C.nude), g('bag', 'nude', C.nude));
      } else {
        add(g('shirt', 'azul cielo', C.sky), g('trousers', 'gris marengo', C.grey));
        add(band === 'cold' ? g('coat', 'camel', C.camel) : g('blazer', 'azul marino', C.navy), g('loafers', 'negros', C.black));
      }
      break;
    default:
      add(g('tshirt', 'blanca', C.white), g('jeans', 'azules', C.denim));
      if (band === 'cold') add(g('coat', 'camel', C.camel)); else if (band === 'mild') add(g('jacket', 'vaquera', C.lightDenim));
      add(g('sneakers', 'blancas', C.white));
  }
  if (rainy && !items.some((i) => i.kind === 'coat' || i.kind === 'jacket')) add(g('jacket', 'impermeable', C.navy));
  const key = PHRASES[moodId.toLowerCase()] ? moodId.toLowerCase() : 'casual';
  const options = PHRASES[key];
  const pair = options[dayOfYear(today) % options.length];
  const label = (LABELS[moodId.toLowerCase()] || ['Tu ánimo', 'Tu ánimo'])[male ? 1 : 0];
  return { title: 'Tu look para hoy', phrase: male ? pair[1] : pair[0], items, moodLabel: label };
}
