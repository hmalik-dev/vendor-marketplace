# Prompt for Claude Code — source the music bed for "Introducing Orla"

Copy everything below the line into Claude Code. It is written to be run in a
terminal-capable environment with `ffmpeg` available and network access.

---

I need a music bed for a 56-second brand launch film. Find it, license it
cleanly, and deliver it in an exact format. Do not compose or synthesize
anything — I want a real recorded track from a legitimate library.

## The film

A warm, calm product film for **Orla**, a marketplace where people book event
vendors (photographers, caterers, venues, florists). The brand is warm and
human: clay orange, ink, cream, serif type. The film shows a couple's wedding
vendors being booked, then the same booking from the vendor's side. The mood is
*relief*, not hype — the promise is "no back-and-forth."

## What to find

- **Length:** at least 56 seconds of usable music, ideally 60–90s so there's
  trim room. It must have a **clean tail** (a resolving final chord or a natural
  ring-out), not a hard cut or a stinger.
- **Tempo:** 88–100 bpm. Steady. No accelerando, no half-time drop.
- **Key/mood:** major or modal-major. Warm, unhurried, optimistic, intimate.
- **Instrumentation:** felt/soft piano OR nylon-string guitar as the lead;
  upright bass; light strings or warm pad entering later. Light brushed
  percussion at most.
- **Structure I need:** sparse and spacious in the first ~8 seconds, then a
  clear but gentle **resolution or lift at around 0:08–0:10** (that's the film's
  turning point), then a steady bed that does not introduce new instruments
  every few bars, a small swell around 0:35, and a full but restrained final
  ~5 seconds.

## Hard exclusions — reject any track with these

- EDM/trailer drops, risers, white-noise sweeps, impact hits
- Four-on-the-floor drums, trap hats, heavy percussion builds
- "Corporate uplift" plucked-synth-and-claps beds (the ukulele-and-whistle genre)
- Ticking-clock or tension motifs, minor-key drama
- Vocals of any kind, including wordless "oohs" — a voice-over may be added later
- Anything with a drop or major section change at 0:15 (it fights my edit)

Good search phrasings: `warm acoustic hopeful piano`, `felt piano optimistic
unhurried`, `intimate strings uplifting no drums`, `nylon guitar warm documentary`.

## Licensing — this is non-negotiable

The film is **commercial marketing** for a startup, will be published on a
website and social channels, and may run as a paid ad. So:

1. Prefer, in this order: a library the user already subscribes to (ask me first
   — I may have Artlist / Musicbed / Epidemic Sound / Soundstripe), then
   Uppbeat, then Pixabay Music, then Free Music Archive **CC-BY** tracks.
2. **Never** use a CC-BY-NC (non-commercial) or CC-BY-ND track. Never scrape
   audio from YouTube, Spotify, SoundCloud, or a film/TV rip.
3. Confirm the license explicitly permits: commercial use, paid advertising,
   and use in an audiovisual work. If it requires attribution, capture the exact
   attribution string.
4. Write a receipt to `uploads/soundtrack-license.md` containing: track title,
   artist, source URL, license name and URL, date downloaded, whether paid ads
   are permitted, and the required attribution string (or "none required").
   If you cannot verify all of that, **do not download the track** — bring me
   two or three candidate links instead and I'll decide.

## Deliverable format — exactly this

The player that consumes this mixes audio from a video element, so I need an
**audio-only MP4**, not an mp3:

```bash
# trim to 56.0s from the best start point (adjust -ss), normalize, encode
ffmpeg -i source.wav -ss 0 -t 56.0 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=54.5:d=1.5" \
  -vn -c:a aac -b:a 192k -ar 48000 uploads/soundtrack.mp4
```

- Output path: **`uploads/soundtrack.mp4`** (exact name and location)
- Duration: **56.0s** ± 0.1s
- Loudness: about **−16 LUFS** integrated, true peak ≤ **−1.5 dBTP** (it sits
  under a possible voice-over later)
- 1.5s fade at the very end only — no fade in
- Also keep the untrimmed original at `uploads/soundtrack-source.<ext>` so the
  cut can be redone

## Report back with

1. The chosen track: title, artist, source, license, and cost (or "free").
2. Why it fits — specifically, where its lift lands and whether it needed
   time-shifting to hit the 0:08 turn.
3. The two runners-up, with links, in case I want to swap.
4. Confirmation that `uploads/soundtrack.mp4` is 56.0s, −16 LUFS, audio-only.

---

## After Claude Code delivers (what I'll do)

Upload `uploads/soundtrack.mp4` here. Then I:

1. Set `window.OM_AUDIO.music` to that path in `Orla - Introducing.dc.html` and
   raise `musicVolume` to **0.85** (music-only — no VO to duck under).
2. Check the track's actual lift point against the film's Bridge cue at
   **8.0s**. If the music resolves at, say, 9.4s, I retime the film to the
   music rather than the reverse: the host timeline lets each scene's playback
   length change and the animation retimes with it, so I'll trim Opening/Scatter
   to move the Bridge onto the music's downbeat. Same for the 35.5s
   confirmation swell and the 50.5s close.
3. Confirm the last frame lands before the track's tail ends, so the film
   doesn't end mid-ring.
4. Re-verify and hand back the file ready for video export.

Tell me the track's lift timestamp when you upload — that's the one number I
need to sync everything else to.
