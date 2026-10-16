/**
 * Fichier de configuration unique pour le module "Couverture en ASC".
 * Permet le passage aux données réelles sans aucune modification de code.
 */

import { SubdivisionLevel } from '../types';

export interface NormativeClassDef {
  id: string;
  label: string;
  labelEn: string;
  shortLabel: string;
  shortLabelEn: string;
  color: string;
}

export interface AscCategoryDef {
  field: string;
  label: string;
  labelEn: string;
  shortLabel: string;
  shortLabelEn: string;
  description: string;
  color: string;
}

export const COVERAGE_CONFIG = {
  // Bandeau d'alerte sur données factices (activable / désactivable ici)
  SHOW_MOCK_BANNER: false,
  MOCK_BANNER_TEXT: "DONNÉES FACTICES : ne pas diffuser",

  // Paramètre d'activation du niveau arrondissement (Instruction 7 : désactivé par défaut)
  ENABLE_ARRONDISSEMENTS: false,

  // Noms uniques des champs dans les GeoJSON (aucun doublon ni variante)
  FIELDS: {
    // Effectifs actifs
    EFF_TOT_A: 'EFF_TOT_A',
    EFF_ASCP_A: 'EFF_ASCP_A',
    EFF_ACC_A: 'EFF_ACC_A',
    EFF_APS_A: 'EFF_APS_A',
    EFF_PE_A: 'EFF_PE_A',
    EFF_MM_A: 'EFF_MM_A',
    EFF_RC_A: 'EFF_RC_A',

    // Inactifs
    EFF_TOT_I: 'EFF_TOT_I',
    PCT_INACT: 'PCT_INACT',

    // Couverture
    RATIO_ASCP: 'RATIO_ASCP',
    RATIO_TOT: 'RATIO_TOT',
    CLASSE_CVG: 'CLASSE_CVG',

    // Population (Instruction 4 : popTotal sur aires de santé, POP_TOT sur les 4 couches supérieures)
    POP_TOT_UPPER: 'POP_TOT',
    POP_TOTAL_AIRES: 'popTotal',

    // Nombre d'aires agrégées
    NB_AIRES: 'NB_AIRES',
  },

  // Champs officiels contenant les noms d'entités par niveau
  NAME_FIELDS: {
    regions: 'NAME_1',
    departements: 'NAME_2',
    arrondissements: 'NAME_3',
    districts_sante: 'District_S',
    aires_sante: 'Nom_AS',
  } as Record<SubdivisionLevel, string>,

  // Fichiers GeoJSON associés aux niveaux de découpage
  GEOJSON_FILES: {
    regions: '/data/regions_5km.geojson',
    departements: '/data/departements_5km.geojson',
    arrondissements: '/data/arrondissements_5km.geojson',
    districts_sante: '/data/districts_sante_5km.geojson',
    aires_sante: '/data/aires_sante_5km.geojson',
  } as Record<SubdivisionLevel, string>,

  // Catégories d'effectifs actifs pour la Carte 1
  ASC_CATEGORIES: [
    {
      field: 'EFF_TOT_A',
      label: 'Tous les ASC actifs',
      labelEn: 'All active CHWs',
      shortLabel: 'Total actifs',
      shortLabelEn: 'Total active',
      description: 'Ensemble des acteurs de santé communautaire actifs',
      color: '#0284c7',
    },
    {
      field: 'EFF_ASCP_A',
      label: 'ASC polyvalents (ASCp)',
      labelEn: 'Versatile CHWs (ASCp)',
      shortLabel: 'ASCp',
      shortLabelEn: 'ASCp',
      description: 'Agents de Santé Communautaire Polyvalents',
      color: '#006948',
    },
    {
      field: 'EFF_ACC_A',
      label: 'Agents de Communication et Relais (ACCRA)',
      labelEn: 'Community Communication & Relay Agents (ACCRA)',
      shortLabel: 'ACCRA',
      shortLabelEn: 'ACCRA',
      description: 'Agents de communication communautaire et relais associés',
      color: '#8b5cf6',
    },
    {
      field: 'EFF_APS_A',
      label: 'Agents Polyvalents de Santé (APS)',
      labelEn: 'Versatile Health Agents (APS)',
      shortLabel: 'APS',
      shortLabelEn: 'APS',
      description: 'Agents de promotion et prévention de santé',
      color: '#0d9488',
    },
    {
      field: 'EFF_PE_A',
      label: 'Pairs Éducateurs (PE)',
      labelEn: 'Peer Educators (PE)',
      shortLabel: 'Pairs éducateurs',
      shortLabelEn: 'Peer educators',
      description: 'Sensibilisation ciblée par les pairs',
      color: '#f59e0b',
    },
    {
      field: 'EFF_MM_A',
      label: 'Mères Mentors (MM)',
      labelEn: 'Mentor Mothers (MM)',
      shortLabel: 'Mères mentors',
      shortLabelEn: 'Mentor mothers',
      description: 'Santé maternelle et infantile',
      color: '#ec4899',
    },
    {
      field: 'EFF_RC_A',
      label: 'Relais Communautaires (RC)',
      labelEn: 'Community Relays (RC)',
      shortLabel: 'Relais communautaires',
      shortLabelEn: 'Community relays',
      description: 'Mobilisation et orientation communautaire',
      color: '#64748b',
    },
  ] as AscCategoryDef[],

  // Classes normatives de couverture en ASCp (Carte 2a) - Palettes daltonien-compatibles
  NORMATIVE_CLASSES: {
    couverte: {
      id: 'couverte',
      label: '1 ASCp pour ≤ 1 000 habitants : conforme',
      labelEn: '1 CHWp per ≤ 1,000 inhabitants: compliant',
      shortLabel: 'Conforme (1 ASCp / ≤ 1 000 hab.)',
      shortLabelEn: 'Compliant (1 CHWp / ≤ 1,000 pop.)',
      color: '#16a34a',
    },
    couverte_si_urbain: {
      id: 'couverte_si_urbain',
      label: '1 ASCp pour 1 000 à 2 499 habitants : conforme en milieu urbain uniquement',
      labelEn: '1 CHWp per 1,000–2,499 inhabitants: compliant in urban areas only',
      shortLabel: 'Conforme si urbain (1 ASCp / 1 000 - 2 499 hab.)',
      shortLabelEn: 'Compliant if urban (1 CHWp / 1,000–2,499 pop.)',
      color: '#ea580c',
    },
    sous_couverte: {
      id: 'sous_couverte',
      label: '1 ASCp pour ≥ 2 500 habitants : sous-couverte',
      labelEn: '1 CHWp per ≥ 2,500 inhabitants: under-covered',
      shortLabel: 'Sous-couverte (1 ASCp / ≥ 2 500 hab.)',
      shortLabelEn: 'Under-covered (1 CHWp / ≥ 2,500 pop.)',
      color: '#dc2626',
    },
    aucun_ascp_actif: {
      id: 'aucun_ascp_actif',
      label: 'Aucun ASCp actif',
      labelEn: 'No active CHWp',
      shortLabel: 'Aucun ASCp actif',
      shortLabelEn: 'No active CHWp',
      color: '#7f1d1d',
    },
    pop_manquante: {
      id: 'pop_manquante',
      label: 'Population non disponible',
      labelEn: 'Population not available',
      shortLabel: 'Population non disponible',
      shortLabelEn: 'Population not available',
      color: '#94a3b8',
    },
  } as Record<string, NormativeClassDef>,

  // Style des zones sans données (règle commune : gris hachuré)
  NO_DATA_STYLE: {
    color: '#94a3b8',
    fillColor: '#f1f5f9',
    fillOpacity: 0.85,
    weight: 1.5,
    dashArray: '3, 4',
    label: 'Découpage en aires de santé non disponible',
    labelEn: 'Health area boundary not available',
  },

  // Paramètre d'effectif minimum pour le calcul fiable du pourcentage d'inactifs (Carte 3b)
  MIN_TOTAL_ASC_FOR_PCT: 5,

  // Palette séquentielle pour la Carte 2b (RATIO_TOT : 5 quantiles, clair = peu d'hab/ASC, foncé = beaucoup)
  RATIO_TOT_PALETTE: [
    '#eff6ff', // Q1 (0-20%) : très clair
    '#bfdbfe', // Q2 (20-40%) : bleu clair
    '#60a5fa', // Q3 (40-60%) : bleu moyen
    '#2563eb', // Q4 (60-80%) : bleu soutenu
    '#1e3a8a', // Q5 (80-100%) : bleu très foncé
  ],

  // Couleur distinctive pour les symboles proportionnels des ASC inactifs (Carte 3a)
  INACTIVE_CIRCLES_COLOR: '#c2410c', // Terracotta / orange brûlé distinct

  // Seuils fixes pour la Carte 3b (% d'inactifs)
  PCT_INACT_CLASSES: [
    { id: 'p1', min: 0, max: 10, label: 'Moins de 10 %', labelEn: 'Less than 10%', color: '#fef3c7' },
    { id: 'p2', min: 10, max: 20, label: '10 à 19 %', labelEn: '10–19%', color: '#fcd34d' },
    { id: 'p3', min: 20, max: 30, label: '20 à 29 %', labelEn: '20–29%', color: '#fb923c' },
    { id: 'p4', min: 30, max: 50, label: '30 à 49 %', labelEn: '30–49%', color: '#ea580c' },
    { id: 'p5', min: 50, max: 100, label: '50 % et plus', labelEn: '50% and over', color: '#b91c1c' },
  ],

  // Style des entités avec effectif trop faible (< 5 ASC au total)
  LOW_ASC_STYLE: {
    label: 'Effectif trop faible pour un pourcentage fiable',
    labelEn: 'Too few CHWs for a reliable percentage',
    note: 'Moins de 5 ASC au total (actifs + inactifs)',
    noteEn: 'Fewer than 5 CHWs total (active + inactive)',
  },

  // Mentions et sources cartographiques
  SOURCES: {
    MAP_SOURCE: 'Population : WorldPop. Effectifs ASC : cartographie et profilage des ASC, MINSANTE.',
    MAP_SOURCE_EN: 'Population: WorldPop. CHW workforce: CHW mapping & profiling, MINSANTE.',
    NORMATIVE_NOTE: 'Norme nationale : 1 ASCp pour 1 000 habitants en milieu rural, 1 pour 2 500 en milieu urbain.',
    NORMATIVE_NOTE_EN: 'National standard: 1 CHWp per 1,000 inhabitants (rural), 1 per 2,500 (urban).',
    RATIO_TOT_NOTE: "Pas de norme officielle pour l'ensemble des catégories ; classes relatives.",
    RATIO_TOT_NOTE_EN: 'No official standard for all categories combined; relative classes.',
    INACTIVE_TITLE: 'ASC inactifs à remplacer',
    INACTIVE_TITLE_EN: 'Inactive CHWs to replace',
  },

  // Liste ordonnée canonique des 10 régions du Cameroun
  REGIONS_LIST: [
    'Adamaoua',
    'Centre',
    'Est',
    'Extrême-Nord',
    'Littoral',
    'Nord',
    'Nord-Ouest',
    'Ouest',
    'Sud',
    'Sud-Ouest',
  ],
};

