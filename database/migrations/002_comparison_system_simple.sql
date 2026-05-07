-- Simplified Comparison System Migration
-- Removes foreign key constraints to avoid dependency issues

CREATE TABLE IF NOT EXISTS comparison_runs (
  comparison_id INT PRIMARY KEY AUTO_INCREMENT,
  comparison_name VARCHAR(255) NOT NULL,
  project_id INT NOT NULL,
  case_ids JSON NOT NULL COMMENT 'Array of case IDs to compare',
  comparison_type ENUM('absolute', 'relative', 'delta') DEFAULT 'absolute',
  base_case_id INT COMMENT 'First case is the baseline',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_project_id (project_id),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comparison_results (
  result_id INT PRIMARY KEY AUTO_INCREMENT,
  comparison_id INT NOT NULL,
  category_id INT NOT NULL,
  category_name VARCHAR(255) NOT NULL,
  case_results JSON NOT NULL COMMENT 'Array of case values with deltas',
  best_case_id INT,
  worst_case_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_comparison_id (comparison_id),
  INDEX idx_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comparison_metadata (
  metadata_id INT PRIMARY KEY AUTO_INCREMENT,
  comparison_id INT NOT NULL UNIQUE,
  total_cases_compared INT NOT NULL,
  total_categories_analyzed INT NOT NULL,
  overall_best_case_id INT,
  overall_worst_case_id INT,
  calculation_time_ms INT,
  assessment_run_ids JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
