-- 006_api_integrations.sql
-- Schema changes for API integration (openLCA, PubChem, Electricity Maps, BLS, EIA, Metals)

-- 1. Extend driver_impact_factors: support multiple valuation methods
ALTER TABLE driver_impact_factors
  ADD COLUMN method_name VARCHAR(100) NOT NULL DEFAULT 'CML 2001' AFTER category_id;

CREATE INDEX idx_method_category
  ON driver_impact_factors(method_name, category_id);

-- 2. Extend substances: PubChem enrichment fields
ALTER TABLE substances
  ADD COLUMN molecular_formula VARCHAR(100) NULL AFTER cas_number,
  ADD COLUMN molecular_weight DECIMAL(12,4) NULL AFTER molecular_formula,
  ADD COLUMN pubchem_cid INT NULL AFTER molecular_weight,
  ADD COLUMN hazard_classification TEXT NULL AFTER pubchem_cid,
  ADD COLUMN iupac_name VARCHAR(500) NULL AFTER hazard_classification,
  ADD COLUMN enriched_at TIMESTAMP NULL AFTER iupac_name;

CREATE INDEX idx_pubchem_cid ON substances(pubchem_cid);

-- 3. cost_rates — cache for BLS / EIA / Metals API rate data
CREATE TABLE IF NOT EXISTS cost_rates (
  rate_id INT AUTO_INCREMENT PRIMARY KEY,
  rate_type ENUM('labor','electricity','natural_gas','material','transport') NOT NULL,
  rate_key VARCHAR(200) NOT NULL COMMENT 'Welder, Electricity, Steel-HR, etc.',
  region_code VARCHAR(20) NOT NULL COMMENT 'US state code, country code',
  rate_value DECIMAL(15,4) NOT NULL,
  rate_unit VARCHAR(50) NOT NULL COMMENT '$/hr, $/kWh, $/kg',
  effective_date DATE NOT NULL,
  source VARCHAR(100) NOT NULL,
  source_series_id VARCHAR(100) NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rate (rate_type, rate_key, region_code, effective_date),
  INDEX idx_type_region (rate_type, region_code),
  INDEX idx_effective (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. integration_log — audit trail
CREATE TABLE IF NOT EXISTS integration_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  records_affected INT DEFAULT 0,
  executed_by INT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success','partial','failed') NOT NULL DEFAULT 'success',
  details JSON NULL,
  INDEX idx_source_time (source, executed_at),
  INDEX idx_executed_by (executed_by)
) ENGINE=InnoDB;

-- 5. assessment_runs: remember which region was used
ALTER TABLE assessment_runs
  ADD COLUMN region_code VARCHAR(20) NULL AFTER calculation_method;

-- 6. Backfill: tag existing factors as CML 2001 (already the default, no-op)
-- Nothing to do — default handles it.
