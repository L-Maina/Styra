# Styra v2 design language: Liquid Glass, Apple-level, and the voice

Status: draft 1 · 2026-11-20 · spec by the web/backend chat · **builder: Claude Code**.
Applies to the web app and the Flutter app, on every screen. The user left all design decisions to us ("i leave all decisions to you"), so everything below is decided; record any change in the blueprint's Decision log. Section 11 (wording and motto) is as binding as the visuals.

## 1. Mandate

- Every screen, web and mobile, is Liquid Glass at Apple level: glass on the functional layer, opaque content, one signature moment, working fallbacks, smooth on a mid-range Android phone.
- Words are design. Motto, tone, labels, errors and notifications follow section 11. No lorem, no placeholder copy, no string typed straight into a component.
- Use the skills in section 2. A screen is not done until the gate in section 12 passes.

## 2. Skills to use (the ones the user supplied)

| Skill | Source | Use it for |
|---|---|---|
| apple-design | github.com/dickwu/apple-design-skill (HIG pages are markdown in `references/hig/`) | Review every screen, both themes. No Critical or High finding stays open. Load: accessibility, layout, typography, color, designing-for-ios, liquid-glass, materials, tab-bars, toolbars, sheets, buttons, loading, feedback, onboarding, launching, motion, playing-haptics, writing, dark-mode, and `references/cross-platform.md` (Flutter and web). Fetch pages from `https://raw.githubusercontent.com/dickwu/apple-design-skill/main/references/hig/<page>.md`; don't review from memory. |
| frontend-design | Anthropic skill | Before building a surface, write a short plan (colour, type, layout, principles), check it against generic defaults, spend boldness in one place (section 6). |
| creative-dev | Anthropic skill | Framer Motion (already in the app) for glass morphs. GSAP, Lenis or Three.js only for the launch moment, and only if the budget in section 8 holds. |
| fatihaydost/brand-identity-skill | github.com/fatihaydost/brand-identity-skill | The identity kit is the source of truth for colour, type and logos. Change the kit first (`brand/`, PR #8), then `globals.css` and the Flutter theme. |
| higgsfield-ai/skills | github.com/higgsfield-ai/skills | Imagery and short motion for the welcome screen, empty states and the launch loop. Images ≤ 500 KB. Video muted, ≤ 6 s, with a poster frame, off under reduced motion. |
| Figma skills | figma-use, figma-generate-library, figma-generate-design, figma-implement-motion, figma-design-to-code | File `2BIULvjy2GGdJDJObPuBDZ`: glass styles and components for both themes, one frame per screen (390×844 and 1440×900), then build from `get_design_context`. Figma shows a frosted approximation; true refraction exists only in code. |
| Process skills | superpowers (TDD, verification-before-completion, writing-plans), supabase-postgres-best-practices, the Vercel skills (nextjs, shadcn, env-vars) | The non-visual build. |

If a skill isn't installed in Code's environment, fetch it from its repository.

## 3. What stays from the brand

Motto "Your Style, On Demand." · graphite (dark, default) and ivory (light) · violet-to-electric-blue gradient · Syne 700 for `h1`, `h2`, `.text-display`, Manrope for everything else · logos only through `BrandLogo`. Values (from `globals.css`): primary `#8780FD` dark / `#6C4EFF` light; secondary `#2F7BFF`; background `#121318` / `#F5F0E8`; foreground `#F2F3F5` / `#171C26`. `CLAUDE.md` sections "Motion and themes" and "Brand (web)" still apply to v2.

## 4. Rules of glass

1. **Two layers.** The content layer (cards, lists, forms, text, photos, money) is opaque. The functional layer floats above it: tab bar, top bar, sheets, menus and popovers, floating controls, toasts. Only the functional layer is glass.
2. **Never glass on glass.** Buttons inside a glass sheet are fills, not glass.
3. **Regular glass for anything with text.** Clear glass only over photography, only for icons and text of 18 pt or larger, always over a 35–45% scrim.
4. **Glass has no colour of its own.** Brand colour on at most two things per screen: the primary action (gradient) and one status. The rest of the brand lives in the content layer.
5. **Content fades at the edges.** Scrolling content fades out under a bar with a gradient mask, not a solid bar and not an extra blur layer.
6. **Glass never shrinks a target.** 44×44 pt minimum (28 is the floor), and spacing counts.
7. **Money never depends on translucency.** Amounts, the held-payment line and anything legal sit on opaque surfaces.
8. **No muted text on glass.** Glass text is `--foreground` only (measured below).
9. **Layer budget.** At most 3 live glass layers per web screen and 2 on Android. No backdrop blur inside scrolling list items. Never animate the blur radius; animate opacity and transform.
10. **Every glass surface has the fallback ladder in section 7.**

## 5. Tokens (starting values; tune until the contrast test passes)

Replace the v1 `--glass-*` variables in `globals.css`; mirror them in Flutter as `GlassTokens`.

| Token | Graphite (dark) | Ivory (light) |
|---|---|---|
| regular fill | `rgba(24,26,34,0.68)` | `rgba(255,255,255,0.62)` |
| regular blur, saturate | 28 px, 165% | 28 px, 170% |
| clear fill | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.18)` |
| clear blur, saturate | 12 px, 140% | 12 px, 140% |
| scrim under clear | black 35–45% | black 35–45% |
| hairline border | `rgba(255,255,255,0.16)` | `rgba(23,28,38,0.10)` |
| specular rim | `inset 0 1px 0 rgba(255,255,255,0.22)` | `inset 0 1px 0 rgba(255,255,255,0.90)` |
| shadow | `0 8px 32px rgba(0,0,0,0.35)` | `0 8px 28px rgba(23,28,38,0.12)` |
| opaque fallback | `#1B1E27`, border `rgba(255,255,255,0.28)` | `#FFFFFF`, border `rgba(23,28,38,0.32)` |

