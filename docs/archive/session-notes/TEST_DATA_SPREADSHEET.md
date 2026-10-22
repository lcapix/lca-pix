# Test Data - Spreadsheet View for PM Review

## USER DATA
| Field | Value |
|-------|-------|
| User ID | 1 |
| Username | john_doe |
| Email | john@lcaproject.com |
| Account Type | user |
| Status | Active |

---

## PROJECT DATA
| Field | Value |
|-------|-------|
| Project ID | 1 |
| Project Name | Electric Vehicle Manufacturing |
| Description | Life cycle assessment of EV battery production facility |
| Owner | john_doe (ID: 1) |
| Is Template | No |
| Status | Active |

---

## CASES DATA
| Case ID | Project | Case Name | Type | Parent Case | Description |
|---------|---------|-----------|------|-------------|-------------|
| 1 | EV Manufacturing | Baseline Production - 2025 | base | - | Current state with coal-based grid electricity |
| 2 | EV Manufacturing | Renewable Energy Scenario | comparative | Case 1 | Same production with 100% renewable electricity |

---

## COMPONENTS DATA (5-Level Hierarchy)

### Case 1: Baseline Production - 2025 (Coal-Based Grid)

| Component ID | Parent ID | Name | Type | Level | Quantity | Unit | Description |
|--------------|-----------|------|------|-------|----------|------|-------------|
| 1 | - | EV Battery Pack (60 kWh) | product | 1 | 1.0 | unit | Complete lithium-ion battery pack |
| 2 | 1 | Cell Assembly Line | machine_line | 2 | 1.0 | line | Automated assembly line |
| 3 | 2 | Electrode Coating Process | subprocess | 3 | 1.0 | batch | Coating electrodes |
| 4 | 3 | Drying Operation | operation | 4 | 1.0 | cycle | High temp drying |
| 5 | 4 | Oven Heating Task | elemental_task | 5 | 1.0 | task | Electric heating (coal-powered) |

**Hierarchy Visualization:**
```
Component 1: EV Battery Pack
    └── Component 2: Cell Assembly Line
        └── Component 3: Electrode Coating Process
            └── Component 4: Drying Operation
                └── Component 5: Oven Heating Task ← Flows attached here
```

### Case 2: Renewable Energy Scenario (100% Renewable Grid)

| Component ID | Parent ID | Name | Type | Level | Quantity | Unit | Description |
|--------------|-----------|------|------|-------|----------|------|-------------|
| 11 | - | EV Battery Pack (60 kWh) | product | 1 | 1.0 | unit | Complete lithium-ion battery pack - renewable energy production |
| 12 | 11 | Cell Assembly Line | machine_line | 2 | 1.0 | line | Automated assembly line powered by renewable energy |
| 13 | 12 | Electrode Coating Process | subprocess | 3 | 1.0 | batch | Coating electrodes with renewable energy |
| 14 | 13 | Drying Operation | operation | 4 | 1.0 | cycle | High temperature drying using renewable electricity |
| 15 | 14 | Oven Heating Task | elemental_task | 5 | 1.0 | task | Electric heating powered by 100% renewable energy |

**Hierarchy Visualization:**
```
Component 11: EV Battery Pack (Renewable)
    └── Component 12: Cell Assembly Line
        └── Component 13: Electrode Coating Process
            └── Component 14: Drying Operation
                └── Component 15: Oven Heating Task ← Flows attached here
```

---

## FLOWS DATA (Inputs & Outputs)

### Case 1: Flows for Component 5 (Oven Heating Task - Coal Grid)

| Flow ID | Component | Substance | CAS Number | Type | Quantity | Unit | Driver? | Description |
|---------|-----------|-----------|------------|------|----------|------|---------|-------------|
| 1 | Oven Heating Task | Electricity | N/A | INPUT | 250.5 | kWh | ✅ YES | Electric energy consumption for oven heating |
| 2 | Oven Heating Task | Carbon Dioxide | 124-38-9 | OUTPUT | 125.25 | kg | ✅ YES | CO₂ emissions from coal-based electricity generation |
| 3 | Oven Heating Task | Methane | 74-82-8 | OUTPUT | 2.5 | kg | ✅ YES | Methane emissions from energy production |
| 4 | Oven Heating Task | Water | 7732-18-5 | INPUT | 15.0 | m³ | ❌ NO | Process cooling water |

### Case 2: Flows for Component 15 (Oven Heating Task - Renewable Grid)

