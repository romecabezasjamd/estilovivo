import React, { useState, useEffect, useMemo } from 'react';
import { Cloud, MapPin, RefreshCw, Globe } from 'lucide-react';
import { type WeatherData, getWeatherEmoji, getWeatherAdvice, getOutfitSuggestions, type OutfitSuggestion } from '../src/utils/weather';
import { getMoodRecommendedGarments, getMoodLabel, getMoodEmoji } from '../src/utils/moodRecommendations';
import { Garment } from '../types';

interface Props {
  garments: Garment[];
  onNavigate?: (tab: string) => void;
  locationName?: string;
  mood?: string | null;
}

export default function WeatherWidget({ garments, onNavigate, locationName, mood }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  /** Hora en que se consultó el tiempo por última vez. */
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    loadWeather();
  }, [locationName]);

  // Al conceder la ubicación desde la pantalla de permisos, se vuelve a cargar el tiempo de tu zona
  useEffect(() => {
    const onGranted = () => { if (!locationName) loadWeather(); };
    window.addEventListener('ev-location-granted', onGranted);
    return () => window.removeEventListener('ev-location-granted', onGranted);
  }, [locationName]);

  useEffect(() => {
    if (weather && garments.length > 0) {
      const result = getOutfitSuggestions(weather, garments);
      setSuggestions(result.suggestions.filter(s => s.priority === 'essential').slice(0, 3));
    }
  }, [weather, garments]);

  const moodGarments = useMemo(() => {
    if (!mood || !weather) return [];
    return getMoodRecommendedGarments(mood, weather, garments);
  }, [mood, weather, garments]);

  const loadWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      let latitude: number, longitude: number;

      // Try saved location first (manual city name)
      if (locationName && locationName.trim()) {
        try {
          const locRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName.trim())}&count=1&language=es`
          );
          const locData = await locRes.json();
          if (locData.results?.[0]) {
            latitude = locData.results[0].latitude;
            longitude = locData.results[0].longitude;
            setLocation(locData.results[0].name || locationName);
          } else {
            // City not found, fallback to Madrid
            latitude = 40.4168;
            longitude = -3.7038;
            setLocation('Madrid');
          }
        } catch {
          latitude = 40.4168;
          longitude = -3.7038;
          setLocation('Madrid');
        }
      } else if (navigator.geolocation) {
        // Try browser geolocation
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: false });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          latitude = 40.4168;
          longitude = -3.7038;
          setLocation('Madrid');
        }
      } else {
        latitude = 40.4168;
        longitude = -3.7038;
        setLocation('Madrid');
      }

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`
      );
      const data = await res.json();
      const current = data.current;

      const code = current.weather_code;
      let condition: WeatherData['condition'] = 'sunny';
      if (code >= 51 && code <= 67) condition = 'rainy';
      else if (code >= 71 && code <= 77) condition = 'snowy';
      else if (code >= 80 && code <= 82) condition = 'rainy';
      else if (code >= 85 && code <= 86) condition = 'snowy';
      else if (code >= 95 && code <= 99) condition = 'rainy';
      else if (code >= 1 && code <= 3) condition = 'cloudy';
      else if (current.temperature_2m > 30) condition = 'hot';
      else if (current.temperature_2m < 5) condition = 'cold';

      const weatherData: WeatherData = {
        temp: Math.round(current.temperature_2m),
        condition,
        humidity: current.relative_humidity_2m,
        description: getConditionName(code),
        icon: getWeatherEmoji(condition),
      };

      setWeather(weatherData);
      setUpdatedAt(new Date());
      // Para el look de ejemplo por ánimo (Inicio): último tiempo conocido
      (window as any).__evWeather = weatherData;

      // If we used geolocation (not manual), try to resolve city name
      if (!locationName && !location) {
        const locRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${latitude}&longitude=${longitude}&count=1`
        ).catch(() => null);
        if (locRes) {
          const locData = await locRes.json();
          if (locData.results?.[0]) {
            setLocation(locData.results[0].name || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          }
        }
        if (!location) setLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      }
    } catch (e) {
      console.warn('Weather fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Mismo diseño que la tarjeta del tiempo de la app: degradado según el tiempo, icono grande y texto en blanco
  if (loading) {
    return <div className="mb-3 h-[150px] rounded-[28px] animate-pulse" style={{ backgroundColor: 'var(--border-light)' }} />;
  }

  if (!weather) {
    return (
      <div className="mb-3 p-[18px] rounded-[28px] flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
        <Cloud size={28} style={{ color: 'var(--text-muted)' }} />
        <div className="flex-1">
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Sin datos del tiempo</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No hemos podido consultar el tiempo ahora mismo.</p>
        </div>
        <button onClick={loadWeather} className="px-3 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Reintentar</button>
      </div>
    );
  }

  const [from, to] = WEATHER_GRADIENT[weather.condition] || WEATHER_GRADIENT.sunny;
  const picks = moodGarments.length > 0 ? moodGarments : [];
  return (
    <div className="mb-3 p-[18px] rounded-[28px] text-white space-y-[14px]" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <div className="flex items-center gap-[14px]">
        <WeatherGlyph condition={weather.condition} />
        <div className="flex-1 min-w-0">
          <p className="text-[44px] leading-none font-extrabold tracking-tight">{weather.temp}°</p>
          <p className="text-base font-semibold capitalize opacity-90 mt-1">{weather.description}</p>
          {location && (
            <p className="flex items-center gap-0.5 text-[11px] opacity-80 truncate">
              <MapPin size={12} /> {location}{weather.humidity > 0 ? ` · ${weather.humidity}% hum.` : ''}
            </p>
          )}
          {updatedAt && (
            <p className="text-[11px] opacity-80">
              Actualizado a las {updatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button onClick={loadWeather} aria-label="Actualizar el tiempo" className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
          <RefreshCw size={20} />
        </button>
      </div>

      <p className="text-sm">{getWeatherAdvice(weather)}</p>

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide opacity-75">SUGERENCIA PARA HOY</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
              <span className="text-[13px]">{s.reason}</span>
            </div>
          ))}
        </div>
      )}

      {picks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide opacity-75">DE TU ARMARIO PARA HOY</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {picks.map((g) => (
              <button key={g.id} onClick={() => onNavigate?.('wardrobe')} aria-label={g.name}
                className="flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <img src={g.imageUrl} alt={g.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const WEATHER_GRADIENT: Record<string, [string, string]> = {
  sunny: ['#F59E0B', '#EF6C3A'],
  hot: ['#EF4444', '#EA580C'],
  cloudy: ['#64748B', '#3B5B8C'],
  rainy: ['#3B6FB6', '#1E3A8A'],
  snowy: ['#5B8DB8', '#3B5B8C'],
  windy: ['#0F8A8A', '#1E5F8C'],
  cold: ['#4F8FD0', '#2D4F9C'],
};

/** Icono grande dibujado (sol, nube, lluvia, nieve o viento), como el de la app. */
function WeatherGlyph({ condition }: { condition: string }) {
  const sun = (cx: number, cy: number, r: number) => (
    <g className="ev-weather-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(a) * (r + 6)} y1={cy + Math.sin(a) * (r + 6)} x2={cx + Math.cos(a) * (r + 13)} y2={cy + Math.sin(a) * (r + 13)} stroke="#FFD84D" strokeWidth="5" strokeLinecap="round" />;
      })}
      <circle cx={cx} cy={cy} r={r} fill="#FFD84D" />
    </g>
  );
  const cloud = (x: number, y: number, s: number) => (
    <path transform={`translate(${x} ${y}) scale(${s})`} fill="#F1F5FA" d="M14 30h34a10 10 0 0 0 0-20 14 14 0 0 0-26-4A12 12 0 0 0 14 30z" />
  );
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" className="shrink-0">
      {(condition === 'sunny' || condition === 'hot' || condition === 'cold') && sun(38, 38, condition === 'hot' ? 18 : 16)}
      {condition === 'cloudy' && <>{sun(48, 26, 11)}{cloud(4, 26, 1.05)}</>}
      {condition === 'rainy' && <>{cloud(4, 14, 1.05)}{[22, 36, 50].map((x) => <line key={x} x1={x} y1={52} x2={x - 4} y2={64} stroke="#BFDBFE" strokeWidth="4" strokeLinecap="round" />)}</>}
      {condition === 'snowy' && <>{cloud(4, 14, 1.05)}{[22, 36, 50].map((x) => <circle key={x} cx={x} cy={58} r={3.5} fill="#fff" />)}</>}
      {condition === 'windy' && [20, 34, 48].map((y, i) => <path key={y} d={`M10 ${y} h${44 - i * 8} a6 6 0 1 0 -6 -6`} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />)}
    </svg>
  );
}

function getConditionName(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 3) return 'Nublado';
  if (code <= 49) return 'Niebla';
  if (code <= 67) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  if (code <= 82) return 'Lluvia';
  if (code <= 86) return 'Nieve';
  if (code <= 99) return 'Tormenta';
  return 'Despejado';
}
