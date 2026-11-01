import unittest
import numpy as np
from _reality_check import wet_grid, damping_factors, residual_factor, encode, decode

BBOX = {"minLon": 7.4, "maxLon": 11.6, "minLat": 46.6, "maxLat": 48.6}
LATS = [47.5]
LONS = [9.3]


class RealityCheckTests(unittest.TestCase):
    def test_dry_radar_damps_model_in_first_hour(self):
        g = wet_grid(np.zeros((200, 420)))
        f = damping_factors(LATS, LONS, 0.5, g, BBOX, None)
        self.assertAlmostEqual(float(f[0, 0]), 0.3)

    def test_wet_radar_keeps_model(self):
        p = np.zeros((200, 420)); p[100:110, 190:200] = 2.0
        f = damping_factors(LATS, LONS, 0.5, wet_grid(p), BBOX, None)
        self.assertEqual(float(f[0, 0]), 1.0)

    def test_upwind_rain_keeps_model(self):
        # Regen 40 km westlich, Zug aus West mit 40 km/h → nach 1 h hier.
        p = np.zeros((200, 420)); p[108:112, 135:140] = 2.0
        g = wet_grid(p)
        self.assertEqual(float(damping_factors(LATS, LONS, 1.0, g, BBOX, {"kmh": 40, "dirFromDeg": 270})[0, 0]), 1.0)
        self.assertLess(float(damping_factors(LATS, LONS, 1.0, g, BBOX, {"kmh": 40, "dirFromDeg": 90})[0, 0]), 1.0)

    def test_no_radar_coverage_keeps_model(self):
        g = wet_grid(np.full((200, 420), np.nan))
        self.assertEqual(float(damping_factors(LATS, LONS, 0.5, g, BBOX, None)[0, 0]), 1.0)

    def test_damping_fades_out_by_three_hours(self):
        self.assertAlmostEqual(residual_factor(2.0), 0.6)
        self.assertEqual(residual_factor(3.0), 1.0)
        self.assertEqual(residual_factor(0.0), 1.0)

    def test_roundtrip(self):
        g = wet_grid(np.zeros((200, 420)))
        np.testing.assert_array_equal(decode(encode(g)), g)


if __name__ == "__main__":
    unittest.main()
