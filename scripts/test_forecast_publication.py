"""Regression tests for safe forecast publication; no live API calls."""
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import ingest_openmeteo as ingest


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.events = []
        self.fail_manifest = False

    def put_object(self, Bucket, Key, Body, **kwargs):
        self.events.append(("put", Key))
        if self.fail_manifest and Key == "radar/forecast-frames.json":
            raise RuntimeError("R2 temporarily unavailable")
        self.objects[Key] = {"Body": Body, "LastModified": datetime.now(timezone.utc)}

    def head_object(self, Bucket, Key):
        if Key not in self.objects:
            raise RuntimeError("Object not found")
        self.events.append(("head", Key))
        return {"ContentLength": len(self.objects[Key]["Body"])}

    def get_paginator(self, name):
        return self

    def paginate(self, Bucket, Prefix):
        yield {"Contents": [{"Key": k, "LastModified": v["LastModified"]}
                            for k, v in self.objects.items() if k.startswith(Prefix)]}

    def delete_object(self, Bucket, Key):
        self.events.append(("delete", Key))
        del self.objects[Key]


class ForecastPublicationTests(unittest.TestCase):
    def setUp(self):
        self.s3 = FakeS3()
        self.old_key = "radar/forecast/old.png"
        self.s3.objects[self.old_key] = {
            "Body": b"old precipitation", "LastModified": datetime.now(timezone.utc) - timedelta(hours=7)}
        self.s3.objects["radar/forecast-frames.json"] = {"Body": b"old manifest"}
        self.frames = []
        start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        for h in range(49):
            t = start + timedelta(hours=h)
            key = ingest.forecast_png_key(t.strftime("%Y%m%dT%H%M"), b"new precipitation")
            self.s3.put_object(Bucket="weather", Key=key, Body=b"new precipitation")
            self.frames.append({"t": t.isoformat().replace("+00:00", "Z"),
                                "precipUrl": "https://weather.test/" + key})
        self.s3.events.clear()

    def test_content_change_gets_new_url_for_same_time(self):
        self.assertNotEqual(ingest.forecast_png_key("20261022T1200", b"wet"),
                            ingest.forecast_png_key("20261022T1200", b"dry"))
        self.assertEqual(ingest.forecast_png_key("20261022T1200", b"wet"),
                         ingest.forecast_png_key("20261022T1200", b"wet"))

    def test_cleanup_only_after_successful_manifest_and_keeps_recent_images(self):
        recent = "radar/forecast/recent.png"
        self.s3.put_object(Bucket="weather", Key=recent, Body=b"recent")
        ingest.write_forecast_manifest(self.s3, "weather", self.frames)
        self.assertNotIn(self.old_key, self.s3.objects)
        self.assertIn(recent, self.s3.objects)
        manifest_index = self.s3.events.index(("put", "radar/forecast-frames.json"))
        self.assertGreater(self.s3.events.index(("delete", self.old_key)), manifest_index)
        self.assertEqual(len(json.loads(self.s3.objects["radar/forecast-frames.json"]["Body"])["frames"]), 49)
        for frame in self.frames:
            self.assertIn(frame["precipUrl"].split("weather.test/")[1], self.s3.objects)

    def test_failed_manifest_keeps_old_manifest_and_images(self):
        self.s3.fail_manifest = True
        with self.assertRaises(RuntimeError):
            ingest.write_forecast_manifest(self.s3, "weather", self.frames)
        self.assertEqual(self.s3.objects["radar/forecast-frames.json"]["Body"], b"old manifest")
        self.assertIn(self.old_key, self.s3.objects)

    def test_missing_png_prevents_publication_and_cleanup(self):
        del self.s3.objects[self.frames[20]["precipUrl"].split("weather.test/")[1]]
        with self.assertRaises(RuntimeError):
            ingest.write_forecast_manifest(self.s3, "weather", self.frames)
        self.assertEqual(self.s3.objects["radar/forecast-frames.json"]["Body"], b"old manifest")
        self.assertIn(self.old_key, self.s3.objects)

    def test_short_horizon_keeps_previous_forecast(self):
        with self.assertRaises(ValueError):
            ingest.write_forecast_manifest(self.s3, "weather", self.frames[:24])
        self.assertEqual(self.s3.objects["radar/forecast-frames.json"]["Body"], b"old manifest")

    def test_timeline_gap_keeps_previous_forecast(self):
        with self.assertRaises(ValueError):
            ingest.write_forecast_manifest(self.s3, "weather", self.frames[:20] + self.frames[22:])
        self.assertIn(self.old_key, self.s3.objects)

    def test_batch_pause_precedes_next_request(self):
        events = []
        with patch.dict(ingest.os.environ, {"FETCH_WORKERS": "1", "BATCH_SLEEP_S": "12"}), \
             patch.object(ingest, "fetch", side_effect=lambda *a, **k: events.append("fetch") or [{}]), \
             patch.object(ingest.time, "sleep", side_effect=lambda seconds: events.append(seconds)):
            ingest.chunk_fetch("test", {}, [(47, 9)] * 3, 1)
        self.assertEqual(events, ["fetch", 12.0, "fetch", 12.0, "fetch"])


