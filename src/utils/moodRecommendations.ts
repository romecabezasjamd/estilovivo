import { Garment } from '../../types';
import { WeatherData } from './weather';

interface MoodProfile {
  preferredTypes: string[];
  preferredColors: string[];
  preferredSeasons: string[];
  avoidColors: string[];
}

const MOOD_PROFILES: Record<string, MoodProfile> = {
  confident: {
    preferredTypes: ['top', 'shoes', 'accessory'],
    preferredColors: ['rojo', 'negro', 'dorado', 'blanco', 'burgundy'],
    preferredSeasons: ['all'],
    avoidColors: [],
  },
  Sport: {
    preferredTypes: ['top', 'shoes', 'bottom'],
    preferredColors: ['negro', 'gris', 'blanco', 'azul', 'verde'],
    preferredSeasons: ['all'],
    avoidColors: [],
  },
  creative: {
    preferredTypes: ['top', 'accessory'],
    preferredColors: ['morado', 'naranja', 'rosa', 'amarillo', 'turquesa', 'multicolor'],
    preferredSeasons: ['all'],
    avoidColors: [],
  },
  relaxed: {
    preferredTypes: ['top', 'bottom', 'shoes'],
    preferredColors: ['beige', 'verde', 'azul claro', 'blanco', 'gris'],
    preferredSeasons: ['all', 'transition', 'summer'],
    avoidColors: ['negro'],
  },
  powerful: {
    preferredTypes: ['top', 'bottom', 'shoes', 'accessory'],
    preferredColors: ['negro', 'gris oscuro', 'azul marino', 'blanco'],
    preferredSeasons: ['all', 'winter', 'transition'],
    avoidColors: [],
  },
  elegant: {
    preferredTypes: ['top', 'shoes', 'accessory', 'bottom'],
    preferredColors: ['negro', 'blanco', 'beige', 'dorado', 'plateado', 'burdeos'],
    preferredSeasons: ['all'],
    avoidColors: ['neon', 'multicolor'],
  },
  casual: {
    preferredTypes: ['top', 'bottom', 'shoes'],
    preferredColors: ['azul', 'verde', 'beige', 'gris', 'blanco'],
    preferredSeasons: ['all', 'summer', 'transition'],
    avoidColors: [],
  },
};

function getSeasonFromTemp(temp: number): string {
  if (temp >= 25) return 'summer';
  if (temp >= 15) return 'transition';
  return 'winter';
}

function garmentMatchesType(garment: Garment, preferredTypes: string[]): boolean {
  const type = garment.type.toLowerCase();
  const name = garment.name.toLowerCase();
  
  for (const pt of preferredTypes) {
    if (pt === 'top' && /camis|polo|shirt|blusa|top|jersey|suéter|sweater|vestido/.test(type + ' ' + name)) return true;
    if (pt === 'bottom' && /pantal|jean|falda|short|trouser|bermuda/.test(type + ' ' + name)) return true;
    if (pt === 'shoes' && /zapat|bota|sandal|shoe|boot|mocasín/.test(type + ' ' + name)) return true;
    if (pt === 'accessory' && /gorr|sombr|bolso|gafas|bufand|guant|reloj|cintur/.test(type + ' ' + name)) return true;
  }
  return false;
}

function garmentMatchesColor(garment: Garment, preferredColors: string[], avoidColors: string[]): boolean {
  const color = (garment.color || '').toLowerCase();
  if (!color) return true;
  
  for (const ac of avoidColors) {
    if (color.includes(ac.toLowerCase())) return false;
  }
  
  for (const pc of preferredColors) {
    if (color.includes(pc.toLowerCase())) return true;
  }
  
  return false;
}

function garmentMatchesSeason(garment: Garment, weatherSeason: string): boolean {
  if (garment.season === 'all') return true;
  if (garment.season === weatherSeason) return true;
  if (garment.season === 'transition') return true;
  return false;
}

export function getMoodRecommendedGarments(
  mood: string | null | undefined,
  weather: WeatherData | null,
  garments: Garment[]
): Garment[] {
  if (!mood || !MOOD_PROFILES[mood]) {
    if (weather) {
      return getWeatherOnlyRecommendations(weather, garments);
    }
    return [];
  }

  const profile = MOOD_PROFILES[mood];
  const weatherSeason = weather ? getSeasonFromTemp(weather.temp) : 'all';

  return garments
    .filter(g => !g.isWashing && !g.forSale)
    .filter(g => garmentMatchesType(g, profile.preferredTypes))
    .filter(g => weather ? garmentMatchesSeason(g, weatherSeason) : true)
    .sort((a, b) => {
      const aColorMatch = garmentMatchesColor(a, profile.preferredColors, profile.avoidColors) ? 1 : 0;
      const bColorMatch = garmentMatchesColor(b, profile.preferredColors, profile.avoidColors) ? 1 : 0;
      return bColorMatch - aColorMatch;
    })
    .slice(0, 6);
}

function getWeatherOnlyRecommendations(weather: WeatherData, garments: Garment[]): Garment[] {
  const season = getSeasonFromTemp(weather.temp);
  return garments
    .filter(g => !g.isWashing && !g.forSale)
    .filter(g => garmentMatchesSeason(g, season))
    .slice(0, 6);
}

export function getMoodLabel(mood: string | null | undefined): string {
  if (!mood) return '';
  const labels: Record<string, string> = {
    confident: 'Seguro/a',
    Sport: 'Deportivo/a',
    creative: 'Creativo/a',
    relaxed: 'Relajado/a',
    powerful: 'Poderoso/a',
    elegant: 'Elegante',
    casual: 'Casual',
  };
  return labels[mood] || mood;
}

export function getMoodEmoji(mood: string | null | undefined): string {
  if (!mood) return '✨';
  const emojis: Record<string, string> = {
    confident: '🦁',
    Sport: '🏃',
    creative: '🎨',
    relaxed: '🧘‍♀️',
    powerful: '⚡',
    elegant: '✨',
    casual: '🌿',
  };
  return emojis[mood] || '✨';
}
