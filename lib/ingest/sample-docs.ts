// Bundled sample documents so a person with no file of their own can still
// walk the whole flow, and so the reference pane in the case editor shows the
// same document the importer reads. Inlined (not fetched) so they work offline
// and on Vercel. The header row doubles as the downloadable blank template.
// The three together are one demo product (a touring bike from a small US
// frame shop), each shaped like the real export it stands for:
//  - routing: an ERP routing (department, work center, setup / run hours,
//    base quantity for the batch oven);
//  - bom: an Oracle-style BOM (qty per, UOM, unit weight, unit cost, and the
//    Op Seq that says which step consumes each line, bulk consumables in kg);
//  - equipment: a maintenance asset register (rated power, typical load),
//    joined to the routing on the work center.
export const SAMPLE_DOCS: Record<string, { filename: string; content: string }> = {
  routing: {
    filename: 'sample-routing.csv',
    content: `Op No,Operation,Department,Work Center,Setup Hrs,Run Hrs,Base Qty,Tooling
10,Cut & miter frame tubes,Fabrication,SAW-01 Cold saw,0.5,0.3,1,Tube miter jig
20,TIG weld main triangle,Fabrication,WLD-01 TIG weld cell,1.0,0.8,1,Frame fixture A
30,Weld dropouts & bosses,Fabrication,WLD-01 TIG weld cell,0.4,0.5,1,Dropout jig
40,Powder coat frame,Finishing,PNT-01 Powder booth,0.6,0.4,1,Spray gun
50,Cure coating,Finishing,OVN-01 Cure oven,0.2,0.8,2,Frame rack
60,Build & true wheels,Assembly,WHL-01 Wheel bench,0.3,0.6,1,Truing stand
70,Final assembly,Assembly,ASM-01 Assembly bench,0.5,1.0,1,Torque tools
80,QA & pack,Assembly,PCK-01 Pack station,0.2,0.3,1,Box sealer`,
  },
  bom: {
    filename: 'sample-bom.csv',
    content: `Item,Description,Material,Qty Per,UOM,Unit Weight (kg),Unit Cost,Op Seq
FT-6061,Frame tube set 6061-T6,Aluminum,1,ea,2.2,85.00,10
FR-4043-A,TIG filler rod ER4043 (main triangle),Aluminum,0.03,kg,,9.50,20
AR-TIG-A,Argon shielding gas (main triangle),Argon,0.18,kg,,,20
FR-4043-B,TIG filler rod ER4043 (dropouts and bosses),Aluminum,0.01,kg,,9.50,30
AR-TIG-B,Argon shielding gas (dropouts and bosses),Argon,0.06,kg,,,30
PC-HYB,Powder coat epoxy-polyester hybrid,Epoxy resin,0.045,kg,,12.00,40
WH-F700,Front wheel 700c (rim hub spokes),Aluminum,1,ea,0.96,45.00,60
WH-R700,Rear wheel 700c (rim hub spokes),Aluminum,1,ea,1.11,55.00,60
TR-37,Tire 37-622 wired,Rubber,2,ea,0.74,15.00,60
TB-700,Inner tube 700c,Rubber,2,ea,0.15,4.00,60
FK-4130,Fork 4130 steel,Steel,1,ea,1.02,40.00,70
CH-9,Chain 9-speed 116 links,Steel,1,ea,0.277,18.00,70
CK-110,Crankset triple,Aluminum,1,ea,0.769,45.00,70
HB-44,Handlebar 44 cm 6061-T6,Aluminum,1,ea,0.322,22.00,70
SD-B17,Saddle,Plastic,1,ea,0.52,15.00,70
PD-520,Pedals (pair),Aluminum,1,pr,0.38,12.00,70
BC-MD,Brake caliper mechanical disc,Aluminum,2,ea,0.154,30.00,70
BR-160,Brake rotor 160 mm,Stainless Steel,2,ea,0.133,15.00,70
DT-9,Derailleurs and shift levers,Aluminum,1,set,0.926,60.00,70
OC-AL,"Other aluminum parts (stem, seatpost, racks), by difference",Aluminum,1,set,1.23,60.00,70
OC-ST,"Other steel parts (cassette, headset, bottom bracket, cables), by difference",Steel,1,set,1.23,45.00,70
BX-54,Bike box corrugated 54x8x28 in,Cardboard,1,ea,3.36,6.00,80`,
  },
  equipment: {
    filename: 'sample-equipment-list.csv',
    content: `Asset ID,Description,Work Center,Rated power (kW),Typical load (%)
EQ-101,Cold saw 275 mm,SAW-01 Cold saw,1.1,50
EQ-201,AC/DC TIG welder 210 A,WLD-01 TIG weld cell,5.6,8
EQ-301,Cartridge powder booth fan,PNT-01 Powder booth,5.6,75
EQ-401,Electric batch cure oven (2 frames),OVN-01 Cure oven,5.0,62`,
  },
}

export type SampleDoc = { filename: string; content: string };

/** What each sample is, for a reader choosing one. */
export const SAMPLE_LABELS: Record<string, string> = {
  routing: 'Routing: the steps, in order, with setup and run hours per step',
  bom: 'Bill of materials: what goes in, how much, and which step consumes it',
  equipment: 'Equipment list: rated power and typical load per work center',
};
