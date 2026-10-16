import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Map,
  Users,
  Activity,
  Layers,
  Filter,
  Download,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  X,
  BookOpen,
  Play,
  SkipForward,
} from 'lucide-react';
import { Language } from '../types';

/* ─────────────────────────────────────────────
   Tour step definitions
───────────────────────────────────────────── */

export type TourAction =
  | { type: 'navigate'; module: 'couverture-asc' | 'ciblage-asc' }
  | { type: 'none' };

interface TourStep {
  id: string;
  /** CSS selector of the element to spotlight. If null → centred modal */
  target: string | null;
  /** Preferred placement of the tooltip card relative to the target */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon: React.ReactNode;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  /** Optional side-effect when this step is shown */
  action?: TourAction;
}

const ACCENT = '#006948';

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    placement: 'center',
    icon: <BookOpen className="w-7 h-7 text-[#006948]" />,
    titleFr: 'Bienvenue sur la Plateforme SIG-ASC',
    titleEn: 'Welcome to the SIG-ASC Platform',
    descFr:
      `Cette plateforme vous permet d'analyser la distribution des Agents de Santé Communautaire (ASC) au Cameroun, ainsi que d'explorer les zones prioritaires pour leur déploiement.`,
    descEn:
      'This platform allows you to analyze the distribution of Community Health Workers (CHWs) across Cameroon and to explore priority zones for their deployment.',
  },
  {
    id: 'couverture-map',
    target: '[data-tour="couverture-map"]',
    placement: 'center',
    icon: <Map className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Carte interactive',
    titleEn: 'Interactive map',
    descFr:
      `La carte constitue l'espace principal d'affichage des résultats. Les polygones représentent les unités territoriales selon le niveau de désagrégation sélectionné.\n\nCliquez sur n'importe quelle zone pour afficher une fiche statistique détaillée relative à cette unité.`,
    descEn:
      'The map is the main space for displaying results. Polygons represent territorial units at the selected disaggregation level.\n\nClick on any zone to open a detailed statistical summary for that unit.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'legend-btn',
    target: '[data-tour="legend-btn"]',
    placement: 'top',
    icon: <Layers className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Légende cartographique',
    titleEn: 'Map Legend',
    descFr:
      `Le bouton Légende, situé en bas à gauche de la carte, permet de dérouler la légende cartographique. Elle décrit les classes de valeurs et les seuils de référence utilisés pour colorer ou dimensionner les polygones et symboles affichés.`,
    descEn:
      'The Legend button, located at the bottom-left of the map, expands the map legend. It describes the value classes and reference thresholds used to color or size the displayed polygons and symbols.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'basemap-switcher',
    target: '[data-tour="basemap-switcher"]',
    placement: 'top',
    icon: <Map className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Fond de carte',
    titleEn: 'Basemap',
    descFr:
      `Le sélecteur de fond de carte, situé en bas à droite, permet de choisir entre trois fonds disponibles : HOT (OpenStreetMap humanitaire), OSM (OpenStreetMap standard) et Satellite (imagerie Esri).`,
    descEn:
      'The basemap selector, located at the bottom-right, allows choosing between three available basemaps: HOT (Humanitarian OpenStreetMap), OSM (Standard OpenStreetMap), and Satellite (Esri imagery).',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'level-selector',
    target: '[data-tour="level-selector"]',
    placement: 'right',
    icon: <Layers className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Désagrégation Territoriale',
    titleEn: 'Territorial Disaggregation',
    descFr:
      `Permet d'afficher les résultats selon différents niveaux de découpages administratifs et sanitaires :\n\n• Régions : socle commun aux deux systèmes\n• Administratif : Départements, Arrondissements\n• Sanitaire : Districts de Santé, Aires de Santé`,
    descEn:
      'Displays results at different administrative and health subdivision levels:\n\n• Regions: common base for both systems\n• Administrative: Departments, Sub-divisions\n• Health: Health Districts, Health Areas',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'horizontal-filter-bar',
    target: '[data-tour="horizontal-filter-bar"]',
    placement: 'bottom',
    icon: <Filter className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Filtre',
    titleEn: 'Filter',
    descFr:
      `Disponible sur les deux modules, la barre de filtre permet de restreindre l'affichage selon deux modalités :\n\n• Filtre régional : sélectionnez une région dans la liste déroulante pour limiter la vue à ce périmètre.\n\n• Recherche libre : saisissez un nom dans le champ texte pour filtrer par département ou par district de santé.`,
    descEn:
      'Available on both modules, the filter bar restricts the display in two ways:\n\n• Regional filter: select a region from the dropdown to limit the view to that area.\n\n• Free text search: type a name in the text field to filter by department or health district.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'analysis-panel',
    target: '[data-tour="analysis-panel-btn"]',
    placement: 'left',
    icon: <BarChart3 className="w-5 h-5 text-[#006948]" />,
    titleFr: `Panneau d'analyse & Légende`,
    titleEn: 'Analysis panel & Legend',
    descFr:
      `Le panneau latéral d'analyse est disponible sur les deux modules. Il présente les indicateurs clés du territoire sélectionné, les classements, les comparaisons régionales et la légende cartographique.\n\nCliquez sur le bouton latéral pour déployer ou réduire ce panneau.`,
    descEn:
      'The side analysis panel is available on both modules. It displays key indicators for the selected territory, rankings, regional comparisons, and the map legend.\n\nClick the side button to expand or collapse this panel.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'couverture-tab-overview',
    target: '[data-tour="couverture-tab"]',
    placement: 'right',
    icon: <Users className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Module 1 : Couverture en ASC',
    titleEn: 'Module 1: CHW Coverage',
    descFr:
      `Ce module présente deux types de représentations cartographiques :\n\n• Symboles proportionnels : figurent les effectifs d'ASC actifs selon la catégorie sélectionnée.\n\n• Cartes choroplèthes : représentent les taux et ratios de couverture par unité territoriale.`,
    descEn:
      'This module offers two types of map representations:\n\n• Proportional symbols: show active CHW workforce by selected category.\n\n• Choropleth maps: display coverage rates and ratios per territorial unit.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'coverage-proportional',
    target: '[data-tour="coverage-proportional"]',
    placement: 'right',
    icon: <Users className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Effectifs d\'ASC Actifs',
    titleEn: 'Active CHW Workforce',
    descFr:
      `Cette carte affiche les effectifs d'ASC actifs sous forme de symboles proportionnels. Il est possible de sélectionner différentes catégories d'ASC (total, polyvalents, travailleurs, etc.) pour adapter la représentation à l'analyse souhaitée.`,
    descEn:
      'This map displays active CHW workforce as proportional symbols. Different CHW categories (total, polyvalent, worker, etc.) can be selected to tailor the representation to the desired analysis.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'coverage-choropleth',
    target: '[data-tour="coverage-choropleth"]',
    placement: 'right',
    icon: <BarChart3 className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Cartes Choroplèthes de Ratio',
    titleEn: 'Ratio Choropleth Maps',
    descFr:
      `Deux cartes choroplèthes sont disponibles :\n\n• Couverture ASCp : ratio d'ASC polyvalents pour 1 000 habitants, selon la norme OMS.\n\n• Ratios toutes catégories : ratio global exprimé en nombre d'habitants par ASC, toutes catégories confondues.`,
    descEn:
      'Two choropleth maps are available:\n\n• CHWp coverage: ratio of polyvalent CHWs per 1,000 inhabitants, per WHO standard.\n\n• All-category ratios: overall ratio expressed as inhabitants per CHW, across all categories.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
  {
    id: 'l3-module',
    target: '[data-tour="ciblage-tab"]',
    placement: 'right',
    icon: <Activity className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Module 2 : Ciblage du Besoin en ASC',
    titleEn: 'Module 2: CHW Need Targeting',
    descFr:
      `Ce module analyse et évalue le pourcentage de la population couverte par une formation sanitaire (FOSA) fonctionnelle, en considérant un rayon d'action de 5 km autour de chaque FOSA.\n\nPar déduction inverse, il identifie les zones où la population se trouve hors de portée de toute FOSA, et priorise ces territoires pour le déploiement d'ASC.`,
    descEn:
      'This module analyzes and evaluates the percentage of the population covered by a functional health facility (FOSA), considering a 5 km catchment radius around each facility.\n\nBy inverse deduction, it identifies areas where the population lies beyond the reach of any FOSA, and prioritizes those territories for CHW deployment.',
    action: { type: 'navigate', module: 'ciblage-asc' },
  },
  {
    id: 'l3-stats-csv',
    target: '[data-tour="ciblage-stats-csv"]',
    placement: 'bottom',
    icon: <BarChart3 className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Export CSV',
    titleEn: 'CSV Export',
    descFr:
      `Le bouton Export CSV, accessible depuis la barre de filtre, télécharge les données tabulaires de la zone affichée au format CSV, prêtes pour une analyse externe (Excel, QGIS, R, etc.).\n\nPour consulter les statistiques détaillées d'une zone, cliquez directement sur un polygone de la carte : le panneau latéral d'analyse s'ouvre automatiquement.`,
    descEn:
      'The CSV Export button, accessible from the filter bar, downloads tabular data for the displayed area in CSV format, ready for external analysis (Excel, QGIS, R, etc.).\n\nTo view detailed statistics for a zone, simply click on a polygon on the map: the side analysis panel opens automatically.',
    action: { type: 'navigate', module: 'ciblage-asc' },
  },
  {
    id: 'l3-map-search',
    target: '[data-tour="ciblage-map-search"]',
    placement: 'right',
    icon: <Filter className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Recherche de Zone sur la Carte',
    titleEn: 'Map Zone Search',
    descFr:
      `Le champ de recherche situé en haut à gauche de la carte permet de localiser une subdivision spécifique (département ou district de santé) à l'intérieur de la zone sélectionnée ou filtrée.\n\nSaisissez les premières lettres du nom pour obtenir des suggestions et centrer l'affichage sur la zone choisie.`,
    descEn:
      'The search field in the top-left of the map allows you to locate a specific subdivision (department or health district) within the selected or filtered area.\n\nType the first letters of the name to get suggestions and center the display on the chosen zone.',
    action: { type: 'navigate', module: 'ciblage-asc' },
  },
  {
    id: 'l3-layers',
    target: '[data-tour="ciblage-layer-controls"]',
    placement: 'right',
    icon: <Layers className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Transparence & Populations non couvertes',
    titleEn: 'Transparency & Uncovered Population Grid',
    descFr:
      `• Transparence des couches : réglez l'opacité des polygones thématiques pour révéler la couche ou le fond de carte sous-jacent.\n\n• Distribution pop. non couverte : affiche la répartition spatiale des populations situées à plus de 5 km de toute FOSA. La grille indique la densité en nombre d'habitants par pixel (1 pixel = 1 hectare).`,
    descEn:
      '• Layer transparency: adjust polygon opacity to reveal the underlying layer or basemap.\n\n• Uncovered pop. distribution: shows the spatial distribution of populations living more than 5 km from any health facility. The grid indicates density in inhabitants per pixel (1 pixel = 1 hectare).',
    action: { type: 'navigate', module: 'ciblage-asc' },
  },
  {
    id: 'export',
    target: '[data-tour="export-btn"]',
    placement: 'bottom',
    icon: <Download className="w-5 h-5 text-[#006948]" />,
    titleFr: 'Exporter / Imprimer la carte',
    titleEn: 'Export / Print Map',
    descFr:
      `Le bouton « Exporter / Imprimer la carte » dans l'en-tête permet d'exporter la carte affichée en haute résolution A4 (300 DPI), prête pour les rapports officiels et présentations.\n\nL'export CSV des données filtrées est accessible depuis la barre de filtres du module Ciblage.`,
    descEn:
      'The "Export / Print map" button in the header exports the currently displayed map in high-resolution A4 format (300 DPI), ready for official reports and presentations.\n\nCSV export of filtered data is accessible from the filter bar of the Targeting module.',
    action: { type: 'navigate', module: 'couverture-asc' },
  },
];

