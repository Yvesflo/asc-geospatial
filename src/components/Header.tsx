import React from 'react';
import { Printer } from 'lucide-react';
import { Language, ActiveModule } from '../types';
import { TRANSLATIONS } from '../data/mockGisData';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  activeModule: ActiveModule;
  onExportMap?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  setLanguage,
  activeModule,
  onExportMap,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#bccac0]/40 shadow-[0_1px_8px_rgba(0,0,0,0.03)] h-16 px-4 flex items-center justify-between gap-4">
      {/* Logo & Geo Title */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
        <img
          src="https://lh3.googleusercontent.com/aida/AEtjO1X4gQE0tCNoIZUmHNOGS5B6ycuTi3XZizByiZrRM88KloFo7dXIxNpzxb4D67xhGniMl2dC58soabkkUi_S25Gm_pZ2u_gl8e-vF-xlphS6PcJqN94lFH9JpRK2HdO5jdQm2B-mBfkTLLEZQHLYvLZXloBgz_IVFdI2-Z0udN6KbQp5qd-qp8BydWlXvaxJBzxoV7M5S7wJJGKx2y5TB7tuA5IpsOWUADdYbrdKuwiU4Eg2SEFJZ6IZEg"
          alt="SIG-ASC Logo"
          className="h-10 w-10 object-contain rounded-xl p-0.5 bg-[#006948]/5 border border-[#006948]/10"
        />
        <div className="flex flex-col">
          <span className="font-display font-bold text-sm sm:text-[15px] text-[#0f172a] truncate leading-tight tracking-tight">
            {t.appTitle}
          </span>
          <span className="text-[11px] font-mono text-[#64748b] truncate leading-normal">
            {t.appSubtitle}
          </span>
        </div>
      </div>

      {/* Right Tools : Language Switcher & Official Export Map Button */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Bilingual Switcher */}
        <div className="inline-flex items-center p-0.5 rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-xs font-mono">
          <button
            onClick={() => setLanguage('fr')}
            className={`px-2.5 py-0.5 rounded-full font-semibold transition-all ${
              language === 'fr'
                ? 'bg-[#006948] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0f172a]'
            }`}
            type="button"
          >
            FR
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-0.5 rounded-full font-semibold transition-all ${
              language === 'en'
                ? 'bg-[#006948] text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0f172a]'
            }`}
            type="button"
          >
            EN
          </button>
        </div>

        {/* Bouton Unique Officiel d'Exportation Cartographique (A4 300 DPI) */}
        <button
          data-tour="export-btn"
          onClick={() => {
            if (onExportMap) {
              onExportMap();
            }
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-semibold text-xs transition-all shadow-xs cursor-pointer active:scale-95 ${
            activeModule === 'couverture-asc'
              ? 'border-[#006948] bg-[#006948] hover:bg-[#005238] text-white shadow-sm'
              : 'border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#0f172a]'
          }`}
          type="button"
          title={language === 'fr' ? 'Exporter la carte affichée en haute résolution A4 (300 DPI)' : 'Export displayed map in high resolution A4 (300 DPI)'}
        >
          <Printer className={`w-4 h-4 ${activeModule === 'couverture-asc' ? 'text-white' : 'text-[#006948]'}`} />
          <span>{t.exportPrint}</span>
        </button>
      </div>
    </header>
  );
};
