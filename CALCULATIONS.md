# How LCAPIX calculates an impact assessment

This document describes the engine as it is (2026-09-30): `lib/lca-engine.ts`,
`lib/units.ts`, `lib/factor-selection.ts` and `lib/run-snapshot.ts`, and the
factor data written by the root migrations `migrate-009` to `migrate-029`.
Every number in the worked example (section 12) is reproduced by
`tests/lib/calculations-doc-example.test.ts`. If the engine changes, that test
and this document change together.

---

## 1. The formula

For one impact category *c*, method *m* and region *r*:

```
Impact_c = Σ_flows  quantity_in_factor_unit(flow) × CF(substance, c, m, r) × allocation_share(step)
```

- `CF` is `driver_impact_factors.factor_value` for the flow's substance.
- `quantity_in_factor_unit` is the flow quantity expressed in the unit the
  factor is stated per (section 4). A flow that cannot be expressed in that
  unit is left out and named; it is never multiplied raw.
- `allocation_share` is 1 unless a step or one of its parents is allocated
  (section 6).

That is the whole engine: a sum of quantity × characterization factor. There
is no "Base driver × Π secondary drivers" formula (the one in the migration
planning notes). Process templates (migrate-022/023) multiply
`amount_per_driver × driver quantity` when a template is added to a step, and
the result is stored as an ordinary flow quantity.

Totals are summed per step, then across steps into the case total, per
category. A result per functional unit is the case total × a scale (section 7).

## 2. Which factor row is used

Factor rows are keyed by (substance, category, method, geographic scope).

1. **Method.** Only rows whose `method_name` equals the run's method
   (`CML 2001` by default, else the project's `lcia_method`: `CML 2001`,
   `TRACI 2.1` or `ReCiPe Midpoint (H)`). Rows moved to `QUARANTINE: <method>`
   by migrate-017/024 never match.
2. **Region.** The run's region is canonicalized first (`US Grid`, `us`,
   `United States` → `US`; `EU Average`, `EU`, `Europe` → `EU`; `Global`,
   `Global average` → `Global`; any other code passes through, e.g. `DE`). Rows
   for that region and `Global` rows are both fetched.
3. **One row per flow × category.** `selectBestScopeRows` keeps exactly one:
   the exact-region row when it exists, otherwise the Global row. Summing both
   would double count.

Today only Electricity (and its synonym "Electricity, grid mix") has regional
rows: US 0.350 (eGRID 2023), EU 0.242 (Ember EU-27 2023), Global 0.473
(Ember 2024) kg CO2 eq/kWh. The data-quality statement says which substances
used a regional factor and how many contributions fell back to Global.

## 3. Direction rule (`factor_basis`)

- `embodied`: the factor describes producing or supplying the substance
  (materials, fuels, electricity, transport, water supply). It is applied to
  **input** flows only.
- `elementary`: the factor describes emitting or treating the substance
  (CO2, CH4, NOx, waste, wastewater, every lciafmt TRACI row). It is applied
  to **output** flows only.
- No basis (a database without migrate-009): applied in both directions, and
  the run warns.