/**
 * Normalisation canonique des noms de régions (gère le bilinguisme EN/FR et les accents)
 */
export const REGION_CANONICAL_MAP: Record<string, string> = {
  'adamaoua': 'Adamaoua',
  'centre': 'Centre',
  'est': 'Est',
  'extreme nord': 'Extrême-Nord',
  'extreme-nord': 'Extrême-Nord',
  'extrême nord': 'Extrême-Nord',
  'extrême-nord': 'Extrême-Nord',
  'littoral': 'Littoral',
  'nord': 'Nord',
  'north west': 'Nord-Ouest',
  'north-west': 'Nord-Ouest',
  'nord ouest': 'Nord-Ouest',
  'nord-ouest': 'Nord-Ouest',
  'ouest': 'Ouest',
  'south west': 'Sud-Ouest',
  'south-west': 'Sud-Ouest',
  'sud ouest': 'Sud-Ouest',
  'sud-ouest': 'Sud-Ouest',
  'sud': 'Sud',
};

export function getCanonicalRegionName(raw: string | undefined | null): string {
  if (!raw) return '';
  const clean = raw.trim().toLowerCase();
  return REGION_CANONICAL_MAP[clean] || raw.trim();
}

export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Fonction d'extraction sécurisée de la population selon la règle (Instruction 4) :
 * - popTotal sur les aires de santé
 * - POP_TOT sur les 4 couches supérieures (régions, départements, arrondissements, districts)
 * Jamais de fallback entre les deux !
 */
