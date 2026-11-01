import unittest
import io
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import numpy as np
from PIL import Image
from _nowcast import aligned_previous, observed_tendency, evolve_intensity


class TendencyTests(unittest.TestCase):
    def setUp(self):
        self.old = np.zeros((60, 80))
        self.old[15:40, 15:40] = 2
        self.moved = np.zeros_like(self.old)
        self.moved[15:40, 21:46] = 2

    def test_translation_is_not_growth(self):
        rate = observed_tendency(self.old, self.moved, 15, 6, 0, 0.9)
        self.assertIsNotNone(rate)
        np.testing.assert_allclose(rate, 0)
        np.testing.assert_allclose(evolve_intensity(self.moved, rate, 55), self.moved)

    def test_observed_growth_increases_intensity_not_dry_pixels(self):
        cur = self.moved * 1.2
        rate = observed_tendency(self.old, cur, 15, 6, 0, 0.9)
        result = evolve_intensity(cur, rate, 30)
        self.assertGreater(result[25, 30], 2.4)
        self.assertLessEqual(result.max(), cur.max() * 1.35)
        self.assertEqual(result[0, 0], 0)

    def test_observed_decay_reduces_intensity(self):
        cur = self.moved * 0.8
        rate = observed_tendency(self.old, cur, 20, 6, 0, 0.9)
        self.assertLess(evolve_intensity(cur, rate, 30)[25, 30], 1.6)

    def test_decay_can_remove_weak_visible_edges(self):
        old = np.full((30, 30), 0.15)
        cur = np.full((30, 30), 0.11)
        rate = observed_tendency(old, cur, 15, 0, 0, 0.9)
        self.assertLess(evolve_intensity(cur, rate, 55)[15, 15], 0.1)

    def test_missing_or_unreliable_observations_are_neutral(self):
        for old, minutes, quality in [(self.old, 5, 0.9), (self.old, 15, 0.4),
                                      (np.full_like(self.old, np.nan), 15, 0.9)]:
            rate = observed_tendency(old, self.moved, minutes, 6, 0, quality)
            self.assertIsNone(rate)
            np.testing.assert_equal(evolve_intensity(self.moved, rate, 30), self.moved)

    def test_alignment_does_not_wrap_edges(self):
        shifted = aligned_previous(self.old, 6, 0)
        self.assertTrue(np.isnan(shifted[:, :6]).all())
        self.assertEqual(shifted[25, 30], 2)

    def test_growth_is_bounded_and_damped_for_long_leads(self):
        rate = observed_tendency(self.old, self.moved * 10, 15, 6, 0, 0.9)
        result = evolve_intensity(self.moved * 10, rate, 1000)
        self.assertLessEqual(result.max(), 27.0)
        np.testing.assert_equal(evolve_intensity(self.moved, rate, 0), self.moved)


if __name__ == '__main__':
    unittest.main()