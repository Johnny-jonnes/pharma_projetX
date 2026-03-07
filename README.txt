PHARMAPROJET — ERP PHARMACEUTIQUE PREMIUM (GUINEE)
================================================

PharmaProjet est une solution moderne de gestion de pharmacie "Offline-First", conçue spécifiquement pour répondre aux besoins des officines en Guinée. Elle combine simplicité d'utilisation, esthétique premium et fonctionnalités robustes pour sécuriser la dispense de médicaments et optimiser la gestion des stocks.

DESIGN & IDENTITÉ VISUELLE
--------------------------

L'application arbore une esthétique "Neo-Professional Medical" caractérisée par :
- Palette Chromatique : Utilisation de bleus profonds (#1B6FAE) pour la confiance, de verts menthe (#2EAF7D) pour la santé, et d'accents orangés (#E8913A) pour les actions critiques.
- Typographie : "Inter" pour une lisibilité maximale des données médicales et "JetBrains Mono" pour les codes produits et chiffres techniques.
- Interface "Glassmorphism" : Effets de transparence subtils et flous d'arrière-plan pour une sensation de profondeur et de modernité.
- Micro-interactions : Animations fluides (transitions 0.2s) et feedbacks visuels immédiats lors des actions utilisateur.

CARACTERISTIQUES PRINCIPALES
---------------------------

- Offline-First : Travail continu sans interruption via IndexedDB, avec synchronisation automatique vers le Cloud.
- Synchronisation Cloud (Supabase) : Sauvegarde sécurisée et accès multi-postes.
- Interface Premium : Design adaptatif (Responsive) avec barre latérale persistante et topbar intuitive.
- PWA (Progressive Web App) : Installation native sur Windows, macOS, Android et iOS.

MODULES ET FONCTIONNALITÉS — DETAILS DU DESIGN
----------------------------------------------

1. TABLEAU DE BORD (DASHBOARD)
- Design : Cartes KPI avec bordures colorées sémantiques (Bleu/Info, Vert/Succès, Rouge/Danger).
- Visualisation : Graphiques Donuts side-by-side et courbes de ventes épurées pour une analyse rapide du chiffre d'affaires.
- Alertes : Badges pulsants pour les ruptures de stock et les péremptions imminentes.

2. POINT DE VENTE (POS)
- Design : Interface en colonnes optimisée pour minimiser les clics. Panneau de panier scrollable indépendamment.
- Ergonomie : Autocomplétion intelligente des patients et produits avec prévisualisation des stocks.
- Feedback : Modales premium pour le choix du mode de paiement (Orange Money, MTN MoMo, Espèces).

3. CATALOGUE MÉDICAMENTS & STOCKS
- Design : Tableaux à haute densité d'information avec lignes alternées (Zebra-striping) pour une lecture reposante.
- Visuel : Étiquettes de statut colorées pour les types de produits (DCI, Marque).
- Tracabilité : Timeline visuelle des mouvements de stock (Entrées/Sorties).

4. ORDONNANCES & PATIENTS
- Design : Fiches patients structurées avec historique chronologique des achats.
- Focus : Mise en évidence visuelle des allergies et des prescriptions en attente de dispense.
- Liaison : Indicateurs visuels reliant une vente à son ordonnance source.

5. CAISSE & FINANCE
- Design : Rapports financiers avec typographie tabulaire (monospaced) pour un alignement parfait des montants.
- Analyse : Segrégration visuelle claire des revenus, bénéfices et marges par code couleur.

6. PARAMÈTRES & ADMINISTRATION
- Design : Layout centré et épuré. Gestion du logo avec prévisualisation en temps réel.
- Sécurité : Badges de rôles (Admin/Pharmacien) et journal d'audit présenté sous forme de log technique lisible.

INSTALLATION ET CONFIGURATION
-----------------------------

PREREQUIS :
- Navigateur moderne (Chrome, Edge recommandé).
- Serveur local (optionnel).

CONFIGURATION SUPABASE :
1. Créez un projet sur Supabase.
2. Exécutez le script SQL (supabase_schema.sql).
3. PharmaProjet -> Paramètres -> Synchronisation.
4. Renseignez l'URL et la Clé Anon.
5. L'application se synchronise automatiquement.

SÉCURITÉ ET CONFORMITÉ
----------------------
- Conforme aux exigences de la DNPM (Guinée).
- Journal d'audit inaltérable.
- Sauvegardes hybrides (Locales + Cloud).

---
PharmaProjet — La technologie au service de la santé en Guinée.
