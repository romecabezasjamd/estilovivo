import React from 'react';
import { Look } from '../types';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';

interface DailyLookRecommenderProps {
  occasion: string;
  emoji: string;
  looks: Look[];
  reasoning: string;
  onSelectLook?: (look: Look) => void;
  onNavigate?: (tab: string) => void;
}

const DailyLookRecommender: React.FC<DailyLookRecommenderProps> = ({
  occasion,
  emoji,
  looks,
  reasoning,
  onSelectLook,
  onNavigate,
}) => {
  const { t } = useLanguage();
  if (looks.length === 0) return null;

  const featuredLook = looks[0];
  const image = featuredLook.imageUrl || (featuredLook.garments?.[0]?.imageUrl);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h3 className="font-bold text-lg text-gray-900">{occasion}</h3>
          <p className="text-xs text-gray-500">{reasoning}</p>
        </div>
        <Sparkles size={20} className="ml-auto text-primary animate-bounce" />
      </div>

      {/* Featured Look */}
      {image && (
        <div
          onClick={() => onSelectLook?.(featuredLook)}
          className="group cursor-pointer bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
        >
          <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
            <img
              src={image}
              alt={featuredLook.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
              <div className="p-4 text-white w-full">
                <p className="font-bold">{featuredLook.name}</p>
                <p className="text-xs text-gray-200">{looks.length} {t('optionsAvailable')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* More Options */}
      {looks.length > 1 && (
        <button
          onClick={() => onNavigate?.('create')}
          className="w-full py-2.5 px-4 bg-primary/10 text-primary font-semibold rounded-2xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {t('viewLooks')} ({looks.length})
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

export default DailyLookRecommender;
