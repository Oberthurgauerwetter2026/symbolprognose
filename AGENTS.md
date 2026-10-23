# Project rules
- Forecast PNG URLs are content-addressed and published before the manifest; cleanup retains recent generations so interrupted ingests and open tabs remain safe.
- Missing radar images are loading failures, never evidence of dry weather; never cache fallback renders under a missing URL.
- Radar playback timing lives in a pure, tested timeline module; render time and the snapped filmstrip time are separate so transitions cannot move labels early.- The dense Open-Meteo forecast fetch is split across parallel GitHub runners (shards) and merged in one publish job, because one runner IP would exceed Open-Meteo's hourly request limit; any missing shard aborts publication.
