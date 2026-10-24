import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from _phase import load_dem, terrain_fraction, terrain_temp


class TerrainPhaseTest(unittest.TestCase):
    def test_dem_has_relief(self):
        dem = load_dem((200, 420))
        self.assertIsNotNone(dem)
        # Säntis-Pixel deutlich höher als Bodensee-Pixel
        def at(lat, lon):
            return dem[round((48.6 - lat) / 2.0 * 199), round((lon - 7.4) / 4.2 * 419)]
        self.assertGreater(at(47.249, 9.343), 1800)
        self.assertLess(at(47.6, 9.4), 450)

    def test_peak_snow_valley_rain(self):
        # Modellpunkt auf 1200 m mit 3 °C: Gipfel 2400 m → Schnee, Tal 400 m → Regen
        t = terrain_temp(np.array([3.0, 3.0, 3.0]), np.array([1200.0] * 3), np.array([2400.0, 1500.0, 400.0]))
        f = terrain_fraction(np.zeros(3), t)
        self.assertEqual(f[0], 1.0)           # Schnee
        self.assertTrue(0.3 <= f[1] < 0.7)    # Schneeregen am Hang
        self.assertEqual(f[2], 0.0)           # Regen im Tal


if __name__ == "__main__":
    unittest.main()
