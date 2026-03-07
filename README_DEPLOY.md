# 🚀 Guide de Déploiement Multi-Pharmacies — PharmaProjet v3.0

Ce guide vous montre **exactement** comment installer PharmaProjet dans une nouvelle pharmacie, du début à la fin, **sans payer d'abonnement Supabase**.

---

## 📌 Architecture : Comment ça marche ?

PharmaProjet utilise le modèle **"1 pharmacie = 1 projet Supabase"** :

- Chaque pharmacie a sa **propre base de données Supabase isolée**
- Les données de la Pharmacie A ne sont jamais accessibles par la Pharmacie B
- Chaque base fonctionne de manière indépendante
- L'application fonctionne **hors-ligne** (Offline-First) et synchronise quand Internet est disponible

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Pharmacie A     │     │  Pharmacie B     │     │  Pharmacie C     │
│  (PC ou mobile)  │     │  (PC ou mobile)  │     │  (PC ou mobile)  │
│  PharmaProjet    │     │  PharmaProjet    │     │  PharmaProjet    │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Supabase        │     │  Supabase        │     │  Supabase        │
│  Compte: phA@... │     │  Compte: phB@... │     │  Compte: phC@... │
│  Projet dédié    │     │  Projet dédié    │     │  Projet dédié    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 💰 Comment rester 100% GRATUIT ?

Supabase limite chaque compte à **2 projets gratuits**. Voici la stratégie :

| Scénario | Solution |
|----------|----------|
| 1 à 2 pharmacies | Créez un seul compte Supabase avec 1 projet par pharmacie |
| 3+ pharmacies | Chaque pharmacie crée **son propre compte Supabase** avec son email |

> **Recommandation** : Demandez au pharmacien de créer son propre compte Supabase avec son email professionnel. Ainsi :
> - ✅ La gratuité est **totale** (chaque client a son quota gratuit)
> - ✅ Les données de santé sont **physiquement séparées**
> - ✅ Le pharmacien est **propriétaire** de ses données
> - ✅ Aucune limite sur le nombre de pharmacies que vous déployez

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

1. ✅ Un navigateur moderne (Chrome, Edge, Safari)
2. ✅ Les fichiers PharmaProjet (le dossier `pharma_projet/`)
3. ✅ Un hébergement web (Netlify, Vercel, GitHub Pages, ou un serveur local)
4. ✅ Une adresse email pour créer le compte Supabase

---

## 🔧 Étapes d'installation (pour chaque nouvelle pharmacie)

### Étape 1 : Créer un compte Supabase

