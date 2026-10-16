# Rules that hold on every screen

These came out of a UX audit of the screens (WCAG 2.2 AA, the ui-ux-pro-max rule set, the behaviour spec's acceptance checks and Kavish's product rules). The screens already follow them; the build must too.

## Words (use exactly these)
- Steel share: "89% comes from 10. Cut blank, almost all of it steel". Steel alone is 1.520 of 1.72, which is 88.4%, so never "89% comes from steel". Bar labels say "10. Cut blank", not "10. Cut blank · steel". How sure: "88% rests on one Global average, for steel", split "Global average 88.4% · Regional 11.6%".
- Step 30 is always "30. Powder coat and cure" (it may wrap to two lines), never "30. Coat and cure".
- Flow statuses: "Counted", "Counted, no climate factor", "Needs an amount", "Left out, unit can't convert". On the tree and on tab badges: "Needs an amount", "2 need an amount".
- Access: "Can change" and "Can read", everywhere, including the add-people form.
- Actions: "+ New project" and "+ New case", everywhere.
- Source tags: "Global average", "Regional", "Supplier", "Reference", "Entered by hand". Never "Industry average".
- Plain language, short sentences, no em dashes. No build notes in the UI.
- Copy a student reads avoids gendered words.

## Facts that must agree on every screen
| Thing | Value |
|---|---|
| Sample study | "Painted steel bracket", 1 bracket, TRACI 2.1 · US, Run #101, 1.72 kg CO₂-eq per bracket |
| What builds it | 10. Cut blank 1.538 (89.4%) · 30. Powder coat and cure 0.140 (8.1%) · 20. Weld tab 0.042 (2.4%) · 40. Pack and ship 0 |
| Steel | 0.80 kg × 1.900 = 1.520 kg CO₂-eq, worldsteel 2022, Global average (no US value) |
| Elena's own copy | "Elena Rivera's case", Run #102 |
| Class project | "Steel bracket · LCA 301": Base case Run #301 (1.72), Shorter cure cycle Run #302 (1.667, 3.1% lower) |
| Ana Ruiz | Run #214, 1.682, 2.2% lower, ticked as hand-in |
| Class progress | 32 student cases: 23 ran, 12 wrote up, 5 ticked as hand-in |
| Cost per bracket | $1.75 = 10. Cut blank 0.90 + 20. Weld tab 0.55 + 30. Powder coat and cure 0.21 + 40. Pack and ship 0.09 |
| Weld tab cost | $0.55 = 0.39 + 0.01 + 0.03 + 0.12 |
| Machine calculator | 0.75 kW × 8 s × 80% = 0.0013 kWh |
- Display totals: 2 decimals for a Base case, 3 for a comparative case. Percentages use the 2-decimal total.
- No invented people on the sample. The sample has no students.

## Controls (WCAG 1.4.11 non-text contrast 3:1, 2.5.8 target size)
- Text inputs, selects, amount boxes, calculator boxes, unticked checkboxes and the off track of a switch: border or track `#858F8A`. Not `#C4CCC7` or `#D5DBD7`.
- Checkboxes: a 20px box in a 24px hit area. Text links: a 24px tall hit area. Targets at least 24 by 24 on desktop, 44 by 44 on phones, 8px apart.
- Disabled controls: lower contrast plus a short visible reason ("Run this case first").
- Focus ring: 2px `#006A44` outline, 3px offset, on every control. Shown on `F1.2b`, `E03c` and `E08b`.
- Icon-only buttons (chevrons, close, drag handle, zoom, more, panel toggle) get an accessible name, for example "Collapse panel" or "More for Ana Ruiz".
- Colour is never the only signal: a dot or tint always has a word or an icon with it.
- First Tab stop on sign-up and log in is "Continue with Google".

## Patterns
- **Destructive actions** (remove the sample, remove a person, delete a step, the privacy switch that hides cases): a small confirm dialog with the consequence in one line, a danger button (`#BA1A1A` text on white, or white on `#BA1A1A`), Cancel, and afterwards an inline "Undo" line where the action happened. Never a toast over content. See `E08b-privacy-confirm.png`.
- **Busy**: the button shows a spinner and "Working…" and is disabled. See `F1.4-building-the-sample.png`.
- **Failure**: an inline error card (`#FDECEB`, 1px `#F2C7C3`, a `#BA1A1A` icon) with the cause, how to fix it, and "Try again". See `F1.4`, `F2.2b`, `F1.2b`.
- **Empty**: one line of what is missing, one action. See `F2.5-start-empty.png`.
- **Saved**: confirm on the line where the action happened ("✓ Saved · Steel 0.80 kg on 10. Cut blank"), or in a status line at the foot of the main area. No toasts over text or buttons.
- **One primary button per screen.**
- **Coming soon**: anything the backend does not do yet carries the COMING SOON pill and one line, at most once per screen. Never draw it as working.
- **Enterprise** shows only as IN DEVELOPMENT. Education and individual accounts get the same experience for now.
- **Guided mode** is a beta extra, off by default. Its control lives in two places only: the "Turn off" link in the guide line when it is on, and the "Guided mode" switch row in the sidebar foot above Help on every app screen. Today it can only be kept per device; saving it to the account needs a per-account beta field (backend). That is said once, as the single Coming soon line on `F1.3-about-you.png`.
- **Students** get lighter screens: no Add step, no Analytics, no People, no View menu. Hand-in is a tick that locks nothing. Grades stay in Canvas. Adding a person needs an existing account and sends no email.

## Testing
Every screen built from this folder gets an e2e test before it merges, in the e2e suite already on this branch (`e2e-tester/`, run with `pnpm test:e2e` there; tests live in `e2e-tester/tests/*.e2e.ts`). Start with exact checks (`screen`, `expect`), which need no model. Keep telemetry off (`E2E_TELEMETRY_DISABLED=1`, already set in the scripts).
