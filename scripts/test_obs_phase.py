import numpy as np
from _phase import observed_freezing_level, station_correct

LAT = np.array([47.55, 47.30]); LON = np.array([9.32, 9.34]); EL = np.array([440.0, 2400.0])


def test_cold_station_cools_nearby_ground_point():
    out = station_correct(LAT, LON, EL, np.array([1.5, -5.0]), [(47.553, 9.320, 437, -0.5)])
    assert out[0] < 0.0


def test_mountain_point_is_never_changed():
    out = station_correct(LAT, LON, EL, np.array([1.5, -5.0]), [(47.553, 9.320, 437, -0.5)])
    assert out[1] == -5.0


def test_far_station_has_no_effect():
    out = station_correct(LAT, LON, EL, np.array([1.5, -5.0]), [(46.5, 7.0, 440, -5.0)])
    assert out[0] == 1.5


def test_warm_hoernli_raises_freezing_level():
    fz = observed_freezing_level(EL, np.array([500.0, 500.0]), [(47.37, 8.94, 1133, 3.0), (47.25, 9.34, 2501, -4.0)])
    assert fz[0] > 1500


def test_all_cold_aloft_removes_warm_nose():
    fz = observed_freezing_level(EL, np.array([1200.0, 1200.0]), [(47.37, 8.94, 1133, -2.0), (47.25, 9.34, 2501, -8.0)])
    assert fz[0] <= 540
