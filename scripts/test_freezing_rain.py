import numpy as np
from _phase import (
    ALPHA_FZRA, ALPHA_SNOW, ALPHA_SLEET, apply_phase_alpha,
    freezing_rain_point, terrain_freezing_rain, phase_field_rgba,
)


def test_frost_with_warm_layer_is_freezing_rain():
    assert freezing_rain_point([1.0], [0.0], [-1.0], [900.0], [450.0])[0] == 1.0


def test_no_warm_layer_is_not_freezing_rain():
    assert freezing_rain_point([1.0], [0.0], [-1.0], [600.0], [450.0])[0] == 0.0


def test_above_zero_is_not_freezing_rain():
    assert freezing_rain_point([1.0], [0.0], [0.5], [1500.0], [450.0])[0] == 0.0


def test_snowing_is_not_freezing_rain():
    assert freezing_rain_point([1.0], [1.0], [-1.0], [900.0], [450.0])[0] == 0.0


def test_alpha_code():
    rgba = np.zeros((1, 2, 4), np.uint8); rgba[..., 3] = 245
    out = apply_phase_alpha(rgba, None, np.array([[0.6, 0.4]]))
    assert list(out[0, :, 3]) == [ALPHA_FZRA, 245]


def test_model_points_only_allow_freezing_rain_up_to_800m_inclusive():
    out = freezing_rain_point(
        [1.0] * 5, [0.0] * 5, [-1.0] * 5, [3000.0] * 5,
        [450.0, 800.0, 800.1, 2501.0, np.nan],
    )
    np.testing.assert_array_equal(out, [1.0, 1.0, 0.0, 0.0, 0.0])


def test_interpolated_pixels_only_allow_freezing_rain_up_to_800m_inclusive():
    out = terrain_freezing_rain(
        np.array([[0.8, 0.7, 0.9, 1.0, 1.0]]),
        np.array([[450.0, 800.0, 800.1, 2501.0, np.nan]]),
    )
    np.testing.assert_allclose(out, [[0.8, 0.7, 0.0, 0.0, 0.0]])


def test_above_800m_keeps_normal_phase_in_measurement_and_nowcast_field():
    frac = np.array([[0.0, 0.0, 0.5, 1.0]])
    fzra = terrain_freezing_rain(np.ones((1, 4)), np.array([[800.0, 801.0, 1000.0, 2501.0]]))
    measurement = np.zeros((1, 4, 4), np.uint8)
    measurement[..., 3] = 245
    for out in (apply_phase_alpha(measurement, frac, fzra), phase_field_rgba((1, 4), frac, fzra)):
        np.testing.assert_array_equal(out[0, :, 3], [ALPHA_FZRA, 245, ALPHA_SLEET, ALPHA_SNOW])


def test_missing_pixel_terrain_does_not_mark_freezing_rain():
    np.testing.assert_array_equal(terrain_freezing_rain(np.ones((1, 2)), None), [[0.0, 0.0]])

if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f()
    print("ok")
