# Public welcome page implementation plan

Goal: Restyle `/` as the welcome-back photo collage, with destination imagery, "THE WORLD AWAITS", and an "ENTER" action.

Architecture: Share the existing `WelcomeScreen` layout through a start-page variant. Keep navigation and animation in the existing `EnterTransition` and `WelcomeTransitionProvider`. Preserve returning-user personalization.

Stack: Next.js App Router, React, Tailwind, Motion, existing editorial image library.

Spec: User approved destination photos in the existing collage composition and THE WORLD AWAITS. Their latest choice replaces YES PLEASE with ENTER. Entry still opens `/home`. Respect saved theme and reduced motion.

## Tasks

- [ ] Independently test the public entry and returning-user screen, with a failing run before implementation.
- [ ] Add the start variant to the shared layout and reuse the unchanged entry action. Reuse registered destination images and their existing attribution.
- [ ] Render the public variant from `/`; preserve signup and returning-user routes.
- [ ] Check desktop and narrow browser layouts, theme switching, and entry to Home.
- [ ] Run format, format:check, lint, TypeScript, the full frontend suite on Node 24, and the production build. Review the final diff.

## Review focus

The longer button label must fit. Headline must remain legible over photos. Phone layouts must keep the action and theme control reachable. Reduced motion must bypass the takeover. Returning-user ENTER and personalized name must remain intact.
