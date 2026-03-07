# 📦 Guide de Déploiement Complet — PharmaProjet v3.0

> Guide d'installation étape par étape pour déployer PharmaProjet dans une pharmacie.
> **100% gratuit** — aucun abonnement requis.

---

## Table des matières

1. [Vue d'ensemble](#1--vue-densemble)
2. [Pré-requis](#2--pré-requis)
3. [Fichiers nécessaires](#3--fichiers-nécessaires)
4. [Installation sur le PC de la pharmacie](#4--installation-sur-le-pc-de-la-pharmacie)
5. [Configuration de Supabase (Cloud gratuit)](#5--configuration-de-supabase-cloud-gratuit)
6. [Premier démarrage & Onboarding](#6--premier-démarrage--onboarding)
7. [Installation multi-postes (PWA)](#7--installation-multi-postes-pwa)
8. [Sauvegarde & Restauration](#8--sauvegarde--restauration)
9. [Mise à jour de PharmaProjet](#9--mise-à-jour-de-pharmaprojet)
10. [FAQ & Troubleshooting](#10--faq--troubleshooting)
11. [Checklist d'installation](#11--checklist-dinstallation)

---

## 1. 🏗 Vue d'ensemble

### Comment ça fonctionne ?

PharmaProjet est une **application web offline-first** :

- **Fonctionne SANS Internet** — toutes les données sont stockées localement (IndexedDB)
- **Synchronise automatiquement** quand Internet est disponible (via Supabase)
- **Installable comme une app native** (PWA) sur PC, tablette ou smartphone
- **Chaque pharmacie est 100% indépendante** — ses données ne sont JAMAIS accessibles par une autre

```
┌──────────────────────────────────────┐
│         PC de la Pharmacie           │
│  ┌──────────────────────────────┐    │
│  │  Navigateur (Chrome/Edge)    │    │
│  │  ┌────────────────────────┐  │    │
│  │  │   PharmaProjet v3.0    │  │    │────── Internet ────── Supabase (Cloud)
│  │  │   IndexedDB (local)    │  │    │                       (synchronisation)
│  │  └────────────────────────┘  │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
     ↑ Fonctionne même SANS Internet
```

---

## 2. ✅ Pré-requis

### Matériel minimum

| Élément | Minimum requis |
|---------|---------------|
| **PC** | Windows 7+, macOS 10.12+, ou Linux avec interface graphique |
| **RAM** | 2 Go minimum (4 Go recommandé) |
| **Stockage** | 200 Mo d'espace libre |
| **Écran** | 1024×768 minimum (1366×768 recommandé) |
| **Navigateur** | Google Chrome 80+, Microsoft Edge 80+, ou Firefox 80+ |
| **Internet** | Requis uniquement pour la configuration initiale de Supabase et la synchronisation |

### Ce que vous devez avoir avant de commencer

1. ✅ Le dossier `pharma_projet/` (fourni avec ce guide)
2. ✅ Un compte email pour créer un compte Supabase gratuit
3. ✅ Environ 30 minutes de temps d'installation

---

## 3. 📂 Fichiers nécessaires

Seul le dossier **`pharma_projet/`** est nécessaire pour faire tourner l'application. Voici sa structure :

```
pharma_projet/
├── index.html          ← Page principale (point d'entrée)
├── manifest.json       ← Configuration PWA  
├── sw.js               ← Service Worker (mode hors-ligne)
├── css/
│   └── main.css        ← Styles de l'application
└── js/
    ├── db.js           ← Moteur de base de données
    ├── auth.js         ← Authentification & routeur
    ├── ui.js           ← Utilitaires d'interface
    ├── mobile-money.js ← Paiements mobiles
    ├── pages/          ← 16 modules de pages
    │   ├── dashboard.js
    │   ├── pos.js
    │   ├── stock.js
    │   ├── products.js
    │   ├── sales.js
    │   ├── returns.js
    │   ├── settings.js
    │   ├── prescriptions.js
    │   ├── suppliers.js
    │   ├── patients.js
    │   ├── caisse.js
    │   ├── traceability.js
    │   ├── alerts-engine.js
    │   ├── print.js
    │   ├── onboarding.js
    │   └── metrics.js
    ├── ui/
    │   ├── command-palette.js
    │   └── feedback.js
    └── vendor/
        ├── supabase.min.js
        └── lucide.min.js
```

> ⚠️ **Important** : Ne modifiez aucun fichier. Copiez le dossier tel quel.

---

## 4. 💻 Installation sur le PC de la pharmacie

### Méthode A : Double-clic (la plus simple)

1. **Copiez** le dossier `pharma_projet/` sur le Bureau du PC (ou n'importe quel dossier)
2. **Ouvrez** le dossier `pharma_projet/`
3. **Double-cliquez** sur le fichier `index.html`
4. L'application s'ouvre dans votre navigateur par défaut

> ℹ️ Avec cette méthode, l'application fonctionne **immédiatement** en mode local. Le Service Worker (mode hors-ligne après installation PWA) peut ne pas fonctionner avec le protocole `file://`. Pour une installation complète, utilisez la méthode B.

### Méthode B : Serveur local (recommandée pour la PWA)

Cette méthode permet d'**installer l'application comme une app native** sur le PC.

#### Option 1 : Avec VS Code (si installé)

1. Ouvrez le dossier `pharma_projet/` dans VS Code
2. Installez l'extension **"Live Server"** (de Ritwick Dey)
3. Clic droit sur `index.html` → **"Open with Live Server"**
4. L'application s'ouvre à l'adresse `http://127.0.0.1:5500`

#### Option 2 : Avec Python (pré-installé sur la plupart des systèmes)

```bash
# Ouvrez un terminal dans le dossier pharma_projet/
cd chemin/vers/pharma_projet

# Python 3
python -m http.server 8080

# Ou Python 2
python -m SimpleHTTPServer 8080
```

Ouvrez ensuite : `http://localhost:8080`

#### Option 3 : Avec Node.js

```bash
# Installer le serveur (une seule fois)
npm install -g http-server

# Lancer
cd chemin/vers/pharma_projet
http-server -p 8080

# Ouvrir http://localhost:8080
```

#### Créer un raccourci Bureau (Windows)

Pour que le pharmacien puisse lancer l'app d'un clic :

1. Clic droit sur le Bureau → **Nouveau** → **Raccourci**
2. Dans "Emplacement", tapez :
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8080
   ```
   (adaptez le chemin de Chrome si nécessaire)
3. Nommez le raccourci **"PharmaProjet"**
4. L'application s'ouvrira sans barre d'adresse, comme une vraie application

---

## 5. ☁️ Configuration de Supabase (Cloud gratuit)

> Supabase est **optionnel** mais **fortement recommandé** pour :
> - Sauvegarder les données dans le cloud (sécurité)
> - Synchroniser entre plusieurs postes de la même pharmacie
> - Récupérer les données si le PC tombe en panne

### 💰 Coût : 0 GNF — 100% GRATUIT

Supabase offre un plan gratuit généreux :
- 500 Mo de base de données
- 5 Go de bande passante
- Illimité en durée

> Cela suffit largement pour une pharmacie (même très active).

### Étape 5.1 — Créer un compte Supabase

1. Allez sur **https://supabase.com** dans votre navigateur
2. Cliquez sur **"Start your project"**
3. Créez un compte avec **l'email de la pharmacie** (ex : `pharmacie.bonheur@gmail.com`)
4. Confirmez l'email en cliquant sur le lien reçu

### Étape 5.2 — Créer un projet

1. Une fois connecté, cliquez sur **"New project"**
2. Remplissez les champs :
   - **Organization** : sélectionnez votre organisation (ou créez-en une)
   - **Name** : le nom de la pharmacie (ex : `Pharmacie du Bonheur`)
   - **Database Password** : un mot de passe fort (notez-le, vous n'en aurez plus besoin après)
   - **Region** : choisissez **"West EU (Ireland)"** ou la plus proche de la Guinée
3. Cliquez sur **"Create new project"**
4. ⏳ **Attendez 2-3 minutes** que le projet soit prêt

### Étape 5.3 — Créer les tables (base de données)

1. Dans le menu de gauche, cliquez sur **"SQL Editor"** (icône `</>`)
2. Cliquez sur **"New query"**
3. **Ouvrez le fichier `supabase_schema.sql`** qui se trouve à la racine du projet (à côté du dossier `pharma_projet/`)
4. **Copiez TOUT le contenu** du fichier `supabase_schema.sql`
5. **Collez-le** dans l'éditeur SQL de Supabase
6. Cliquez sur le bouton vert **"Run"** (▶️)
7. Vous devez voir : **"Success. No rows returned"** — c'est normal, les 14 tables ont été créées !

> ⚠️ **Ne modifiez RIEN** dans le script SQL. Collez-le tel quel.

### Étape 5.4 — Récupérer les clés API

1. Dans le menu de gauche, cliquez sur l'icône **⚙️ (Project Settings)**
2. Allez dans **"API"** (section "Configuration")
3. Notez les deux informations suivantes :

| Information | Où la trouver | Exemple |
|-------------|---------------|---------|
| **Project URL** | Section "Project URL" | `https://abcdef123.supabase.co` |
| **Clé `anon` `public`** | Section "Project API keys" | `eyJhbGciOiJIUzI1NiIsInR5c...` |

> 🔒 **IMPORTANT** : Ne copiez JAMAIS la clé `service_role` (la clé "secret"). 
> Utilisez uniquement la clé **`anon` `public`**.

### Étape 5.5 — Connecter PharmaProjet à Supabase

**Méthode 1 : Magic Link (automatique) — Recommandée**

Construisez ce lien et envoyez-le au pharmacien (WhatsApp, SMS, email) :

```
http://localhost:8080/?sb_url=VOTRE_URL_SUPABASE&sb_key=VOTRE_CLE_ANON
```

Exemple concret :
```
http://localhost:8080/?sb_url=https://abcdef123.supabase.co&sb_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

L'application détecte automatiquement les paramètres et configure la connexion.

**Méthode 2 : Configuration manuelle**

1. Connectez-vous à PharmaProjet en tant qu'admin
2. Allez dans **Paramètres** → **Synchronisation & Sauvegarde**
3. Renseignez l'**URL Supabase** et la **Clé Anon**
4. Cliquez sur **"Enregistrer la config Cloud"**

---

## 6. 🚀 Premier démarrage & Onboarding

Au premier lancement, un assistant de configuration guide le pharmacien :

### Étape 1/4 — Identité de la pharmacie
- Nom de la pharmacie
- Slogan / accroche
- Adresse complète
- Logo (optionnel mais recommandé)

### Étape 2/4 — Contact & Réglementation
- Téléphone de contact
- Email professionnel
- N° de licence DNPM
- Nom du pharmacien responsable

### Étape 3/4 — Configuration technique
- Seuil d'alerte de stock (unités)
- Délai d'alerte d'expiration (jours)

### Étape 4/4 — Sécurité du compte admin
- **Création obligatoire d'un mot de passe personnalisé** (min. 6 caractères)
- Ce mot de passe remplace le mot de passe par défaut

Après l'onboarding, le pharmacien se connecte avec :
- **Identifiant** : `admin`
- **Mot de passe** : celui qu'il vient de définir

> ✅ **C'est prêt !** L'application est opérationnelle.

---

## 7. 📱 Installation multi-postes (PWA)

Pour installer PharmaProjet sur **plusieurs postes** dans la même pharmacie :

### Sur un PC/Mac supplémentaire

1. Ouvrez le navigateur et accédez à la même adresse que le poste principal
   (ex : `http://192.168.1.x:8080` — l'adresse IP du PC serveur sur le réseau local)
2. Cliquez sur l'icône 📲 (installer) dans la barre d'adresse ou dans le topbar de l'application
3. L'application s'installe comme une app native

### Sur un smartphone ou tablette

1. Ouvrez Chrome ou Safari
2. Accédez à l'adresse du serveur local (ex : `http://192.168.1.x:8080`)
3. **Chrome** : Menu ⋮ → "Ajouter à l'écran d'accueil"
4. **Safari** : Bouton Partager → "Sur l'écran d'accueil"

> Tous les postes partagent la même base Supabase et se synchronisent automatiquement.

### Trouver l'adresse IP du PC serveur (Windows)

```
# Ouvrez l'invite de commande et tapez :
ipconfig

# Cherchez l'adresse "Adresse IPv4" sous votre connexion active
# Exemple : 192.168.1.100
```

---

## 8. 💾 Sauvegarde & Restauration

### Sauvegarde automatique (avec Supabase)

Si Supabase est configuré, **toutes les données sont synchronisées automatiquement** dans le cloud. En cas de panne du PC, il suffit de :
1. Installer PharmaProjet sur un nouveau PC
2. Reconfigurer la connexion Supabase (même URL et clé)
3. Les données se téléchargent automatiquement

### Sauvegarde manuelle (fichier JSON)

1. Connectez-vous en tant qu'admin
2. Allez dans **Paramètres** → **Synchronisation & Sauvegarde**
3. Cliquez sur **"Sauvegarder maintenant"**
4. Un fichier `pharma_backup_AAAA-MM-JJ.json` est téléchargé
5. **Stockez ce fichier** sur une clé USB ou un disque externe

> 📌 **Recommandation** : Faites une sauvegarde manuelle **chaque semaine** en plus de Supabase.

### Restauration depuis un fichier

1. Allez dans **Paramètres** → **Synchronisation & Sauvegarde**
2. Cliquez sur **"Restaurer une sauvegarde"**
3. Sélectionnez votre fichier `.json`
4. Confirmez (⚠️ les données actuelles seront écrasées)
5. L'application se recharge avec les données restaurées

---

## 9. 🔄 Mise à jour de PharmaProjet

Pour mettre à jour l'application vers une nouvelle version :

1. **Téléchargez** le nouveau dossier `pharma_projet/`
2. **Remplacez** l'ancien dossier par le nouveau (écrasez les fichiers)
3. **Rechargez** l'application dans le navigateur (Ctrl+F5 ou Cmd+Shift+R)

> ℹ️ Les données de la pharmacie ne sont **pas affectées** par la mise à jour.
> Elles sont stockées dans IndexedDB (navigateur) et Supabase (cloud).

---

## 10. ❓ FAQ & Troubleshooting

### Questions fréquentes

**Q : La pharmacie n'a pas Internet en permanence. Ça fonctionne ?**
> **Oui.** PharmaProjet est "Offline-First". Toutes les opérations fonctionnent sans Internet. La synchronisation se fait automatiquement quand Internet revient.

**Q : Combien de pharmacies puis-je installer ?**
> **Illimité.** Chaque pharmacie crée son propre compte Supabase (gratuit). Il n'y a aucune limite.

**Q : Les données d'une pharmacie sont-elles visibles par une autre ?**
> **Non.** Chaque pharmacie a sa propre base Supabase totalement isolée.

**Q : L'application est lente au premier chargement ?**
> Normal au tout premier lancement (téléchargement des polices Google). Les lancements suivants sont instantanés grâce au Service Worker.

**Q : Puis-je modifier les données de démo ?**
> Oui, vous pouvez supprimer et ajouter des produits librement. Les données de démo sont créées une seule fois au premier lancement.

### Problèmes courants

| Problème | Solution |
|----------|----------|
| Page blanche au lancement | Videz le cache du navigateur (Ctrl+Shift+Delete) et rechargez |
| "Erreur de démarrage" | Vérifiez que tous les fichiers JS sont présents dans le dossier |
| Supabase ne synchronise pas | Vérifiez l'URL et la clé dans Paramètres → Synchronisation |
| L'app ne s'installe pas en PWA | Utilisez la Méthode B (serveur local) au lieu du double-clic |
| Les icônes ne s'affichent pas | Rechargez avec Ctrl+F5 (forcer le rafraîchissement du cache) |
| Connexion refusée (identifiant) | Vérifiez que vous utilisez le mot de passe défini à l'onboarding |

---

## 11. ✅ Checklist d'installation

À imprimer et cocher pour chaque nouvelle pharmacie :

```
CHECKLIST D'INSTALLATION — PharmaProjet v3.0
═══════════════════════════════════════════════

Pharmacie : ________________________________
Date      : __ / __ / ____
Technicien: ________________________________

PRÉPARATION
□ PC avec navigateur Chrome/Edge à jour
□ Dossier pharma_projet/ copié sur le PC
□ Adresse email de la pharmacie disponible

INSTALLATION
□ Application ouverte via serveur local ou double-clic
□ L'écran d'onboarding s'affiche correctement

SUPABASE (optionnel mais recommandé)
□ Compte Supabase créé
□ Projet Supabase créé
□ Script SQL exécuté avec succès
□ URL et clé anon copiées
□ Connexion Supabase configurée dans l'app

ONBOARDING
□ Nom de la pharmacie renseigné
□ Contact et licence DNPM renseignés
□ Mot de passe admin personnalisé défini
□ Connexion avec admin / [nouveau mot de passe] réussie

VÉRIFICATION FONCTIONNELLE
□ Tableau de bord s'affiche correctement
□ Point de Vente accessible et fonctionnel
□ Ajout d'un produit test réussi
□ Vente test validée avec succès
□ Sauvegarde JSON téléchargée

FORMATION DU PERSONNEL
□ Le pharmacien sait se connecter / déconnecter
□ Le pharmacien sait faire une vente
□ Le pharmacien sait ajouter un produit
□ Le pharmacien sait faire une sauvegarde
□ Raccourci créé sur le Bureau (si applicable)

SIGNATURE
Technicien : ________________  Client : ________________
```

---

*PharmaProjet v3.0 — Propulsé par TrillionX — La technologie au service de la santé en Guinée.* 🇬🇳