| Flow ID | Component | Substance | CAS Number | Type | Quantity | Unit | Driver? | Description |
|---------|-----------|-----------|------------|------|----------|------|---------|-------------|
| - | Oven Heating Task | Electricity | N/A | INPUT | 250.5 | kWh | ✅ YES | Electric energy consumption from 100% renewable sources (solar/wind) |
| - | Oven Heating Task | Carbon Dioxide | 124-38-9 | OUTPUT | 5.0 | kg | ✅ YES | CO₂ emissions from renewable electricity lifecycle (manufacturing, maintenance) |
| - | Oven Heating Task | Methane | 74-82-8 | OUTPUT | 0.1 | kg | ✅ YES | Trace methane emissions from renewable energy infrastructure |
| - | Oven Heating Task | Water | 7732-18-5 | INPUT | 15.0 | m³ | ❌ NO | Process cooling water (same for both cases) |

### Comparison: Coal vs Renewable Energy Emissions

| Substance | Coal Grid (Case 1) | Renewable Grid (Case 2) | Reduction | Reduction % |
|-----------|-------------------|------------------------|-----------|-------------|
| **Electricity Input** | 250.5 kWh | 250.5 kWh | 0 kWh | 0% (same consumption) |
| **CO₂ Output** | 125.25 kg | 5.0 kg | 120.25 kg | **96.0%** |
| **CH₄ Output** | 2.5 kg | 0.1 kg | 2.4 kg | **96.0%** |
| **Water Input** | 15.0 m³ | 15.0 m³ | 0 m³ | 0% (same process) |

**Key Insight**: Switching from coal to renewable energy reduces greenhouse gas emissions by 96% while maintaining the same energy consumption and process requirements.

---

## ASSESSMENT RUN DATA

| Run ID | Case | Run Name | Method | Status | Executed By | Run Date |
|--------|------|----------|--------|--------|-------------|----------|
| 1 | Baseline Production - 2025 | Q1 2025 Baseline Assessment | CML 2001 | completed | john_doe | 2025-01-15 14:30:00 |
| 2 | Renewable Energy Scenario | Q1 2025 Renewable Energy Assessment | CML 2001 | completed | john_doe | 2025-01-15 14:30:00 |

---

## ASSESSMENT RESULTS (Environmental Impacts)

### Case 1: Baseline Production - Coal Grid (Component 5)

| Result ID | Component | Impact Category | Impact Value | Unit | Source Substance |
|-----------|-----------|-----------------|--------------|------|------------------|
| 1 | Oven Heating Task | Global Warming | 125.25 | kg CO₂ eq | CO₂ (125.25 kg × 1.0) |
| 2 | Oven Heating Task | Global Warming | 70.00 | kg CO₂ eq | CH₄ (2.5 kg × 28.0) |
| 3 | Oven Heating Task | Ozone Depletion | 0.0425 | kg CFC-11 eq | N₂O equivalent |
| 4 | Oven Heating Task | Acidification | 87.675 | kg SO₂ eq | SO₂/NOₓ from coal |
| 5 | Oven Heating Task | Eutrophication | 16.275 | kg PO₄ eq | NOₓ from combustion |
| 6 | Oven Heating Task | Photochemical Oxidation | 3.50 | kg C₂H₄ eq | NOₓ emissions |
| 7 | Oven Heating Task | Resource Depletion | 0.001353 | kg Sb eq | Electricity (250.5 kWh × 0.0000054) |

**Total Global Warming Impact (Case 1)**: **195.25 kg CO₂ eq** (125.25 from CO₂ + 70.00 from CH₄)

### Case 2: Renewable Energy Scenario (Component 15)

| Result ID | Component | Impact Category | Impact Value | Unit | Source Substance |
|-----------|-----------|-----------------|--------------|------|------------------|
| - | Oven Heating Task | Global Warming | 5.0 | kg CO₂ eq | CO₂ lifecycle (5.0 kg × 1.0) |
| - | Oven Heating Task | Global Warming | 2.8 | kg CO₂ eq | CH₄ trace (0.1 kg × 28.0) |
| - | Oven Heating Task | Ozone Depletion | 0.0017 | kg CFC-11 eq | Minimal (96% reduction) |
| - | Oven Heating Task | Acidification | 3.5 | kg SO₂ eq | Manufacturing only (96% reduction) |
| - | Oven Heating Task | Eutrophication | 0.65 | kg PO₄ eq | Manufacturing only (96% reduction) |
| - | Oven Heating Task | Photochemical Oxidation | 0.14 | kg C₂H₄ eq | Minimal (96% reduction) |
| - | Oven Heating Task | Resource Depletion | 0.000135 | kg Sb eq | Renewable infrastructure (90% reduction) |

**Total Global Warming Impact (Case 2)**: **7.8 kg CO₂ eq** (5.0 from CO₂ + 2.8 from CH₄)

