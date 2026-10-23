import { describe, it, expect } from 'vitest';
import { buildIdeas, slotOf, colorFamily, colorScore, weeklyKeywords, ideasForKeyword, type WardrobeItem } from '../outfitIdeas.js';

const item = (id: string, category: string, color: string | null, name = id): WardrobeItem => ({ id, name, category, color, image: `/api/uploads/${id}.jpg` });

describe('ideas con una prenda', () => {
  it('reconoce tipos y colores escritos de distintas formas', () => {
    expect(slotOf('Tops')).toBe('top');
    expect(slotOf('pantalón')).toBe('bottom');
    expect(slotOf('Abrigos')).toBe('outer');
    expect(slotOf('shoes')).toBe('shoes');
    expect(colorFamily('Azul marino')).toBe('azul marino');
    expect(colorFamily('vaquero claro')).toBe('vaquero');
    expect(colorFamily('Granate')).toBe('burdeos');
    expect(colorFamily('varios')).toBeNull();
  });

  it('los neutros combinan con todo y dos colores fuertes que no casan puntúan poco', () => {
    expect(colorScore('negro', 'burdeos')).toBeGreaterThan(2);
    expect(colorScore('burdeos', 'rosa')).toBeGreaterThanOrEqual(2);
    expect(colorScore('verde', 'rojo')).toBeLessThan(1);
  });

  it('combina con el propio armario y dibuja lo que falta', () => {
    const base = item('t1', 'top', 'burdeos', 'Jersey burdeos');
    const wardrobe = [base, item('b1', 'bottom', 'vaquero', 'Vaqueros rectos'), item('b2', 'bottom', 'verde', 'Falda verde'), item('o1', 'Abrigos', 'camel', 'Abrigo camel')];
    const ideas = buildIdeas(base, wardrobe);
    expect(ideas.length).toBeGreaterThan(0);
    const first = ideas[0];
    expect(first.pieces[0]).toMatchObject({ kind: 'own', id: 't1' });
    // Parte de abajo: los vaqueros (neutro), no la falda verde
    expect(first.pieces.find((p) => p.slot === 'bottom')).toMatchObject({ kind: 'own', id: 'b1' });
    // No hay zapatos en el armario: se sugieren dibujados, con texto en español
    const shoes = first.pieces.find((p) => p.slot === 'shoes');
    expect(shoes).toMatchObject({ kind: 'drawn' });
    expect((shoes as any).label).toMatch(/^Un(a|o)s? /);
    // El abrigo camel se añade como pieza opcional
    expect(first.pieces.some((p) => p.kind === 'own' && p.id === 'o1')).toBe(true);
  });

  it('sin nada más en el armario, todas las piezas necesarias salen dibujadas y no se repiten combinaciones', () => {
    const base = item('d1', 'vestido', 'negro');
    const ideas = buildIdeas(base, [base]);
    for (const idea of ideas) expect(idea.pieces.filter((p) => p.kind === 'drawn').map((p) => p.slot)).toEqual(['shoes']);
    expect(new Set(ideas.map((i) => JSON.stringify(i.pieces))).size).toBe(ideas.length);
  });
});

describe('palabras de la semana', () => {
  it('cuenta palabras de moda de un vocabulario propio', () => {
    const words = weeklyKeywords([
      'El vaquero del otoño es este', 'Zara tiene el abrigo azulón oversize', 'Los náuticos azul marino que arrasan',
      'Chaqueta de lana burdeos', 'Vaqueros paisley rosas', 'Abrigo burdeos',
    ]);
    expect(words.slice(0, 3)).toEqual(expect.arrayContaining(['Vaqueros', 'Abrigos', 'Burdeos']));
    expect(words.length).toBeLessThanOrEqual(6);
  });
});

describe('recrea este look con tu armario', () => {
  const wardrobe = [
    item('b1', 'pantalon', 'azul', 'Vaqueros claros'), item('t1', 'camiseta', 'blanco', 'Camiseta blanca'),
    item('s1', 'zapatillas', 'blanco', 'Zapatillas blancas'), item('o1', 'abrigo', 'camel', 'Abrigo camel'),
  ];

  it('usa como base la prenda del armario que encaja con la palabra', () => {
    const r = ideasForKeyword('Vaqueros', wardrobe)!;
    expect(r.found).toBe(true);
    expect(r.base).toBe('Vaqueros claros');
    expect(r.ideas[0].pieces[0]).toMatchObject({ kind: 'own', id: 'b1' });
    expect(r.ideas[0].pieces.some((p) => p.kind === 'own' && p.id === 't1')).toBe(true);
  });

  it('una palabra de color elige una prenda de ese color', () => {
    expect(ideasForKeyword('Camel', wardrobe)!.base).toBe('Abrigo camel');
  });

  it('si no tienes nada parecido, la base sale dibujada y el resto del armario', () => {
    const r = ideasForKeyword('Faldas', wardrobe)!;
    expect(r.found).toBe(false);
    expect(r.ideas[0].pieces[0]).toMatchObject({ kind: 'drawn', slot: 'bottom', shape: 'skirt' });
    expect(r.ideas[0].pieces.some((p) => p.kind === 'own' && p.id === 't1')).toBe(true);
  });

  it('una palabra desconocida no se inventa', () => {
    expect(ideasForKeyword('Cualquier cosa', wardrobe)).toBeNull();
  });
});
