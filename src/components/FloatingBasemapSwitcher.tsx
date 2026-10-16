import React from 'react';
import { Layers } from 'lucide-react';
import { BasemapType } from '../types';

interface FloatingBasemapSwitcherProps {
  basemap: BasemapType;
  onBasemapChange?: (bm: BasemapType) => void;
  className?: string;
  language?: 'fr' | 'en';
}

export const FloatingBasemapSwitcher: React.FC<FloatingBasemapSwitcherProps> = ({
  basemap,
  onBasemapChange,
  className = '',
  language = 'fr',
}) => {
  const isFr = language === 'fr';
  const options: { id: BasemapType; label: string; icon: string; title: string }[] = [
    { id: 'hot', label: 'HOT', icon: '🗺️', title: isFr ? 'OpenStreetMap Humanitaire' : 'Humanitarian OpenStreetMap' },
    { id: 'osm', label: 'OSM', icon: '🌍', title: 'OpenStreetMap Standard' },
    { id: 'satellite', label: 'Satellite', icon: '🛰️', title: isFr ? 'Imagerie Satellite Esri World Imagery' : 'Esri World Imagery Satellite' },
  ];

  return (
    <div
      data-tour="basemap-switcher"
      className={`absolute z-20 pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#cbd5e1] p-1 flex items-center gap-1 font-mono text-[11px] select-none transition-all duration-300 ${className}`}
    >
      <span className="text-[10px] text-[#64748b] font-bold uppercase px-1.5 hidden sm:flex items-center gap-1">
        <Layers className="w-3 h-3 text-[#006948]" />
        <span>{isFr ? 'Fond :' : 'Map:'}</span>
      </span>
      {options.map((bm) => {
        const isActive = basemap === bm.id;
        return (
          <button
            key={bm.id}
            type="button"
            onClick={() => onBasemapChange && onBasemapChange(bm.id)}
            title={bm.title}
            className={`px-2 py-1 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isActive
                ? 'bg-[#006948] text-white shadow-xs'
                : 'bg-white hover:bg-[#f1f5f9] text-[#475569] border border-transparent hover:border-[#cbd5e1]'
            }`}
          >
            <span className="text-xs">{bm.icon}</span>
            <span>{bm.label}</span>
          </button>
        );
      })}
    </div>
  );
};
