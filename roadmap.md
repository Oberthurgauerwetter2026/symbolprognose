# Radar forecast reliability
- [x] Tune and verify radar playback: 220 ms steps, 50 ms transitions, orientation and loop pauses; browser playback, loop and drag/restart checked, five timing tests pass.
- [x] Safely publish forecast images and retain previous images during interrupted runs.
- [x] Shorten batch pauses and extend workflow timeout, preserving grid resolution.
- [x] Reject missing images instead of displaying artificial dry frames.
- [x] Run regression tests and verify the forecast map.
- [ ] Verify a complete live ingest with the new version: waiting for GitHub source synchronization and a subsequent successful run.
- [x] Strengthen stationary forecast-edge texture and retain it in map sampling; 26 tests pass and real forecast view checked on desktop/mobile. Stronger generated texture awaits the next successful live ingest above.

# Map orientation labels
- [x] Supplement the German side of the map (Lake Constance, Allgäu, Upper Swabia, High Rhine) with Ravensburg, Friedrichshafen, Wangen, Isny, Kempten, Memmingen, Biberach, Sigmaringen, Pfullendorf, Stockach, Waldshut and Freiburg i. Br., plus Feldberg as a peak; radar map checked in the browser — 39 of 42 names shown, no overlaps.