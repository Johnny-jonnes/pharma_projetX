-- ============================================================
-- PHARMA_PROJET v3.0 — Schéma Supabase COMPLET
-- 
-- INSTRUCTIONS :
-- 1. Ouvrez votre Dashboard Supabase
-- 2. Allez dans "SQL Editor" → "New query"
-- 3. Collez tout ce script et cliquez "Run"
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 0. NETTOYAGE — Supprime les tables existantes (ordre = dépendances)
-- ═══════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS "cashRegister" CASCADE;
DROP TABLE IF EXISTS "auditLog" CASCADE;
DROP TABLE IF EXISTS "app_users" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE; -- Nettoyage ancienne table
DROP TABLE IF EXISTS "returns" CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS "saleItems" CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS movements CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS lots CASCADE;
DROP TABLE IF EXISTS "purchaseOrders" CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLE PRODUCTS — Catalogue des médicaments
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE products (
  id                      BIGINT PRIMARY KEY,
  code                    TEXT,
  name                    TEXT,
  dci                     TEXT,
  brand                   TEXT,
  form                    TEXT,
  dosage                  TEXT,
  category                TEXT,
  "requiresPrescription"  BOOLEAN DEFAULT false,
  "minStock"              INTEGER DEFAULT 10,
  "salePrice"             NUMERIC DEFAULT 0,
  "purchasePrice"         NUMERIC DEFAULT 0,
  "vatRate"               NUMERIC DEFAULT 0,
  unit                    TEXT DEFAULT 'boîte',
  status                  TEXT DEFAULT 'active',
  "expiryDate"            TEXT,
  "updatedAt"             BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 2. TABLE LOTS — Gestion des lots (péremption, traçabilité)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE lots (
  id                BIGINT PRIMARY KEY,
  "productId"       BIGINT,
  "lotNumber"       TEXT,
  "expiryDate"      TEXT,
  quantity          INTEGER DEFAULT 0,
  "initialQuantity" INTEGER DEFAULT 0,
  "supplierId"      BIGINT,
  "receiptDate"     TEXT,
  status            TEXT DEFAULT 'active',
  "updatedAt"       BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 3. TABLE STOCK — État du stock par produit
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE stock (
  id                  BIGINT PRIMARY KEY,
  "productId"         BIGINT,
  quantity            INTEGER DEFAULT 0,
  "reservedQuantity"  INTEGER DEFAULT 0,
  "lastUpdated"       BIGINT,
  "updatedAt"         BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 4. TABLE MOVEMENTS — Historique des mouvements de stock
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE movements (
  id            BIGINT PRIMARY KEY,
  "productId"   BIGINT,
  type          TEXT,
  "subType"     TEXT,
  quantity      INTEGER DEFAULT 0,
  "lotNumber"   TEXT,
  date          TEXT,
  "userId"      BIGINT,
  note          TEXT,
  reference     TEXT,
  "updatedAt"   BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 5. TABLE SUPPLIERS — Fournisseurs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE suppliers (
  id              BIGINT PRIMARY KEY,
  name            TEXT,
  contact         TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  status          TEXT DEFAULT 'active',
  "agrément"      TEXT,
  "paymentTerms"  INTEGER DEFAULT 30,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 6. TABLE PURCHASE_ORDERS — Bons de commande
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "purchaseOrders" (
  id              BIGINT PRIMARY KEY,
  "supplierId"    BIGINT,
  status          TEXT DEFAULT 'draft',
  date            TEXT,
  "totalAmount"   NUMERIC DEFAULT 0,
  items           JSONB,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 7. TABLE PATIENTS — Dossiers patients
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE patients (
  id          BIGINT PRIMARY KEY,
  name        TEXT,
  phone       TEXT,
  dob         TEXT,
  allergies   TEXT,
  address     TEXT,
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 8. TABLE PRESCRIPTIONS — Ordonnances médicales
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE prescriptions (
  id            BIGINT PRIMARY KEY,
  "patientId"   BIGINT,
  date          TEXT,
  status        TEXT DEFAULT 'pending',
  "doctorName"  TEXT,
  items         JSONB,
  "updatedAt"   BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 9. TABLE SALES — Ventes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE sales (
  id                BIGINT PRIMARY KEY,
  date              TEXT,
  "patientId"       BIGINT,
  "patientName"     TEXT,
  "patientPhone"    TEXT,
  "userId"          BIGINT,
  "sellerName"      TEXT,
  total             NUMERIC DEFAULT 0,
  subtotal          NUMERIC DEFAULT 0,
  discount          NUMERIC DEFAULT 0,
  "paymentMethod"   TEXT,
  "mmPhone"         TEXT,
  status            TEXT DEFAULT 'completed',
  "prescriptionId"  BIGINT,
  "prescriptionRef" TEXT,
  "doctorName"      TEXT,
  "itemCount"       INTEGER DEFAULT 0,
  "creditDueDate"   TEXT,
  "cashReceived"    NUMERIC,
  "returnStatus"    TEXT,
  "lastReturnId"    BIGINT,
  "lastReturnDate"  TEXT,
  "updatedAt"       BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 10. TABLE SALE_ITEMS — Détails des lignes de vente
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "saleItems" (
  id              BIGINT PRIMARY KEY,
  "saleId"        BIGINT,
  "productId"     BIGINT,
  "productName"   TEXT,
  quantity        INTEGER DEFAULT 0,
  "unitPrice"     NUMERIC DEFAULT 0,
  "purchasePrice" NUMERIC DEFAULT 0,
  "lotId"         BIGINT,
  total           NUMERIC DEFAULT 0,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 11. TABLE ALERTS — Alertes système
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE alerts (
  id            BIGINT PRIMARY KEY,
  type          TEXT,
  "productId"   BIGINT,
  "productName" TEXT,
  message       TEXT,
  status        TEXT DEFAULT 'unread',
  date          BIGINT,
  priority      TEXT DEFAULT 'medium',
  "updatedAt"   BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 12. TABLE RETURNS — Retours clients
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "returns" (
  id              BIGINT PRIMARY KEY,
  "saleId"        BIGINT,
  "saleRef"       TEXT,
  "patientId"     BIGINT,
  "patientName"   TEXT,
  date            TEXT,
  reason          TEXT,
  items           JSONB,
  "refundAmount"  NUMERIC DEFAULT 0,
  "isFullReturn"  BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'approved',
  "paymentMethod" TEXT,
  "processedBy"   TEXT,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 13. TABLE CASH_REGISTER — Caisse journalière
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "cashRegister" (
  id              BIGINT PRIMARY KEY,
  type            TEXT,
  amount          NUMERIC DEFAULT 0,
  "paymentMethod" TEXT,
  reason          TEXT,
  date            TEXT,
  "timestamp"     BIGINT,
  "userId"        BIGINT,
  "updatedAt"     BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 14. TABLE AUDIT_LOG — Journal d'audit (traçabilité)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "auditLog" (
  id          BIGINT PRIMARY KEY,
  "userId"    BIGINT,
  username    TEXT,
  action      TEXT,
  entity      TEXT,
  "entityId"  BIGINT,
  details     JSONB,
  "timestamp" BIGINT,
  ip          TEXT,
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 15. TABLE APP_USERS — Gestion des utilisateurs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "app_users" (
  id          BIGINT PRIMARY KEY,
  name        TEXT,
  email       TEXT,
  username    TEXT UNIQUE,
  password    TEXT,
  role        TEXT,
  active      BOOLEAN DEFAULT true,
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 16. TABLE SETTINGS — Paramètres clé/valeur
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  "updatedAt" BIGINT
);

-- ═══════════════════════════════════════════════════════════════
-- 15. SÉCURITÉ — Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════
-- On active RLS sur toutes les tables et on crée une politique
-- "Allow all" pour l'accès via la clé anon (usage interne pharmacie).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock            ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchaseOrders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saleItems"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "returns"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cashRegister"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auditLog"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_users"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_products"         ON products         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_lots"             ON lots             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_stock"            ON stock            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_movements"        ON movements        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_suppliers"        ON suppliers        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_purchaseOrders"   ON "purchaseOrders" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_patients"         ON patients         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_prescriptions"    ON prescriptions    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sales"            ON sales            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_saleItems"        ON "saleItems"      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_alerts"           ON alerts           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_returns"          ON "returns"        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cashRegister"     ON "cashRegister"   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_auditLog"         ON "auditLog"       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_app_users"        ON "app_users"      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settings"         ON settings         FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- ✅ TERMINÉ — Toutes les tables sont prêtes.
-- Retournez dans PharmaProjet et connectez votre Supabase.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "closedAt" BIGINT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "closedBy" TEXT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "openingFund" NUMERIC;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "expectedCash" NUMERIC;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "physicalCash" NUMERIC;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "totalSales" NUMERIC;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "transactionCount" BIGINT;
ALTER TABLE "cashRegister" ADD COLUMN IF NOT EXISTS "note" TEXT;
