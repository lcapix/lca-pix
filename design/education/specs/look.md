# The look: shell, sidebar, headers, tables, tags

Every screen in `../screens/` uses this finish. It comes from Kavish's earlier "LCAPIX App v3" design, measured from its markup. Where that design used 10 or 11px text, the screens use 12px: nothing in the education app is under 12px.

Type: Inter Tight for UI, IBM Plex Mono for numbers, codes, units and small labels. Body 14/20 `#191C1B`. Secondary 13 `#3D4340`. Muted 12 `#5E6663`. Never `#858F8A` for text.

## 1. The app sits in a shell
- Page background `#E9ECEA`, padding 16.
- One "app shell" inside it: white, radius 28, 1px `#DFE3E0`, overflow hidden, shadow `0 30px 80px rgba(20,28,24,.10), 0 2px 6px rgba(20,28,24,.05)`, a row with the sidebar and the main area.
- Main area: background `#F4F5F3`, flex 1, column.

## 2. Sidebar
Structure and the many-projects behaviour are in `sidebar.md`. The finish:
- White, 256 wide, border-right 1px `#E3E7E4`.
- Current place or current nested item: background `#E5F1EA`, text `#006A44` 600, radius 10 (nested items keep the 2px left rule in `#006A44`).
- Other items: text `#3D4340` 500. Icons stroke `#3D4340`, current `#006A44`.
- Count pills: IBM Plex Mono 12/18, `#E5F1EA` on `#005537`.

## 3. Header bar (every page that is not a case)
- White, height 76, padding 0 24, border-bottom 1px `#E3E7E4`, items centred, gap 12.
- Left: breadcrumb 12/16 `#5E6663` above the title, Inter Tight 600 20/28 `#191C1B`.
- Right: search field (height 40, radius 10, `#F4F5F3`, 1px `#E3E7E4`, placeholder 14 `#5E6663`, 16px search icon), secondary buttons, then the one primary button.
- Optional status chip beside the title: pill, padding 2 10, radius 999, 12px 600, 6px dot. Saved `#E5F1EA` / `#006A44`. Unsaved `#FDF3E1` / `#8F5B00`.
- Case pages keep their own case header (case name, facts line, Case switcher, Run) and the tab row Tree · Inventory · Results · Write-up, with Compare at the right end.

## 4. Filter bar (under a header, when a page lists things)
- White, padding 12 24, border-bottom 1px `#E3E7E4`, gap 8.
- Filter pills: height 32, padding 0 12, radius 999, 1px `#D5DBD7`, white, 13px 600 `#191C1B`, then a count in IBM Plex Mono 12px at 80% opacity. Selected: background and border `#191C1B`, text white.
- Dropdown chips at the right: height 32, padding 0 12, radius 9, `#F4F5F3`, 13px `#191C1B`, small chevron.

## 5. Content area and cards
- Padding 16 24 or 20 24. Cards: white, radius 16, 1px `#E3E7E4`. No heavy shadows on cards.

## 6. Tables (build them as real `<table>` elements)
- Card radius 16, overflow hidden.
- Head row: `#F8FAF8`, border-bottom 1px `#ECEEEC`, padding 10 16, IBM Plex Mono 500 12/16, letter-spacing .08em, uppercase, `#5E6663`. Numeric columns right-aligned.
- Rows: padding 12 16, border-bottom 1px `#ECEEEC`. Selected `#F1F8F4`. Hover `#F8FAF8`.
- First cell: a 30 by 30 icon tile (radius 8), then the name (14 600 `#191C1B`) over a sub line (12 `#5E6663`).
  - Tile tints: material `#F2F4F2` / `#3D4340`; supplier `#E5F1EA` / `#006A44`; energy and transport `#E8F1FA` / `#0B5FA5`; custom `#F0EBF8` / `#5D4B8F`.
- Numbers: IBM Plex Mono 500 13/18 with the unit in the same string ("1.9 kg CO₂-eq", "0.80 kg"). Region codes mono 12 (GLO, US).