export function getPopulationForLevel(level: SubdivisionLevel, properties: any): number | null {
  if (!properties) return null;
  if (level === 'aires_sante') {
    const val = properties[COVERAGE_CONFIG.FIELDS.POP_TOTAL_AIRES];
    return typeof val === 'number' && !isNaN(val) ? val : null;
  } else {
    const val = properties[COVERAGE_CONFIG.FIELDS.POP_TOT_UPPER];
    return typeof val === 'number' && !isNaN(val) ? val : null;
  }
}

/**
 * Extraction rigoureuse du nom officiel de l'entité selon le niveau administratif / sanitaire :
 * - Régions : NAME_1
 * - Départements : NAME_2
 * - Arrondissements : NAME_3
 * - Districts de santé : District_S
 * - Aires de santé : Nom_AS
 */
export function getFeatureNameForLevel(level: SubdivisionLevel, properties: any): string {
  if (!properties) return '';
  const officialField = COVERAGE_CONFIG.NAME_FIELDS[level];
  if (officialField && properties[officialField]) {
    return String(properties[officialField]).trim();
  }
  return properties.Nom_AS || properties.District_S || properties.NAME_3 || properties.NAME_2 || properties.NAME_1 || properties.name || 'Zone';
}

export interface TerritorialFilter {
  type: 'dept' | 'district';
  name: string;
  region?: string;
  dept?: string;
}

