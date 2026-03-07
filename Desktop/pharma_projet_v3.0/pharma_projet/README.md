# 💊 PharmaProjet — ERP Pharmaceutique Premium (Guinée)

**PharmaProjet** est une solution moderne de gestion de pharmacie "Offline-First", conçue spécifiquement pour répondre aux besoins des officines en Guinée. Elle combine simplicité d'utilisation, esthétique premium et fonctionnalités robustes pour sécuriser la dispense de médicaments et optimiser la gestion des stocks.

## 🚀 Caractéristiques Principales

- **Offline-First** : Continuez à travailler sans interruption, même en cas de coupure internet. Les données sont stockées localement (IndexedDB) et synchronisées automatiquement dès que la connexion revient.
- **Synchronisation Cloud (Supabase)** : Sauvegardez vos données en toute sécurité sur le cloud et accédez-y depuis plusieurs postes.
- **Interface Premium** : Un design moderne, épuré et réactif (mode sombre/clair) inspiré des meilleurs standards médicaux.
- **PWA (Progressive Web App)** : Installable sur ordinateur et mobile comme une application native.

## 📦 Modules et Fonctionnalités

### 📊 Tableau de Bord (Dashboard)
- Vue d'ensemble en temps réel du chiffre d'affaires et des bénéfices.
- Graphiques analytiques (ventes, bénéfices, top produits).
- Indicateurs clés (ventes du jour, alertes stock, péremptions).

### 🛒 Point de Vente (POS)
- Terminal de vente intuitif avec recherche rapide.
- **Paiements Mobiles** : Intégration simulée d'Orange Money et MTN MoMo avec envoi de reçu par SMS.
- **Gestion des Ordonnances** : Liaison automatique des ventes aux ordonnances pour une traçabilité totale.
- **Impression de Reçus** : Génération de tickets de caisse thermiques et de factures A4 professionnelles.

### 💊 Catalogue Médicaments & Stocks
- Gestion complète des fiches produits (DCI, Marque, Dosage, Catégorie).
- **Gestion par Lots** : Suivi précis des dates de péremption et des numéros de lots.
- Alertes automatiques de stock bas et de péremption imminente.
- Historique complet des mouvements de stock (Entrées/Sorties).

### 📄 Ordonnances & Patients
- Dossiers patients complets (allergies, historique de ventes).
- Gestion des prescriptions médicales avec statut de dispense.
- Liaison patient → ordonnance → vente.

### 💵 Caisse & Finance
- Suivi de la caisse journalière (entrées/sorties).
- Historique détaillé des ventes avec filtres avancés.
- Rapports de bénéfices et marges par produit/catégorie.

### ⚙️ Paramètres & Administration
- Personnalisation de la pharmacie (Nom, Adresse, Téléphone, Logo).
- Gestion des utilisateurs avec rôles sécurisés (Admin, Pharmacien, Caissier).
- Journal d'audit complet (traçabilité de toutes les actions sensibles).

## 🛠 Installation et Configuration

### Prérequis
- Un navigateur moderne (Chrome, Edge ou Safari recommandé).
- Serveur local (optionnel, ex: Live Server sous VS Code).

### Configuration Supabase (Synchronisation Cloud)
1. Créez un projet sur [Supabase](https://supabase.com).
2. Exécutez le script SQL fourni (`supabase_schema.sql`) dans l'éditeur SQL de votre projet Supabase.
3. Dans PharmaProjet, allez dans **Paramètres** → **Synchronisation & Sauvegarde**.
4. Renseignez votre **URL Supabase** et votre **Clé Anon**.
5. Cliquez sur "Enregistrer la config Cloud". L'application se synchronisera automatiquement 5 secondes après chaque modification.

## 🛡️ Sécurité et Conformité
- Conforme aux exigences de la **DNPM** (Guinée) pour la traçabilité des médicaments.
- Journal d'audit inaltérable pour prévenir les fraudes.
- Sauvegardes locales (JSON) et Cloud automatiques.

---
*PharmaProjet — La technologie au service de la santé en Guinée.*

## 📞 Support & Développement
Développé par **TrillionX**
- **Téléphone** : +224 627 17 13 97
- **Email** : trillionnx@gmail.com
- **Web** : www.trillionx.gn (Bientôt disponible)
