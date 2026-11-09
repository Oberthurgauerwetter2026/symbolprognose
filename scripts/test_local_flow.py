import numpy as np
from _flow import local_flow, advect


def blob(h, w, cy, cx, r=10):
    y, x = np.indices((h, w))
    return np.where((y - cy) ** 2 + (x - cx) ** 2 <= r * r, 5.0, 0.0)


def test_two_cells_get_own_directions():
    h, w = 120, 240
    prev = blob(h, w, 60, 50) + blob(h, w, 60, 180)
    # links zieht nach Osten (+6 px), rechts bleibt stehen
    cur = blob(h, w, 60, 56) + blob(h, w, 60, 180)
    u, v = local_flow(prev, cur, 15.0, 3.0, 0.0)
    assert u[60, 56] * 15 > 4.5
    assert abs(u[60, 180] * 15) < 1.5


def test_no_signal_returns_none():
    z = np.zeros((100, 100))
    assert local_flow(z, z, 15.0, 1.0, 0.0) is None


def test_advect_moves_cell_downstream():
    h, w = 80, 160
    f = blob(h, w, 40, 40, 6)
    u = np.full((h, w), 1.0); v = np.zeros((h, w))
    out = advect(f, u, v, 30.0)
    assert out[40, 70] > 4 and out[40, 40] < 1


def test_advect_zero_flow_is_identity():
    f = blob(60, 60, 30, 30, 5)
    z = np.zeros((60, 60))
    assert np.allclose(advect(f, z, z, 60.0), f)


def test_inflow_buffer_fills_west_edge():
    import numpy as np
    from _flow import advect_with_inflow
    pad, h, w = 20, 30, 40
    field = np.zeros((h, w))
    wide = np.zeros((h + 2 * pad, w + 2 * pad))
    wide[:, pad - 15:pad] = 2.0  # gemessener Regen westlich des Ausschnitts
    u = np.full((h, w), 1.0); v = np.zeros((h, w))  # 1 px/min nach Osten
    out = advect_with_inflow(field, wide, u, v, 10, pad, fade_px=3)
    assert out[h // 2, 5] > 1.5  # Einstrom statt Linealkante
