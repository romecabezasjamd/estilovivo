import React, { useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onClose?: () => void;
  colors?: string[];
  types?: string[];
}

export interface SearchFilters {
  query: string;
  color?: string;
  type?: string;
  season?: string;
  priceMin?: number;
  priceMax?: number;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onClose,
  colors = ['rojo', 'azul', 'negro', 'blanco', 'verde', 'gris'],
  types = ['top', 'bottom', 'shoes', 'dress', 'outerwear', 'accessories'],
}) => {
  const [query, setQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    onSearch(query, {
      query,
      color: selectedColor || undefined,
      type: selectedType || undefined,
      season: selectedSeason || undefined,
    });
  };

  const hasFilters = selectedColor || selectedType || selectedSeason;

  return (
    <div className="space-y-4 p-4 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-light)] shadow-lg">
      {/* Search Input */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Buscar prendas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-base)] border border-[var(--border-light)] rounded-xl focus:outline-none focus:border-primary focus:bg-[var(--bg-card)] transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 rounded-xl transition-colors ${
            hasFilters
              ? 'bg-primary/20 text-primary'
              : 'bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-gray-200'
          }`}
          title="Filtros avanzados"
        >
          <ChevronDown size={18} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={handleSearch}
          className="px-4 py-2.5 bg-primary text-white font-semibold rounded-xl hover:shadow-lg transition-all active:scale-[0.98]"
        >
          Buscar
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-4 pt-4 border-t border-[var(--border-light)] animate-fade-in-down">
          {/* Color Filter */}
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedColor === color
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-gray-200'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              Tipo
            </label>
            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(selectedType === type ? null : type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedType === type
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Season Filter */}
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              Temporada
            </label>
            <div className="flex flex-wrap gap-2">
              {['todos', 'verano', 'invierno', 'entretiempo'].map((season) => (
                <button
                  key={season}
                  onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedSeason === season
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-gray-200'
                  }`}
                >
                  {season}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={() => {
                setSelectedColor(null);
                setSelectedType(null);
                setSelectedSeason(null);
              }}
              className="w-full py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
