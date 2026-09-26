# Proposal — scene-by-scene specification

The first template on the premium experience system ([ADR 0009](../decisions/0009-premium-experience-system.md)).
Source of truth for its content: `prisma/occasion-templates.ts` (`key: 'proposal'`).

**Character:** motion profile `CINEMATIC` (slow blur reveals, fades through dark, quiet taps),
palette `dusk` (deep plum, rose gold, candlelight), serif type, recorded _Clair de lune_
(public domain, 790 KB, streamed only once the recipient taps). Personal details: `{{name}}`,
`{{from}}`, `{{firstPlace}}`.

**Arc:** curiosity → our story → memory → affection → anticipation → proposal → release.
Motion and music stay restrained until scene 5; the climax is the only big moment.

| #   | Scene                                                                                  | Purpose                           | Composition / type                                                      | Entrance                                                          | Interaction → feedback                                                                                                                        | Music | Leaves by              |
| --- | -------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------- |
| 1   | Opening — "{{name}}, this is our story ❤️" + "Some stories deserve to be told slowly." | Curiosity; it was made for _them_ | FLOAT: text on the dark background, no card                             | Word by word (≈1.4 s max, longer names just take a little longer) | "Remember with me" → no sound, no burst                                                                                                       | 75 %  | Fade through dark      |
| 2   | Memory — "Do you remember where we first met?"                                         | Only they know; intimacy          | FLOAT, typed answer, hint on request                                    | Blur reveal                                                       | Right answer → soft shimmer + "You remembered 🥹" for 1.8 s, the question dims behind it; wrong → gentle shake + "Not quite — think back… 💭" | 75 %  | Profile default (dark) |
| 3   | Build — "Somehow every ordinary moment with you became one of my favourites."          | Let it breathe                    | FLOAT, one line                                                         | Word by word                                                      | "Keep going"                                                                                                                                  | 60 %  | Fade through dark      |
| 4   | Anticipation — "There is one more thing I’ve wanted to ask you…"                       | Hush                              | FOCUS: the line owns the screen, nothing else                           | Blur reveal                                                       | "Ask me"                                                                                                                                      | 30 %  | Fade through dark      |
| 5   | The question — "Will you marry me?"                                                    | The peak                          | FOCUS, 2.3 em serif, Yes / No (No playfully dodges; Close always works) | Word by word                                                      | **Yes → climax** (below)                                                                                                                      | 20 %  | —                      |
| 6   | Final reveal — "Forever starts now." + "There is something I wrote for you."           | Release                           | FLOAT; the letter unfolds from its top edge                             | Blur reveal                                                       | "Open my letter" → reveal shimmer, cream paper letter signed by `{{from}}`                                                                    | 90 %  | Stays on screen        |

**Climax (PROPOSAL):** taps are ignored while it plays.

1. The question fades out, the screen dims and the music falls to 12 % (0–0.4 s).
2. A heartbeat plays (0.25 s).
3. A warm rose light blooms from the centre, and the music swells back to 85 % (1.5 s).
4. The ring illustration settles in with "You said yes 💍" (1.85 s).
5. A reveal shimmer plays (2.4 s), then a shower of hearts (2.2 s).
6. The story hands over to scene 6 (≈5.3 s).

With reduced motion it is a 1.4 s fade.

**Ending:** a free surprise shows "Someone made this for you with Wish Revealer" nine seconds
after the letter opens, with "See it again" returning to the open letter. A paid surprise shows
nothing about Wish Revealer at all; Report stays available.

**Mobile:** designed at 360 × 740 portrait first. The focused viewport is ≤ 28 rem wide on larger
screens. Only transform, opacity and filter animate; the illustration (≈5 KB) and its player
(46 KB gzipped) load only when the climax plays.
