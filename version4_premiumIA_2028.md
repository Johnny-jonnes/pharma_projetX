# PharmaProjet V4.0 — Premium IA (Édition 2028)
**Vision Stratégique et Guide de Développement Technique**

Ce document détaille l'architecture et la feuille de route des trois modules "Premium" destinés à propulser PharmaProjet d'un logiciel de pharmacie individuel vers un ERP multi-réseaux intelligent, prévu pour l'horizon 2028.

---

## 1. Module d'Intelligence Artificielle : Prévision de la Demande 

### Description Détaillée
L'algorithme de prévision analyse les données historiques de vente croisées avec les facteurs saisonniers pour anticiper les besoins en stock.
L'objectif n'est plus seulement de réagir à des "seuils d'alerte métier" (stock minimum atteint), mais de *prévenir* l'utilisateur qu'une maladie ou une saison spécifique arrive, créant ainsi des recommandations de commandes automatiques.

### Guide de Développement

> [!TIP]
> **Approche technique recommandée : Machine Learning Temporel**

1. **Préparation des Modèles (Data Engineering)** :
   - Extrapoler les bases de ventes historiques.
   - Injecter les variables "Date/Mois" et "Catégories de médicaments" (ex: antipaludiques, antitussifs, antiallergiques).
2. **Le Modèle Autoregressif (ARIMA ou Prophet)** :
   - Coder l'intégration d'une librairie JS d'analyse temporelle (ex. Tensorflow.js) pour que l'IA puisse tourner côté client sans fuite de données de santé (parfaite confidentialité).
3. **UI/UX (Dashboard)** :
   - Créer un onglet **"IA & Recommandations"**.
   - Afficher un tableau prédictif : *"Dans 15 jours, la demande pour le paracétamol augmentera de 40% (Taux de confiance: 88%)"*.
   - Ajouter un bouton : **"Générer un bon de commande automatisé"**.


---

## 2. API REST : Ouverture & Interopérabilité

### Description Détaillée
Afin que PharmaProjet ne reste pas en circuit fermé, l'outil déploiera une API HTTPS sécurisée. Cela permet de connecter du matériel physique externe ou des logiciels professionnels :
- **Intégration Comptable** (Quickbooks, Sage) pour l'export automatique des bilans financiers.
- **Intégration Outils Externes** : Communication avec un site web de réservation de médicaments pour le click-and-collect.
- **Applications Mobiles** (Application patient pour vérifier la disponibilité de son traitement).

### Guide de Développement

> [!IMPORTANT]
> **Architecture de Sécurité**

1. **Architecture Serveur Backend (Node.js/Supabase)** :
   - Créer un fichier de routes sécurisé (`routes/api.js`).
   - Mettre en place les Endpoints principaux :
     - `GET /api/v1/stock` (Pour les requêtes clients/app externe)
     - `POST /api/v1/sales-export` (Pour Sage/Comptabilité)
2. **Mécanisme d'Authentification (OAuth 2.0 / JWT)** :
   - Ne jamais exposer de données de santé (RGPD local/loi sur la santé).
   - Offrir un module *"Développeurs & API"* dans l'ERP où le propriétaire de la pharmacie génère et révoque des **Clés API** (`API_KEY`).
3. **Throttling (Limitation)** :
   - Limiter les appels à 100 requêtes/minute par clé pour garantir que PharmaProjet ne subisse aucun ralentissement local.


---

## 3. Architecture Multi-sites (Réseau de Pharmacies)

### Description Détaillée
Un dirigeant possédant 3 pharmacies avec PharmaProjet pourra tout gérer en un espace unique. Les stocks de chaque pharmacie seront connectés pour permettre des transferts inter-sites.
- Vue "Consolidée" (chiffre d'affaires total du réseau).
- Vue "Par Succursale" (performance clinique individuelle).

### Guide de Développement

> [!WARNING]
> **Refonte de la Base de Données Requise**

1. **Refonte Modèle de Données (IndexedDB / Supabase)** :
   - Dans toutes les tables existantes (`lots`, `movements`, `sales`, `users`, `prescriptions`), ajouter une colonne matricielle : `site_id` ou `branch_id`.
   - Créer une nouvelle table `branches` (Agences/Pharmacies).
2. **Le Super-Administrateur (RBAC Étendu)** :
   - Ajouter un nouveau rôle : `super-admin`. 
   - Le pharmacien d'une succursale n'a accès qu'au `site_id` local.
   - Le `super-admin` possède un filtre déroulant persistant en haut (Navbar) pour changer dynamiquement de site ou afficher le réseau en "Vue Globale".
3. **Module de Transbordement (Transferts Intersites)** :
   - Créer une mécanique de transbordement (Bons de Transfert) qui procède à la décrémentation sur la Pharmacie A, et passe en "Statut: Transit".
   - Quand la Pharmacie B clique sur "Réceptionner le transfert", la quantité est incrémentée chez B. (Utiliser les *Transactions SQL/IndexedDB* pour prévenir toute perte de stock).

---
*Ce document sert de spécifications techniques pour le passage futur en V4.0. Le code actuel de la V3.0 est structuré de façon à recevoir facilement cette évolution sans nécessiter de réécrire les bases d'application.*
