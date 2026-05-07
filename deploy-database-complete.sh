#!/usr/bin/env node

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'lcaadmin',
  password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
  multipleStatements: true
};

async function deploy() {
  let connection;
  
  try {
    console.log('=== LCA v3 Database Deployment ===\n');
    console.log('Connecting to RDS...');
    
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ Connected to RDS\n');
    
    // Create database
    console.log('Creating database lca_v3...');
    await connection.query('CREATE DATABASE IF NOT EXISTS lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✓ Database created\n');
    
    // Use database
    await connection.query('USE lca_v3');
    
    console.log('Deploying schema...');
    
    // Drop existing tables
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    const dropTables = [
      'audit_log', 'assessment_results', 'assessment_runs', 
      'driver_impact_factors', 'impact_categories', 'flows', 
      'substances', 'component', 'case_table', 'project_members', 
      'project', 'permissions', 'account'
    ];
    
    for (const table of dropTables) {
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Cleaned existing tables\n');
    
    // Create tables
    console.log('Creating tables...');
    
    await connection.query(`
      CREATE TABLE account (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        account_type ENUM('admin', 'user') DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ account');
    
    await connection.query(`
      CREATE TABLE permissions (
        permission_id INT AUTO_INCREMENT PRIMARY KEY,
        permission_name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ permissions');
    
    await connection.query(`
      CREATE TABLE project (
        project_id INT AUTO_INCREMENT PRIMARY KEY,
        project_name VARCHAR(100) NOT NULL,
        description TEXT,
        owner_id INT NOT NULL,
        is_template BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES account(id) ON DELETE CASCADE,
        INDEX idx_owner (owner_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ project');
    
    await connection.query(`
      CREATE TABLE project_members (
        member_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        user_id INT NOT NULL,
        permission_id INT NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES account(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(permission_id),
        UNIQUE KEY unique_project_user (project_id, user_id),
        INDEX idx_project (project_id),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ project_members');
    
    await connection.query(`
      CREATE TABLE case_table (
        case_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        case_name VARCHAR(100) NOT NULL,
        case_type ENUM('base', 'comparative') NOT NULL,
        parent_case_id INT DEFAULT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE,
        FOREIGN KEY (parent_case_id) REFERENCES case_table(case_id) ON DELETE SET NULL,
        INDEX idx_project (project_id),
        INDEX idx_type (case_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ case_table');
    
    await connection.query(`
      CREATE TABLE component (
        component_id INT AUTO_INCREMENT PRIMARY KEY,
        case_id INT NOT NULL,
        parent_component_id INT DEFAULT NULL,
        component_name VARCHAR(200) NOT NULL,
        component_type ENUM('product', 'machine_line', 'subprocess', 'operation', 'elemental_task') NOT NULL,
        hierarchy_level INT NOT NULL CHECK (hierarchy_level BETWEEN 1 AND 5),
        quantity DECIMAL(15,6) DEFAULT 1.000000,
        unit VARCHAR(50) DEFAULT 'unit',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES case_table(case_id) ON DELETE CASCADE,
        FOREIGN KEY (parent_component_id) REFERENCES component(component_id) ON DELETE CASCADE,
        INDEX idx_case (case_id),
        INDEX idx_parent (parent_component_id),
        INDEX idx_type (component_type),
        INDEX idx_level (hierarchy_level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ component');
    
    await connection.query(`
      CREATE TABLE substances (
        substance_id INT AUTO_INCREMENT PRIMARY KEY,
        substance_name VARCHAR(200) UNIQUE NOT NULL,
        cas_number VARCHAR(50),
        category ENUM('resource', 'emission_air', 'emission_water', 'emission_soil', 'waste') NOT NULL,
        unit VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_name (substance_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ substances');
    
    await connection.query(`
      CREATE TABLE flows (
        flow_id INT AUTO_INCREMENT PRIMARY KEY,
        component_id INT NOT NULL,
        substance_id INT NOT NULL,
        flow_type ENUM('input', 'output') NOT NULL,
        quantity DECIMAL(15,6) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        is_driver BOOLEAN DEFAULT FALSE,
        driver_description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (component_id) REFERENCES component(component_id) ON DELETE CASCADE,
        FOREIGN KEY (substance_id) REFERENCES substances(substance_id) ON DELETE RESTRICT,
        INDEX idx_component (component_id),
        INDEX idx_substance (substance_id),
        INDEX idx_type (flow_type),
        INDEX idx_driver (is_driver)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ flows');
    
    await connection.query(`
      CREATE TABLE impact_categories (
        category_id INT AUTO_INCREMENT PRIMARY KEY,
        category_name VARCHAR(100) UNIQUE NOT NULL,
        abbreviation VARCHAR(20),
        unit VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (category_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ impact_categories');
    
    await connection.query(`
      CREATE TABLE driver_impact_factors (
        factor_id INT AUTO_INCREMENT PRIMARY KEY,
        substance_id INT NOT NULL,
        category_id INT NOT NULL,
        factor_value DECIMAL(20,10) NOT NULL,
        unit VARCHAR(100) NOT NULL,
        geographic_scope VARCHAR(50) DEFAULT 'Global',
        temporal_scope VARCHAR(50),
        data_quality_score DECIMAL(3,2) CHECK (data_quality_score BETWEEN 0 AND 5),
        source_reference TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (substance_id) REFERENCES substances(substance_id) ON DELETE RESTRICT,
        FOREIGN KEY (category_id) REFERENCES impact_categories(category_id) ON DELETE RESTRICT,
        UNIQUE KEY unique_substance_category (substance_id, category_id),
        INDEX idx_substance (substance_id),
        INDEX idx_category (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ driver_impact_factors');
    
    await connection.query(`
      CREATE TABLE assessment_runs (
        run_id INT AUTO_INCREMENT PRIMARY KEY,
        case_id INT NOT NULL,
        run_name VARCHAR(100),
        run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        calculation_method VARCHAR(100) DEFAULT 'CML 2001',
        status ENUM('running', 'completed', 'failed') DEFAULT 'running',
        error_log TEXT,
        executed_by INT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES case_table(case_id) ON DELETE CASCADE,
        FOREIGN KEY (executed_by) REFERENCES account(id) ON DELETE RESTRICT,
        INDEX idx_case (case_id),
        INDEX idx_date (run_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ assessment_runs');
    
    await connection.query(`
      CREATE TABLE assessment_results (
        result_id INT AUTO_INCREMENT PRIMARY KEY,
        run_id INT NOT NULL,
        component_id INT NOT NULL,
        category_id INT NOT NULL,
        impact_value DECIMAL(20,10) NOT NULL,
        unit VARCHAR(100) NOT NULL,
        contribution_percentage DECIMAL(5,2),
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES assessment_runs(run_id) ON DELETE CASCADE,
        FOREIGN KEY (component_id) REFERENCES component(component_id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES impact_categories(category_id) ON DELETE RESTRICT,
        INDEX idx_run (run_id),
        INDEX idx_component (component_id),
        INDEX idx_category (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ assessment_results');
    
    await connection.query(`
      CREATE TABLE audit_log (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action_type ENUM('create', 'update', 'delete', 'calculate', 'export') NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        record_id INT NOT NULL,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES account(id) ON DELETE RESTRICT,
        INDEX idx_user (user_id),
        INDEX idx_table (table_name),
        INDEX idx_timestamp (timestamp),
        INDEX idx_action (action_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ audit_log\n');
    
    console.log('Seeding reference data...');
    
    // Permissions
    await connection.query(`
      INSERT INTO permissions (permission_name, description) VALUES
      ('owner', 'Full control over the project including deletion'),
      ('admin', 'Can manage project settings and members'),
      ('editor', 'Can edit project data but cannot manage members'),
      ('viewer', 'Read-only access to project data')
    `);
    console.log('  ✓ 4 permissions');
    
    // Impact Categories
    await connection.query(`
      INSERT INTO impact_categories (category_name, abbreviation, unit, description) VALUES
      ('Global Warming', 'GWP', 'kg CO2 eq', 'Climate change impact measured in CO2 equivalents'),
      ('Ozone Depletion', 'ODP', 'kg CFC-11 eq', 'Stratospheric ozone depletion potential'),
      ('Acidification', 'AP', 'kg SO2 eq', 'Acidification potential of air and water'),
      ('Eutrophication', 'EP', 'kg PO4 eq', 'Nutrient enrichment of water and soil'),
      ('Photochemical Oxidation', 'POCP', 'kg C2H4 eq', 'Smog formation potential'),
      ('Human Toxicity', 'HTP', 'kg 1,4-DB eq', 'Toxic impact on human health'),
      ('Ecotoxicity', 'ETP', 'kg 1,4-DB eq', 'Toxic impact on ecosystems'),
      ('Resource Depletion', 'ADP', 'kg Sb eq', 'Depletion of abiotic resources')
    `);
    console.log('  ✓ 8 impact categories');
    
    // Substances
    await connection.query(`
      INSERT INTO substances (substance_name, cas_number, category, unit, description) VALUES
      ('Carbon Dioxide', '124-38-9', 'emission_air', 'kg', 'Primary greenhouse gas'),
      ('Methane', '74-82-8', 'emission_air', 'kg', 'Potent greenhouse gas'),
      ('Nitrous Oxide', '10024-97-2', 'emission_air', 'kg', 'Greenhouse gas and ozone depleter'),
      ('Sulfur Dioxide', '7446-09-5', 'emission_air', 'kg', 'Acidification precursor'),
      ('Nitrogen Oxides', '11104-93-1', 'emission_air', 'kg', 'Acidification and smog precursor'),
      ('Particulate Matter (PM2.5)', 'N/A', 'emission_air', 'kg', 'Fine particulate matter'),
      ('Electricity', 'N/A', 'resource', 'kWh', 'Electrical energy consumption'),
      ('Water', '7732-18-5', 'resource', 'm3', 'Fresh water consumption'),
      ('Crude Oil', '8002-05-9', 'resource', 'kg', 'Petroleum resource'),
      ('Natural Gas', '8006-14-2', 'resource', 'm3', 'Fossil fuel resource'),
      ('Coal', 'N/A', 'resource', 'kg', 'Fossil fuel resource'),
      ('Wastewater', 'N/A', 'emission_water', 'm3', 'Contaminated water discharge'),
      ('Solid Waste', 'N/A', 'waste', 'kg', 'Non-hazardous solid waste')
    `);
    console.log('  ✓ 13 substances');
    
    // Driver Impact Factors
    await connection.query(`
      INSERT INTO driver_impact_factors (substance_id, category_id, factor_value, unit, geographic_scope, data_quality_score, source_reference) VALUES
      (1, 1, 1.0000000000, 'kg CO2 eq / kg CO2', 'Global', 5.00, 'IPCC AR6 2021'),
      (2, 1, 28.0000000000, 'kg CO2 eq / kg CH4', 'Global', 5.00, 'IPCC AR6 2021 (100-year GWP)'),
      (3, 1, 265.0000000000, 'kg CO2 eq / kg N2O', 'Global', 5.00, 'IPCC AR6 2021 (100-year GWP)'),
      (3, 2, 0.0170000000, 'kg CFC-11 eq / kg N2O', 'Global', 4.50, 'WMO 2018'),
      (4, 3, 1.0000000000, 'kg SO2 eq / kg SO2', 'Global', 5.00, 'CML 2001'),
      (5, 3, 0.7000000000, 'kg SO2 eq / kg NOx', 'Global', 4.80, 'CML 2001'),
      (5, 4, 0.1300000000, 'kg PO4 eq / kg NOx', 'Global', 4.50, 'CML 2001'),
      (5, 5, 0.0280000000, 'kg C2H4 eq / kg NOx', 'Global', 4.70, 'CML 2001'),
      (7, 8, 0.0000054000, 'kg Sb eq / kWh', 'Global', 3.50, 'CML 2001 - Electricity mix'),
      (9, 8, 0.0200000000, 'kg Sb eq / kg', 'Global', 4.20, 'CML 2001 - Crude oil'),
      (11, 1, 2.4200000000, 'kg CO2 eq / kg', 'Global', 4.80, 'IPCC - Coal combustion')
    `);
    console.log('  ✓ 11 driver impact factors\n');
    
    // Verify deployment
    const [tables] = await connection.query("SHOW TABLES");
    console.log('=== Deployment Summary ===');
    console.log(`Database: lca_v3`);
    console.log(`Tables deployed: ${tables.length}`);
    console.log(`\nTables:`);
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`  - ${tableName}`);
    });
    
    console.log('\n✅ Database deployment completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:');
    console.error(error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

deploy();