/* ─────────────────────────────────────────────
   localStorage key
───────────────────────────────────────────── */
const TOUR_STORAGE_KEY = 'sig_asc_tour_v1_completed';

/* ─────────────────────────────────────────────
   Helper: compute tooltip position
───────────────────────────────────────────── */
interface TooltipPos {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  transform?: string;
}

function computeTooltipPos(
  rect: DOMRect | null,
  placement: TourStep['placement'],
  cardW = 360,
  cardH = 310
): TooltipPos {
  if (!rect || placement === 'center') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  switch (placement) {
    case 'right': {
      let top = rect.top + rect.height / 2 - cardH / 2;
      top = Math.max(12, Math.min(top, vh - cardH - 12));
      const left = Math.min(rect.right + gap, vw - cardW - 12);
      return { top, left };
    }
    case 'left': {
      let top = rect.top + rect.height / 2 - cardH / 2;
      top = Math.max(12, Math.min(top, vh - cardH - 12));
      const left = Math.max(12, rect.left - cardW - gap);
      return { top, left };
    }
    case 'bottom': {
      const top = Math.min(rect.bottom + gap, vh - cardH - 12);
      let left = rect.left + rect.width / 2 - cardW / 2;
      left = Math.max(12, Math.min(left, vw - cardW - 12));
      return { top, left };
    }
    case 'top': {
      const top = Math.max(12, rect.top - cardH - gap);
      let left = rect.left + rect.width / 2 - cardW / 2;
      left = Math.max(12, Math.min(left, vw - cardW - 12));
      return { top, left };
    }
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

/* ─────────────────────────────────────────────
   Spotlight mask (SVG with cut-out)
───────────────────────────────────────────── */
function SpotlightMask({ rect }: { rect: DOMRect | null }) {
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <rect x="0" y="0" width={vw} height={vh} fill="rgba(2,12,27,0.72)" />
      </svg>
    );
  }

  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const r = 10;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect x="0" y="0" width={vw} height={vh} fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width={vw}
        height={vh}
        fill="rgba(2,12,27,0.72)"
        mask="url(#spotlight-mask)"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Language Toggle (reusable pill)
───────────────────────────────────────────── */
interface LangToggleProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  dark?: boolean;
}

