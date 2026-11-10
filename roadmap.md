# Precipitation sums usability
- [x] Increase accumulation overlay resolution (option A only): live past image 2070 px, forecast 1995 px; desktop/mobile checked, no browser errors, five interpolation tests pass. Classes and opacity unchanged.
- [x] Show valid zero and trace snow amounts; missing model hours remain unavailable. Retain smooth contours, reduce rendering work, bound upstream requests and add managed background refresh; 19 tests pass.
- [x] Add icon controls, distinguish past/future headers, and include alpine snow areas in snow framing; desktop/mobile interactions checked with live data, no browser errors or horizontal overflow.

# Freezing rain terrain restriction
- [x] Restrict freezing rain to lowland model points and DEM pixels in measurement, nowcast and forecast; 20 tests pass, including the inclusive 800 m boundary, normal-phase fallback and an actual generated forecast PNG with the committed DEM.
- [ ] Verify newly published phase images: awaiting source synchronization and successful radar/model ingestion.

# Symbol forecast refresh
- [x] Select the latest available hourly MeteoSwiss asset per parameter instead of the first daily asset; four regression tests pass and live STAC selects the 06:00 UTC run for hourly/daily symbols and temperature.
- [ ] Verify the updated published forecast: awaiting GitHub source synchronization and a successful ingestion using the corrected script; no live workflow was triggered.

# Embed source attribution
- [x] Consolidate duplicate footers and attribute Oberthurgauer Wetter as publisher, data partners separately, with necessary map credits retained. Browser checks cover local forecast (compact/detail), radar, wind, warnings, sums (rain/snow), satellite, widgets and combined embed; one visible footer, no duplicate Leaflet boxes or browser errors, mobile text fits.

# Radar forecast reliability
- [x] Extend nowcast to 75 minutes with a smooth intensity fade from minute 60 to 75, including fallback measurement PNGs; model reality check unchanged. 29 timeline/rendering-logic tests and seven tendency tests pass; actual 12:55 radar source produces a tail through 14:10, visibly attenuated at 14:05 and clear at 14:10; playback runs without browser errors. Full Python publication suite remains unavailable locally because h5py is not installed (ingest code unchanged).
- [x] Add motion-aligned 15–20-minute observed intensity tendencies for five-minute nowcast PNGs; bounded local growth/decay, damped leads, exact measurement matching, and safe publication. Ten Python and 21 timeline/image-selection tests pass; live radar playback has no runtime errors.
- [ ] Verify observed intensity evolution on the live map: waiting for GitHub source synchronization and a successful radar ingest producing the new tendency PNGs; published frontend also needs republishing. Model forecasts and phase rules remain unchanged.
- [x] Fix and verify the nowcast hour-boundary gap with delayed measurements; 20 regression tests pass and live map advances through five-minute nowcast frames without runtime errors.
- [x] Tune and verify radar playback: 220 ms steps, 50 ms transitions, orientation and loop pauses; browser playback, loop and drag/restart checked, five timing tests pass.
- [x] Safely publish forecast images and retain previous images during interrupted runs.
- [x] Shorten batch pauses and extend workflow timeout, preserving grid resolution.
- [x] Reject missing images instead of displaying artificial dry frames.
- [x] Run regression tests and verify the forecast map.
- [ ] Verify a complete live ingest with the new version: waiting for GitHub source synchronization and a subsequent successful run.
- [x] Strengthen stationary forecast-edge texture and retain it in map sampling; 26 tests pass and real forecast view checked on desktop/mobile. Stronger generated texture awaits the next successful live ingest above.

# Map orientation labels
- [x] Supplement the German side of the map (Lake Constance, Allgäu, Upper Swabia, High Rhine) with Ravensburg, Friedrichshafen, Wangen, Isny, Kempten, Memmingen, Biberach, Sigmaringen, Pfullendorf, Stockach, Waldshut and Freiburg i. Br., plus Feldberg as a peak; radar map checked in the browser — 39 of 42 names shown, no overlaps.
- [x] Keep only genuinely larger German cities on the map (Freiburg i. Br., Ulm, Ravensburg, Kempten, Friedrichshafen, Memmingen, Singen); small spa and district towns removed.
- [x] Add Ottenberg (680 m, Weinfelden) to the peaks as a regional orientation point; it needed a small label offset to clear Frauenfeld and Romanshorn at the standard zoom — six declutter tests pass and the radar map was checked in the browser.