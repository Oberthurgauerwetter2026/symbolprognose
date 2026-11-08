"""Regression tests for hourly MeteoSwiss asset selection."""
import unittest

from ingest_mch_local_forecast import asset_url


class LatestForecastAssetTests(unittest.TestCase):
    def test_symbols_use_0600_instead_of_midnight(self):
        item = {"assets": {
            "vnut12.lssw.202611080000.jww003i0.csv": {"href": "midnight"},
            "vnut12.lssw.202611080600.jww003i0.csv": {"href": "0600"},
            "vnut12.lssw.202611080100.jww003i0.csv": {"href": "0100"},
        }}
        self.assertEqual(asset_url(item, "jww003i0"), "0600")

    def test_each_parameter_uses_its_latest_available_run(self):
        item = {"assets": {
            "vnut12.lssw.202611080600.jww003i0.csv": {"href": "symbols"},
            "vnut12.lssw.202611080000.tre200h0.csv": {"href": "old-temp"},
            "vnut12.lssw.202611080500.tre200h0.csv": {"href": "latest-temp"},
            "vnut12.lssw.202611080000.jp2000d0.csv": {"href": "old-daily"},
            "vnut12.lssw.202611080600.jp2000d0.csv": {"href": "latest-daily"},
        }}
        self.assertEqual(asset_url(item, "tre200h0"), "latest-temp")
        self.assertEqual(asset_url(item, "jp2000d0"), "latest-daily")

    def test_unpublished_latest_asset_does_not_hide_available_run(self):
        item = {"assets": {
            "vnut12.lssw.202611080600.jww003i0.csv": {"href": "0600"},
            "vnut12.lssw.202611080700.jww003i0.csv": {"href": ""},
        }}
        self.assertEqual(asset_url(item, "jww003i0"), "0600")

    def test_missing_parameter_returns_none(self):
        self.assertIsNone(asset_url({"assets": {}}, "jww003i0"))
        self.assertIsNone(asset_url({"assets": None}, "jww003i0"))


if __name__ == "__main__":
    unittest.main()