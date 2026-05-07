#!/bin/bash

# ============================================================================
# Deploy Database Schema from EC2 Instance
# ============================================================================
# This script uploads the schema and deployment script to EC2,
# then executes the deployment from within the VPC
# ============================================================================

set -e

PROFILE="lca-pix"
EC2_IP="35.170.250.110"
KEY_FILE="lca-dev-keypair.pem"

echo "============================================================================"
echo "  Deploy Database from EC2 (Secure VPC Access)"
echo "============================================================================"
echo ""

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ SSH key file not found: $KEY_FILE"
    echo ""
    echo "Please download the key file from AWS Console:"
    echo "  1. Go to EC2 → Key Pairs"
    echo "  2. Find 'lca-dev-keypair'"
    echo "  3. Download the .pem file to this directory"
    echo ""
    echo "Or use an alternative method to deploy the schema."
    exit 1
fi

echo "📦 Step 1: Preparing files for upload..."
chmod 400 "$KEY_FILE"

# Create deployment package
mkdir -p /tmp/lca-deployment
cp lca_v3_drawsql_schema.sql /tmp/lca-deployment/
cat > /tmp/lca-deployment/deploy-on-ec2.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

echo "Installing MySQL client on EC2..."
sudo yum install -y mysql

echo "Getting database credentials from Secrets Manager..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id rds!db-fabed009-0d32-4d03-aa8a-54bb8209c1b4 \
    --region us-east-1 \
    --query 'SecretString' \
    --output text)

DB_USERNAME=$(echo "$SECRET_JSON" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
DB_PASSWORD=$(echo "$SECRET_JSON" | grep -o '"password":"[^"]*"' | cut -d'"' -f4)
DB_ENDPOINT="lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"

echo "Creating database..."
mysql -h "$DB_ENDPOINT" -u "$DB_USERNAME" -p"$DB_PASSWORD" << 'EOF'
CREATE DATABASE IF NOT EXISTS lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF

echo "Deploying schema..."
{
    echo "USE lca_v3;"
    cat lca_v3_drawsql_schema.sql
} | mysql -h "$DB_ENDPOINT" -u "$DB_USERNAME" -p"$DB_PASSWORD"

echo "Seeding reference data..."
mysql -h "$DB_ENDPOINT" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D lca_v3 << 'EOF'
-- Permissions
INSERT INTO permissions (permission_name, description) VALUES
('owner', 'Project owner - full access including delete'),
('admin', 'Project admin - can edit and manage team'),
('editor', 'Can edit project data'),
('viewer', 'Read-only access');

-- Impact categories
INSERT INTO impact_categories (category_name, unit, description) VALUES
('Global warming', 'kg CO2-eq', 'Climate change impact from greenhouse gas emissions'),
('Ozone depletion', 'kg CFC-11-eq', 'Stratospheric ozone depletion potential'),
('Smog formation', 'kg NOx-eq', 'Photochemical ozone creation potential'),
('Acidification', 'kg SO2-eq', 'Terrestrial acidification from acid deposition'),
('Eutrophication', 'kg N-eq', 'Nutrient enrichment of water bodies'),
('Freshwater ecotoxicity', 'CTUe', 'Toxic impacts on freshwater ecosystems'),
('Human toxicity', 'CTUh', 'Toxic impacts on human health'),
('Resource depletion', 'kg Sb-eq', 'Abiotic resource depletion');

-- Substances
INSERT INTO substances (substance_name, cas_number, category, default_unit, description) VALUES
('Electricity', NULL, 'energy', 'kWh', 'Electrical energy'),
('Natural Gas', NULL, 'energy', 'm3', 'Natural gas fuel'),
('Diesel', NULL, 'energy', 'L', 'Diesel fuel'),
('Steel', '12597-69-2', 'material', 'kg', 'Carbon steel'),
('Aluminum', '7429-90-5', 'material', 'kg', 'Aluminum metal'),
('Plastic (PET)', NULL, 'material', 'kg', 'Polyethylene terephthalate'),
('Water', '7732-18-5', 'water', 'L', 'Fresh water'),
('CO2', '124-38-9', 'emission', 'kg', 'Carbon dioxide'),
('CH4', '74-82-8', 'emission', 'kg', 'Methane'),
('NOx', NULL, 'emission', 'kg', 'Nitrogen oxides'),
('SOx', NULL, 'emission', 'kg', 'Sulfur oxides'),
('Municipal Waste', NULL, 'waste', 'kg', 'General municipal solid waste'),
('Hazardous Waste', NULL, 'waste', 'kg', 'Hazardous industrial waste');

-- Driver impact factors
INSERT INTO driver_impact_factors (driver_name, category_id, impact_factor, geographic_region, valid_from, data_source) VALUES
('Electricity (kWh)', 1, 0.5, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Electricity (kWh)', 2, 0.0000001, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Electricity (kWh)', 3, 0.0008, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Electricity (kWh)', 4, 0.0012, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Steel (kg)', 1, 1.8, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Steel (kg)', 4, 0.005, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Steel (kg)', 5, 0.003, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Aluminum (kg)', 1, 8.5, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Aluminum (kg)', 4, 0.015, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Natural Gas (m3)', 1, 2.0, 'US', '2025-01-01', 'GREET 2024'),
('Natural Gas (m3)', 3, 0.002, 'US', '2025-01-01', 'GREET 2024');
EOF

echo ""
echo "✅ Database deployment complete!"
mysql -h "$DB_ENDPOINT" -u "$DB_USERNAME" -p"$DB_PASSWORD" -D lca_v3 -e "SHOW TABLES;"
DEPLOY_SCRIPT

chmod +x /tmp/lca-deployment/deploy-on-ec2.sh

echo "✅ Deployment package ready"
echo ""

echo "📤 Step 2: Uploading files to EC2..."
scp -i "$KEY_FILE" -o StrictHostKeyChecking=no \
    /tmp/lca-deployment/* \
    ec2-user@$EC2_IP:/tmp/

echo "✅ Files uploaded"
echo ""

echo "🚀 Step 3: Executing deployment on EC2..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ec2-user@$EC2_IP \
    'cd /tmp && chmod +x deploy-on-ec2.sh && ./deploy-on-ec2.sh'

echo ""
echo "============================================================================"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "============================================================================"
echo ""
echo "Database successfully deployed to:"
echo "  lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com:3306/lca_v3"
echo ""
