# Legacy design material

Design artifacts from earlier rounds. They used to sit at the repository root. Nothing in the app imports them; they are kept for reference.

| Folder | What it is |
|---|---|
| [`LCAPIX/`](LCAPIX/) | The Babel-in-browser React prototype (`LCAPIX Design.html`, `shared.jsx`, `pages-app.jsx`, `pages-landing.jsx`, `pages-misc.jsx`, `data.jsx`, `styles.css`) and its screenshots. Code comments such as "mirrored from LCAPIX/pages-misc.jsx" refer to these files. `LCAPIX.zip` at the root is an untracked copy of this folder. |
| [`review-screens/`](review-screens/) | Screenshots and `LCAPIX-Review.pdf` from a design review. `scripts/capture-review.mjs` writes here by default and `scripts/build-review-pdf.mjs` reads from here. |
| [`stitch_lcapix_design_system_prompts/`](stitch_lcapix_design_system_prompts/) | Stitch-generated mockups (one `code.html` + `screen.png` per screen) and the Veridian Flow `DESIGN.md`, referenced by the April 2026 plans in `docs/plans/`. |
