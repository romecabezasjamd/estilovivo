export interface WeatherData {
  temp: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'hot' | 'cold';
  humidity: number;
  description: string;
  icon: string;
}

export interface OutfitSuggestion {
  category: string;
  reason: string;
  priority: 'essential' | 'recommended' | 'optional';
}

const TEMP_RANGES = {
  veryHot: { min: 30, max: 50 },
  hot: { min: 25, max: 30 },
  warm: { min: 20, max: 25 },
  mild: { min: 15, max: 20 },
  cool: { min: 10, max: 15 },
  cold: { min: 0, max: 10 },
  freezing: { min: -50, max: 0 },
};

function getTempRange(temp: number): keyof typeof TEMP_RANGES {
  for (const [key, range] of Object.entries(TEMP_RANGES)) {
    if (temp >= range.min && temp < range.max) return key as keyof typeof TEMP_RANGES;
  }
  return 'mild';
}

const WEATHER_RULES: Record<string, OutfitSuggestion[]> = {
  veryHot: [
    { category: 'top', reason: 'Camiseta ligera de algodón o lino', priority: 'essential' },
    { category: 'bottom', reason: 'Shorts o falda ligera', priority: 'essential' },
    { category: 'shoes', reason: 'Sandalias o zapatillas transpirables', priority: 'essential' },
    { category: 'acc', reason: 'Gafas de sol y protección solar', priority: 'recommended' },
  ],
  hot: [
    { category: 'top', reason: 'Camiseta o camisa ligera', priority: 'essential' },
    { category: 'bottom', reason: 'Pantalón ligero o shorts', priority: 'essential' },
    { category: 'shoes', reason: 'Zapatillas cómodas', priority: 'essential' },
  ],
  warm: [
    { category: 'top', reason: 'Camiseta o polo', priority: 'essential' },
    { category: 'bottom', reason: 'Jeans ligero o pantalón de chino', priority: 'essential' },
    { category: 'shoes', reason: 'Zapatillas o mocasines', priority: 'essential' },
  ],
  mild: [
    { category: 'top', reason: 'Camisa o camiseta con capa ligera', priority: 'essential' },
    { category: 'outer', reason: 'Chaqueta ligera o sudadera', priority: 'recommended' },
    { category: 'bottom', reason: 'Jeans o pantalón normal', priority: 'essential' },
    { category: 'shoes', reason: 'Zapatillas cerradas', priority: 'essential' },
  ],
  cool: [
    { category: 'top', reason: 'Camisa con suéter o capa media', priority: 'essential' },
    { category: 'outer', reason: 'Chaqueta o blazer', priority: 'essential' },
    { category: 'bottom', reason: 'Jeans o pantalón largo', priority: 'essential' },
    { category: 'shoes', reason: 'Zapatillas cerradas o botas bajas', priority: 'essential' },
  ],
  cold: [
    { category: 'top', reason: 'Suéter o jersey grueso', priority: 'essential' },
    { category: 'outer', reason: 'Chaqueta abrigada o parka', priority: 'essential' },
    { category: 'bottom', reason: 'Pantalón grueso o jeans oscuros', priority: 'essential' },
    { category: 'shoes', reason: 'Botas o zapatos cerrados', priority: 'essential' },
    { category: 'acc', reason: 'Bufanda y guantes', priority: 'recommended' },
  ],
  freezing: [
    { category: 'top', reason: 'Capas térmicas y suéter grueso', priority: 'essential' },
    { category: 'outer', reason: 'Chaqueta de invierno o abrigo', priority: 'essential' },
    { category: 'bottom', reason: 'Pantalón térmico o jeans gruesos', priority: 'essential' },
    { category: 'shoes', reason: 'Botas impermeables', priority: 'essential' },
    { category: 'acc', reason: 'Bufanda, guantes y gorro', priority: 'essential' },
  ],
  rainy: [
    { category: 'outer', reason: 'Chaqueta impermeable o de lluvia', priority: 'essential' },
    { category: 'shoes', reason: 'Zapatos impermeables o botas', priority: 'essential' },
    { category: 'acc', reason: 'Paraguas', priority: 'recommended' },
  ],
  snowy: [
    { category: 'outer', reason: 'Chaqueta térmica impermeable', priority: 'essential' },
    { category: 'shoes', reason: 'Botas con buen agarre', priority: 'essential' },
    { category: 'acc', reason: 'Guantes, bufanda y gorro', priority: 'essential' },
  ],
  windy: [
    { category: 'outer', reason: 'Chaqueta que corte el viento', priority: 'essential' },
    { category: 'acc', reason: 'Gafas de sol si hay brillo', priority: 'optional' },
  ],
};