## 7. Source tags (wherever a factor, rate or value has a source)
- Pill: padding 0 8, radius 999, 12px 600, line height 18. The word is always there; the colour is never the only signal.
- Supplier `#E5F1EA` / `#006A44`. Regional `#E8F1FA` / `#0B5FA5`. Global average `#FDF3E1` / `#8F5B00`. Entered by hand `#F0EBF8` / `#5D4B8F`. Reference (a static rate) `#F2F4F2` / `#3D4340`.
- Under a source name: source 13px `#191C1B`, the tag below it with a 2px gap.
- Use only these five words. Never "Industry average".

## 8. Inspector (the panel for a selected thing)
- White, padding 18, column gap 14.
- Head: 44 by 44 icon tile (radius 12), title Inter Tight 600 17/24, sub 12 `#5E6663`.
- Big value: Inter Tight 600 32/38 `#191C1B`, the unit in IBM Plex Mono 13/18 `#5E6663`, baseline aligned. Then the source tag.
- Key and value list: two columns, gap 8 14, 13px; keys `#5E6663`, values `#191C1B` (years and codes in mono).
- Section label: IBM Plex Mono 500 12/16, .08em, uppercase, `#5E6663`.
- List rows: 13px, padding 6 0, border-bottom 1px `#ECEEEC`, the value on the right in mono.
- Callout: padding 12 14, radius 12, `#FDF3E1`, 1px `#ECD29A`, 13px, a bold lead-in, and a dark button (height 32, padding 0 12, radius 9, `#191C1B`, white 13px 600).
- On the case Tree tab the inspector floats over the canvas: see `canvas.md`, "The step panel".

## 9. Buttons
- Primary: height 40, padding 0 16, radius 10, `#006A44` (hover `#005537`), white 14px 600, optional 16px icon with gap 8. One per screen.
- Secondary: height 40, padding 0 14, radius 10, white, 1px `#D5DBD7`, 14px 500 `#191C1B`.
- Icon button: 38 by 38, radius 10, 1px `#E3E7E4`, white. Always with an accessible name.
- Dark small button: see the callout above.

## 10. Case pages: phase and next-step chips
- Phase pill: height 34, padding 0 12 0 6, radius 999, 13px, a 22px circle with a mono numeral.
- NEXT chip: height 34, padding 0 6 0 12, radius 999, `#FDF3E1`, 1px `#ECD29A`, 13px; lead "NEXT" in IBM Plex Mono 600 12px .08em `#8F5B00`; ends in a 24px white circle with a chevron.

## 11. Magic Insights (case pages, bottom left of the main area; not on Results, which shows it in its panel)
- Floating pill: height 40, padding 0 14 0 6, radius 999, `#141816`, 1px `#2B3530`, white 13px 600, shadow `0 10px 24px rgba(20,28,24,.24)`.
- Left: a 28px mint `#5DDDA1` circle with a dark spark icon. Right: an optional count badge, mint, `#141816` text, IBM Plex Mono 12.

## 12. Pills for things that are not built
All the same shape: height 22, padding 0 8, radius 6, IBM Plex Mono 12/16 600, letter-spacing .04em, uppercase.
- COMING SOON: `#FDF3E1`, 1px `#ECD29A`, text `#7A4D00`, followed by one line of 13/18 `#3D4340`. At most once per screen.
- IN DEVELOPMENT (Enterprise only): `#ECEEEC`, 1px `#D5DBD7`, text `#3D4340`.
- BETA (Guided mode only): `#E8F1FA`, 1px `#B9D3EC`, text `#0B5FA5`.

## 13. Status colours
Success `#006A44` on `#F1F8F4`. Warning `#7A4D00` on `#FDF3E1`, border `#ECD29A`. Error `#BA1A1A` on `#FDECEB`, border `#F2C7C3`. Info `#0B5FA5` on `#E8F1FA`.
Chart colours in order: `#006A44`, `#0B5FA5`, `#A66B00`, `#9C3D5C`, `#5D4B8F`, `#2B7A8C`, other `#6B7470`.
