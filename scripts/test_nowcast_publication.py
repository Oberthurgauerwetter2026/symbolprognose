"""Offline integration test: observations -> PNGs -> public frame references."""
import io
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import numpy as np
from PIL import Image
import ingest_radar as ingest


class FakeS3:
    def __init__(self):
        self.objects = {}

    def put_object(self, Bucket, Key, Body, **kwargs):
        self.objects[Key] = Body


class PublicationTests(unittest.TestCase):
    def observations(self):
        ts = datetime(2026, 11, 1, 9, 25, tzinfo=timezone.utc)
        loaded = []
        for i in range(5):
            field = np.zeros((ingest.OUT_H, ingest.OUT_W))
            field[60:100, 100+i:140+i] = 0.11 if i == 4 else 0.15
            loaded.append((field, ts - timedelta(minutes=20-i*5)))
        mid_lat = (ingest.MOTION_WINDOW['minLat'] + ingest.MOTION_WINDOW['maxLat']) / 2
        km_per_pixel = ((ingest.BBOX_WGS['maxLon'] - ingest.BBOX_WGS['minLon'])
                        / (ingest.OUT_W-1) * 111.32 * np.cos(np.radians(mid_lat)))
        return loaded, {'dirFromDeg': 270, 'kmh': km_per_pixel * 12, 'quality': 0.9}

    def test_generated_pngs_decay_and_all_references_exist(self):
        loaded, motion = self.observations()
        s3 = FakeS3()
        with patch.object(ingest, 'PUBLIC_URL', 'https://weather.test'), \
             patch.object(ingest, 'phase_fraction_at', return_value=None), \
             patch.object(ingest, 'freezing_rain_at', return_value=None):
            frames = ingest.publish_tendency_frames(s3, loaded, motion)
        self.assertEqual(len(frames), 16)
        self.assertEqual(frames[0]['t'], '2026-11-01T09:30:00Z')
        self.assertEqual(frames[0]['sourceT'], '2026-11-01T09:25:00Z')
        for frame in frames:
            self.assertIn(frame['precipUrl'].removeprefix('https://weather.test/'), s3.objects)
        def wet_count(frame):
            png = s3.objects[frame['precipUrl'].removeprefix('https://weather.test/')]
            return np.count_nonzero(np.asarray(Image.open(io.BytesIO(png)))[:, :, 3])
        self.assertGreater(wet_count(frames[0]), wet_count(frames[-1]))

    def test_failed_upload_does_not_return_partial_frames(self):
        loaded, motion = self.observations()
        s3 = FakeS3()
        with patch.object(ingest, 'phase_fraction_at', return_value=None), \
             patch.object(ingest, 'freezing_rain_at', return_value=None), \
             patch.object(s3, 'put_object', side_effect=RuntimeError('upload failed')):
            with self.assertRaises(RuntimeError):
                ingest.publish_tendency_frames(s3, loaded, motion)

    def test_unreliable_motion_keeps_original_advection(self):
        loaded, motion = self.observations()
        motion['quality'] = 0.4
        self.assertEqual(ingest.publish_tendency_frames(FakeS3(), loaded, motion), [])


if __name__ == '__main__':
    unittest.main()