# Audio Recording Feature — Build Plan

## The Vision

Taylor records himself reading a completed story in one continuous take. Later — when he's traveling or at work — Rayna taps play and gets the full picture book experience with dad's voice: illustrations flip automatically as the recording plays, and she just watches and listens. Deployed as a PWA for iPhone.

## UX Flow

### Recording (Taylor's perspective)

1. Taylor finishes a story (or opens a completed one from the library)
2. Taps **"Record Reading"** button on the story page
3. Enters **recording mode** — the UI shifts:
   - Story shows beat 1 with the illustration and text (teleprompter style)
   - A big mic button pulses at the bottom: **"Tap to start recording"**
4. Taylor taps the mic — **one continuous recording starts**
5. Taylor reads beat 1, then taps **"Next Page"** to advance to beat 2 (this logs a timestamp)
6. Reads beat 2, taps Next Page, reads beat 3... all the way through beat 5
7. Taps **"Stop"** after reading beat 5
8. Quick preview: plays back the full recording with illustrations flipping at the timestamps
9. If it sounds good, tap **"Save"**. If not, **"Re-record"** to start over
10. Done — the recording is linked to this story

**Key UX details:**
- **One continuous recording** — no stopping/starting between beats. Taylor just reads naturally
- **Tap to mark page turns** — a subtle "Next Page" button that logs the timestamp in the audio where each beat transition happens. Minimal friction, precise sync
- The text is shown prominently so Taylor can read it like a teleprompter
- Visual countdown (3-2-1) before recording starts to avoid cutting off the first word
- If Taylor fumbles, he can re-record the whole thing (v1 — no partial editing)

### Playback (Rayna/Olivia's perspective)

1. Open a story that has a recording
2. A **"Listen to Daddy"** button appears (big, friendly, with a play icon)
3. Tap play — the story becomes completely hands-free:
   - Beat 1 illustration fills the screen, Taylor's voice plays
   - Text shown below the image
   - When audio reaches the beat 2 timestamp, illustration crossfades to beat 2
   - Continues automatically through all 5 beats
4. At the end, "The End" screen appears with a star animation
5. Option to **"Listen Again"** or pick a new story

**Key UX details:**
- Completely hands-free after tapping play — a 3-year-old can just watch and listen
- No choice buttons during playback (the choices were already made when the story was played)
- Pause/resume by tapping anywhere on the screen
- Large, simple controls — nothing confusing
- Smooth crossfade transitions between beat illustrations at the logged timestamps

### PWA (iPhone)

- Add a web app manifest + service worker for "Add to Home Screen" on iPhone
- Cache story images + audio for offline bedtime reading
- Full-screen experience with no browser chrome
- Splash screen with StorySprout branding

### Sharing (Stretch)

- Taylor generates a **share link** for a story with recording
- The link opens a read-only playback view (no auth required)
- Optional: protect with a simple PIN
- QR code for easy phone sharing

## Data Model

### New table: `story_recordings`

```
story_recordings
├── id              UUID, primary key
├── story_id        UUID, FK → stories (one recording per story for now)
├── recorded_by     UUID, FK → users
├── audio_url       String (path to single audio file)
├── duration_ms     Int (total recording duration)
├── beat_timestamps Int[] (array of 4 timestamps in ms — marks where beats 2/3/4/5 start)
├── is_complete     Boolean, default false
├── created_at      DateTime
└── updated_at      DateTime
```

**Why `beat_timestamps` as an array:** One audio file, 4 timestamp markers (beat 1 starts at 0, so we only need to store where beats 2-5 begin). Simple, no join table needed. During playback, the client watches `audio.currentTime` and advances the illustration when it crosses a timestamp.

### Storage

Audio file saved to `public/audio/stories/{storyId}/recording.webm`. Single file per story.

Vite middleware already serves runtime files from `public/` — extend to handle `audio/webm` MIME type.

For production: upload to S3 or Supabase Storage, store permanent URL.

## Technical Implementation

### Recording (Browser APIs)

Use the **MediaRecorder API** — supported in all modern browsers, works on iOS Safari 14.5+.

```typescript
// Core recording logic — will be wrapped in useAudioRecorder hook
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, {
  mimeType: "audio/webm;codecs=opus", // fallback to "audio/mp4" on iOS
});
const chunks: Blob[] = [];
const beatTimestamps: number[] = [];
const startTime = Date.now();

recorder.ondataavailable = (e) => chunks.push(e.data);

// Called when Taylor taps "Next Page"
function markBeatTransition() {
  beatTimestamps.push(Date.now() - startTime);
}

recorder.onstop = () => {
  const blob = new Blob(chunks, { type: recorder.mimeType });
  const duration = Date.now() - startTime;
  // Upload: { blob, duration, beatTimestamps }
};

recorder.start();
```

**iOS Safari note:** WebM is not supported on iOS Safari. Fall back to `audio/mp4` (AAC) which is natively supported. Detection:

```typescript
const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
  ? "audio/webm;codecs=opus"
  : "audio/mp4";
```

