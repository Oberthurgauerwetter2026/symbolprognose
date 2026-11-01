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


if __name__ == "__main__":
    unittest.main()
