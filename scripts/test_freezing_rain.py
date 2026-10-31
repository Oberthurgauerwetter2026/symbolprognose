import numpy as np
from _phase import ALPHA_FZRA, apply_phase_alpha, freezing_rain_point


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

if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"): f()
    print("ok")