Shapes: capsule for bars and buttons, 24 px radius (`--radius-xl`) for sheets; continuous corners in Flutter.

Contrast, measured by compositing each fill over worst-case backdrops (black, white, mid grey, violet, blue; blur ignored):

| Case | Result |
|---|---|
| Graphite regular, `--foreground` | 5.38 over white, 16.9 over black, ≥ 9.4 on grey, violet, blue. Pass. |
| Graphite regular, muted text | 2.33 over white. Fail, hence rule 8. |
| Ivory regular, `--foreground` | 6.38 over black, 17.1 over white. Pass. |
| Ivory regular, muted text | 2.79 over black. Fail, hence rule 8. |
| Clear glass, white icon, 35% scrim | 2.44 over pure white. Fail. |
| Clear glass, white icon, 45% scrim | 3.35 over pure white, 9.4 over grey. Pass (3:1 for icons and large text). |

Add this as a test beside `tests/brand.test.ts` so a token change can't break contrast.

## 6. Where glass goes, and the one signature

| Screen | Glass (functional layer) | Opaque (content) |
|---|---|---|
| Launch, welcome | Bottom action bar over the hero photo (clear, with scrim) | Hero photo, motto |
| Home, search | Floating tab bar (mobile) or floating top bar (web), search capsule, filter sheet | Business cards, category rail, results |
| Business page | Back, save, share over the cover (clear). Sticky "Book" bar (regular) | Services, staff, reviews, hours |
| Booking flow | Step sheet and sticky summary bar | Slot grid, price lines |
| Payment | Sheet chrome only | Amount, M-Pesa steps, status |
| Booking detail | Top bar, action bar ("Confirm service", "Report a problem") | Timeline, money breakdown |
| Provider console | Tab bar, top bar | Calendar, requests, balances, payouts |
| Admin | Top bar, command menu (web) | Tables, ledger, disputes |
| System | Toasts, menus, popovers, alerts | |

**The signature (spend the boldness here, nowhere else): the booking sheet.** The sticky "Book" bar grows into a glass sheet over the business's own cover photo; one gradient button, "Book and pay", and one plain line under it: "Your payment is held until the job is done." Everything else stays quiet: no glass cards, no gradient washes, no entrance animation on every section.

Defining moments (only these get special treatment): launch (motto, once per session, skippable), welcome, booking confirmed (check settles into the sheet, success haptic, no confetti), service confirmed ("{Business} has been paid"), empty states with real imagery.

## 7. Fallback ladder and accessibility

**Web**
- Default: `backdrop-filter: blur() saturate()` with fill, hairline, specular rim. Keep `-webkit-backdrop-filter` for older Safari.
- Refraction upgrade: SVG displacement through `backdrop-filter: url(#lens)` works in Chromium only (Safari and Firefox ignore it). Use it only on the floating top bar and the booking sheet, only with a fine pointer, behind a runtime check; everyone else gets the default. Re-test engine support when upgrading.
- `prefers-reduced-transparency: reduce`, `prefers-contrast: more`, or no `backdrop-filter` support: opaque fallback fill, no blur, stronger border. v1 has none of these media rules; v2 needs all three.
- `forced-colors: active`: system colours; the 1 px border stays because it is the only edge.
- Reduced motion is already global (`MotionSettings`): morphs become fades.
- `backdrop-filter` makes a containing block for fixed-position descendants. Put the glass on its own layer (a sibling or pseudo-element), not on the element that owns fixed children.