A steel **output** therefore adds nothing (steel's factor is embodied), and a
CO2 **input** adds nothing (CO2's factor is elementary). A flow whose only
factors point the other way is listed as uncharacterized.

## 4. Units

All unit reading goes through `lib/units.ts`. The engine, the flow routes'
save-time check (`convertQuantity(1, unit, substance.unit)`), ingest mapping
and the flow editor share one normaliser. `tests/lib/unit-agreement.test.ts`
checks that the save-time validator and the engine agree on acceptance and
quantity for 215 spellings × 15 substance units.

### 4.1 The factor's basis

A factor is stated **per** a unit:

- If the factor's unit label has a denominator (`kg CO2 eq / MMBtu`), that
  denominator is the basis. It must be in the same unit family as the
  substance's unit. If it is not (a per-kg factor on an MMBtu fuel, a per-kg
  factor on an m3 substance), the flow is **excluded** from that category with
  a warning, because the factor row was written for a different kind of
  quantity. If the family matches but the unit differs (`/ t` on a kg
  substance), the flow is converted to the denominator.
- A bare label (`kg CO2 eq`) means "per the substance's unit".

### 4.2 Expressing the flow in the basis unit

In order:

1. **Quantity.** A quantity that is not a finite number (NULL, `''`, `'abc'`,
   `'12abc'`, NaN) is **skipped** in every category, with one warning per flow.
   It is counted in `invalid_quantity_flows` and in the data-quality statement.
   It never turns a category total into NaN.
2. **No unit on the flow:** excluded, with a warning. The unit is not assumed.
3. **Same unit:** used as-is, including units the table does not hold (`p`
   and `p`). Same means equal after normalisation (4.3), ignoring letter case,
   except that a flipped m/M is never the same unit (`Mt` vs `mt`, `ML` vs
   `ml`).
4. **Both units known, same family:** converted. The conversion is recorded
   on the contribution (`1 kWh = 0.00341… MMBtu`) and counted in the
   data-quality statement.
5. **Anything else is excluded with a warning:** an unrecognized unit, an
   ambiguous unit, or two different families (kg → kWh). There is no fallback
   that multiplies the raw quantity.

An excluded flow still counts as characterized (it has a factor). It is
counted in `excluded_flows` (flow × category pairs) and named in the warnings.

### 4.3 Normalisation and ambiguity

- Unicode is NFKC-folded (`m³` → `m3`, `ｋｇ` → `kg`). The multiplication
  dots `·` `⋅` `∙` `•` `×` become `*`, `m^3` becomes `m3`, spaces around `*`
  and `-` are dropped, and whitespace (including no-break spaces) collapses.
- Letter case is ignored, except for the SI m/M prefix, where case sets the
  magnitude: `mg` vs `Mg`, `mL` vs `ML`, `MWh` vs `mWh`, `MJ` vs `mJ` are 10^9
  apart. The wrong-case spellings (`Mg`, `MG`, `ML`, `mwh`, `mj`) are rejected
  as ambiguous.
- `ton`/`tons` are rejected: US sources (EPA WARM, EIA) mean a short ton
  (907.18474 kg), while the legacy flow editor stores `ton` meaning a metric
  ton. `mt` is rejected (metric ton or megatonne). Write `short ton`, `st` or
  `t`.

### 4.4 Unit table (base unit of each family)

| Family | Base | Spellings (factor to base) |
|---|---|---|
| mass | kg | kg, kilogram(s); g, gram(s) 0.001; mg 1e-6; t, tonne(s) 1000; lb, lbs 0.45359237; oz 0.028349523125; short ton(s), st 907.18474 |
| energy | kWh | kWh; Wh 0.001; MWh 1000; MJ 1/3.6; GJ 1000/3.6; kJ 1/3600; Btu 0.000293071; MMBtu 293.071; therm 29.3071 |
| volume | m3 | m3; L, liter, litre 0.001; mL 1e-6; gal 0.003785411784; Tgal 3.785411784; ft3, cf, scf 0.028316846592; ccf ×100; Mcf, Mscf ×1,000; MMcf, MMscf ×10^6 (of 0.028316846592) |
| transport | tkm | tkm, tonne-km, tonne*km, t-km, t*km; kg*km, kg-km 0.001 |
| time | h | h, hr, hour; min 1/60; s 1/3600 |
| area | m2 | m2; ft2 0.09290304 |
| count | units | unit(s), pcs, piece(s), ea, each, item(s) (count ↔ count only) |

Cubic-foot conversions are geometric. `scf` and the m3 basis of the Natural
Gas factor are both standard-condition volumes. See 11.2 for the heat-content
question behind that factor.

## 5. Result units and consistency checks

- A category result is labelled with the factor's **numerator**
  (`kg CO2 eq / MMBtu` → `kg CO2 eq`), not the category's default unit. Units
  are method-specific: TRACI eutrophication is kg N eq, CML is kg PO4 eq.
- If one step's contributions to a category carry different reference units,
  the run warns that the total is not comparable. It warns the same way when
  steps report one category in different units.

## 6. Allocation (ISO 14044 4.3.4)

`component.allocation_factor` (0 < share ≤ 1) is the share of a step's burden
assigned to this product. The effective share of a step is its own share ×
every ancestor's share, so 0.5 on a machine line and 0.5 on a process below it
give 0.25. A missing, zero, negative or >1 share counts as 1. A parent cycle
is cut off at depth 64. The engine multiplies the step's category impacts and
every contribution by the effective share, and records the share on each
contribution.

## 7. Result per functional unit (ISO 14044 4.2.3.2)

```
result per FU = case total × reference_flow / modeled_output
```

`reference_flow` is the amount of product that fulfils one functional unit.
`modeled_output` is the amount of product the case's entered data produce:
1 for a per-unit model, 52,000 for a year of plant data. Blank or non-positive
values count as 1. The scale is frozen into the run snapshot's goal & scope.

## 8. Warnings and the data-quality statement (ISO 14044 4.2.3.6, 4.5.3.2)

Every run carries its warnings and a plain-language statement built from its
own contributions:

- **Sources.** The share of the Global Warming result by source tier:
  authoritative (published method or official dataset: lciafmt TRACI, IPCC,
  EPA, eGRID, Ember, EPD), industry average (worldsteel, PlasticsEurope, IAI,
  expired EPDs), unverified legacy, unknown.
- **Geography.** How many contributions used a Global factor on a regional
  run, and which substances actually had a regional factor.
- **Conversions**, **unit exclusions** and **skipped non-numeric quantities**,
  each counted.
- **Coverage per category, over input flows only.** For example:
  "Acidification covers 1 of 3 inputs: Aluminum, Cardboard have no
  acidification factor". Outputs are not counted on either side, because an
  emission only has factors in the categories it acts in.
- **Uncharacterized flows.** Flows with no applicable factor in the method add
  nothing, and are listed by name.
- **Allocation.** Which steps were allocated, and by how much.

Other warnings:

- **Possible double count.** A step has a fuel input (natural gas, coal, crude
  oil, fuel oil, LPG) and also a CO2/CH4/N2O output. The fuel factors are
  combustion factors, so the gas is already counted. Keep the output only if it
  is a separate process emission.
- **Parent with flows.** A step with steps below it should be the sum of
  those steps. Flows on the parent count, but the run says so.
- **Untyped factors** (no `factor_basis`).

`summary.total_flows_processed` counts flows that had at least one factor row
in the method, each flow once. `driver_flows_count` counts the flows that
contributed to at least one category.

## 9. GWP vintage per method

migrate-029 records this in `lcia_gwp_vintage`, read from the live rows.
Values below are from `lcapix_factors` on 2026-09-30.

| Method | Factor group | GWP set | Evidence |
|---|---|---|---|
| TRACI 2.1 | lciafmt GHG rows (migrate-015) | **IPCC AR4** | CH4 25, N2O 298, SF6 22800, HFC-134a 1430 |
| all three | EPA GHG Hub fuel rows: Coal, Wood, Fuel Oil, LPG (migrate-012/028) | **IPCC AR5** | CO2 + CH4×28 + N2O×265; Wood 93.8 + 0.2016 + 0.954 = 94.956 |
| CML 2001 | CH4, N2O | **IPCC AR5** | CH4 28 (migrate-009), N2O 265 |
| ReCiPe Midpoint (H) | CH4, N2O | **mixed** | CH4 28 (AR5, migrate-009), N2O 298 (AR4 / ReCiPe 2016 H) |
| all three | R-410A | **IPCC AR4** | 2088 = 0.5×675 + 0.5×3500 (AR5 would be 1924) |
| all three | Natural Gas per m3 | CO2 only | 53.06 kg CO2/MMBtu ÷ 28.263 m3/MMBtu = 1.877 |
| all three | Electricity | as published | eGRID/Ember CO2e intensities, not recomputed |

These are AR4 and AR5 values. None is AR6: AR6 GWP100 is CH4 27.0
(non-fossil) / 29.8 (fossil) and N2O 273. The previous version of this
document called 28/265 "AR6"; that was wrong.

**Open decision (not taken by any migration).** TRACI 2.1 mixes GWP sets: the
lciafmt rows are AR4 while the EPA fuel rows filed under TRACI 2.1 are AR5.
Either keep AR4 for TRACI and recompute the four fuel rows at AR4 (Coal 94.032,
Wood 95.053, Fuel Oil 74.214, LPG 61.964 kg CO2 eq/MMBtu, each within 0.2% of
today), or move TRACI's GHG rows to AR5 (CH4 25 → 28, a 12% change for methane
emissions). Until someone decides, a TRACI report should state "GWP100, IPCC
AR4 for emissions, AR5 inside the EPA fuel combustion factors". migrate-009
sets methane to 28 under every method. Re-applying it after migrate-015 would
change TRACI silently. The runner (section 13) never re-applies a recorded
file.

