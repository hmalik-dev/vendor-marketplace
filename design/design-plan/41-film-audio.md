# 41 — "Introducing Orla" film: audio

The film is `Orla - Introducing.dc.html` — 56.0s, eleven scenes. Audio is wired
but not supplied: drop the files in and they play, and they are mixed into the
video export.

## The track (as shipped)

**"Meanwhile" — Scott Buckley**, CC-BY 4.0. Delivered as a **7.93s seamless
loop** (0.4s crossfaded seams, source offset 133.79s), laid end to end to
56.000s · audio-only AAC 48kHz · −16.0 LUFS · −1.7 dBTP · 1.5s fade at 54.5s,
none at the head. Untrimmed source and the reproduction receipt live in
`uploads/`.

`musicVolume` is **0.85** (music only, no VO to duck under).

**Consequence of the loop, recorded deliberately:** there is no musical event
under any of the film's three cues. Loudness range is 2.2 LU (a linear cut of
the same track measures 8.8 LU), so the Bridge at 8.0s, the confirmation at
35.5s and the close at 50.5s all land on the same bed. **Nothing is retimed to
the music** — there is nothing to retime to. The film ends mid-loop; the 1.5s
fade is what ends it, not a resolving chord.

That is a legitimate choice for a bed that sits under captions, and it is
completely safe. It is also the thing to revisit if the film ever needs to carry
emotional weight on its own — see "If the film needs a score" below.

### Attribution — required, every place this ships

> Meanwhile by Scott Buckley – released under CC-BY 4.0. www.scottbuckley.com.au

CC-BY obliges credit wherever the film is published. Put that line in the video
description on every channel. If it is ever embedded with no description field —
an autoplaying hero, a trade-show loop — it needs an on-screen credit instead:
one line of 13px JetBrains Mono in `stone-600`, bottom-centre of the closing
frame under `orla.com`.

## If the film needs a score

A 7.93s loop repeats seven times in 56 seconds. It disappears as wallpaper,
which is fine for a muted-by-default social post and thin for a hero film or
anything played to a room. If that day comes, the ask is a **linear 56s cut of
the same track** (same licence, same attribution) with its natural dynamics
intact — then the three cues above become real beats again, and the film's
existing structure snaps to them without a redesign.

## How to add the tracks

Put them in `uploads/` as **.mp4** (an audio-only mp4 is fine — the export mixes
audio from nested `<video>` elements, not from `<audio>` or bare `.mp3`):

| File                     | Role       | Volume key           |
| ------------------------ | ---------- | -------------------- |
| `uploads/soundtrack.mp4` | music bed  | `musicVolume` (0.65) |
| `uploads/voiceover.mp4`  | voice-over | `voiceVolume` (1)    |

Both are declared in the film's `window.OM_AUDIO` block. Empty a value and that
track is absent; nothing else changes. Music sits at 0.65 so a VO reads over it —
if you ship music only, raise it to 0.85.

## Cue sheet (authored seconds)

| In   | Scene     | On screen                          |
| ---- | --------- | ---------------------------------- |
| 0.0  | Opening   | mark assembles, wordmark lands     |
| 3.5  | Scatter   | tabs / DMs / spreadsheet drift out |
| 8.0  | Bridge    | the mess collapses into the mark   |
| 10.5 | Search    | window rises, search fills in      |
| 17.0 | Results   | six vendors, availability, prices  |
| 23.5 | Request   | one request, nothing charged       |
| 29.0 | Quote     | quote arrives, accepted, held      |
| 35.5 | Confirmed | "Jun 14 is booked"                 |
| 39.5 | Flip      | screen lifts to the vendor side    |
| 42.5 | VendorDay | quote sent, date blocks, payout    |
| 50.5 | Close     | mark, tagline, both CTAs           |
| 56.0 | end       |                                    |

**Click ticks** (if you add UI SFX — soft, dry, ~40ms, one sound only):
15.0 · 23.2 · 28.35 · 32.85 · 45.0. A single low "settle" at **35.7** under the
confirmation, nothing else.

## Music direction