**Custom hook: `useAudioRecorder`**
- `startRecording()` / `stopRecording()` / `markBeatTransition()`
- Returns `{ isRecording, elapsedTime, beatTimestamps, audioBlob, audioDuration }`
- Handles permissions, MIME type detection, error states, stream cleanup

### Upload

POST the single audio file + timestamps to a resource route:

```
POST /api/story-recording
Body: FormData { storyId, audio (Blob), durationMs, beatTimestamps (JSON string) }
Response: { recordingId, audioUrl }
```

Server saves the file to disk and creates the `story_recordings` row.

### Playback

Use standard **HTML5 Audio API** with `timeupdate` events:

```typescript
const audioRef = useRef<HTMLAudioElement>(null);
const timestamps = [0, ...recording.beatTimestamps]; // [0, t2, t3, t4, t5]

useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  const handleTimeUpdate = () => {
    const currentMs = audio.currentTime * 1000;
    // Find which beat we're in based on timestamps
    let activeBeat = 1;
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (currentMs >= timestamps[i]) {
        activeBeat = i + 1;
        break;
      }
    }
    setCurrentBeat(activeBeat);
  };

  audio.addEventListener("timeupdate", handleTimeUpdate);
  return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
}, [timestamps]);
```

**Custom hook: `useStoryPlayback`**
- Takes `audioUrl` + `beatTimestamps`
- `play()` / `pause()` / `togglePlayPause()`
- Returns `{ isPlaying, currentBeat, progress, duration }`
- Handles auto-advance based on timestamps, preloading, ended event

### Transitions Between Beats

- Crossfade: current image fades out (opacity 0) while next image fades in (opacity 1) over 0.5s
- CSS transitions on the image container
- Beat text swaps simultaneously with the image

### PWA Setup

```json
// public/manifest.json
{
  "name": "StorySprout",
  "short_name": "StorySprout",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF8F0",
  "theme_color": "#7C5CFC",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```

Service worker for offline caching of story images + audio files. Use Workbox or a simple cache-first strategy.

## File Structure (New Files)

```
app/
├── routes/
│   └── api.story-recording.tsx    # Upload/retrieve audio endpoint
├── hooks/
│   ├── useAudioRecorder.ts        # MediaRecorder + beat timestamp tracking
│   └── useStoryPlayback.ts        # Audio playback + timestamp-based beat advance
├── components/
│   ├── RecordingMode.tsx           # Recording UI (teleprompter + mic + next page)
│   └── PlaybackMode.tsx            # Hands-free playback UI (full-screen)
├── lib/
│   └── audio-storage.server.ts    # Save/retrieve audio files
public/
├── manifest.json                   # PWA manifest
└── sw.js                          # Service worker (offline caching)
```

## Phases

### Phase 1: Core Recording + Playback
- [ ] DB migration: `story_recordings` table
- [ ] `useAudioRecorder` hook (MediaRecorder + beat timestamps)
- [ ] `api.story-recording.tsx` resource route (upload single audio file)
- [ ] Recording mode UI (teleprompter view, mic button, "Next Page" button)
- [ ] `useStoryPlayback` hook (HTML5 Audio, timestamp-based beat advance)
- [ ] Playback mode UI (full-screen, hands-free, auto-advancing illustrations)
- [ ] Extend Vite middleware for audio MIME types
- [ ] "Record Reading" button on completed stories
- [ ] "Listen to Daddy" button when recording exists
- [ ] iOS audio format fallback (WebM → MP4/AAC)

### Phase 2: PWA + Polish
- [ ] Web app manifest + "Add to Home Screen" support
- [ ] Service worker for offline caching (images + audio)
- [ ] 3-2-1 countdown before recording starts
- [ ] Crossfade transitions between beats during playback
- [ ] Preview playback after recording (before saving)
- [ ] Audio playback progress indicator (subtle bar or beat dots)
- [ ] "Listen Again" flow at story end
- [ ] Tap-anywhere to pause/resume during playback

### Phase 3: Sharing (Stretch)
- [ ] Generate shareable link for a story with recording
- [ ] Read-only playback view (no auth)
- [ ] Optional PIN protection
- [ ] QR code generation for easy phone sharing
- [ ] Multiple recordings per story (mom, grandma, etc.)

## Edge Cases to Handle

- **Microphone permissions denied** — show friendly message explaining why mic is needed
- **iOS Safari audio quirks** — playback requires user gesture to start; the "Listen to Daddy" tap satisfies this
- **iOS Safari MediaRecorder** — no WebM support; detect and fall back to audio/mp4
- **Recording interrupted** (phone call, tab switch) — detect `visibilitychange` event, pause recording, show "Resume or discard?" prompt
- **Timestamps drift** — use `performance.now()` instead of `Date.now()` for more accurate beat markers
- **Very short/long beats** — if Taylor taps "Next Page" too fast or too slow, playback still works (timestamps are absolute, not relative)
- **Multiple recordings per story** — v1 supports one per story; schema allows expansion later
- **Offline playback** — PWA service worker caches audio + images; works without WiFi after first load

## Cost

Zero additional API cost. Recording and playback are entirely client-side browser APIs + local file storage. The only cost is disk space (~200-500KB per story recording in WebM/MP4).
