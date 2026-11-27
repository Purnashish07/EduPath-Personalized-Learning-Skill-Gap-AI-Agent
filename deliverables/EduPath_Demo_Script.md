# EduPath Product Demo Storyboard

Target runtime: about 2 minutes 50 seconds. Capture the deployed product at
1920x1080, 16:9. Use the actual browser UI and synthetic learner data only.
The timed narration is in `EduPath_Voiceover_Script.md`; `EduPath_Subtitles.srt`
is a timing draft and must be adjusted against the final generated audio.

| Time | Scene | Production capture and narration focus |
|---|---|---|
| 00:00-00:12 | Introduction | Begin with a clean EduPath title card, then cut to the production app. Introduce the challenge of aimless learning and EduPath's personalized path. |
| 00:12-00:30 | Dashboard | Show the real dashboard. Frame target role, progress, next best action, weekly activity, and priority gaps. |
| 00:30-00:50 | Learner profile | Open Profile. Show the synthetic Alex Morgan profile and explain how skills, experience, study time, learning style, and goal inform recommendations. Do not expose personal data. |
| 00:50-01:15 | Skill-gap analysis | Open Skill Gaps. Show the actual current/required levels, priorities, and actions. Identify these as demo-mode guidance, not independently validated career credentials. |
| 01:15-01:40 | Learning path | Open Learning Path and Weekly Plan. Show the current generated phases and schedule, without replacing them with mock content. |
| 01:40-02:05 | Learning assistant | Open AI Assistant and ask: “Help me understand scaled dot-product attention and plan a short practice session.” Show the actual response. Keep its DEMO MODE/fallback label visible: this production deployment has no configured LLM key. |
| 02:05-02:30 | Practice and progress | Generate a practice question, submit a real answer through the UI, and show the result and Progress view. Use a synthetic score. Mention that current demo state is in-memory and not durable. |
| 02:30-02:50 | Conclusion | End on a clean EduPath title card with “Learn Smarter. Grow Faster. Achieve More.” and the verified production URL and GitHub repository. |

## Capture and edit instructions

1. Use OBS Studio or another screen recorder; set canvas and output to 1920x1080,
   30 fps, 16:9. Record the production URL, not a local mock or recreated UI.
2. Use a fresh browser session, hide bookmarks and personal browser profile
   information, and use only the seeded synthetic demo learner.
3. Capture each storyboard scene separately. Allow a short pause after clicks so
   the real interface finishes loading. Do not record developer tools, terminals,
   account settings, environment variables, or credentials.
4. Generate narration from the supplied voiceover text with an authorized
   natural-sounding English TTS service. Do not describe system speech as AI
   narration. Keep the demo-mode notice audible/visible during the assistant scene.
5. Edit the screen recordings to the storyboard, add restrained transitions and
   low-volume licensed music, then synchronize the subtitle cues to the final
   narration waveform. The current SRT timings are an edit guide, not verified
   against audio that has not been generated.
6. Export H.264 MP4 at 1920x1080, 30 fps, AAC audio. Save as
   `deliverables/EduPath_AI_Product_Demo.mp4` only after genuine recording,
   narration, edit, and playback verification.

No MP4 is included yet: no screen recording or AI voice audio has been produced.
