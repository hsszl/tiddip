import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "update_data.py"


class SourceTests(unittest.TestCase):
    def test_reads_public_json_without_executing_page_javascript(self):
        self.assertTrue(SCRIPT.is_file(), "The public-data importer is not implemented")
        spec = importlib.util.spec_from_file_location("update_data", SCRIPT)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        html = '''<script>
const PHONES = /*__PHONES__*/[{"id":"a","name":"手机","brand":"一加","weight":194}];
const DATES = /*__DATES__*/["11/9","11/11"];
throw new Error("Page scripts must never execute");
</script><footer>数据更新至 2026-11-11</footer>'''
        result = module.parse_source(html)
        self.assertEqual(result["phones"][0]["weight"], 194)
        self.assertEqual(result["meta"]["latestLabel"], "11/11")
        self.assertEqual(result["meta"]["updatedAt"], "2026-11-11")
        self.assertEqual(result["meta"]["count"], 1)


if __name__ == "__main__":
    unittest.main()
