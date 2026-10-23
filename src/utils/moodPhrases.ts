// GENERADO por scripts/mood-phrases.cjs (texto propio, sin citas de famosos). No editar a mano.
// Frase que acompaña al estado de ánimo elegido en Inicio. Va cambiando: cada día empieza por una distinta (y si hay
// tiempo conocido, por una que lo tiene en cuenta) y cada toque en el ánimo muestra la siguiente.

export type WeatherKind = 'rain' | 'cold' | 'hot' | 'sun';

const DATA: { general: Record<string, string[]>; weather: Record<WeatherKind, Record<string, string>> } = {
  "general": {
    "confident": [
      "Hoy no pides permiso para brillar.",
      "Tu mejor accesorio: la seguridad con la que lo llevas.",
      "Camina como si el pasillo fuera una pasarela.",
      "Hoy el look te acompaña, pero quien manda eres tú.",
      "Lo que te pongas hoy, llévalo con la cabeza alta.",
      "Confía en tu instinto: suele tener buen gusto.",
      "Hoy sales list{a|o} para todo.",
      "Tu estilo habla antes que tú, y hoy dice mucho.",
      "Nada de dudas frente al espejo: estás genial.",
      "La seguridad no se compra, pero se nota en cada paso."
    ],
    "sport": [
      "Cómod{a|o} por fuera, imparable por dentro.",
      "Zapatillas puestas, excusas fuera.",
      "Hoy el ritmo lo marcas tú.",
      "Lo deportivo también tiene estilo.",
      "Muévete a gusto: hoy toca libertad.",
      "Energía al máximo, look a la altura.",
      "Un buen chándal también es una declaración.",
      "Hoy cada paso cuenta, y con estilo cuenta doble.",
      "Ropa que se mueve contigo, no contra ti.",
      "Suda, ríe y vuelve a por más."
    ],
    "creative": [
      "Mezcla, prueba, atrévete: hoy no hay reglas.",
      "Ese color que nunca te pones… hoy es el día.",
      "Tu armario es un lienzo: hoy pintas tú.",
      "Combina lo que nadie combinaría.",
      "Hoy la regla es que no hay reglas.",
      "Un estampado, un accesorio raro, una idea nueva.",
      "Si te hace sonreír, combina.",
      "Hoy tu look es tu obra de arte.",
      "Rompe la rutina empezando por los calcetines.",
      "Lo original no se copia: se inventa cada mañana."
    ],
    "relaxed": [
      "Hoy el plan es estar a gusto.",
      "Lo cómodo también puede ser bonito.",
      "Respira hondo: hoy no hay prisa.",
      "Tejidos suaves, mente tranquila.",
      "Hoy te vistes para sentirte bien, no para impresionar.",
      "Un jersey amplio y un buen café: plan perfecto.",
      "Sin agobios: lo sencillo siempre funciona.",
      "Hoy vas a tu ritmo.",
      "Lo que te abrace un poco, eso es lo de hoy.",
      "Descansar también es tener estilo."
    ],
    "powerful": [
      "Entra como si la sala fuera tuya.",
      "Hombros atrás, mirada al frente, look a tu favor.",
      "Hoy vas a por todas.",
      "Hoy no te achicas: ocupa tu espacio.",
      "Un buen look es media reunión ganada.",
      "Hoy decides tú, y se nota.",
      "Fuerza por dentro, impecable por fuera.",
      "Que tu ropa diga \"aquí estoy\".",
      "Hoy no sigues el ritmo: lo marcas.",
      "Paso firme y algo que te haga sentir invencible."
    ],
    "elegant": [
      "Menos es más, y tú lo sabes.",
      "Un buen corte nunca pasa de moda.",
      "La elegancia está en los detalles.",
      "Hoy toca cuidar cada detalle.",
      "Colores sobrios, presencia que se recuerda.",
      "La elegancia no hace ruido, pero se nota.",
      "Una prenda bien elegida vale más que diez.",
      "Hoy vas impecable sin esfuerzo aparente.",
      "Clásico nunca es aburrido si lo llevas tú.",
      "Postura, calma y tu mejor abrigo."
    ],
    "casual": [
      "Vaqueros, camiseta y tu mejor sonrisa.",
      "Sencillo, pero con tu toque.",
      "Hoy lo fácil es lo bonito.",
      "Un look de diario puede ser de diez.",
      "Básicos bien combinados: nunca fallan.",
      "Hoy ni muy arreglad{a|o} ni muy de casa: perfect{a|o}.",
      "Lo de siempre, pero con un detalle nuevo.",
      "Ropa cómoda para un día lleno de planes.",
      "Natural, como tú.",
      "Hoy el estilo está en no complicarse."
    ]
  },
  "weather": {
    "rain": {
      "confident": "Llueve, pero tu estilo no se moja.",
      "sport": "Lluvia fuera, energía dentro: chubasquero y a por ello.",
      "creative": "Día gris, look de colores: tú pones la luz.",
      "relaxed": "Llueve: plan de jersey gordo y calma.",
      "powerful": "Que llueva: tú pisas fuerte igual.",
      "elegant": "Una gabardina y un paraguas bonito: elegancia bajo la lluvia.",
      "casual": "Botas cómodas y capucha: la lluvia no te frena."
    },
    "cold": {
      "confident": "Hace frío, pero tú vas a paso firme.",
      "sport": "Frío fuera: capas ligeras y a moverse.",
      "creative": "El frío es la excusa perfecta para jugar con capas.",
      "relaxed": "Frío fuera, abrigo calentito y cero prisas.",
      "powerful": "Un buen abrigo y una actitud que no se congela.",
      "elegant": "El frío pide abrigo largo y bufanda: puro estilo.",
      "casual": "Jersey, vaqueros y un abrigo que abrace."
    },
    "hot": {
      "confident": "Hace calor, y tú brillas más que el sol.",
      "sport": "Calor: tejidos frescos e hidratación a mano.",
      "creative": "Con este calor, colores vivos y estampados sin miedo.",
      "relaxed": "Calor: lino, sandalias y nada de prisas.",
      "powerful": "Ni el calor te quita fuerza: fresc{a|o} y segur{a|o}.",
      "elegant": "Tejidos ligeros y colores claros: elegancia de verano.",
      "casual": "Camiseta fresca y gafas de sol: listo el día."
    },
    "sun": {
      "confident": "Hace sol: sal a lucirte.",
      "sport": "Sol y buen tiempo: el día perfecto para moverte.",
      "creative": "Con este sol, hoy toca algo de color.",
      "relaxed": "Sol tranquilo: un paseo y un look sin complicaciones.",
      "powerful": "Día soleado, energía a tope.",
      "elegant": "Buen tiempo para ese look que reservabas.",
      "casual": "Hace buen día: vaqueros, zapatillas y a la calle."
    }
  }
};

