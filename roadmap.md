# Region map desktop only, dark frame
- [x] Phone home no longer shows the region symbol map (link under «Mehr Wetter» stays); desktop map frame is night blue like the tiles. Checked at 1557 and 390 px: desktop map, search and level bottom edges intact, phone loads no map, no overflow or page errors. Not checked on a physical phone.

# Blue detail pages and ticker tile
- [x] Opened detail pages use the website blue with night-blue controls and white text instead of a white page; the ticker is a tile among the product tiles (desktop and phone) and opens its own page. Checked at 1557 and 390 px: all eleven detail pages render without page errors, ticker tile opens /ticker and X returns to the same position, right column ends level with the region map, no overflow. Ticker seen only in standby (no post in 24 h); timeline strips under radar/wind/satellite and the local forecast sheet stay light.

# Home: map, ticker, return position
- [x] Phone home also shows the normal interactive region map and the ticker; desktop tile images use 1.5 so the warning map is fully visible; closing a tile (X) returns to the place it was opened. Checked at 1557 and 390 px: map and ticker visible, tile returns to the same position, direct open + X lands at top, no overflow; 4 tests pass. Not checked on a physical phone.

# Separate desktop home
- [x] Desktop (lg+) home: region symbol map left, raised radar + report preview + ticker right, six product tiles below; phone layout unchanged. Checked at 1557/1100/390 px: map and markers render, radar opens and closes home, no overflow; phone loads no map or ticker. Ticker seen only in standby (no post in 24 h).

# Radar point outlook
- [x] Add native-pixel dry-area fallback only for absent nowcasts (100 km/h approach plus image age, bounded by image edges). 18 tests pass; real Amriswil shows «Voraussichtlich 30 Min. trocken» at 1557/390 px, no overflow or browser errors, preview build OK; embeds unchanged.
- [x] Show dry / rain / sleet / snow and approximate arrival minutes below the home symbol using native radar nowcast frames; nine tests pass. Real Amriswil input checked on desktop/phone: current data provide only the measurement, so the UI correctly reports unavailable; no false dry claim, no overflow or browser errors.
- [ ] Verify live precipitation arrival: waiting for a real precipitation event with complete nowcast data; rain/sleet/snow arrival minutes are tested. Live dry fallback is verified above.

# Compact location and precipitation outlook
- [x] Group location and temperature with a small gap; show local rain/snow/dry outlook below the current symbol without loading radar frames or changing embeds.
- [x] Ten trend/hour-selection tests pass; real Horn and Amriswil forecasts checked at 1557/390/320 px, temperature 4 px below place, outlook visible without overflow or browser errors; preview build OK. Rain/snow branches covered by unit tests, current live outlook is dry.

# Local hourly overview and app launch
- [x] Show upcoming local forecast hours below the temperature and open the same place's full symbol forecast with X home return.
- [x] Start the main installed weather app on home and return home when reopened; preserve browser deep links, admin and existing embeds. Manifest identity retained for existing installations.
- [x] Verify real Horn/Amriswil forecasts, place selection and detail/X navigation at desktop/390 px without overflow or page errors; seven tests pass, build OK. Standalone visibility/resume tested through browser simulation, not a physically installed phone app; publication remains separate.

# Tile arrangement planning mask
- [x] Add a separate visual planning mask at /admin/anordnung with independent phone/desktop layouts, ordering, widths, visibility, local saving and JSON draft exchange; three tests pass, real move/resize/hide/save/reload/export/import and home return verified at 1557/390/320 px without browser errors or overflow. Public home and existing embeds unchanged; drafts are device-local, not published.

# Mobile weather overview and editorial report
- [x] Refine the blue regional overview and focused product pages with visible return navigation; integrate temperature, daily gust and rain selections without an external jump. Nine real stations and all five selections checked at 320/402/768/1440 px, radar/wind/warnings/report and home return verified, no overflow or runtime errors; 14 station and 3 report tests pass, preview build OK. Publication and WordPress remain unchanged.
- [x] Replace the start page with lightweight product tiles and nearest-station readings; verified at 320/390/768/1440 px, geolocation selects Horn, no overflow or iframes, radar opens its live map. Preview images total about 44 KB.
- [x] Add public report summary/detail and password-protected smartphone publishing; real admin login, incorrect password rejection, publish, update, reload and public summary/detail readback verified. Test report removed; 3 overview/report tests and 14 station tests pass; preview build OK.
- [ ] Make the new overview live: publish the app; WordPress itself has not been changed.

# Ticker widget entry limit
- [x] Sidebar widget shows only the three newest messages, then «weitere …» / «schliessen»; two tests pass, collapsed and expanded verified in the browser at phone width (329 px → 578 px), banner unchanged.

