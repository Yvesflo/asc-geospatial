import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { CiblageAscMap } from './components/Livrable3RealNeed';
import { CouvertureAscMap } from './components/CouvertureAscMap';
import { GuidedTour } from './components/GuidedTour';
import { ActiveModule, Language, SubdivisionLevel, BasemapType, CoverageMapType } from './types';
import { COVERAGE_CONFIG } from './config/coverageConfig';

export default function App() {
  const [language, setLanguage] = useState<Language>('fr');
  const [activeModule, setActiveModule] = useState<ActiveModule>('couverture-asc');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Échelon spatial partagé entre barre latérale et cartes
  const [spatialLevel, setSpatialLevel] = useState<SubdivisionLevel>('regions');
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('hot');

  // Paramètres d'affichage spécifiques Livrable 3
  const [ciblageThematicOpacity, setCiblageThematicOpacity] = useState<number>(0.85);
  const [ciblageIsThematicVisible, setCiblageIsThematicVisible] = useState<boolean>(true);
  const [ciblageRasterOpacity, setCiblageRasterOpacity] = useState<number>(0.85);
  const [ciblageIsRasterVisible, setCiblageIsRasterVisible] = useState<boolean>(true);

  // Paramètres spécifiques Couverture en ASC (5 cartes thématiques et sous-catégories)
  const [coverageActiveMap, setCoverageActiveMap] = useState<CoverageMapType>('map-1');
  const [coverageCategoryField, setCoverageCategoryField] = useState<string>(
    COVERAGE_CONFIG.FIELDS.EFF_TOT_A
  );

  // Déclencheurs d'export depuis le bouton officiel de l'en-tête
  const [coverageExportTrigger, setCoverageExportTrigger] = useState<number>(0);
  const [ciblageExportTrigger, setCiblageExportTrigger] = useState<number>(0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans antialiased flex flex-col">
      {/* Guided Platform Tour (shown on first visit) */}
      <GuidedTour
        language={language}
        onNavigate={(module) => setActiveModule(module as ActiveModule)}
        onLanguageChange={setLanguage}
      />

      {/* Barre Supérieure Épurée */}
      <Header
        language={language}
        setLanguage={setLanguage}
        activeModule={activeModule}
        onExportMap={() => {
          if (activeModule === 'ciblage-asc') {
            setCiblageExportTrigger((prev) => prev + 1);
          } else {
            setCoverageExportTrigger((prev) => prev + 1);
          }
        }}
      />

      {/* Disposition Principale */}
      <div className="flex-1 flex pt-16">
        {/* Barre Latérale Épurée */}
        <Sidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          language={language}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          ciblageLevel={spatialLevel}
          setCiblageLevel={setSpatialLevel}
          ciblageThematicOpacity={ciblageThematicOpacity}
          setCiblageThematicOpacity={setCiblageThematicOpacity}
          ciblageIsThematicVisible={ciblageIsThematicVisible}
          setCiblageIsThematicVisible={setCiblageIsThematicVisible}
          ciblageRasterOpacity={ciblageRasterOpacity}
          setCiblageRasterOpacity={setCiblageRasterOpacity}
          ciblageIsRasterVisible={ciblageIsRasterVisible}
          setCiblageIsRasterVisible={setCiblageIsRasterVisible}
          coverageActiveMap={coverageActiveMap}
          onCoverageActiveMapChange={setCoverageActiveMap}
          coverageCategoryField={coverageCategoryField}
          onCoverageCategoryFieldChange={setCoverageCategoryField}
        />

        {/* Espace Cartographique & Analytique */}
        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-72 sm:ml-80'
          } min-h-[calc(100vh-4rem)] overflow-hidden relative`}
        >
          {/* Ciblage du besoin en ASC (population couverte FOSA < 5 km) */}
          {activeModule === 'ciblage-asc' && (
            <CiblageAscMap
              language={language}
              level={spatialLevel}
              onLevelChange={setSpatialLevel}
              basemap={activeBasemap}
              onBasemapChange={setActiveBasemap}
              thematicOpacity={ciblageThematicOpacity}
              onThematicOpacityChange={setCiblageThematicOpacity}
              isThematicVisible={ciblageIsThematicVisible}
              onIsThematicVisibleChange={setCiblageIsThematicVisible}
              rasterOpacity={ciblageRasterOpacity}
              onRasterOpacityChange={setCiblageRasterOpacity}
              isRasterVisible={ciblageIsRasterVisible}
              onIsRasterVisibleChange={setCiblageIsRasterVisible}
              exportTrigger={ciblageExportTrigger}
            />
          )}

          {/* Module Couverture en ASC (5 Cartes thématiques, effectifs & ratios) */}
          {activeModule === 'couverture-asc' && (
            <CouvertureAscMap
              language={language}
              level={spatialLevel}
              onLevelChange={setSpatialLevel}
              basemap={activeBasemap}
              onBasemapChange={setActiveBasemap}
              exportTrigger={coverageExportTrigger}
              activeMap={coverageActiveMap}
              onActiveMapChange={setCoverageActiveMap}
              selectedCategoryField={coverageCategoryField}
              onSelectedCategoryFieldChange={setCoverageCategoryField}
            />
          )}

        </main>
      </div>
    </div>
  );
}