/** Tipo de tiempo para las frases (null si no se conoce). */
export function weatherKind(temp?: number | null, condition?: string | null): WeatherKind | null {
  const c = (condition || '').toLowerCase();
  if (c === 'rainy' || c === 'stormy') return 'rain';
  if (c === 'snowy' || (typeof temp === 'number' && temp <= 10)) return 'cold';
  if (typeof temp === 'number' && temp >= 27) return 'hot';
  if (c === 'sunny') return 'sun';
  return null;
}

/** Frase n.º [step] del día para [mood] ("{a|o}" según el género). */
export function moodPhrase(mood: string, gender: string | null | undefined, kind: WeatherKind | null, step: number, date = new Date()): string | null {
  const key = mood.toLowerCase();
  const general = DATA.general[key];
  if (!general) return null;
  const pool = [...(kind && DATA.weather[kind]?.[key] ? [DATA.weather[kind][key]] : []), ...general];
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
  // La primera del día es la del tiempo (si la hay); las demás rotan empezando en un punto distinto cada día
  const i = step === 0 && pool.length > general.length ? 0 : (pool.length > general.length ? 1 : 0) + ((day + step) % general.length);
  const text = pool[Math.min(i, pool.length - 1)];
  const male = gender === 'male';
  return text.replace(/\{(\w*)\|(\w*)\}/g, (_, f, m) => (male ? m : f));
}
