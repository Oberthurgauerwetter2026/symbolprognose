## Fix

`scripts/ingest_arome.py`, Zeile 234:

```python
smooth = np.array(up, dtype=np.float32)  # statt np.asarray(...)
```

`np.array(...)` kopiert und liefert ein writable Array, das `np.clip(..., out=smooth)` braucht. Eine Zeile, sonst nichts.

## Verifikation

Workflow „AROME-HD Ingest" manuell triggern → sollte komplett durchlaufen, `arome/frames.json` + 42 PNGs landen in R2, Toggle „AROME-HD" auf `/karten/radar` zeigt Frames.