class ShardTests(unittest.TestCase):
    def setUp(self):
        # 66×96-Gitter wie im Workflow, 3 Shards.
        lats = [46.6 + 2.0 * i / 65 for i in range(66)]
        lons = [7.4 + 4.2 * j / 95 for j in range(96)]
        self.pts = [(la, lo) for la in lats for lo in lons]
        self.data = [{"idx": i} for i in range(len(self.pts))]

    def shards(self, count=3):
        out = []
        for i in range(count):
            start, end = ingest.shard_bounds(len(self.pts), i, count)
            out.append(json.loads(json.dumps(
                ingest.shard_payload(i, count, self.pts, self.data[start:end]))))
        return out

    def test_three_shards_stay_under_hourly_limit(self):
        sizes = [e - s for s, e in (ingest.shard_bounds(len(self.pts), i, 3) for i in range(3))]
        self.assertEqual(sum(sizes), 6336)
        self.assertTrue(all(n < 5000 for n in sizes))
        # Auch zwei Shards auf derselben IP bleiben unter 5000.
        self.assertLess(sizes[0] + sizes[1], 5000)

    def test_merge_restores_exact_point_order(self):
        shards = self.shards()
        merged = ingest.merge_shards(list(reversed(shards)), self.pts)
        self.assertEqual(merged, self.data)

    def test_missing_shard_aborts_merge(self):
        with self.assertRaises(ValueError):
            ingest.merge_shards(self.shards()[:2], self.pts)

    def test_shard_from_other_grid_aborts_merge(self):
        shards = self.shards()
        shards[1]["points"][0] = [0.0, 0.0]
        with self.assertRaises(ValueError):
            ingest.merge_shards(shards, self.pts)


class ImportWithoutBoto3Test(unittest.TestCase):
    def test_module_imports_without_boto3(self):
        import importlib, sys
        saved = sys.modules.get("boto3")
        sys.modules["boto3"] = None
        try:
            mod = importlib.reload(ingest)
            self.assertTrue(hasattr(mod, "shard_payload"))
        finally:
            if saved is not None:
                sys.modules["boto3"] = saved
            else:
                del sys.modules["boto3"]
            importlib.reload(ingest)


class EdgeRoughenTest(unittest.TestCase):
    def test_edges_rougher_and_mass_kept(self):
        import numpy as np
        import ingest_openmeteo as m
        h, w = 200, 420
        yy, xx = np.mgrid[0:h, 0:w]
        field = np.clip(3.0 - np.hypot(yy - 100, xx - 210) / 25.0, 0, None).astype(np.float32)
        def perim(a):
            b = a > 0.2
            return int((b[1:] != b[:-1]).sum() + (b[:, 1:] != b[:, :-1]).sum())
        rough = m._edge_roughen(field)
        self.assertGreater(perim(rough), perim(field) * 1.3)
        self.assertAlmostEqual(float(rough.sum()) / float(field.sum()), 1.0, delta=0.05)
        np.testing.assert_array_equal(rough, m._edge_roughen(field))

    def test_strong_cores_are_not_changed(self):
        import numpy as np
        yy, xx = np.mgrid[0:200, 0:420]
        field = np.clip(20.0 - np.hypot(yy - 100, xx - 210) / 4.0, 0, None).astype(np.float32)
        rough = ingest._edge_roughen(field)
        np.testing.assert_array_equal(rough[field >= 4.0], field[field >= 4.0])
        self.assertAlmostEqual(float(rough.sum()) / float(field.sum()), 1.0, delta=0.05)

    def test_dry_field_stays_dry(self):
        import numpy as np
        field = np.zeros((200, 420), dtype=np.float32)
        np.testing.assert_array_equal(ingest._edge_roughen(field), field)


if __name__ == "__main__":
    unittest.main()
