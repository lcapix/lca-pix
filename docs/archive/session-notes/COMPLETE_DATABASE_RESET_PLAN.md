# Complete Database Reset & Systematic Rebuild Plan

## Current State

**Project 6**: Nutroleum vs Vaseline - Petroleum Jelly Manufacturing LCA
- 2 cases (12: Nutroleum, 13: Vaseline)
- 248 components (124 per case - VERY COMPLEX)
- 360 flows total
- Status: Existing, unknown if correct

**Project 7**: Electric Vehicle Manufacturing
- 2 cases (17: Baseline Coal, 18: Renewable Energy)
- 10 components (5 per case - SIMPLE)
- 8 flows total
- Status: Just restored per TEST_DATA_SPREADSHEET.md

## Goal

Clean entire database and rebuild BOTH projects systematically with:
1. **Simple, understandable hierarchies**
2. **Clear documentation**
3. **Step-by-step explanation**

## Proposed Hierarchies

### Project 1: Electric Vehicle Manufacturing (SIMPLE - 5 levels)

**Case 1: Baseline Production - Coal Grid**
```
Level 1: EV Battery Pack (60 kWh) [PRODUCT]
  └─ Level 2: Cell Assembly Line [MACHINE/LINE]
      └─ Level 3: Electrode Coating Process [SUBPROCESS]
          └─ Level 4: Drying Operation [OPERATION]
              └─ Level 5: Oven Heating Task [ELEMENTAL TASK]
                  ├─ INPUT: Electricity (250.5 kWh)
                  ├─ OUTPUT: CO2 (125.25 kg)
                  ├─ OUTPUT: Methane (2.5 kg)
                  └─ INPUT: Water (15.0 m³)
```

**Case 2: Renewable Energy Scenario**
```
Same hierarchy structure, different emissions:
- CO2: 5.0 kg (96% reduction!)
- Methane: 0.1 kg (96% reduction!)
```

**Total Components**: 10 (5 per case)
**Total Flows**: 8 (4 per case)
**Key Metric**: 96% CO2 reduction with renewable energy

---

### Project 2: Nutroleum vs Vaseline (SIMPLIFIED - 5 levels)

Currently has 124 components per case - WAY too complex!

**Proposed Simple Structure:**

**Case 1: Nutroleum - Plant-Based Petroleum Jelly**
```
Level 1: Nutroleum Jar (3 oz) [PRODUCT]
  └─ Level 2: Manufacturing Line [MACHINE/LINE]
      └─ Level 3: Mixing & Heating Process [SUBPROCESS]
          └─ Level 4: Blending Operation [OPERATION]
              └─ Level 5: Heat & Mix Task [ELEMENTAL TASK]
                  ├─ INPUT: Plant-based oils (85 g)
                  ├─ INPUT: Electricity (12.5 kWh)
                  ├─ OUTPUT: CO2 (8.5 kg)
                  └─ OUTPUT: Wastewater (2.0 L)
```

**Case 2: Vaseline - Petroleum-Based Jelly**
```
Same hierarchy, petroleum sources:
- INPUT: Petroleum derivatives (85 g)
- OUTPUT: CO2 (45.2 kg) - MUCH HIGHER!
- Key finding: 81% more CO2 emissions than plant-based
```

**Total Components**: 10 (5 per case)
**Total Flows**: 8 (4 per case)
**Key Metric**: Plant-based alternative reduces CO2 by 81%

## Questions for You

1. **Do you want BOTH projects to be SIMPLE (5 levels, 5 components each)?**
   - Current Project 6 has 124 components per case (very complex)
   - I can simplify it to match the EV Manufacturing structure

2. **Should I delete EVERYTHING and start fresh?**
   - Clean Projects 6 and 7 completely
   - Rebuild both with simple, clear hierarchies
   - Document every step

3. **What test data do you actually need?**
   - Option A: Keep both as 5-level simple hierarchies (easy to understand)
   - Option B: Keep EV simple, make Nutroleum more detailed
   - Option C: Something else?

Let me know and I'll create the complete cleanup and restoration scripts!
