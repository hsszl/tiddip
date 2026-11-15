"""Build display-only supplements from sourced evidence and the original catalog.

No original value, filter metric or current quote is overwritten. Network collection
is separate; pass the recorded evidence JSON files explicitly to reproduce a build.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
from statistics import median
import subprocess

ROOT = Path(__file__).resolve().parents[1]
UNITS = {'weight': 'g', 'thickness': 'mm', 'charge': 'W', 'wireless': 'W',
         'mainCamera': 'MP', 'telephoto': 'MP', 'ultrawide': 'MP', 'frontCamera': 'MP',
         'touch': 'Hz', 'touchInstant': 'Hz', 'cpuFrequency': 'GHz', 'antutu': '万分',
         'ram': 'GB', 'storage': 'GB', 'gbSingle': '分', 'gbMulti': '分',
         'gb7Single': '分', 'gb7Multi': '分', 'battery': 'mAh', 'screenSize': '英寸', 'refresh': 'Hz'}
TEXT_FIELDS = {'cpu', 'ramType', 'romType', 'waterproof', 'others', 'sim', 'os', 'releaseYM', 'configs', 'usb'}


def positive(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result > 0 else None
    except (TypeError, ValueError):
        return None


def key(value):
    return re.sub(r'\s+', '', str(value or '')).casefold()


def has_value(value):
    return value is not None and value != '' and (not isinstance(value, float) or math.isfinite(value))


def known(phone, field):
    if field in phone.get('metrics', {}):
        return has_value(phone['metrics'][field])
    if field in phone.get('facets', {}):
        return has_value(phone['facets'][field])
    if field in {'ram', 'storage'}:
        return any(has_value(offer.get(field)) for offer in phone.get('offers', []))
    return has_value(phone.get(field)) and phone.get(field) != []


def validated_value(field, entry):
    value, unit = entry['value'], entry.get('unit')
    if field in TEXT_FIELDS:
        return (value, '') if isinstance(value, str) else None
    expected = UNITS.get(field, '')
    if field in {'ram', 'storage'} and isinstance(value, str):
        if unit == 'GB' and re.fullmatch(r'\d+(?:\s*/\s*\d+)*', value):
            return value, unit
        return None
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
        return None
    if field == 'antutu' and unit == '分':
        return value / 10000, '万分'
    if not isinstance(unit, str) or unit.casefold() != expected.casefold():
        return None
    return value, expected


def urls(values):
    return list(dict.fromkeys(v for v in (values or []) if isinstance(v, str) and v.startswith(('https://', 'http://'))))


def confidence(entry):
    return {'low': 0, 'medium': 1, 'high': 2}.get(entry.get('confidence'), 0) + (3 if entry.get('kind') == 'reference' else 0)


def price_entry(value, method, sources, ids=None, config=None, level='low'):
    result = {'value': max(50, int(round(value / 50) * 50)), 'unit': '元', 'kind': 'estimate',
              'method': method, 'sources': urls(sources), 'evidenceIds': list(ids or []), 'confidence': level}
    if config:
        result['config'] = config
    return result


def family(phone):
    name = key(phone.get('name'))
    brand = key(phone.get('brand'))
    if name.startswith(brand) and brand:
        name = name[len(brand):]
    return re.split(r'\d', name, maxsplit=1)[0]


def foldable(phone):
    return bool(re.search(r'fold|flip|折叠|内屏|外屏', str(phone.get('name', '')) + str(phone.get('screen', '')), re.I))


def nearest_price(phone, donors, supplement):
    ranked = []
    target_perf = positive(phone.get('metrics', {}).get('gbMulti')) or positive(supplement.get('fields', {}).get('gbMulti', {}).get('value'))
    target_antutu = positive(phone.get('metrics', {}).get('antutu'))
    for other in donors:
        if other['id'] == phone['id'] or foldable(other) != foldable(phone):
            continue
        same_chip = bool(key(phone.get('soc'))) and key(phone.get('soc')) == key(other.get('soc'))
        same_brand = key(phone.get('brand')) == key(other.get('brand'))
        same_family = same_brand and bool(family(phone)) and family(phone) == family(other)
        other_perf = positive(other.get('metrics', {}).get('gbMulti'))
        other_antutu = positive(other.get('metrics', {}).get('antutu'))
        gap = abs(math.log(target_perf / other_perf)) if target_perf and other_perf else None
        if gap is None and target_antutu and other_antutu:
            gap = abs(math.log(target_antutu / other_antutu))
        if not (same_chip or same_family or (gap is not None and gap < 0.35)):
            continue
        score = (0 if same_chip else 2) + (0 if same_brand else 0.5) + (0 if same_family else 0.5) + (gap if gap is not None else 0.5)
        if phone.get('screenSize') and other.get('screenSize'):
            score += abs(phone['screenSize'] - other['screenSize']) * 0.2
        offer = min((o for o in other.get('offers', []) if positive(o.get('price'))), key=lambda o: o['price'])
        ranked.append((score, other['id'], offer['price'], offer.get('config')))
    return sorted(ranked)[:5]


def build_payload(phones, external, source_url, generated_at):
    by_id = {p['id']: p for p in phones}
    output = {}
    unresolved = []
    rejected = []
    variants = {}
    for evidence in external:
        for identifier, record in evidence.get('phones', {}).items():
            if identifier not in by_id:
                continue
            phone = by_id[identifier]
            if record.get('name') and key(record['name']) != key(phone.get('name')):
                unresolved.append({'id': identifier, 'field': 'identity', 'reason': '补源机型名称不一致，未合并'})
                continue
            target = output.setdefault(identifier, {'fields': {}, 'prices': {}})
            for field, entry in record.get('fields', {}).items():
                if field not in UNITS and field not in TEXT_FIELDS and field != 'bluetooth':
                    continue
                if known(phone, field) or not isinstance(entry, dict) or not has_value(entry.get('value')):
                    continue
                normalized = validated_value(field, entry)
                if normalized is None:
                    rejected.append({'id': identifier, 'field': field, 'reason': '类型或单位不符合字段规范，未猜填或计数'})
                    continue
                sources = urls([source_url if isinstance(url, str) and url.startswith('file:') and url.replace('\\', '/').endswith('/phones/data.js') else url for url in entry.get('sources', [])])
                if not sources or not entry.get('method'):
                    rejected.append({'id': identifier, 'field': field, 'reason': '缺少可公开来源或推导方法'})
                    continue
                clean = {**entry, 'sources': sources, 'value': normalized[0], 'unit': normalized[1]}
                if '峰值上沿' in entry['method']:
                    clean['displayNote'] = '峰值参考'
                old = target['fields'].get(field)
                if old is None or confidence(clean) > confidence(old):
                    target['fields'][field] = clean
            for variant in record.get('variants', []):
                value = positive(variant.get('referencePrice'))
                if value and variant.get('config') and urls([variant.get('url')]):
                    variants.setdefault(identifier, {})[variant['config']] = {**variant, 'referencePrice': value}

    donors = [p for p in phones if any(positive(o.get('price')) for o in p.get('offers', []))]

    for phone in phones:
        identifier = phone['id']
        target = output.setdefault(identifier, {'fields': {}, 'prices': {}})
        refs = variants.get(identifier, {})
        if not phone.get('offers') and refs:
            sources = urls([v.get('url') for v in refs.values()])
            target['fields'].setdefault('configs', {'value': ' / '.join(refs), 'kind': 'reference', 'unit': '',
                'method': '同型号资料库列出的配置，作为补缺参考；不加入原始配置筛选值。', 'sources': sources, 'confidence': 'medium'})
            for field, group in [('ram', 1), ('storage', 2)]:
                capacities = set()
                for config in refs:
                    match = re.fullmatch(r'(?:(\d+)\+)?(\d+(?:\.\d+)?)(T|TB|G|GB)?', config, re.I)
                    if not match or not match[group]:
                        continue
                    value = float(match[group]) * (1024 if group == 2 and (match[3] or '').upper().startswith('T') else 1)
                    capacities.add(int(value) if value.is_integer() else value)
                if capacities:
                    target['fields'].setdefault(field, {'value': ' / '.join(map(str, sorted(capacities))), 'unit': 'GB', 'kind': 'reference',
                        'method': '从同型号配置标题解析，未使用资料库含义不一致的storage字段。', 'sources': sources, 'confidence': 'medium'})

        offers = phone.get('offers') or [{'config': 'default', 'price': None, 'out': False}]
        for offer in offers:
            config = offer.get('config', 'default')
            if positive(offer.get('price')) or offer.get('out'):
                continue
            history = [e for e in phone.get('histByCfg', {}).get(config, []) if positive(e.get('value')) and not e.get('out')]
            if history:
                samples = history[-3:]
                basis = '、'.join(f"{e.get('label', '?')}={e['value']}元" for e in samples)
                target['prices'][config] = price_entry(median(e['value'] for e in samples),
                    f'同机型同配置最近历史记录的中位数（{basis}），按50元取整；非本期成交报价，未确认现货。',
                    [source_url], [identifier], config, 'medium')
                target['prices'][config]['displayNote'] = '历史推估'
                continue
            ref = refs.get(config) if config != 'default' else min(refs.values(), key=lambda v: v['referencePrice'], default=None)
            if ref:
                target['prices'][config] = price_entry(ref['referencePrice'],
                    f"同型号{ref['config']}公开参考值{ref['referencePrice']:g}元；{ref.get('note', '资料库参考标价/起售价，未提供可靠现价日期。')}按50元取整，不套用其他机型折扣，不是已核实成交价。",
                    [ref['url']], [], ref['config'])
                target['prices'][config]['referencePrice'] = ref['referencePrice']
                target['prices'][config]['displayNote'] = '活动参考，未验结算' if ref.get('priceKind') == 'public_display_price' else '参考标价，非现价'
                continue
            # A model-level estimate is not a fabricated storage-specific offer.
            if config == 'default':
                peers = nearest_price(phone, donors, target)
                if peers:
                    basis = '；'.join(f'{p[1]} {p[3]} {p[2]:g}元' for p in peers)
                    target['prices'][config] = price_entry(median(p[2] for p in peers),
                        f'同芯片、同品牌系列或性能接近机型的入门在售配置统计价中位数：{basis}。机型级粗估，配置与现货待核实，按50元取整。',
                        [source_url], [p[1] for p in peers])
                    target['prices'][config]['displayNote'] = '同类推估，配置待核'
                    continue
            unresolved.append({'id': identifier, 'field': 'price', 'config': config, 'reason': '没有同配置历史、参考报价或足够相关的机型依据'})

    result = {identifier: values for identifier, values in output.items() if values['fields'] or values['prices']}
    coverage = []
    for field in [*UNITS, 'bluetooth']:
        missing = [p['id'] for p in phones if not known(p, field)]
        filled = [identifier for identifier in missing if field in result.get(identifier, {}).get('fields', {})]
        pending = sorted(set(missing) - set(filled))
        coverage.append({'field': field, 'missingOriginally': len(missing), 'supplemented': len(filled), 'remaining': len(pending)})
        unresolved.extend({'id': identifier, 'field': field, 'reason': '未取得足够可靠且同口径的数值依据，保留未知'} for identifier in pending)
    return {'meta': {'generatedAt': generated_at, 'originalSource': source_url,
                     'policy': '仅展示补缺值，均用括号标预估；不覆盖原始值、不改变缺值保留筛选、不是实时成交报价。',
                     'models': len(result), 'fieldCount': sum(len(x['fields']) for x in result.values()),
                     'priceCount': sum(len(x['prices']) for x in result.values()), 'numericCoverage': coverage},
            'phones': result, 'unresolved': unresolved, 'rejected': rejected}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', nargs='*', type=Path, default=[ROOT / 'supplement-evidence.json'])
    parser.add_argument('--output', type=Path, default=ROOT / 'supplements.js')
    args = parser.parse_args()
    script = "require('./data.js');require('./model.js');console.log(JSON.stringify({meta:PHONE_DATA.meta,phones:PHONE_DATA.phones.map(PhoneModel.normalizePhone)}));"
    source = json.loads(subprocess.check_output(['node', '-e', script], cwd=ROOT, text=True, encoding='utf-8'))
    external = []
    for path in args.evidence:
        evidence = json.loads(path.read_text(encoding='utf-8'))
        external.extend(evidence.get('batches', [evidence]))
    result = build_payload(source['phones'], external, source['meta']['source'], datetime.now(timezone.utc).isoformat(timespec='seconds'))
    result['meta']['sourceDate'] = source['meta'].get('updatedAt')
    result['meta']['inputs'] = [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in args.evidence]
    result['meta']['originalDataSha256'] = hashlib.sha256((ROOT / 'data.js').read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text('// Display-only supplements; original data and filtering remain unchanged.\n'
                           + 'globalThis.PHONE_SUPPLEMENTS = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + ';\n', encoding='utf-8')
    print(json.dumps({'output': str(args.output), **{k: v for k, v in result['meta'].items() if k != 'numericCoverage'},
                      'unresolvedPrices': sum(x['field'] == 'price' for x in result['unresolved']),
                      'unresolvedParameters': sum(x['field'] != 'price' for x in result['unresolved']), 'rejected': len(result['rejected'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