### Comparative Assessment Results: Coal vs Renewable

| Impact Category | Coal Grid (Case 1) | Renewable Grid (Case 2) | Reduction | Reduction % | Unit |
|-----------------|-------------------|------------------------|-----------|-------------|------|
| **Global Warming** | 195.25 | 7.8 | 187.45 | **96.0%** | kg CO₂ eq |
| **Ozone Depletion** | 0.0425 | 0.0017 | 0.0408 | **96.0%** | kg CFC-11 eq |
| **Acidification** | 87.675 | 3.5 | 84.175 | **96.0%** | kg SO₂ eq |
| **Eutrophication** | 16.275 | 0.65 | 15.625 | **96.0%** | kg PO₄ eq |
| **Photochemical Oxidation** | 3.50 | 0.14 | 3.36 | **96.0%** | kg C₂H₄ eq |
| **Resource Depletion** | 0.001353 | 0.000135 | 0.001218 | **90.0%** | kg Sb eq |

**Key Findings**:
- 🌍 **Climate Impact**: Renewable energy reduces global warming potential by 96% (187.45 kg CO₂ eq saved)
- 💨 **Air Quality**: Acidification and photochemical oxidation reduced by 96%
- 💧 **Water Quality**: Eutrophication potential reduced by 96%
- ♻️ **Resources**: 90% reduction in resource depletion (renewable infrastructure still requires materials)

---

## CALCULATION DETAILS

### Case 1: Global Warming Calculation (Coal Grid)

| Input Flow | Quantity | × | Impact Factor | = | Impact | Unit |
|------------|----------|---|---------------|---|--------|------|
| CO₂ output | 125.25 kg | × | 1.0 (kg CO₂ eq / kg CO₂) | = | 125.25 | kg CO₂ eq |
| CH₄ output | 2.5 kg | × | 28.0 (kg CO₂ eq / kg CH₄) | = | 70.00 | kg CO₂ eq |
| **TOTAL (Case 1)** | | | | | **195.25** | **kg CO₂ eq** |

### Case 2: Global Warming Calculation (Renewable Grid)

| Input Flow | Quantity | × | Impact Factor | = | Impact | Unit |
|------------|----------|---|---------------|---|--------|------|
| CO₂ output | 5.0 kg | × | 1.0 (kg CO₂ eq / kg CO₂) | = | 5.0 | kg CO₂ eq |
| CH₄ output | 0.1 kg | × | 28.0 (kg CO₂ eq / kg CH₄) | = | 2.8 | kg CO₂ eq |
| **TOTAL (Case 2)** | | | | | **7.8** | **kg CO₂ eq** |

**Difference**: 195.25 - 7.8 = **187.45 kg CO₂ eq saved** (96.0% reduction)

### Resource Depletion Calculation (Both Cases)

| Case | Input Flow | Quantity | × | Impact Factor | = | Impact | Unit |
|------|------------|----------|---|---------------|---|--------|------|
| Case 1 (Coal) | Electricity | 250.5 kWh | × | 0.0000054 (kg Sb eq / kWh) | = | 0.001353 | kg Sb eq |
| Case 2 (Renewable) | Electricity | 250.5 kWh | × | 0.00000054 (kg Sb eq / kWh) | = | 0.000135 | kg Sb eq |

**Difference**: 0.001353 - 0.000135 = **0.001218 kg Sb eq saved** (90.0% reduction)

**Note**: Renewable energy has a 10× lower resource depletion factor due to reduced mining/extraction requirements, though infrastructure manufacturing still consumes some resources.

### Why 96% Reduction in Emissions?

**Coal-Based Electricity (Case 1)**:
- Burning coal releases CO₂: ~0.5 kg CO₂ per kWh
- 250.5 kWh × 0.5 = 125.25 kg CO₂
- Additional methane from coal mining and combustion: 2.5 kg CH₄
- Total GWP: 195.25 kg CO₂ eq

**Renewable Electricity (Case 2)**:
- Solar/wind operations release no direct emissions
- Small lifecycle emissions from:
  - Manufacturing solar panels/wind turbines: ~0.02 kg CO₂/kWh
  - Maintenance and transportation: trace amounts
- 250.5 kWh × 0.02 = 5.0 kg CO₂ lifecycle
- Minimal methane from manufacturing: 0.1 kg CH₄
- Total GWP: 7.8 kg CO₂ eq

**Conclusion**: The 96% reduction demonstrates the dramatic environmental benefit of transitioning from fossil fuel-based electricity to renewable energy sources, even when accounting for the full lifecycle of renewable energy infrastructure.

---

## REFERENCE DATA (Already in Database)

