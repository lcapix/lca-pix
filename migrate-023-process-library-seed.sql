-- migrate-023-process-library-seed.sql  (idempotent; needs migrate-022)
--
-- The starting process library, in driver units.
--
-- What this is: for each common shop process, the unit its consumption should
-- be measured in (its DRIVER) and the list of what it draws. A student who has
-- no equipment list can still model a step properly, because the library tells
-- them what to go and find, in what unit, and where the number usually lives.
--
-- What this is NOT: a set of published per-process factors. We do not have
-- licensed process data, and inventing plausible kWh-per-minute numbers would
-- put unsourced figures inside student results. So every line states the
-- substance, the unit and where to read the amount off; amounts stay NULL and
-- are asked for when the template is used. The one exception is electricity
-- from a machine's nameplate, which is arithmetic the student does with us
-- (rated kW x hours x load) and already exists as the machine calculator.
--
-- When licensed or public process data is added later (USLCI is CC0), the
-- amounts can be filled in with their source_reference, and every case built
-- on a template keeps working.

INSERT INTO process_templates
  (template_name, process_family, driver_unit, driver_label, description, source_reference)
VALUES
  ('Laser cutting', 'cutting', 'min', 'Minutes of cutting time at the machine',
   'Cutting sheet or tube with a laser. Energy follows the cutting head and the chiller; the assist gas is consumed at a rate per minute of cut.',
   'LCAPIX process checklist. Amounts are entered from the machine in front of you: nameplate power for electricity, gas supplier data for assist gas.'),
  ('CNC machining', 'cutting', 'min', 'Minutes of spindle time',
   'Milling or turning. The spindle rarely runs at nameplate power; use the load factor from the machine or the equipment list.',
   'LCAPIX process checklist. Amounts entered by the user.'),
  ('MIG / TIG welding', 'joining', 'min', 'Minutes of arc-on time',
   'Arc-on minutes drive both the power draw and the shielding gas. Setup and idle time are not arc-on time.',
   'LCAPIX process checklist. Amounts entered by the user.'),
  ('Powder coating', 'finishing', 'm2', 'Square metres of coated surface',
   'Spray plus cure. The powder is consumed per square metre at the transfer efficiency of the booth; the oven draws power per batch, so divide the batch by the area it holds.',
   'LCAPIX process checklist. Amounts entered by the user.'),
  ('Heat treatment / curing oven', 'heat', 'h', 'Hours the oven runs',
   'An oven is a batch process: work out the energy per hour, then divide by the number of parts in a batch to get the amount per unit.',
   'LCAPIX process checklist. Amounts entered by the user.'),
  ('Injection moulding', 'forming', 'kg', 'Kilograms of polymer shot',
   'Energy per kilogram of polymer processed, plus the regrind or scrap rate of the tool.',
   'LCAPIX process checklist. Amounts entered by the user.'),
  ('Sheet forming / press', 'forming', 'unit', 'Parts pressed',
   'Press energy per stroke and the lubricant used per part.',
   'LCAPIX process checklist. Amounts entered by the user.'),
  ('Washing / degreasing', 'finishing', 'unit', 'Parts washed',
   'Heated washers draw energy continuously and consume detergent and water per part.',
   'LCAPIX process checklist. Amounts entered by the user.')
ON DUPLICATE KEY UPDATE
  process_family = VALUES(process_family),
  driver_unit = VALUES(driver_unit),
  driver_label = VALUES(driver_label),
  description = VALUES(description),
  source_reference = VALUES(source_reference);

-- The lines of each template. substance_id is resolved by name where the
-- catalog already holds the substance; where it does not, the hint tells the
-- student what to add. Re-running is safe: lines are cleared per template
-- first, so the seed is the single source of truth for a seeded template.
DELETE ptf FROM process_template_flows ptf
  JOIN process_templates pt ON pt.template_id = ptf.template_id
 WHERE pt.is_custom = 0;

INSERT INTO process_template_flows
  (template_id, substance_id, substance_hint, flow_type, amount_per_driver, unit, note, sort_order)
