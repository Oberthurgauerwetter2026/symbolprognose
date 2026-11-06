import os, sys, unittest
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from _phase import phase_field_rgba, ALPHA_SNOW, ALPHA_SLEET, ALPHA_FZRA


class PhaseFieldTest(unittest.TestCase):
    def test_every_pixel_carries_local_phase(self):
        # Säntis-Pixel Schnee, Hang Schneeregen, Flachland Regen — auch ohne Niederschlag.
        frac = np.array([[1.0, 0.5, 0.0]])
        a = phase_field_rgba((1, 3), frac)[..., 3][0]
        self.assertEqual(list(a), [ALPHA_SNOW, ALPHA_SLEET, 245])

    def test_freezing_rain_overrides(self):
        a = phase_field_rgba((1, 2), np.array([[0.0, 1.0]]), np.array([[1.0, 0.0]]))[..., 3][0]
        self.assertEqual(list(a), [ALPHA_FZRA, ALPHA_SNOW])

    def test_missing_model_is_rain(self):
        a = phase_field_rgba((2, 2), None)[..., 3]
        self.assertTrue((a == 245).all())


if __name__ == "__main__":
    unittest.main()