**Flutter**
- Baseline is Android: lightly translucent or opaque bars, because blur is costly there and most users are on mid-range phones (Kenya first). iOS gets the full effect.
- `MediaQuery.highContrast` means opaque; `disableAnimations` means no morphs. Flutter doesn't expose iOS "Reduce Transparency" directly (verify on the Flutter version in use): read `UIAccessibility.isReduceTransparencyEnabled` through a small platform channel and treat it as opaque.
- Text scales to 200%; layouts survive it. Body 17 pt, minimum 11 pt, no thin weights on glass.

**Both:** 4.5:1 for text, 3:1 for icons and large text; nothing carried by colour alone; every icon-only control has a label for screen readers; visible focus ring (`--ring`); dark and light both designed, no in-app theme switch that fights the system.

## 8. Performance budget

- Web, on a mid-range Android over 4G: INP under 200 ms, LCP under 2.5 s (Core Web Vitals "good"). Home route first-load JS ≤ 200 KB gzipped (our call; change it with a reason in the Decision log). Images ≤ 500 KB, responsive, with blur-up placeholders.
- Flutter, profile mode on a mid-range Android and an iPhone: 60 fps with no shader-compile jank (Impeller; precache shaders at startup). At most 2 `BackdropFilter` layers per screen, each clipped to a small rect, never inside list items.

## 9. Motion and haptics

Use the shared tokens only: durations 150 / 250 / 400 / 1200 ms, easings standard / spring / exit, press scale 0.97, rise 12 px, slide 16 px, stagger 60 ms (first six). Glass morph = slow + spring (sheet, tab indicator); hover and press = fast. Nothing loops except skeleton shimmer; nothing autoplays except the launch splash. A new token goes into `src/lib/motion.ts`, `globals.css`, `apps/mobile/lib/core/motion.dart` and `tests/motion.test.ts` in one change.
Haptics (mobile): selection click on picking a slot or tab, light impact on the primary action, success on payment captured and on "Confirm service". None on scroll.

## 10. Flutter implementation

- One widget, `GlassSurface(level: regular | clear | opaque)`, built on `ClipRRect` + `BackdropFilter` + fill + hairline + specular rim, driven by `GlassTokens`. App code never imports a glass package directly.
- Candidates for refraction on the signature surfaces (seen on pub.dev 2026-11-20; re-check versions and licences): `fresnel` (native iOS 26 glass, calibrated shader elsewhere; 0.1.0), `liquid_glass_renderer` (shader; prerelease), `liquid_glass_widgets` (26 widgets; prerelease), `liquid_glass_hig` (primitives on the renderer; beta), `liquid_glass_easy` (cross-platform lens), `cupertino_liquid_glass` (BackdropFilter approximation, no native code; 0.6.0).
- Rule: the baseline works with no glass package. Adopt a package only if it is stable enough to pin, passes section 8 on both test devices, and sits behind `GlassSurface`.

## 11. Wording, tone and motto

**Motto:** "Your Style, On Demand." Exactly that, comma and full stop included. It appears on the launch splash, the welcome screen, the store listing, the web meta description, email footers and the 404 page. Not in navigation, buttons or on every page. Display type sets it in capitals with CSS; the source string stays as written.

**Voice:** assured, warm, exact. A good front-desk lead at a premium barbershop: calm, specific, never pushy. Short sentences (about 16 words at most), active voice, one idea per line, say who does what.

**Rules**
- Buttons say what happens: verb and object ("Book and pay", "Confirm service", "Report a problem", "Cancel booking", "Browse businesses"). Never "Submit", "OK", "Click here".
- An action keeps its name through the flow: "Confirm service", then the toast "Service confirmed", then the status "Completed".
- Sentence case everywhere. Title case only for the motto and proper names.
- Errors say what went wrong and what to do next. No apology, no blame, no "Oops", no error codes in the main line (a small "Details" line holds the reference).
- Empty states invite the next action.
- Banned in UI: "please" on buttons, "successfully", exclamation marks (none; at most one at the booking-confirmed moment), emoji in system copy, "premium", "luxury", "world-class".
- No system words: escrow, ledger, settlement, webhook, idempotent, status codes. Help text may say "payment protection".
- **Words follow the ledger.** Never say "paid", "refunded" or "sent" until the money has moved; say "on its way" until the provider confirms.