Warm, unhurried, human — the same brief as the brand. Felt piano or nylon guitar
lead, upright bass, light strings arriving late. **92–96 bpm**, major, no
percussion build, no EDM drop, no ticking-clock tension, no corporate-uplift
plucks.

- **0.0–8.0** — sparse. One instrument, wide space. The Scatter section is the
  only slightly unresolved moment; let harmony sit on a suspended chord rather
  than adding drama.
- **8.0** — resolve on the Bridge, exactly as the mess collapses. This is the
  film's turn and the one place the music should be _noticed_.
- **10.5–35.5** — steady bed under the product. Nothing new should enter mid-scene;
  the interface is carrying attention.
- **35.5** — small swell for the confirmation. Two seconds, then back.
- **50.5–56.0** — full but restrained; land on one sustained chord and let it ring
  past the last frame. Do not end on a stinger.

Library search terms that land close: _warm acoustic hopeful piano_, _felt piano
optimistic_, _intimate strings uplifting no drums_. Buy a **56s+ cut** with a
clean tail; avoid anything with a 4-bar drop at 0:15.

## Voice-over script

Female or male, mid-register, unhurried, conversational — a friend explaining,
not an announcer. Total ~110 words against 56s: that is deliberately loose. Let
the silences stand; the Opening and Confirmed beats carry no words at all.

| At   | Line                                                                                                        | Words |
| ---- | ----------------------------------------------------------------------------------------------------------- | ----- |
| —    | _(Opening: music only — no VO)_                                                                             | 0     |
| 3.8  | "Booking the people who make your event has meant fifteen tabs, four DMs, and a spreadsheet nobody trusts." | 18    |
| 8.4  | "Not any more."                                                                                             | 3     |
| 11.0 | "Orla starts with what you already know. What you need, where, and when."                                   | 13    |
| 17.4 | "Real calendars. Real prices. No waiting to hear that a date is gone."                                      | 13    |
| 24.0 | "Send one request. Nothing is charged."                                                                     | 6     |
| 29.5 | "Accept the quote, and your payment is held until the event."                                               | 11    |
| 36.2 | _(beat — no VO. Let "Jun 14 is booked" land.)_                                                              | 0     |
| 40.0 | "And for the vendor —"                                                                                      | 4     |
| 43.2 | "the same booking arrives ready to quote. Accept, and the date blocks itself. You're paid the day after."   | 18    |
| 51.2 | "Orla. Clear prices, open calendars, no back-and-forth."                                                    | 8     |

Pacing target is **≤ 2.5 words per second** — every line above fits its scene
with room to breathe. If a line feels rushed in the booth, cut words rather than
speeding up; the timeline can also be trimmed per-scene in the host editor and
the animation retimes with it.

**Claims discipline:** the script says nothing the product can't do. No vendor
counts, no reply-time promises, no fee claims of any kind (the platform fee is
vendor-side and belongs on the vendor page, not in a customer film).

## Exporting with sound — one extra step

**The video export is silent by design.** The animation engine renders the film
frame by frame from the DOM; it has no audio pipeline, so the soundtrack plays in
the preview but is not written into the exported file. Nothing is misconfigured —
audio gets muxed on afterwards.

1. Export the video from the host as usual (silent, 56s).
2. Mux the soundtrack onto it — the cut is already exactly 56.000s, correctly
   normalized, so this is a copy, not a re-encode of either stream:

```bash
ffmpeg -i introducing-orla.mp4 -i uploads/soundtrack.mp4 \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart \
  introducing-orla-with-music.mp4
```

Because `musicVolume` (0.85) is a preview-only control, bake the level in if you
want it quieter than the file: add `-filter:a "volume=0.85"` and drop `-c:a aac`
to `-c:a aac -b:a 192k` (already there).

3. Check the result: `ffprobe` should report two streams and a 56s duration.

Any editor does the same job — drop the exported mp4 and `soundtrack.mp4` on a
timeline, align both at 0, render. No trimming needed; they are the same length.

## Checking it

Play in the preview — browsers block audio until the user interacts, so hit play
in the player rather than expecting sound on load. Then export video; the mixed
track comes with it.
