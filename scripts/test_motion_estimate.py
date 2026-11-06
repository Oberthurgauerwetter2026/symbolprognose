"""Tests: Verlagerungsschätzung akzeptiert quasi-stationäre Felder (0 km/h)."""
import unittest
import numpy as np
import ingest_radar as ingest


def field(col0: int, row0: int = 95) -> np.ndarray:
    f = np.zeros((ingest.OUT_H, ingest.OUT_W))
    f[row0 : row0 + 20, col0 : col0 + 20] = 0.5
    return f


class MotionEstimateTests(unittest.TestCase):
    def test_stationary_field_yields_zero_kmh(self):
        # Quasi-stationärer Stauregen: identisches Feld → 0 km/h ist brauchbar,
        # kein Abbruch mehr, weil die Schwelle bei 5 km/h lag.
        prev = field(195)
        cur = field(195)
        motion = ingest.estimate_motion(prev, cur, 5.0)
        self.assertIsNotNone(motion)
        self.assertEqual(motion["kmh"], 0.0)
        self.assertGreaterEqual(motion["quality"], 0.35)

    def test_moving_field_still_detected(self):
        # 5 px nach Osten in 5 Minuten ≈ 45 km/h, Herkunft West (270°).
        prev = field(195)
        cur = field(200)
        motion = ingest.estimate_motion(prev, cur, 5.0)
        self.assertIsNotNone(motion)
        self.assertGreaterEqual(motion["kmh"], 40.0)
        self.assertLessEqual(motion["kmh"], 50.0)
        self.assertAlmostEqual(motion["dirFromDeg"], 270.0, delta=5.0)

    def test_lead_fields_still_require_movement(self):
        # Anflug-Warnung bleibt an Bewegung gebunden: 0 km/h → keine Vorlauffelder.
        self.assertEqual(ingest._lead_fields(field(195), {"dirFromDeg": 270.0, "kmh": 0.0}), [])

    def test_fifteen_minute_base_detects_slow_drift(self):
        # 2 px in 15 Minuten: langsame Drift wird mit 15-Min-Basis erkannt.
        motion = ingest.estimate_motion(field(195), field(197), 15.0)
        self.assertIsNotNone(motion)
        self.assertAlmostEqual(motion["dirFromDeg"], 270.0, delta=10.0)

    def test_weak_radar_direction_nudged_to_steering(self):
        from _steering import nudge_motion
        weak = {"dirFromDeg": 346.0, "kmh": 5.3, "quality": 0.4}
        out = nudge_motion(weak, 67.0, 49.0)
        self.assertEqual(out["kmh"], 5.3)  # Tempo bleibt aus dem Radar
        self.assertGreater(out["dirFromDeg"], 40.0)
        self.assertLess(out["dirFromDeg"], 70.0)

    def test_strong_radar_direction_kept(self):
        from _steering import nudge_motion
        strong = {"dirFromDeg": 270.0, "kmh": 40.0, "quality": 0.9}
        self.assertEqual(nudge_motion(strong, 67.0, 49.0)["dirFromDeg"], 270.0)

    def test_stationary_and_missing_steering_unchanged(self):
        from _steering import nudge_motion
        still = {"dirFromDeg": 0.0, "kmh": 0.0, "quality": 0.9}
        self.assertEqual(nudge_motion(still, 67.0, 49.0), still)
        m = {"dirFromDeg": 300.0, "kmh": 10.0, "quality": 0.5}
        self.assertEqual(nudge_motion(m, None, None), m)


    def test_clear_slow_measurement_beats_opposite_steering(self):
        from _steering import nudge_motion
        slow = {"dirFromDeg": 270.0, "kmh": 12.0, "quality": 0.95}
        self.assertEqual(nudge_motion(slow, 90.0, 40.0)["dirFromDeg"], 270.0)

    def test_uncertain_slow_motion_follows_steering_at_least_75_percent(self):
        from _steering import nudge_motion
        slow = {"dirFromDeg": 270.0, "kmh": 12.0, "quality": 0.5}
        self.assertGreaterEqual(nudge_motion(slow, 90.0, 40.0)["steerWeight"], 0.75)

    def test_layer_wind_850_dominates_foehn_aloft(self):
        from _steering import layer_wind
        d, _ = layer_wind((250.0, 24.0), (153.0, 17.5))
        self.assertTrue(205.0 < d < 250.0)
        self.assertEqual(layer_wind(None, (153.0, 17.5)), (153.0, 17.5))
        self.assertIsNone(layer_wind(None, None))

    def test_blend_model_and_saentis(self):
        from _steering import blend_steering
        d, k = blend_steering((60.0, 50.0), (80.0, 30.0))
        self.assertTrue(60.0 < d < 80.0)
        self.assertEqual(blend_steering(None, (80.0, 30.0)), (80.0, 30.0))
        self.assertEqual(blend_steering((60.0, 50.0), (80.0, 2.0)), (60.0, 50.0))
        self.assertEqual(blend_steering(None, None), (None, None))


if __name__ == "__main__":
    unittest.main()