SELECT pt.template_id,
       (SELECT s.substance_id FROM substances s WHERE s.substance_name = v.substance LIMIT 1),
       v.hint, v.flow_type, NULL, v.unit, v.note, v.sort_order
FROM (
  SELECT 'Laser cutting' AS template, 'Electricity' AS substance, 'Electricity, kWh' AS hint,
         'input' AS flow_type, 'kWh' AS unit,
         'Nameplate kW x minutes / 60 x load. The machine calculator does this for you.' AS note,
         1 AS sort_order
  UNION ALL SELECT 'Laser cutting', 'Nitrogen', 'Assist gas: nitrogen or oxygen, m3 or kg', 'input', 'm3',
         'Flow rate at the head x cutting minutes. On the gas invoice or the machine settings.', 2
  UNION ALL SELECT 'CNC machining', 'Electricity', 'Electricity, kWh', 'input', 'kWh',
         'Spindle kW x minutes / 60 x load factor. Idle time counts at a lower load.', 1
  UNION ALL SELECT 'CNC machining', NULL, 'Cutting fluid or coolant, litres', 'input', 'l',
         'Top-up volume per period divided by the machine minutes in that period.', 2
  UNION ALL SELECT 'MIG / TIG welding', 'Electricity', 'Electricity, kWh', 'input', 'kWh',
         'Welder kW x arc-on minutes / 60. Duty cycle is not load: arc-on minutes already account for it.', 1
  UNION ALL SELECT 'MIG / TIG welding', 'Argon', 'Shielding gas: argon or an argon mix, m3', 'input', 'm3',
         'Gas flow rate (l/min) x arc-on minutes / 1000.', 2
  UNION ALL SELECT 'MIG / TIG welding', NULL, 'Filler wire or rod, kg', 'input', 'kg',
         'Spool weight divided by the arc-on minutes it lasts.', 3
  UNION ALL SELECT 'Powder coating', 'Electricity', 'Electricity, kWh', 'input', 'kWh',
         'Booth plus oven. Oven kW x cure hours, divided by the area cured in that batch.', 1
  UNION ALL SELECT 'Powder coating', NULL, 'Powder coating material, kg', 'input', 'kg',
         'Powder used per m2 at the booth transfer efficiency. Reclaimed overspray does not count twice.', 2
  UNION ALL SELECT 'Heat treatment / curing oven', 'Electricity', 'Electricity, kWh', 'input', 'kWh',
         'Oven kW x hours. Divide by the parts in a batch to get the amount per part.', 1
  UNION ALL SELECT 'Heat treatment / curing oven', 'Natural Gas', 'Natural gas, m3 or kWh', 'input', 'm3',
         'Only for a gas-fired oven. Meter reading per hour, or burner rating x hours.', 2
  UNION ALL SELECT 'Injection moulding', 'Electricity', 'Electricity, kWh', 'input', 'kWh',
         'Machine kWh per kg of polymer processed, from the machine log or a shot-weight estimate.', 1
  UNION ALL SELECT 'Injection moulding', NULL, 'Polymer, kg (the material you mould)', 'input', 'kg',
         'Shot weight x shots, including sprue and runner if they are not reground.', 2
  UNION ALL SELECT 'Sheet forming / press', 'Electricity', 'Electricity, kWh', 'input', 'kWh',
         'Press kW x cycle time / 3600 per part.', 1
  UNION ALL SELECT 'Sheet forming / press', NULL, 'Forming lubricant, kg or litres', 'input', 'kg',
         'Consumption per period divided by the parts pressed in it.', 2
  UNION ALL SELECT 'Washing / degreasing', 'Electricity', 'Electricity, kWh', 'input', 'kWh',
         'Heater kW x hours running, divided by the parts washed in that time.', 1
  UNION ALL SELECT 'Washing / degreasing', 'Water', 'Water, m3 or litres', 'input', 'l',
         'Bath volume divided by the parts washed before it is changed, plus top-up.', 2
  UNION ALL SELECT 'Washing / degreasing', NULL, 'Detergent or degreaser, kg', 'input', 'kg',
         'Dose per bath divided by the parts washed in it.', 3
) AS v
JOIN process_templates pt ON pt.template_name = v.template;