function LangToggle({ language, onLanguageChange, dark = false }: LangToggleProps) {
  return (
    <div className={`flex gap-0.5 rounded-lg p-0.5 ${dark ? 'bg-white/15' : 'bg-[#f1f5f9] border border-[#e2e8f0]'}`}>
      {(['fr', 'en'] as Language[]).map((lang) => {
        const active = language === lang;
        return (
          <button
            key={lang}
            onClick={() => onLanguageChange(lang)}
            className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors uppercase cursor-pointer ${
              active
                ? dark
                  ? 'bg-white text-[#006948]'
                  : 'bg-[#006948] text-white'
                : dark
                  ? 'text-white/60 hover:text-white'
                  : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Welcome Modal
───────────────────────────────────────────── */
interface WelcomeModalProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onStart: () => void;
  onSkip: () => void;
}

function WelcomeModal({ language, onLanguageChange, onStart, onSkip }: WelcomeModalProps) {
  const fr = language === 'fr';
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#020c1b]/80 backdrop-blur-sm"
        onClick={onSkip}
      />

      {/* Card */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[#006948] via-[#0f766e] to-[#0369a1] p-8 text-white">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                SIG-ASC · DOSTS / WBG
              </p>
              <h2 className="text-xl font-bold text-white leading-tight">
                {fr ? 'Bienvenue sur la Plateforme !' : 'Welcome to the Platform!'}
              </h2>
            </div>
            <LangToggle language={language} onLanguageChange={onLanguageChange} dark />
          </div>
          <p className="text-sm text-white/85 leading-relaxed">
            {fr
              ? 'Vous utilisez cette plateforme pour la première fois. Souhaitez-vous un tour guidé des principales fonctionnalités ?'
              : 'You are using this platform for the first time. Would you like a guided tour of the main features?'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Tour preview: chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: <Map className="w-3 h-3" />, label: fr ? 'Carte interactive' : 'Interactive map' },
              { icon: <Layers className="w-3 h-3" />, label: fr ? 'Désagrégation' : 'Disaggregation' },
              { icon: <Filter className="w-3 h-3" />, label: fr ? 'Filtres & Recherche' : 'Filters & Search' },
              { icon: <Users className="w-3 h-3" />, label: fr ? 'Couverture ASC' : 'CHW Coverage' },
              { icon: <Activity className="w-3 h-3" />, label: fr ? 'Ciblage du besoin en ASC' : 'Need Targeting' },
            ].map((chip) => (
              <span
                key={chip.label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[#334155] bg-[#f1f5f9] rounded-full px-3 py-1 border border-[#e2e8f0]"
              >
                {chip.icon}
                {chip.label}
              </span>
            ))}
          </div>

          <p className="text-xs text-[#64748b]">
            {fr
              ? `${TOUR_STEPS.length} étapes · environ 2 minutes · vous pouvez arrêter à tout moment`
              : `${TOUR_STEPS.length} steps · about 2 minutes · you can stop at any time`}
          </p>

          {/* CTA buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 bg-[#006948] hover:bg-[#005538] text-white text-sm font-semibold rounded-xl py-3 px-4 transition-colors shadow-lg shadow-[#006948]/25 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              {fr ? 'Oui, faites-moi visiter' : 'Yes, show me around'}
            </button>
            <button
              onClick={onSkip}
              className="flex items-center justify-center gap-2 text-[#64748b] hover:text-[#0f172a] text-sm font-medium rounded-xl py-3 px-4 border border-[#e2e8f0] hover:border-[#cbd5e1] transition-colors cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
              {fr ? 'Explorer seul' : 'Skip tour'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tour Step Card
───────────────────────────────────────────── */
interface StepCardProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  tooltipPos: TooltipPos;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function StepCard({
  step,
  stepIndex,
  totalSteps,
  language,
  onLanguageChange,
  tooltipPos,
  onNext,
  onPrev,
  onClose,
}: StepCardProps) {
  const fr = language === 'fr';
  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  return (
    <div
      className="fixed z-[10001] w-[340px] sm:w-[370px] bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] overflow-hidden"
      style={{ ...tooltipPos, position: 'fixed' } as React.CSSProperties}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: ACCENT }} />

      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          {step.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-0.5">
            {fr ? `Étape ${stepIndex + 1} sur ${totalSteps}` : `Step ${stepIndex + 1} of ${totalSteps}`}
          </p>
          <h3 className="text-sm font-bold text-[#0f172a] leading-snug">
            {fr ? step.titleFr : step.titleEn}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <LangToggle language={language} onLanguageChange={onLanguageChange} />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
            title={fr ? 'Quitter le tour' : 'Exit tour'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-4 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${((stepIndex + 1) / totalSteps) * 100}%`,
            backgroundColor: ACCENT,
          }}
        />
      </div>

      {/* Description */}
      <div className="px-4 py-3">
        <p className="text-xs text-[#475569] leading-relaxed whitespace-pre-line">
          {fr ? step.descFr : step.descEn}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 pb-4 gap-2">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
            isFirst
              ? 'opacity-30 cursor-not-allowed border-[#e2e8f0] text-[#94a3b8]'
              : 'border-[#e2e8f0] text-[#334155] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {fr ? 'Précédent' : 'Previous'}
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === stepIndex ? 16 : 6,
                height: 6,
                backgroundColor: i === stepIndex ? ACCENT : '#e2e8f0',
              }}
            />
          ))}
        </div>

        <button
          onClick={isLast ? onClose : onNext}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white transition-colors cursor-pointer shadow-sm"
          style={{ backgroundColor: ACCENT }}
        >
          {isLast ? (
            <>{fr ? 'Terminer' : 'Finish'}</>
          ) : (
            <>
              {fr ? 'Suivant' : 'Next'}
              <ChevronRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main GuidedTour component
───────────────────────────────────────────── */
interface GuidedTourProps {
  language: Language;
  onNavigate: (module: 'couverture-asc' | 'ciblage-asc') => void;
  onLanguageChange: (lang: Language) => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ language, onNavigate, onLanguageChange }) => {
  const [phase, setPhase] = useState<'welcome' | 'tour' | 'done'>(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    return completed ? 'done' : 'welcome';
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
  const animFrameRef = useRef<number | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  /* Resolve target element rect & compute tooltip position */
  const resolveStep = useCallback(
    (idx: number) => {
      const step = TOUR_STEPS[idx];

      // Fire side-effect action
      if (step.action?.type === 'navigate') {
        onNavigate(step.action.module);
      }

      // Wait a tick for DOM changes caused by navigation, then measure
      const measure = () => {
        if (step.target) {
          const el = document.querySelector(step.target);
          if (el) {
            // Scroll first (instant) so the element is in viewport before measuring
            el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'nearest' });
            requestAnimationFrame(() => {
              const rect = el.getBoundingClientRect();
              setTargetRect(rect);
              setTooltipPos(computeTooltipPos(rect, step.placement));
            });
            return;
          }
        }
        // No target → centre
        setTargetRect(null);
        setTooltipPos(computeTooltipPos(null, 'center'));
      };

      // Give React time to commit navigation changes
      setTimeout(measure, 350);

      // For the map step, trigger demo popup after map settles
      if (step.id === 'couverture-map') {
        setTimeout(() => {
          window.dispatchEvent(new Event('tour:show-demo-popup'));
        }, 800);
      }
    },
    [onNavigate]
  );

  /* Keep rect in sync on window resize */
  useEffect(() => {
    if (phase !== 'tour') return;

    const onResize = () => resolveStep(stepIndex);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [phase, stepIndex, resolveStep]);

  /* Kick off initial step resolution when tour starts */
  useEffect(() => {
    if (phase === 'tour') {
      resolveStep(stepIndex);
    }
  }, [phase, stepIndex, resolveStep]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setPhase('done');
  }, []);

  const handleNext = useCallback(() => {
    const nextIdx = stepIndex + 1;
    if (nextIdx >= TOUR_STEPS.length) {
      completeTour();
    } else {
      setStepIndex(nextIdx);
    }
  }, [stepIndex, completeTour]);

  const handlePrev = useCallback(() => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) {
      setStepIndex(prevIdx);
    }
  }, [stepIndex]);

  if (phase === 'done') return null;

  if (phase === 'welcome') {
    return (
      <WelcomeModal
        language={language}
        onLanguageChange={onLanguageChange}
        onStart={() => {
          setStepIndex(0);
          setPhase('tour');
        }}
        onSkip={completeTour}
      />
    );
  }

  /* ── Tour phase ── */
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark overlay with spotlight cut-out — pointer-events enabled so clicks on overlay are blocked */}
      <div className="absolute inset-0 pointer-events-auto" onClick={() => {}}>
        <SpotlightMask rect={targetRect} />
      </div>

      {/* Tooltip card — pointer-events enabled */}
      <div className="pointer-events-auto">
        <StepCard
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={TOUR_STEPS.length}
          language={language}
          onLanguageChange={onLanguageChange}
          tooltipPos={tooltipPos}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={completeTour}
        />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Helper: reset tour (for dev / "replay" button)
───────────────────────────────────────────── */
export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}