function getConditionKey(condition: WeatherData['condition']): string {
  if (condition === 'rainy') return 'rainy';
  if (condition === 'snowy') return 'snowy';
  if (condition === 'windy') return 'windy';
  return '';
}

function matchGarmentToCategory(garment: { type: string; name: string }, category: string): boolean {
  const type = garment.type.toLowerCase();
  const name = garment.name.toLowerCase();
  const patterns: Record<string, RegExp> = {
    top: /camis|polo|shirt|blusa|top|jersey|suéter|sweater/,
    bottom: /pantal|jean|falda|short|trouser|bermuda/,
    outer: /chaqueta|abrigo|saco|jacket|coat|parka|blazer|sudadera/,
    dress: /vestido|enterizo/,
    shoes: /zapat|bota|sandal|shoe|boot|mocasín/,
    acc: /gorr|sombr|bolso|gafas|bufand|guant|paraguas|reloj/,
  };
  return patterns[category]?.test(type) || patterns[category]?.test(name) || false;
}

export function getOutfitSuggestions(
  weather: WeatherData,
  garments: { type: string; name: string; color?: string }[]
): { suggestions: OutfitSuggestion[]; matchingGarments: { suggestion: OutfitSuggestion; garment: typeof garments[0] }[] } {
  const tempRange = getTempRange(weather.temp);
  const conditionKey = getConditionKey(weather.condition);

  let suggestions = [...(WEATHER_RULES[tempRange] || WEATHER_RULES.mild)];

  if (conditionKey && WEATHER_RULES[conditionKey]) {
    const conditionSuggestions = WEATHER_RULES[conditionKey];
    for (const cs of conditionSuggestions) {
      if (!suggestions.find(s => s.category === cs.category)) {
        suggestions.push(cs);
      }
    }
  }

  const matchingGarments: { suggestion: OutfitSuggestion; garment: typeof garments[0] }[] = [];

  for (const suggestion of suggestions) {
    const matches = garments.filter(g => matchGarmentToCategory(g, suggestion.category));
    if (matches.length > 0) {
      matchingGarments.push({ suggestion, garment: matches[0] });
    }
  }

  return { suggestions, matchingGarments };
}

export function getWeatherEmoji(condition: WeatherData['condition']): string {
  const emojis: Record<string, string> = {
    sunny: '☀️',
    cloudy: '⛅',
    rainy: '🌧️',
    snowy: '❄️',
    windy: '💨',
    hot: '🔥',
    cold: '🥶',
  };
  return emojis[condition] || '🌤️';
}

export function getWeatherAdvice(weather: WeatherData): string {
  const tempRange = getTempRange(weather.temp);
  const advice: Record<string, string> = {
    veryHot: 'Hace mucho calor. Usa ropa ligera y transpirable.',
    hot: 'Calor agradable. Ropa ligera es ideal.',
    warm: 'Temperatura agradable. Puedes usar ropa de una sola capa.',
    mild: 'Temperatura fresca. Considera una capa ligera.',
    cool: 'Empieza a refrescar. Una chaqueta te vendrá bien.',
    cold: 'Hace frío. Abrígate bien con capas.',
    freezing: 'Temperaturas bajo cero. Vístete por capas y no olvides accesorios térmicos.',
  };
  return advice[tempRange] || 'Condiciones normales.';
}
