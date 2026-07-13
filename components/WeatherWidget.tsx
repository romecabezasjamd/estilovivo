import React, { useState, useEffect } from 'react';
import { Cloud, MapPin, RefreshCw } from 'lucide-react';
import { type WeatherData, getWeatherEmoji, getWeatherAdvice, getOutfitSuggestions, type OutfitSuggestion } from '../src/utils/weather';

interface Props {
  garments: { type: string; name: string; color?: string }[];
  onNavigate?: (tab: string) => void;
}

export default function WeatherWidget({ garments, onNavigate }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');

  useEffect(() => {
    loadWeather();
  }, []);

  useEffect(() => {
    if (weather && garments.length > 0) {
      const result = getOutfitSuggestions(weather, garments);
      setSuggestions(result.suggestions.filter(s => s.priority === 'essential').slice(0, 3));
    }
  }, [weather, garments]);

  const loadWeather = async () => {
    setLoading(true);
    try {
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        const { latitude, longitude } = pos.coords;

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

  if (loading) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Cloud size={16} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
            <div className="h-2 w-32 rounded bg-gray-100 animate-pulse mt-1" />
          </div>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="mx-3 mb-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-2xl shadow-sm">
          {weather.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{weather.temp}°C</span>
            <span className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>{weather.description}</span>
          </div>
          {location && (
            <div className="flex items-center gap-0.5">
              <MapPin size={8} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{location}</span>
            </div>
          )}
        </div>
        <button onClick={loadWeather} className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <RefreshCw size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <p className="text-[10px] mb-2" style={{ color: 'var(--text-secondary)' }}>{getWeatherAdvice(weather)}</p>

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>SUGERENCIA PARA HOY</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.reason}</span>
            </div>
          ))}
          {onNavigate && (
            <button
              onClick={() => onNavigate('wardrobe')}
              className="w-full mt-1 py-1.5 rounded-lg text-[10px] font-medium"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              Ver mi armario
            </button>
          )}
        </div>
      )}
    </div>
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
