# Project rules
- Forecast PNG URLs are content-addressed and published before the manifest; cleanup retains recent generations so interrupted ingests and open tabs remain safe.
- Missing radar images are loading failures, never evidence of dry weather; never cache fallback renders under a missing URL.
- Radar playback timing lives in a pure, tested timeline module; render time and the snapped filmstrip time are separate so transitions cannot move labels early.
- The dense Open-Meteo forecast fetch is split across parallel GitHub runners (shards) and merged in one publish job, because one runner IP would exceed Open-Meteo's hourly request limit; any missing shard aborts publication.
- Precipitation phase is refined per map pixel with the committed DEM (scripts/terrain_elev_420x200.npy, same 420x200 bbox as radar); regenerate it whenever the radar bbox or raster changes, because model terrain is too smooth for snow lines.
- Forecast contour texture is stationary in native PNG coordinates, with weak-edge-only ingest roughening and subpixel edge sampling; retain bilinear sampling and unchanged strong cores to avoid coarse blocks or fabricated intensity changes.
- Map place labels are dropped by a pure, tested declutter step in Web-Mercator pixels (priority: large cities, then medium towns, then peaks, then local places), so adding a place never requires manual collision checks.
