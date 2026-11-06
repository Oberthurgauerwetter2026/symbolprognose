import unittest
from _steering import centroid_track, guard_direction


class DirectionGuard(unittest.TestCase):
    def test_track_west_to_east(self):
        tr = centroid_track([(-20, -8, 0), (-15, -6, 0), (-10, -4, 0), (-5, -2, 0), (0, 0, 0)])
        self.assertAlmostEqual(tr[0], 270.0, delta=0.5)
        self.assertAlmostEqual(tr[1], 24.0, delta=0.5)

    def test_reverse_vector_is_overruled(self):
        m = guard_direction({"dirFromDeg": 90.0, "kmh": 20.0}, (270.0, 24.0, 1.0))
        self.assertEqual(m["dirFromDeg"], 270.0)

    def test_moderate_deviation_clamped_to_45(self):
        m = guard_direction({"dirFromDeg": 330.0, "kmh": 20.0}, (260.0, 24.0, 1.0))
        self.assertAlmostEqual(m["dirFromDeg"], 305.0, delta=0.1)

    def test_small_deviation_unchanged(self):
        m = guard_direction({"dirFromDeg": 250.0, "kmh": 20.0}, (270.0, 24.0, 1.0))
        self.assertEqual(m["dirFromDeg"], 250.0)

    def test_jittery_or_tiny_track_ignored(self):
        self.assertIsNone(centroid_track([(-10, 0, 0), (-5, 1, 0), (0, 1.5, 0)]))
        self.assertIsNone(centroid_track([(-10, 0, 0), (-5, 6, 0), (0, 0.5, 4)]))


if __name__ == "__main__":
    unittest.main()