## 10. Factor sources in the library

| Substance(s) | Factor | Source (as cited in `source_reference`) |
|---|---|---|
| Electricity | 0.473 Global / 0.350 US / 0.242 EU kg CO2 eq/kWh | Ember 2024; EPA eGRID 2023; Ember EU-27 2023 |
| Natural Gas | 1.877 kg CO2/m3 | EPA GHG Emission Factors Hub 2025, 53.06 kg CO2/MMBtu ÷ 28.263 m3/MMBtu |
| Coal, Fuel Oil, LPG, Wood (fuel, MMBtu) | 94.012 / 74.203 / 61.953 / 94.956 kg CO2 eq/MMBtu | EPA Hub Table 1, CO2e at AR5 |
| Wood, dimensional lumber (kg) | 0.187 kg CO2 eq/kg | US EPA WARM v16, Exhibit 12-5: 0.17 MTCO2E/short ton ÷ 907.18474 |
| Steel, Aluminum, plastics, glass, paper, cardboard, concrete, electronics, PCB… | see rows | migrate-016/025: worldsteel, IAI, PlasticsEurope, EPA WARM v16, NGA and NRMCA EPDs (per-kg conversions in each row) |
| ~3,200 emission substances | TRACI 2.1 characterization | lciafmt TRACI 2.1 (US EPA, public domain), migrate-015 |
| CO2, N2O and other CML/ReCiPe seed rows | openLCA seed values | graded authoritative when the source names openLCA; rows whose source says "legacy pack" or "not yet verified" are graded unverified |

