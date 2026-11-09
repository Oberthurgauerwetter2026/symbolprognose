import os, sys
from datetime import datetime, timedelta, timezone
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_precip_sums import snow_cm, snow_window_sums, resample_phase, grid_axes

def test_rain_gives_no_snow():
    assert snow_cm(np.array([10.0]), np.array([0.0]))[0] == 0
    assert snow_cm(np.array([10.0]), np.array([0.2]))[0] == 0

def test_full_snow_uses_model_ratio():
    assert abs(snow_cm(np.array([10.0]), np.array([1.0]))[0] - 7.0) < 1e-5

def test_hours_without_phase_count_missing():
    lats, lons = grid_axes()
    now = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)
    g = np.full((len(lats), len(lons)), 2.0, np.float32)
    hourly = {now - timedelta(hours=k): g for k in range(12)}
    phase = {now - timedelta(hours=k): np.ones_like(g) for k in range(6)}
    sums, miss = snow_window_sums(hourly, phase, now)
    assert miss[12] == 6
    assert abs(float(sums[12][0, 0]) - 6 * 2.0 * 0.7) < 1e-4

def test_resample_north_up_to_south_up():
    f = np.zeros((200, 420), np.float32); f[0, :] = 1.0  # Nordrand
    out = resample_phase(f, {"minLon": 7.4, "maxLon": 11.6, "minLat": 46.6, "maxLat": 48.6})
    assert out[0].max() == 0.0  # Südzeile bleibt Regen


from ingest_precip_sums import retained_step

def test_warm_bare_ground_eats_first_snow():
    pack, kept = retained_step(np.zeros(1), np.array([0.2]), np.array([1.0]))
    assert kept[0] == 0 and pack[0] == 0

def test_frozen_ground_keeps_all():
    pack, kept = retained_step(np.zeros(1), np.array([2.0]), np.array([-2.0]))
    assert abs(kept[0] - 2.0) < 1e-6 and abs(pack[0] - 2.0) < 1e-6

def test_existing_pack_no_ground_loss():
    _, kept = retained_step(np.array([3.0]), np.array([1.0]), np.array([0.5]))
    assert abs(kept[0] - 0.95) < 1e-6

def test_no_temperature_keeps_all():
    _, kept = retained_step(np.zeros(1), np.array([1.0]), None)
    assert kept[0] == 1.0
