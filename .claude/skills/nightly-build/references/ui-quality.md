# UI quality bar

## Every screen
- **States:** loading, empty (with a next action), error (with recovery), success. Never a blank screen.
- **Accessibility (WCAG 2.1 AA):** every control reachable and usable by keyboard with a visible focus ring;
  real `<button>`/`<a>`/`<label>` elements; images have alt text; color contrast ≥ 4.5:1 for body text; form errors
  announced and tied to their field. If axe-core is available, run it: zero critical or serious violations.
- **Responsive:** usable at 375px wide with no horizontal scroll; tap targets ≥ 44px.
- **Performance:** first load LCP ≤ 2.5 s, layout shift CLS ≤ 0.1 (Lighthouse if available).
- **Console:** zero errors and warnings.

## Avoid the generic "AI app" look
Purple/indigo everything, gradients everywhere, max-rounded corners, oversized padding, stock hero + card-grid
layouts, heavy shadows, and lorem-ipsum copy all signal "generated". Instead: a small, deliberate palette and type
scale defined once as tokens; layouts driven by what the user needs first; realistic content in mockups and
fixtures. Use the project's existing components before creating new ones.

## Verify visually
Take screenshots of each acceptance step at desktop and 375px widths. Look at them: check alignment, overflow,
truncated text, and that the primary action is obvious. Fix what you see before marking the feature passing.
