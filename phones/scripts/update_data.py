"""Refresh a local factual-data snapshot from mingqimiao.cn's public page.

No page JavaScript is evaluated. A saved browser HTML copy can be used when
ordinary HTTP retrieval is unavailable. No server or scheduled job is created.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

SOURCE_URL = "https://mingqimiao.cn/"
ROOT = Path(__file__).resolve().parents[1]


def read_json_constant(html, name):
    pattern = rf"\bconst\s+{re.escape(name)}\s*=\s*(?:/\*.*?\*/\s*)?"
    match = re.search(pattern, html, re.DOTALL)
    if match is None:
        raise ValueError(f"Public data marker {name} was not found; keep the old snapshot")
    return json.JSONDecoder().raw_decode(html[match.end():])[0]


def parse_source(html):
    phones = read_json_constant(html, "PHONES")
    dates = read_json_constant(html, "DATES")
    if not isinstance(phones, list) or not phones:
        raise ValueError("The public phone dataset is empty or invalid")
    ids = [phone.get("id") for phone in phones]
    if any(not identifier for identifier in ids) or len(set(ids)) != len(ids):
        raise ValueError("Phone IDs must be present and unique")
    if not isinstance(dates, list) or not dates:
        raise ValueError("Price dates are missing")
    updated = re.search(r"数据更新至\s*(\d{4}-\d{2}-\d{2})", html)
    return {
        "meta": {
            "source": SOURCE_URL,
            "author": "名其喵",
            "sourceTitle": "手机参数对比汇总表 / 公开网页参数",
            "sourceLicense": "未发现公开仓库或开源许可证；不复制原站前端代码",
            "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "updatedAt": updated.group(1) if updated else None,
            "latestLabel": dates[-1],
            "dates": dates,
            "count": len(phones),
            "sourceSha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
        },
        "phones": phones,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-html", type=Path, help="Use a saved copy of the public page")
    parser.add_argument("--output", type=Path, default=ROOT / "data.js")
    args = parser.parse_args()
    if args.source_html:
        html = args.source_html.read_text(encoding="utf-8")
    else:
        request = Request(SOURCE_URL, headers={"User-Agent": "PhoneFilter/1.0 (manual data refresh)"})
        with urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8")
    result = parse_source(html)
    payload = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    # A classic script works under file:// without fetch, a build, or a server.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text("// Public factual data; source and date are preserved in meta.\n"
                         + "globalThis.PHONE_DATA = " + payload + ";\n", encoding="utf-8")
    temporary.replace(args.output)
    print(json.dumps({"phones": len(result["phones"]), "updatedAt": result["meta"]["updatedAt"],
                      "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
