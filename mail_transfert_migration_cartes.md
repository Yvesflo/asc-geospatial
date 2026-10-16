# Objet : Migration des cartes vers une source de données dynamique

Bonjour,

Je vous transmet ci-joint la documentation technique du module cartographique ainsi que le code associé.

Le but est de migrer l’alimentation des cartes depuis des fichiers statiques vers une source de données dynamique côté serveur, sans modifier la logique actuelle de rendu et de symbologie.

## Contexte

Le module cartographique actuel est alimenté par des fichiers GeoJSON présents dans le dossier public/data. Ces fichiers sont chargés côté front dans le composant principal de la carte.

Les éléments de référence sont :
- src/config/coverageConfig.ts
- src/components/CouvertureAscMap.tsx
- public/data/

## Données attendues par le front

Les GeoJSON doivent contenir les propriétés suivantes :

### Population
- POP_TOT
- popTotal

### Effectifs actifs
- EFF_TOT_A
- EFF_ASCP_A
- EFF_ACC_A
- EFF_APS_A
- EFF_PE_A
- EFF_MM_A
- EFF_RC_A

### Effectifs inactifs
- EFF_TOT_I
- PCT_INACT

### Couverture
- RATIO_ASCP
- RATIO_TOT
- CLASSE_CVG

### Noms / hiérarchie
- NAME_1
- NAME_2
- NAME_3
- District_S
- Nom_AS

Le mapping exact des cartes est le suivant :
- Carte 1 : selectedCategoryField
- Carte 2a : CLASSE_CVG
- Carte 2b : RATIO_TOT
- Carte 3a : EFF_TOT_I
- Carte 3b : PCT_INACT

Le point important est que le front n’attend pas un CSV unique, mais des GeoJSON structurés avec des propriétés cohérentes.

## Objectif de migration

Le backend devra fournir les mêmes données au même format afin de permettre :
- la mise à jour des informations depuis le serveur,
- la mise à jour automatique des cartes,
- la conservation du comportement fonctionnel actuel.

Le backend peut exposer :
- un endpoint par niveau territorial,
- ou un endpoint unique avec paramètre level.

Exemples :
- /api/coverage?level=regions
- /api/coverage?level=departements
- /api/coverage?level=districts_sante
- /api/coverage?level=aires_sante

Le contrat de données doit rester compatible avec le front existant.

Le point d’intégration clé est :
- src/config/coverageConfig.ts
- src/components/CouvertureAscMap.tsx

Ces éléments doivent rester le point de contact entre le front et la donnée, sans recoder la logique du rendu.

Merci de regarder cette documentation avant de proposer l’architecture backend de données.

Cordialement,

[Votre nom]