# Fine forecast snow contours
- [x] Generate source-sampled 840×400 terrain and use it in forecast PNGs, preserving phase gates, colors and native rainfall texture; 47 Python and 31 radar tests pass. Live existing radar checked without errors; generated fine-terrain test PNG decoded in the real map at desktop/390 px without overflow (controlled test imagery, not live forecast verification).
- [ ] Verify new live forecast imagery: requires source synchronization and a successful model ingest.

# WordPress ticker sizing
- [x] Add persistent admin on/off for automatic radar thunderstorm warnings; four tests pass, signed-in toggle/reload/restoration and mobile verified. Existing warnings expire normally; manual warnings unchanged.
- [x] Replace fragile inline resize scripts with a shared external file and late-load handshake; make standby compact and keep the full info/message visible as content grows and shrinks. Admin snippets now use the external script; standby preview stays visible.
- [x] Verify generated WordPress snippets at 320/375/402 px and 320 px desktop sidebar: standby 68–90 px, full info 188–253 px, returning to the original height; 28 regression tests pass. An expired database-backed test post read back through both embeds with two real station cards, then was removed; isolated component checks with the same input confirm attachment lazy loading and grow/shrink without runtime errors. Signed-in admin remains unverified without a valid admin session (existing blocker below).
- [ ] Activate on the WordPress site: publish the app and replace both existing embed codes in WordPress; the external site still contains the old broken inline script.

# Ticker link destinations
- [x] Correct every catalog destination: matching WordPress pages when available, otherwise the selected interactive map with its parameters; all 33 products resolve to 28 HTTP-200 destinations without redirects, and 36 regression tests pass. A real temporary five-card post read back through the public widget/banner, its radar link opened the correct WordPress page, and mobile has no overflow or runtime errors; temporary post removed. Snow 72 h and maximum gust selection verified with real data. Signed-in admin verification remains blocked by the rejected available admin credential, as recorded below.

# Satellite portrait framing
- [x] Fit the entire Swiss outline to the actual satellite-map container on phones and resize; four framing tests pass, and real imagery verified at 375/402 px, landscape and desktop, with both embeds and Europe/Switzerland switching. Desktop stays at zoom 7; no cropped Swiss bounds, horizontal overflow or runtime errors. Remove tile layers before clearing their listeners to keep resize and region changes stable.

# Reader photo notifications
- [x] Add password-protected device opt-in, disable and test controls, and delivery attempts after successful reader photo submission; preserve weather-warning subscriptions. Seven tests pass; unauthorized registration rejected; real photo accepted, read back in admin and removed; mobile has no overflow.
- [ ] Verify actual push receipt on a real device: automated Chromium denies push registration; activate on the published admin page and use Test senden.

# Additional ticker station maps
- [x] Add current temperatures, today's strongest gusts and daily precipitation using the existing regional station map; nine real station readings verified in all five views at desktop/mobile sizes, no controls or browser errors, 16 tests pass. Existing WordPress live map stays unchanged.

# Ticker station temperature coverage
- [x] Include Sitterdorf-Bischofszell and Güttingen on both daily extreme temperature maps; real Weather Hub daily readings verified, all nine live-map pills visible without overlap or controls at desktop and mobile sizes, WordPress live overview unchanged. Fourteen tests pass; no browser errors.

# Precipitation sums usability
- [x] Restore identical regional framing for rain and snow; map-only previews fit Oberthurgau, Lake Constance and Alpstein at desktop/mobile ticker sizes, without headers or buttons and with a retained color scale. Sixteen tests pass; all six local map types checked without buttons and a real public ticker post opens its attached map without runtime errors.
- [x] Local ticker map previews use same-origin map-only embeds; seven catalog tests preserve all 16 sum selections, and live sum/wind/radar/region/warning/satellite views checked without toolbars.
- [x] Verify a visitor post with an attached map: public ticker opens its selected map successfully.
- [ ] Verify the signed-in ticker selection: available admin credential was previously rejected; requires a valid admin session.
- [ ] Make external Weather Hub and Amriswil product previews map-only: their pages require changes in the originating projects; read-only snapshots cannot be modified here.
- [x] Apply the shared DEM to past model-fallback snow for 12/24/48/72 h; measured snow unchanged. 13 tests pass; live 72 h model fallback follows alpine relief, mobile/desktop switching has no runtime errors or overflow.
- [x] Separate period and precipitation selection into two rows, with time windows directly above the map and an independent download icon; live mobile/desktop switching checked, no overflow or browser errors.
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