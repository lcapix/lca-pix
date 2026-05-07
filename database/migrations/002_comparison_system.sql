-- Migration: Comparison System for Multi-Case Assessment
-- Date: 2025-01-20
-- Description: Add tables for comparing multiple LCA cases

-- Create comparison_runs table
CREATE TABLE IF NOT EXISTS comparison_runs (
  comparison_id INT PRIMARY KEY AUTO_INCREMENT,
  comparison_name VARCHAR(255) NOT NULL,
  project_id INT NOT NULL,
  case_ids JSON NOT NULL COMMENT 'Array of case IDs to compare',
  comparison_type ENUM('absolute', 'relative', 'delta') DEFAULT 'absolute',
  base_case_id INT COMMENT 'First case is the baseline for comparisons',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE,
  FOREIGN KEY (base_case_id) REFERENCES case_table(case_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES account(user_id) ON DELETE CASCADE,

  INDEX idx_project_id (project_id),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stores multi-case comparison configurations';

-- Create comparison_results table (denormalized for performance)
CREATE TABLE IF NOT EXISTS comparison_results (
  result_id INT PRIMARY KEY AUTO_INCREMENT,
  comparison_id INT NOT NULL,
  category_id INT NOT NULL,
  category_name VARCHAR(255) NOT NULL,

  -- Store aggregated results for each case
  case_results JSON NOT NULL COMMENT 'Array of {case_id, case_name, impact_value, delta, percentage}',

  -- Pre-calculated rankings
  best_case_id INT COMMENT 'Case with lowest impact for this category',
  worst_case_id INT COMMENT 'Case with highest impact for this category',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (comparison_id) REFERENCES comparison_runs(comparison_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES impact_categories(category_id) ON DELETE CASCADE,

  INDEX idx_comparison_id (comparison_id),
  INDEX idx_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stores calculated comparison results by category';

-- Create comparison_metadata table
CREATE TABLE IF NOT EXISTS comparison_metadata (
  metadata_id INT PRIMARY KEY AUTO_INCREMENT,
  comparison_id INT NOT NULL,

  -- Summary statistics
  total_cases_compared INT NOT NULL,
  total_categories_analyzed INT NOT NULL,

  -- Overall winner (case with best overall environmental score)
  overall_best_case_id INT,
  overall_worst_case_id INT,

  -- Calculation metadata
  calculation_time_ms INT COMMENT 'Time taken to calculate comparison',
  assessment_run_ids JSON COMMENT 'Array of assessment run IDs used',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (comparison_id) REFERENCES comparison_runs(comparison_id) ON DELETE CASCADE,
  FOREIGN KEY (overall_best_case_id) REFERENCES case_table(case_id) ON DELETE SET NULL,
  FOREIGN KEY (overall_worst_case_id) REFERENCES case_table(case_id) ON DELETE SET NULL,

  UNIQUE KEY unique_comparison (comparison_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stores metadata and summary for comparisons';

-- Add indexes for performance
CREATE INDEX idx_comparison_runs_project ON comparison_runs(project_id, created_at DESC);
CREATE INDEX idx_comparison_results_lookup ON comparison_results(comparison_id, category_id);

-- Sample query examples (for documentation)
-- Get all comparisons for a project:
-- SELECT * FROM comparison_runs WHERE project_id = ? ORDER BY created_at DESC;

-- Get full comparison with results:
-- SELECT cr.*, crs.category_name, crs.case_results
-- FROM comparison_runs cr
-- JOIN comparison_results crs ON cr.comparison_id = crs.comparison_id
-- WHERE cr.comparison_id = ?;

-- Get ranking by category:
-- SELECT category_name, best_case_id, worst_case_id
-- FROM comparison_results
-- WHERE comparison_id = ?
-- ORDER BY category_name;
