```markdown
# Design System Specification: Botanical Precision

## 1. Overview & Creative North Star: "The Digital Conservatory"
This design system is built on the concept of **Botanical Precision**. It rejects the sterile, flat nature of traditional SaaS dashboards in favor of an aesthetic that feels both scientifically exact and organically lush. We are moving away from "template" layouts toward a high-end editorial experience.

**The Creative North Star** is a space where high-density data meets premium atmosphere. We achieve this through:
*   **Intentional Asymmetry:** Breaking the 12-column grid with oversized "Display" type and offset containers.
*   **Lush Depth:** Moving beyond flat HEX codes to use vibrant, directional emerald gradients that mimic natural light hitting a leaf.
*   **Technical Elegance:** Pairing the humanist clarity of **Inter** with the mechanical rigors of **IBM Plex Mono** to signal "Data-Forward Professionalism."

---

## 2. Colors: Tonal Atmosphere & Gradient Soul
The palette is rooted in a soft, breathable off-white environment (`#f8faf8`), punctuated by deep, "living" greens.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Boundaries must be defined solely through background color shifts. Use `surface_container_low` sections sitting on a `surface` background to denote change. A container should never "stop" with a line; it should "settle" into a tone.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine, heavy-stock paper.
*   **Base Layer:** `surface` (#f8faf8)
*   **Sectioning:** `surface_container_low` (#f2f4f2)
*   **Interactive/Elevated:** `surface_container_lowest` (#ffffff)
*   **Functional Pop:** `surface_container_high` (#e6e9e7)

### The "Glass & Gradient" Rule
To escape the "standard" feel, use **Glassmorphism** for floating elements. 
*   **Floating Panels:** Use `surface_container_lowest` at 80% opacity with a `24px` backdrop blur.
*   **Signature Gradients:** All primary actions must use a linear gradient (135°) from `primary` (#006a44) to `primary_container` (#008558). This provides the visual "soul" and depth that flat green cannot achieve.

---

## 3. Typography: The Editorial Scale
We pair two distinct personalities to create a "Technical-Editorial" vibe.

*   **Inter (Humanist/Primary):** Used for all Display, Headline, and Title roles. Use tight letter-spacing (-0.02em) for `display-lg` to create a premium, "ink-trap" feel.
*   **IBM Plex Mono (Technical/Data):** Use this for `label-md`, `label-sm`, and all numerical data points. This font acts as the "precision" layer, signaling to the user that the information is calculated and trustworthy.

**Hierarchy Strategy:**
*   **High Contrast:** Use `display-lg` (3.5rem) immediately adjacent to `body-sm` (0.75rem). This extreme jump in scale is a hallmark of award-winning digital design.
*   **Data Density:** All numerical values in tables or charts should utilize IBM Plex Mono to ensure alignment and a "scientific" tone.

---

## 4. Elevation & Depth: Tonal Layering
Depth in this system is achieved through light and tone, never through heavy shadows or structural lines.

*   **The Layering Principle:** Place a `surface_container_lowest` (#ffffff) card on top of a `surface_container_low` (#f2f4f2) section. The contrast is subtle (2-3%), creating a soft, natural lift.
*   **Ambient Shadows:** When a true floating effect is required (e.g., Modals), use a "Botanical Shadow": `0px 24px 48px -12px` using `on_surface` at 6% opacity. It should feel like a soft glow rather than a drop shadow.
*   **The Ghost Border:** If a border is required for accessibility, use the `outline_variant` (#bccabf) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Precision Elements

### Buttons
*   **Primary:** Linear Gradient (`primary` to `primary_container`), white text, `md` (0.375rem) corner radius. Use a subtle inner-shadow (white at 10%) on the top edge to simulate a beveled, physical button.
*   **Tertiary:** No background. Use `primary` text with IBM Plex Mono for a "utility" feel.

### Cards & Lists
*   **Anti-Divider Policy:** Forbid the use of horizontal rules (`<hr>`). Use vertical white space (32px or 48px) or a subtle shift from `surface` to `surface_container_low` to separate content.
*   **Interactive Cards:** On hover, transition from `surface_container_lowest` to a very subtle gradient of `surface_container_lowest` to `primary_fixed` (at 5% opacity).

### Input Fields
*   **Styling:** Background of `surface_container_low`. Bottom border only, using `outline_variant` at 40%. On focus, the bottom border "blooms" into the `primary` gradient.
*   **Precision Labels:** Labels must use IBM Plex Mono in `label-sm` to maintain the data-forward aesthetic.

### Data Chips
*   **Style:** `full` (9999px) roundedness. Use `secondary_container` with `on_secondary_container` text. These should look like smooth, polished river stones.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins. A 64px left margin and a 128px right margin can make a dashboard feel like a luxury magazine.
*   **Do** use "oversized" emerald icons (24px to 32px) in `primary` to act as focal points in sparse layouts.
*   **Do** rely on IBM Plex Mono for any "changing" data to prevent layout shift and reinforce the precision theme.

### Don't:
*   **Don't** use pure black for text. Always use `on_surface` (#191c1b) to maintain the soft, organic feel.
*   **Don't** use "Standard" shadows. If the shadow looks like a default Figma effect, it is wrong.
*   **Don't** use 1px borders to separate table rows. Use alternating tonal stripes (`surface` and `surface_container_low`).

---

## 7. Signature Detail: The "Veridian Light"
Whenever a user completes a major action (e.g., "Success" state), do not just show a green checkmark. Use a radial gradient of `primary_fixed` (#7bfabb) at 20% opacity as a background "glow" behind the success message to simulate light passing through a leaf. This is the "Veridian Flow" in its purest form.