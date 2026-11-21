"""Fine terrain must reveal falling lowland snow without changing phase gates."""
import io
import unittest
import numpy as np
from PIL import Image
from _phase import ALPHA_SLEET, ALPHA_SNOW, load_dem, terrain_temp, terrain_fraction
from ingest_openmeteo import _render_frame_png


class ForecastTerrainDetailTests(unittest.TestCase):
    def test_real_fine_dem_is_not_an_enlargement(self):
        fine = load_dem((400, 840))
        coarse = load_dem((200, 420))
        self.assertIsNotNone(fine)
        self.assertIsNotNone(coarse)
        self.assertTrue(np.isfinite(fine).all())
        self.assertGreater(np.mean(np.abs(fine - np.repeat(np.repeat(coarse, 2, axis=0), 2, axis=1))), 10)
        # North-up: Lake Constance lowlands vs. Säntis.
        def at(lat, lon):
            return fine[round((48.6-lat)/2*399), round((lon-7.4)/4.2*839)]
        self.assertLess(at(47.6, 9.4), 450)
        self.assertGreater(at(47.249, 9.343), 1800)
        self.assertIsNone(load_dem((401, 840)))

    def test_fine_slope_retains_rain_sleet_snow(self):
        # A 200 m hillside straddles the existing phase transition.
        heights = np.array([400., 550., 600.])
        t = terrain_temp(np.ones(3), np.full(3, 500.), heights)
        fraction = terrain_fraction(np.zeros(3), t)
        self.assertEqual(fraction[0], 0)
        self.assertGreaterEqual(fraction[1], .3)
        self.assertLess(fraction[1], .7)
        self.assertEqual(fraction[2], 1)

    def test_falling_snow_line_reaches_lowlands_in_actual_png(self):
        args = dict(n_lat=2, n_lon=2, mmh_row_major=[5.] * 4,
                    snow_cm_row_major=[0.] * 4, elev_row_major=[500.] * 4)
        warm = np.asarray(Image.open(io.BytesIO(_render_frame_png(**args, temp_c_row_major=[3.] * 4))))
        cold = np.asarray(Image.open(io.BytesIO(_render_frame_png(**args, temp_c_row_major=[-1.] * 4))))
        self.assertEqual(cold.shape, (400, 840, 4))
        y, x = round((48.6-47.6)/2*399), round((9.4-7.4)/4.2*839)
        self.assertEqual(warm[y, x, 3], 255)  # Wet lowland, still rain.
        self.assertEqual(cold[y, x, 3], ALPHA_SNOW)  # Same pixel, later snow.
        np.testing.assert_array_equal(warm[..., :3], cold[..., :3])
        self.assertTrue(np.isin(cold[..., 3], [ALPHA_SNOW, ALPHA_SLEET, 245, 255]).all())

    def test_dry_forecast_does_not_gain_snow(self):
        png = _render_frame_png(2, 2, [0.] * 4, snow_cm_row_major=[0.] * 4,
                                temp_c_row_major=[-2.] * 4, elev_row_major=[500.] * 4)
        self.assertTrue((np.asarray(Image.open(io.BytesIO(png)))[..., 3] == 0).all())


if __name__ == '__main__':
    unittest.main()