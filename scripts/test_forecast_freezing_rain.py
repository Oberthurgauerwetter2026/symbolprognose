"""Check the terrain cap on actual forecast PNGs, not only field helpers."""
import io

import numpy as np
from PIL import Image

from _phase import ALPHA_FZRA, load_dem
from ingest_openmeteo import _render_frame_png, FORECAST_OUT_H, FORECAST_OUT_W


def test_forecast_png_never_shows_freezing_rain_above_800m():
    # A uniformly interpolated valley signal would otherwise cover mountains.
    png = _render_frame_png(2, 2, [2.0] * 4, fzra_row_major=[1.0] * 4)
    alpha = np.asarray(Image.open(io.BytesIO(png)))[..., 3]
    dem = load_dem((FORECAST_OUT_H, FORECAST_OUT_W))
    assert dem is not None
    lowland = np.isfinite(dem) & (dem <= 800.0)
    mountains = np.isfinite(dem) & (dem > 800.0)
    assert lowland.any() and mountains.any()
    assert np.all(alpha[lowland] == ALPHA_FZRA)
    assert np.all(alpha[mountains] != ALPHA_FZRA)
    assert np.all(alpha[mountains] > 0)  # Rain remains visible.


if __name__ == "__main__":
    test_forecast_png_never_shows_freezing_rain_above_800m()
    print("forecast PNG terrain test passed")