**Names and numbers**
- Money: `KSh 1,500` (no decimals for whole shillings; tabular numbers), formatted from integer minor units by one function in `src/core`. `KES` only on receipts, exports and the ledger.
- Time: 12-hour, `2:30 pm`; dates `Sat 22 Nov` (year only when not the current one); relative ("in 2 hours") only inside 24 hours. All times are Nairobi time (EAT).
- Phone: `0712 345 678` on screen, E.164 in storage. Duration: `45 min`, `1 h 30 min`. Rating: `4.8 (120)`.
- Money labels: Held, Available, Payout on its way, Refund on its way. Fee label: "Styra fee".

**Status labels**

| Booking (escrow) | Customer sees | Provider sees |
|---|---|---|
| PENDING | Awaiting payment (slot held for 14:32) | Awaiting payment |
| CONFIRMED (held) | Confirmed | Confirmed, payment held |
| COMPLETED (held) | Confirm your service | Done, waiting for the customer |
| NO_SHOW (held) | Marked as a no-show | No-show reported, waiting for the customer |
| DISPUTED (held) | Problem reported, in review | Problem reported, in review |
| VERIFIED (settled) | Completed | Completed, payout on its way, then Paid out |
| CANCELLED | Cancelled (Refund on its way, then Refunded, when money was taken) | Cancelled |
| EXPIRED | Expired, payment not received in time | Expired |

**Starting copy** (edit freely, keep the rules)
- Welcome: "Your Style, On Demand." / "Book grooming near you. Your payment is held until the job is done." / "Browse businesses" / "Sign in". No sign-in wall before browsing.
- Checkout: "Pay KSh 1,500 now. We hold it until your service is done."
- After payment: "You're booked. Your payment is held until you confirm the service."
- After the service: "Was everything okay? Confirm to pay {Business}. If we don't hear from you, we pay them automatically on {Sat 22 Nov, 2:30 pm}."
- Problem reported: "Problem reported. Your payment stays held while we review it. We'll message you when it's decided."
- M-Pesa timeout: "M-Pesa didn't confirm the payment. Check your phone for the prompt, or try again. Your slot is held for 9:42."
- Slot taken: "That time was just booked. Pick another time."
- Server error: "Something went wrong on our side. Try again in a minute. If it keeps happening, quote ref {id}."
- Validation: "Enter a Kenyan phone number, like 0712 345 678."
- Empty bookings: "No bookings yet. Find grooming near you." / "Browse businesses".
- Empty provider day: "No requests today. Share your page to get your first booking." / "Copy link".
- No search results: "Nothing matches. Try fewer filters or a wider area." / "Clear filters".
- SMS and push (about 90 characters, lead with the thing, no emoji): "Booking confirmed: Kinyozi Pro, Sat 22 Nov, 2:30 pm. Payment is held until you confirm." / "Did Kinyozi Pro do the job? Confirm by 2:30 pm tomorrow or we pay them automatically."

**One catalogue.** All user-facing strings live in one source (`copy/en.json`) read by the web through a typed `t()` helper and turned into Flutter ARB files by a script. A check fails the build on literal user-facing strings in components or widgets. Plurals use ICU. English ships first; Swahili (`sw`) is the first extra locale and is written by a native speaker, never machine-translated.

## 12. Screen gate (in every screen's PR)

- [ ] Glass only on the functional layer, never on glass, within the layer budget.
- [ ] Contrast numbers shown for text on glass; 3:1 for icons; muted text not on glass.
- [ ] Fallbacks verified: reduced transparency, increased contrast, reduced motion, forced colours (web) or high contrast and disabled animations (Flutter).
- [ ] Both themes, at 390×844 and 1440×900, screenshots attached.
- [ ] Targets ≥ 44 pt; text scales; icon-only controls labelled; focus visible.
- [ ] Brand colour on at most two things; one signature per flow, not per screen.
- [ ] Budget met (section 8) on the test devices.
- [ ] apple-design review run: no Critical or High finding open.
- [ ] Every string from the catalogue and passing section 11; money words follow the ledger.
- [ ] A Figma frame exists and matches.

## 13. References

- apple-design skill and HIG pages: https://github.com/dickwu/apple-design-skill
- Flutter: https://pub.dev/packages/fresnel · https://pub.dev/packages/liquid_glass_widgets · https://pub.dev/packages/liquid_glass_hig · https://pub.dev/packages/liquid_glass_easy · https://pub.dev/packages/cupertino_liquid_glass
- Web glass and Chromium-only refraction: https://dev.to/dimonb19a/liquid-glass-needs-a-ladder-394j · https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026 · https://vitrumui.vercel.app/docs/browser-support · https://aave.com/design/building-glass-for-the-web