**Wood.** `Wood` is the fuel (MMBtu, ITAC stream E9). `Wood, dimensional
lumber` is the material (kg). Until migrate-028, migrate-016's lumber factor
(0.187) sat on the fuel substance and charged each MMBtu of wood fuel about
1/500 of its combustion CO2. The 94.956 is gross combustion. Its 93.8 kg CO2
is biogenic, so a study that reports biogenic CO2 as net zero must say so.

## 11. Data-quality limitations (state these in a report)

### 11.1 TRACI 2.1 factors are the emission-to-air values (audit E4)

`scripts/factor-import/build_traci_sql.py` keeps one factor per substance and
category, preferring the `emission/air` context. Of the 3,225 substances
migrate-015 imported, 3,223 are tagged `emission_air` and 2 `emission_water`
(Biological and Chemical Oxygen Demand). Flows carry no compartment. A
discharge to **water** therefore gets the **air** factor. That matters most
for eutrophication and freshwater ecotoxicity of N and P species: for example,
Phosphorus is characterized at 1.12 kg N eq/kg (its air value) whatever the
receiving compartment. TRACI's water-compartment values for N and P differ
from the air values, often by several times; the lciafmt source file is not
in the repository, so they are not quantified here. Until the import is done
per compartment, a report on water emissions should say that eutrophication
and ecotoxicity use emission-to-air factors.