1. Allez sur **[https://supabase.com](https://supabase.com)**
2. Cliquez sur **"Start your project"**
3. Créez un compte avec l'email de la pharmacie (ex: `pharmacie.bonheur@gmail.com`)
4. Confirmez l'email

### Étape 2 : Créer un projet Supabase

1. Une fois connecté, cliquez sur **"New project"**
2. Remplissez :
   - **Nom du projet** : le nom de la pharmacie (ex: `Pharmacie du Bonheur`)
   - **Mot de passe de la base** : un mot de passe fort (notez-le quelque part)
   - **Région** : choisissez la plus proche (ex: `EU West (Ireland)` ou `US East`)
3. Cliquez sur **"Create new project"**
4. **Attendez 2-3 minutes** que le projet soit prêt (un indicateur de chargement s'affiche)

### Étape 3 : Créer les tables dans la base de données

1. Dans le menu de gauche, cliquez sur **"SQL Editor"**
2. Cliquez sur **"New query"** (en haut à droite)
3. **Ouvrez le fichier `supabase_schema.sql`** fourni avec PharmaProjet (à la racine du projet)
4. **Copiez tout le contenu** du fichier et **collez-le** dans l'éditeur SQL
5. Cliquez sur le bouton **"Run"** (▶️ en bas à droite)
6. Vous devez voir le message **"Success. No rows returned"** — C'est normal, les tables ont été créées !

> ⚠️ **IMPORTANT** : Ne modifiez pas le contenu du script SQL. Collez-le tel quel et exécutez-le.

### Étape 4 : Récupérer les clés API

1. Dans le menu de gauche, cliquez sur l'icône **⚙️ (Project Settings)**
2. Allez dans **"API"** (sous la section "Configuration")
3. Vous verrez deux informations essentielles :

| Information | Où la trouver | Exemple |
|-------------|---------------|---------|
| **Project URL** | Section "Project URL" | `https://abcdef123.supabase.co` |
| **API Key (anon public)** | Section "Project API keys" → `anon` `public` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

> ⚠️ **NE JAMAIS copier la clé `service_role`** (la clé "secret"). Utilisez uniquement la clé `anon` `public`.

4. **Copiez ces deux valeurs** — vous en aurez besoin à l'étape suivante.

### Étape 5 : Générer le Magic Link

Le Magic Link permet de configurer automatiquement PharmaProjet pour la pharmacie. Il se construit comme suit :

**Format :**
```
https://VOTRE-DOMAINE/?sb_url=URL_SUPABASE&sb_key=CLE_ANON_PUBLIC
```

**Exemple concret :**
```
https://pharma-guinee.com/?sb_url=https://abcdef123.supabase.co&sb_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZjEyMyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk5MDAwMDAwLCJleHAiOjIwMTUwMDAwMDB9.xxxxx
```

> 💡 **Si vous utilisez un serveur local** (Live Server, VS Code), le lien sera :
> `http://127.0.0.1:5500/?sb_url=https://abcdef123.supabase.co&sb_key=eyJhbGci...`

### Étape 6 : Installation chez la pharmacie

1. **Envoyez le Magic Link** au pharmacien (par WhatsApp, Email ou SMS)
2. Le pharmacien **clique sur le lien** dans son navigateur
3. L'application détecte les paramètres et **configure automatiquement** la connexion Supabase
4. L'**assistant de configuration** (Onboarding) se lance automatiquement :
   - **Étape 1** : Nom, adresse et logo de la pharmacie
   - **Étape 2** : Contact et n° licence DNPM
   - **Étape 3** : Paramètres techniques (seuils d'alerte)
   - **Étape 4** : Changement du mot de passe admin (obligatoire)
5. Après l'onboarding, le pharmacien se connecte avec :
   - **Identifiant** : `admin`
   - **Mot de passe** : celui qu'il vient de définir
6. **C'est terminé !** L'application est fonctionnelle et synchronisée.

---

## 🔄 Configuration manuelle (alternative au Magic Link)

Si le Magic Link ne fonctionne pas, la configuration peut se faire manuellement :

1. Ouvrez PharmaProjet normalement
2. Complétez l'assistant de configuration (Onboarding)
3. Connectez-vous avec le compte admin
4. Allez dans **Paramètres** → **Synchronisation & Sauvegarde**
5. Renseignez l'**URL Supabase** et la **Clé Anon**
6. Cliquez sur **"Enregistrer la config Cloud"**

---

## ❓ Questions Fréquentes (FAQ)

### « La pharmacie n'a pas Internet en permanence. Ça fonctionne quand même ? »
**Oui.** PharmaProjet est "Offline-First". Toutes les données sont stockées localement. Quand Internet revient, la synchronisation se fait automatiquement en arrière-plan.

### « Comment faire si je gère plus de 2 pharmacies ? »
Chaque pharmacie doit créer son propre compte Supabase avec un email différent. Chaque compte a droit à 2 projets gratuits — mais une pharmacie n'a besoin que d'un seul projet.

### « Les données d'une pharmacie peuvent-elles être vues par une autre ? »
**Non.** Chaque pharmacie a sa propre instance Supabase totalement isolée. Il n'y a aucun lien entre les bases de données.

### « Que se passe-t-il si le pharmacien perd sa connexion Supabase ? »
Rien ne change pour l'utilisation quotidienne. L'application continue de fonctionner normalement en mode local. Il suffit de reconfigurer la connexion Supabase dans les paramètres quand le problème est résolu.

### « Puis-je installer PharmaProjet sur plusieurs postes dans la même pharmacie ? »
**Oui.** Il suffit d'ouvrir le même lien (ou Magic Link) sur chaque poste. Tous les postes se synchroniseront via la même base Supabase.

### « Comment mettre à jour PharmaProjet ? »
Remplacez simplement les fichiers du dossier `pharma_projet/` sur votre hébergement. Les données des pharmacies ne sont pas affectées (elles sont dans Supabase et IndexedDB).

---

## 📁 Structure du Script SQL

Le fichier `supabase_schema.sql` crée les 14 tables suivantes :

| Table | Description |
|-------|-------------|
| `products` | Catalogue des médicaments |
| `lots` | Lots (péremption, traçabilité) |
| `stock` | État du stock par produit |
| `movements` | Historique des mouvements de stock |
| `suppliers` | Fournisseurs |
| `purchaseOrders` | Bons de commande |
| `patients` | Dossiers patients |
| `prescriptions` | Ordonnances médicales |
| `sales` | Ventes |
| `saleItems` | Détails des lignes de vente |
| `alerts` | Alertes système |
| `cashRegister` | Caisse journalière |
| `auditLog` | Journal d'audit |
| `settings` | Paramètres clé/valeur |

---

*PharmaProjet v3.0 — La technologie au service de la santé en Guinée.*
