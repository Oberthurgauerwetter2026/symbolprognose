# Radar forecast reliability
- [x] Tune and verify radar playback: 220 ms steps, 50 ms transitions, orientation and loop pauses; browser playback, loop and drag/restart checked, five timing tests pass.
- [x] Safely publish forecast images and retain previous images during interrupted runs.
- [x] Shorten batch pauses and extend workflow timeout, preserving grid resolution.
- [x] Reject missing images instead of displaying artificial dry frames.
- [x] Run regression tests and verify the forecast map.
- [ ] Verify a complete live ingest with the new version: waiting for GitHub source synchronization and a subsequent successful run.