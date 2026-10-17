# Sidebar: stays calm with 10 or more projects

Screens: every app screen; the many-projects case is `../screens/d-project-pages/E19-many-projects.png` (switcher open with ten projects).

Kavish's words: "if we have like 10 trees this is gonna get cluttered. The nesting is beautiful, but figure out ways in which the navbar on this side doesn't look bad."

The answer: keep the nesting, but only for the one open project. Every other project is one line. The full list lives behind a switcher. Cases never appear in the sidebar.

## Order, top to bottom (256 wide, white, right hairline `#E3E7E4`, padding 20 14)
1. Logo row: the six-pixel mark (30px), "LCAPIX", and the sub line "Teaching and research".
2. Places: Home, Findings, Reports, Analytics (Analytics only for a project owner once people are in). Rows 34 tall, 18px icons, 13px 500 `#3D4340`. Current: `#E5F1EA`, `#006A44` 600, radius 10, `aria-current="page"`.
3. A 1px `#ECEEEC` divider with 8px above and below.
4. **Project switcher card** for the open project: white, 1px `#E3E7E4`, radius 12, padding 10 12, shadow `0 1px 2px rgba(20,28,24,.05)`. A 28px project tile (radius 8, the project's tint, initials), then the name (13px 600 `#191C1B`, one line, ellipsis) over a meta line (12px `#5E6663`, for example "34 cases · you own it", or a SAMPLE tag and "3 cases"), then an up-down chevron. Clicking opens the switcher. Optional shortcut hint "⌘P".
5. **The open project's pages, nested** under the card with an 18px indent and a 2px left rule (`#D5DBD7`, current `#006A44`): Overview, Cases (count pill), Compare, People (count pill, owner only).
6. **RECENT** label (IBM Plex Mono 500 12px, .08em, `#5E6663`), then at most 3 other projects, one line each, 32 tall: an 8px rounded square in the project's tint, the name (13px 500 `#3D4340`, ellipsis), and at the end only a small tag when needed (SAMPLE, or a 12px count). Never a second line, never nested pages. Hidden when there are no other projects.
7. "All projects" with the total in a mono count ("All projects 10 ›"), then "+ New project" (13px 600 `#006A44`).
8. Spacer, then the **Guided mode** row (the guide face, "Guided mode", the BETA pill, a switch; off by default), then Help, then the profile row (initials, name, institution).

Students: places are Home, Findings, Reports. The switcher card shows the shared project with "From Dr. Elena Rivera"; nested pages are Overview, Cases, Compare. Recent and All projects work the same. No "+ New project" at the top level (a small link lower down is fine).

## Long names
Always one line with an ellipsis in the sidebar. The full name shows in the switcher, in a tooltip and in the page header. The SAMPLE pill sits at the end of the row and never pushes the name to two lines.

## Switcher (opened from the card)
- 320 wide, white, radius 14, 1px `#E3E7E4`, shadow `0 18px 44px rgba(20,28,24,.16)`.
- Top: a search field (height 36, `#F4F5F3`, "Find a project").
- Groups with mono labels: PINNED, YOUR PROJECTS, SHARED WITH YOU, SAMPLE. Each row: tint square, name (one line), a 12px meta on the right (case count or "Run #301"), a tick on the current project.
- Foot: "+ New project" and "All projects ›".
- Keyboard: opens on Enter or Space, arrow keys move, typing filters, Esc closes and returns focus to the card.

## Project tints
In order: `#A7D3B8`, `#F0A68A`, `#F5C971`, `#7BB5E8`, `#C8B5E8`, then repeat. The sample always uses `#E5F1EA` with the SAMPLE tag.

## Phone
The sidebar folds away. See `../screens/e-student-and-phone/`.
