import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'build_supplements.py'
spec = importlib.util.spec_from_file_location('build_supplements', SCRIPT)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def phone(identifier, value=None, out=False):
    return {'id': identifier, 'name': identifier, 'brand': '测试品牌', 'soc': '测试芯片',
            'metrics': {'weight': None, 'gbMulti': 5000, 'antutu': 100, 'screenSize': 6.5},
            'offers': [{'config': '12+256', 'ram': 12, 'storage': 256, 'price': value, 'out': out}],
            'histByCfg': {'12+256': [{'label': '11/9', 'value': 1999}, {'label': '11/11', 'value': value, 'out': out}]}}


class SupplementTests(unittest.TestCase):
    def build(self, phones, external=None):
        return module.build_payload(phones, external or [], 'https://example.com/source', '2026-11-15T00:00:00Z')

    def test_history_is_a_labelled_estimate_not_a_current_quote(self):
        raw = phone('missing')
        result = self.build([raw])['phones']['missing']['prices']['12+256']
        self.assertEqual(result['value'], 2000)
        self.assertEqual(result['kind'], 'estimate')
        self.assertIn('11/9', result['method'])
        self.assertIsNone(raw['offers'][0]['price'])

    def test_existing_prices_and_explicit_sold_out_status_are_not_replaced(self):
        result = self.build([phone('known', 3000), phone('out', out=True)])
        self.assertFalse(result['phones'].get('known', {}).get('prices'))
        self.assertFalse(result['phones'].get('out', {}).get('prices'))

    def test_reference_price_is_separate_and_has_provenance(self):
        raw = phone('reference')
        raw['offers'] = []
        raw['histByCfg'] = {}
        external = [{'phones': {'reference': {'variants': [
            {'config': '12+256', 'referencePrice': 3999, 'url': 'https://example.com/reference'}]}}}]
        result = self.build([raw], external)['phones']['reference']['prices']['default']
        self.assertEqual(result['value'], 4000)
        self.assertEqual(result['config'], '12+256')
        self.assertIn('https://example.com/reference', result['sources'])
        self.assertEqual(result['confidence'], 'low')

    def test_known_parameter_wins_and_missing_parameter_keeps_external_evidence(self):
        raw = phone('fields', 3000)
        external = [{'phones': {'fields': {'fields': {
            'weight': {'value': 210, 'unit': 'g', 'kind': 'reference', 'sources': ['https://example.com/spec'], 'method': '资料规格'},
            'gbMulti': {'value': 9999, 'kind': 'estimate', 'sources': ['https://example.com/spec'], 'method': '推测'},
        }}}}]
        fields = self.build([raw], external)['phones']['fields']['fields']
        self.assertEqual(fields['weight']['value'], 210)
        self.assertNotIn('gbMulti', fields)

    def test_no_evidence_does_not_create_a_default_price(self):
        raw = {'id': 'unknown', 'name': 'unknown', 'brand': '未知', 'soc': '', 'metrics': {}, 'offers': [], 'histByCfg': {}}
        result = self.build([raw])
        self.assertFalse(result['phones'].get('unknown', {}).get('prices'))
        self.assertTrue(any(x['id'] == 'unknown' and x['field'] == 'price' for x in result['unresolved']))

    def test_local_snapshot_citation_becomes_public_original_source(self):
        raw = phone('local', 3000)
        raw['metrics']['gbMulti'] = None
        external = [{'phones': {'local': {'fields': {'gbMulti': {
            'value': 4500, 'unit': '分', 'kind': 'estimate', 'method': '同芯片原表中位数',
            'sources': ['file:///D:/MyProjects/tiddip.com/phones/data.js'],
        }}}}}]
        entry = self.build([raw], external)['phones']['local']['fields']['gbMulti']
        self.assertEqual(entry['sources'], ['https://example.com/source'])

    def test_non_scalar_values_are_not_counted_as_supplements(self):
        for bad in [True, {'unexpected': 210}, [210]]:
            external = [{'phones': {'bad': {'fields': {'weight': {
                'value': bad, 'method': '异常数据', 'sources': ['https://example.com/spec'],
            }}}}}]
            result = self.build([phone('bad', 3000)], external)
            self.assertFalse(result['phones'].get('bad', {}).get('fields'))

    def test_reference_price_does_not_inherit_unrelated_flagship_discounts(self):
        donors = [phone(f'flagship{i}', 2000) for i in range(3)]
        target = phone('budget')
        target['offers'], target['histByCfg'] = [], {}
        records = {p['id']: {'variants': [{'config': '12+256', 'referencePrice': 4000, 'url': 'https://example.com/spec'}]} for p in donors}
        records['budget'] = {'variants': [{'config': '6+128', 'referencePrice': 800, 'url': 'https://example.com/budget'}]}
        result = self.build(donors + [target], [{'phones': records}])
        self.assertEqual(result['phones']['budget']['prices']['default']['value'], 800)

    def test_benchmark_units_are_explicit_and_converted_not_guessed(self):
        raw = phone('units', 3000)
        raw['metrics']['antutu'] = None
        base = {'value': 2000000, 'kind': 'reference', 'method': '提供分值', 'sources': ['https://example.com/benchmark']}
        missing_unit = self.build([raw], [{'phones': {'units': {'fields': {'antutu': base}}}}])
        self.assertFalse(missing_unit['phones'].get('units', {}).get('fields'))
        self.assertTrue(missing_unit['rejected'])
        converted = self.build([raw], [{'phones': {'units': {'fields': {'antutu': {**base, 'unit': '分'}}}}}])
        entry = converted['phones']['units']['fields']['antutu']
        self.assertEqual(entry['value'], 2000000 / 10000)
        self.assertEqual(entry['unit'], '万分')


if __name__ == '__main__':
    unittest.main()