### Permissions
| ID | Name | Description |
|----|------|-------------|
| 1 | owner | Full control over the project including deletion |
| 2 | admin | Can manage project settings and members |
| 3 | editor | Can edit project data but cannot manage members |
| 4 | viewer | Read-only access to project data |

### Impact Categories (8 total)
| ID | Name | Abbr | Unit | Description |
|----|------|------|------|-------------|
| 1 | Global Warming | GWP | kg CO₂ eq | Climate change impact |
| 2 | Ozone Depletion | ODP | kg CFC-11 eq | Ozone layer depletion |
| 3 | Acidification | AP | kg SO₂ eq | Acidification potential |
| 4 | Eutrophication | EP | kg PO₄ eq | Nutrient enrichment |
| 5 | Photochemical Oxidation | POCP | kg C₂H₄ eq | Smog formation |
| 6 | Human Toxicity | HTP | kg 1,4-DB eq | Toxic to humans |
| 7 | Ecotoxicity | ETP | kg 1,4-DB eq | Toxic to ecosystems |
| 8 | Resource Depletion | ADP | kg Sb eq | Resource depletion |

### Substances (13 total)
| ID | Name | CAS | Category | Unit |
|----|------|-----|----------|------|
| 1 | Carbon Dioxide | 124-38-9 | emission_air | kg |
| 2 | Methane | 74-82-8 | emission_air | kg |
| 3 | Nitrous Oxide | 10024-97-2 | emission_air | kg |
| 4 | Sulfur Dioxide | 7446-09-5 | emission_air | kg |
| 5 | Nitrogen Oxides | 11104-93-1 | emission_air | kg |
| 6 | Particulate Matter (PM2.5) | N/A | emission_air | kg |
| 7 | Electricity | N/A | resource | kWh |
| 8 | Water | 7732-18-5 | resource | m³ |
| 9 | Crude Oil | 8002-05-9 | resource | kg |
| 10 | Natural Gas | 8006-14-2 | resource | m³ |
| 11 | Coal | N/A | resource | kg |
| 12 | Wastewater | N/A | emission_water | m³ |
| 13 | Solid Waste | N/A | waste | kg |

### Driver Impact Factors (11 total)
| ID | Substance | Category | Factor | Unit | Source |
|----|-----------|----------|--------|------|--------|
| 1 | CO₂ | Global Warming | 1.0 | kg CO₂ eq / kg CO₂ | IPCC AR6 2021 |
| 2 | CH₄ | Global Warming | 28.0 | kg CO₂ eq / kg CH₄ | IPCC AR6 2021 |
| 3 | N₂O | Global Warming | 265.0 | kg CO₂ eq / kg N₂O | IPCC AR6 2021 |
| 4 | N₂O | Ozone Depletion | 0.017 | kg CFC-11 eq / kg N₂O | WMO 2018 |
| 5 | SO₂ | Acidification | 1.0 | kg SO₂ eq / kg SO₂ | CML 2001 |
| 6 | NOₓ | Acidification | 0.7 | kg SO₂ eq / kg NOₓ | CML 2001 |
| 7 | NOₓ | Eutrophication | 0.13 | kg PO₄ eq / kg NOₓ | CML 2001 |
| 8 | NOₓ | Photochemical Oxidation | 0.028 | kg C₂H₄ eq / kg NOₓ | CML 2001 |
| 9 | Electricity | Resource Depletion | 0.0000054 | kg Sb eq / kWh | CML 2001 - Electricity mix |
| 10 | Crude Oil | Resource Depletion | 0.02 | kg Sb eq / kg | CML 2001 - Crude oil |
| 11 | Coal | Global Warming | 2.42 | kg CO₂ eq / kg | IPCC - Coal combustion |



**Component Hierarchy:**
- [ ] Names accurately describe EV battery manufacturing process
- [ ] 5 levels provide sufficient detail for analysis
- [ ] Parent-child relationships make logical sense

**Flow Data:**
- [ ] Electricity consumption (250.5 kWh) is realistic
- [ ] CO₂ emissions (125.25 kg) align with coal electricity
- [ ] Methane emissions (2.5 kg) are in expected range
- [ ] Water usage (15 m³) is appropriate for the process

**Impact Calculations:**
- [ ] GWP total (195.25 kg CO₂ eq) is reasonable
- [ ] Characterization factors are correct (CH₄ × 28 = correct)
- [ ] All impact categories are calculated
- [ ] Values align with industry benchmarks

### ✅ Methodology Review

- [ ] CML 2001 method is appropriate for this assessment
- [ ] Driver flows correctly identified
- [ ] Non-driver flows properly documented
- [ ] Impact factor sources (IPCC AR6) are acceptable


