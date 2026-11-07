# Jobwalay UI palette

The shared theme follows the supplied blue/green Jobwalay logo. The original PNG is stored unchanged at `public/brand/jobwalay-logo.png`; the header displays its symbol alongside a readable navy/green wordmark.

Theme tokens live in `src/app/globals.css` using Tailwind's `@theme` syntax. Use these semantic tokens instead of adding hardcoded teal utility classes:

| Role | Color |
| --- | --- |
| Brand navy / headings | `#052858` |
| Primary action / focus | `#0758D9` |
| Primary hover | `#0645AD` |
| Accessible green accent | `#00804A` |
| Decorative logo blue / cyan | `#005EE8` / `#00A8EE` |
| Decorative logo green / lime | `#00A65A` / `#54DC4B` |
| Main text / muted text | `#163452` / `#52647C` |
| Background / cards | `#F5F8FD` / `#FFFFFF` |

Bright cyan/lime are decorative accents. Text and controls use darker blue/green for contrast: white on primary blue is approximately 6.16:1, white on the accessible green 5.02:1, and muted text on the background 5.68:1. Existing red/amber error and warning meanings are retained. Keyboard focus, 44px shared controls, forced-color text fallback and reduced-motion preferences are supported.

The palette applies to shared buttons, inputs, badges, panels, navigation, public pages, candidate and recruiter dashboards, administration and company cover placeholders. Keep tenant-uploaded branding unchanged. Check desktop/mobile overflow and focus states when changing the theme.