/**
 * Vérifie si une entité GeoJSON correspond aux filtres territoriaux actifs (Région, Département, District).
 */
export function isFeatureInTerritorialFilter(
  feature: any,
  selectedRegion: string | null,
  selectedSubdivision: TerritorialFilter | null,
  level: SubdivisionLevel
): boolean {
  const p = feature.properties || {};

  // 1. Filtre spécifique par Département ou District (le plus fin)
  if (selectedSubdivision) {
    const targetNorm = normalizeString(selectedSubdivision.name);

    if (selectedSubdivision.type === 'district') {
      if (level === 'aires_sante') {
        return normalizeString(p.District_S || p.district) === targetNorm;
      }
      if (level === 'districts_sante') {
        return normalizeString(p.District_S || p.name) === targetNorm;
      }
      if (level === 'departements' || level === 'arrondissements') {
        const targetDept = selectedSubdivision.dept ? normalizeString(selectedSubdivision.dept) : '';
        if (targetDept) {
          return normalizeString(p.NAME_2 || p.dept || p.name) === targetDept;
        }
        return true;
      }
      if (level === 'regions') {
        if (selectedSubdivision.region) {
          return getCanonicalRegionName(p.NAME_1 || p.name) === getCanonicalRegionName(selectedSubdivision.region);
        }
        return true;
      }
    } else if (selectedSubdivision.type === 'dept') {
      if (level === 'departements') {
        return normalizeString(p.NAME_2 || p.name) === targetNorm;
      }
      if (level === 'arrondissements') {
        return normalizeString(p.NAME_2 || p.dept) === targetNorm;
      }
      if (level === 'districts_sante' || level === 'aires_sante') {
        return normalizeString(p.Nom_Dept || p.dept || p.NAME_2) === targetNorm;
      }
      if (level === 'regions') {
        if (selectedSubdivision.region) {
          return getCanonicalRegionName(p.NAME_1 || p.name) === getCanonicalRegionName(selectedSubdivision.region);
        }
        return true;
      }
    }
  }

  // 2. Filtre général par Région
  if (selectedRegion) {
    const canSelectedReg = getCanonicalRegionName(selectedRegion);
    const reg = getCanonicalRegionName(
      level === 'regions' ? (p.name || p.NAME_1) : (p.region || p.Nom_Region || p.NAME_1)
    );
    return reg === canSelectedReg;
  }

  // 3. Aucun filtre : tout le territoire national
  return true;
}