### 11.2 Natural gas per m3: 28.263 m3/MMBtu (audit E7)

The Natural Gas factor is 53.06 kg CO2/MMBtu ÷ 28.263 m3/MMBtu = 1.877 kg
CO2/m3. 28.263 m3/MMBtu is 1,001.9 Btu per standard cubic foot. The EPA Hub's
own higher heating value is 1,026 Btu/scf, which gives:

| Heat content | m3 per MMBtu | kg CO2 per m3 | vs 1.877 |
|---|---|---|---|
| 1,001.9 Btu/scf (in use) | 28.263 | 1.877 | — |
| 1,026 Btu/scf (EPA Hub HHV) | 27.599 | 1.9225 | +2.4% |
| ~1,037 Btu/scf (EIA delivered average) | 27.307 | 1.943 | +3.5% |

Hand-entered natural gas in m3 (or scf/Mcf, which convert geometrically to
m3) is therefore probably **under-counted by 2.4 to 3.5%**. ITAC natural gas
in MMBtu is exact. Ingest converts it at the same 28.263 and the factor
converts it back, so 1 MMBtu = 53.05 kg CO2. The factor is also CO2 only: with
CH4 (1.0 g) and N2O (0.10 g) per MMBtu at AR5 it would be 53.11 kg CO2e/MMBtu,
0.1% more. The value is unchanged pending a decision. The fix would be 27.60
m3/MMBtu and the CO2e value.

### 11.3 Factor rows that disagree with their substance unit (audit E11)

The engine now refuses a factor whose denominator is in a different unit
family from the substance's unit. On `lcapix_factors` (2026-09-30), 2 of the
4,253 live rows are refused: CML 2001 Global Warming for **Water** and
**Wastewater**, stated `kg CO2 eq / kg` on m3 substances. Both are 0 (zeroed
by migrate-009 pending a sourced supply/treatment factor), so no total changes.
Such flows now show an exclusion warning instead of a silent zero.

The engine cannot see rows that have no denominator. **Coal's three
Acidification rows** (CML 0.008, ReCiPe 0.009, TRACI 0.0085 kg SO2 eq) come
from per-kg openLCA seeds. migrate-011 switched Coal to MMBtu and replaced
only its Global Warming rows, so these are now read **per MMBtu**. With
bituminous coal at about 36 kg/MMBtu that is roughly 36× low. They need a
human decision: quarantine them, or convert them with a stated coal heat
content.

### 11.4 Other

- **Mixed GWP sets** inside TRACI 2.1 and ReCiPe (section 9).
- **Pre-snapshot runs.** For runs made before `run_snapshot` existed, the
  results API rebuilds the per-flow table from today's data with simpler math:
  no unit conversion, no direction rule, no allocation. Only runs with a
  snapshot show the numbers the run actually used.
- **The fuel/gas double-count check** looks only at flows that have a factor
  in the method.

## 12. Worked example (CML 2001, Global)

Three steps of an electrode line. Each step's flows are distinct, and no step
models a fuel input together with its combustion gas.

**Step A: electrode drying oven.** Input: Electricity 250.5 kWh.

```
Global Warming      250.5 kWh × 0.473 kg CO2 eq/kWh        = 118.4865 kg CO2 eq
Resource Depletion  250.5 kWh × 0.0000054 kg Sb eq/kWh     = 0.0013527 kg Sb eq
```

The grid's emissions are inside the electricity factor. No CO2 output is
modeled for this step.

**Step B: curing vent.** Measured process emissions; no fuel is burned on this
step. Outputs: Carbon Dioxide 125.25 kg, Methane 2.5 kg (both `elementary`).

