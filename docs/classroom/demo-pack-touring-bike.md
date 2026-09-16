# Demo pack: touring bike from a small US frame shop

Three documents, each shaped like the real export it stands for, build one complete case. They load from **Import → Load a sample** in this order: routing, BOM, equipment list. Every number below traces to a source opened on 2026-09-15 (full table: `research/bike-demo-data-2026-09-15.md`).

Status codes: **V** verified (the exact figure is in the source), **C** converted by unit arithmetic only, **I** inferred (needs a named assumption).

## 1. Routing (ERP routing export)

Columns: Op No, Operation, Department, Work Center, Setup Hrs, Run Hrs, Base Qty, Tooling. It builds the tree: product → department → work center → operation.

- **Hours** are the shop's own routing standards (illustrative, not sourced). Setup is per lot, so it stays out of per-unit labor unless a lot size is entered.
- **Cure coating** runs in batches of 2 frames (Base Qty 2): the oven fits 2 frames (V, Myth Cycles). Warm-up is ~20 min (V) and the cure is 10 min at 200 °C (V, Tiger Drylac TDS). About 10 more minutes let thin tubes reach metal temperature (I), and loading takes a few more, so the step takes 0.8 h per batch, 0.4 h per frame (I).
- **Labor** = hours × BLS OEWS mean wage for the occupation (welders 51-4121, assemblers 51-2090, production workers 51-0000). These are direct wages, not a loaded shop rate.

## 2. Bill of materials (Oracle-style BOM export)

Columns: Item, Description, Material, Qty Per, UOM, Unit Weight (kg), Unit Cost, Op Seq. **Op Seq** is the step that consumes the line (real Oracle and Epicor BOMs carry it), so each line lands on its step automatically.

| Line | Mass | Status | Source |
|---|---|---|---|
| Frame tube set, 6061-T6 | 2.2 kg | I | midpoint of maker frame weights 1.7 kg (Kinesis Tripster AT) and 2.6 kg (Velotraum Finder) |
| TIG filler rod ER4043 | 0.04 kg per frame | I | 1.5 m of weld × 16 to 37 g/m (Lincoln fillet data, scaled for aluminum) |
| Argon shielding gas | 0.24 kg per frame | I | 18 cfh (V) × ~17 min gas-on × 1.6908 kg/m³ (V, NIST); 1.8% of bike mass, so it fails a 1% mass cut-off and is kept as a line |
| Powder coat | 0.045 kg | I | 0.40 m² frame at 70 µm, 11.1 m²/kg at 60 µm (V, TDS), 92.5% utilization with reclaim (V, EPA AP-42 4.2.2.12) |
| Front / rear wheel (no tire) | 0.96 / 1.11 kg | I | Velocity Dyad rim 535 g (V), VO hubs 160 / 317 g (V), 36 DT spokes and nipples |
| Tire 37-622 | 0.74 kg each | C | Schwalbe Green Marathon |
| Inner tube | 0.15 kg each | V | Schwalbe Tube 17 |
| Fork, 4130 steel | 1.02 kg | V | Surly LHT spec |
| Chain | 0.277 kg | V | KMC X9 |
| Crankset | 0.769 kg | V | Velo Orange Grand Cru triple |
| Handlebar | 0.322 kg | V | Salsa Cowchipper 44 cm |
| Saddle | 0.52 kg | V mass | Brooks B17; **modeled as Plastic, a proxy** (the library has no leather factor) |
| Pedals (pair) | 0.38 kg | V | Shimano PD-M520 |
| Brake calipers (2) / rotors (2) | 0.154 / 0.133 kg each | V | TRP Spyre, Shimano SM-RT56 |
| Derailleurs and shift levers | 0.926 kg | C | RD-T6000 + FD-R3000 + ST-R3000; aluminum assumed as the main material |
| Other parts, by difference | 2 × 1.23 kg | I | 13.3 kg complete Trek 520 (V) minus the 10.84 kg listed; split half aluminum (stem, seatpost, racks), half steel (cassette, headset, bottom bracket, cables) |
| Bike box, corrugated | 3.36 kg | C | Uline S-4878, 7.40 lb |

**Unit costs are illustrative**, round shop prices, not market quotes.

## 3. Equipment list (maintenance asset register)

Energy per step = rated kW × typical load × the step's hours per unit (routing), the standard estimate when machines are not sub-metered. Electricity is costed at 8.62 ¢/kWh (V, EIA Electric Power Monthly Table 5.3, 2025).

| Machine | Rated | Load | Status | Basis |
|---|---|---|---|---|
| Cold saw 275 mm | 1.1 kW | 50% | C / I | JET CS-275, 1.5 hp; idles between cuts |
| TIG welder 210 A | 5.6 kW | 8% | V / I | Miller Dynasty 210 at rated output; arc on ~17% of weld time (13 of 78 min) at ~half of rated output (2.7 kW at 125 A, V) |
| Powder booth fan | 5.6 kW | 75% | C / I | RTT RPB-08-07, 7.5 hp; fan on for the whole booth step (upper bound) |
| Batch cure oven, 2 frames | 5.0 kW | 62% | V / I | Myth Cycles 5 kW; 2.5 kWh per 0.8 h batch (full power during warm-up, ~50% during cure) |

## 4. By hand in the demo

- **Transport** (EN 15804 A2): an ocean leg for the purchased parts, Kaohsiung to Long Beach, 11,658 km (V, Fluent Cargo; 4.1% over the great-circle distance). Use the transport-leg calculator on the step that receives the parts: tonnes × km.
- **Argon** has no factor in the library, so its line is held at review. Name the gap in the boundary notes, or pick a proxy and say so.

## Expected result (verified 2026-09-15, run #169)

TRACI 2.1, US grid, with the 11,658 km ocean leg for the frame tubes on step 10: **88.73 kg CO₂e per bicycle**. Hand check: aluminum 8.245 kg × 8.6 = 70.9; rubber 5.07; steel 4.80; cardboard 3.15; stainless 1.64; plastic 1.30; electricity 3.667 kWh × 0.35 = 1.28; ocean freight 25.65 tkm × 0.012 = 0.31; epoxy 0.27.

By step: final assembly 41.6, wheels 22.9, frame tubes 19.3, box 3.15, powder coat 0.86. Aluminum is about 80% of the total; shop electricity is under 1.5%.

**Swap A, steel frame (verified, case 207):** duplicate the base, open step 10, edit the aluminum line, swap to Steel and set 2.34 kg (Surly LHT 58 cm, V). Result **74.25 kg CO₂e**, 16.3% lower; only step 10 moves (19.3 → 4.81). For a careful swap, also set the ocean leg to 0.00234 t (it changes the result by 0.02 kg).

**Swap B, EU grid (verified, case 208, run 172):** duplicate the base, open Run Assessment and set Region to Europe. Result **88.33 kg CO₂e**, 0.45% lower (electricity 3.667 kWh at 0.242 instead of 0.350). The contrast with swap A is the teaching point: the material moves 16%, the grid under half a percent.

**Exports (verified):** PDF and PPTX both return from a results page (about 21 KB and 171 KB).

## Known limits (say them in the demo)

- Materials carry a climate-change factor only, so acidification and smog reflect electricity and freight only.
- The 2.46 kg of parts by difference and the saddle proxy are the largest modeling assumptions.
- Offcuts from mitering and rod stubs are not modeled.