```
CO2   125.25 kg × 1   = 125.25
CH4     2.5 kg × 28   =  70.00   (IPCC AR5, the CML 2001 row)
Global Warming        = 195.25 kg CO2 eq
```

Under TRACI 2.1 the methane row is 25 (AR4): 62.50, and the step total is
187.75.

**Step C: wood-fired dryer burner.** Input: Wood (fuel) metered as 1,465.355
kWh, plus a steel line typed as `2 ton`.

```
Wood   1,465.355 kWh × (1 MMBtu / 293.071 kWh) = 5.000 MMBtu
       5.000 MMBtu × 94.956 kg CO2 eq/MMBtu     = 474.78 kg CO2 eq
Steel  '2 ton' is ambiguous (short or metric)   → EXCLUDED, warned
```

The conversion is recorded on the Wood contribution. The data-quality
statement reports "1 flow-category pair was left out because the unit could
not be converted". Enter the steel as `t` or `short ton` and it counts.

**Case total and per functional unit**

```
Global Warming = 118.4865 + 195.25 + 474.78 = 788.5165 kg CO2 eq
```

The data describe a batch of 400 electrodes. The functional unit is one
electrode (reference_flow 1, modeled_output 400):

```
788.5165 × 1 / 400 = 1.97129 kg CO2 eq per electrode
```

With region US the electricity row is eGRID's 0.350: 87.675 + 195.25 +
474.78 = 757.705 kg CO2 eq. With a 0.8 allocation share on Step A (the oven
also dries another product), Step A contributes 118.4865 × 0.8 = 94.7892.

## 13. Applying the factor migrations

Root migrations `migrate-0NN-*.sql` are applied in order by
`scripts/db/migrate.mjs` through the `mysql` CLI:

```
node --env-file=.env.local scripts/db/migrate.mjs --dry-run    # list pending
node --env-file=.env.local scripts/db/migrate.mjs --baseline   # existing DB: mark 009–025 applied, run nothing
node --env-file=.env.local scripts/db/migrate.mjs              # apply pending
```

It records each file in `schema_migrations` (filename, sha256, applied_at,
baseline) and never runs a recorded file again. It reports a recorded file
whose checksum changed instead of re-running it, and it refuses any host but
127.0.0.1/localhost/::1 unless `--allow-remote` is confirmed at a terminal.
migrate-028 runs in one transaction and ends with a unit guard that raises an
error, so nothing is committed, if a fuel or lumber factor disagrees with its
substance's unit.

## 14. Tests

| What | Where |
|---|---|
| Method/region query, Global fallback | `tests/lib/lca-engine.test.ts` |
| Unit exclusion (E3), non-finite quantity (E9), factor denominators (E11), flow counting and input coverage (E10) | `tests/lib/lca-engine-units.test.ts` |
| Unit table, aliases, normalisation, ambiguity, `toFactorBasis` | `tests/lib/units.test.ts` |
| Save-time validator ⇔ engine agreement on every spelling | `tests/lib/unit-agreement.test.ts` |
| One factor per flow × category, region canonicalization | `tests/lib/factor-selection.test.ts` |
| Source tiers, allocation, data-quality statement, goal & scope, snapshot | `tests/lib/iso-engine.test.ts`, `tests/lib/run-snapshot.test.ts` |
| This document's worked example | `tests/lib/calculations-doc-example.test.ts` |
| Migration runner (order, ledger, baseline, host refusal) | `tests/scripts/db-migrate.test.ts` |
| End to end on the local DB: region, grams, direction, warnings, allocation, Wood fuel 94.956, unit exclusions | `tests/e2e-local/engine-golden.local.test.ts` |
| migrate-028 values, idempotency and guard; migrate-029 vintages | `tests/e2e-local/migrate-028.local.test.ts` |

Run: `npx vitest run`. For the local-DB tests:
`set -a; source .env.local; set +a; LOCAL_DB=1 npx vitest run tests/e2e-local`.
