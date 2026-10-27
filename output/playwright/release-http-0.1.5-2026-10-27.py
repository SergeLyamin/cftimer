#!/usr/bin/env python3
"""Read-only HTTPS acceptance of release 0.1.5; run after symlink switch."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "output/playwright/release-candidate-0.1.5-2026-10-27.json"
REPORT_PATH = ROOT / "output/playwright/release-http-0.1.5-2026-10-27.json"
BASE = "https://timer.lyamin.org"


def fetch(check):
    path, expected_status, expected_sha, category = check
    url = f"{BASE}{quote(path, safe='/')}?cf-release-check={time.time_ns()}"
    request = Request(url, headers={
        "Cache-Control": "no-cache, no-store",
        "Pragma": "no-cache",
        "Accept-Encoding": "identity",
        "User-Agent": "CF-Timer-release-verifier/0.1.5",
    })
    result = {
        "path": path,
        "category": category,
        "url": url,
        "expectedStatus": expected_status,
        "expectedSha256": expected_sha,
    }
    try:
        try:
            response = urlopen(request, timeout=25)
        except HTTPError as error:
            response = error
        with response:
            body = response.read()
            result.update({
                "status": response.status,
                "bytes": len(body),
                "sha256": hashlib.sha256(body).hexdigest(),
                "headers": {key: response.headers.get(key) for key in [
                    "Cache-Control", "Content-Type", "ETag", "Last-Modified",
                    "Content-Encoding", "Expires", "Server",
                ]},
            })
        result["passed"] = result["status"] == expected_status and (
            expected_sha is None or result["sha256"] == expected_sha
        )
    except (URLError, OSError, TimeoutError) as error:
        result.update({"passed": False, "error": str(error)})
    return result


def main():
    manifest = json.loads(MANIFEST_PATH.read_text())
    checks = [("/" + path, 200, digest, "release-file")
              for path, digest in manifest["files"].items()]
    checks.extend([
        ("/", 200, manifest["files"]["index.html"], "public-entry"),
        ("/assets/index-BgKQaoxn.js", 200, None, "previous-asset"),
        ("/assets/index-BvySuFq7.css", 200, None, "previous-asset"),
        ("/assets/missing-release-0.1.5-check.js", 404, None, "missing-asset"),
    ])
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch, checks))
    passed = sum(result["passed"] for result in results)
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "version": manifest["version"],
        "source": manifest["source"],
        "baseUrl": BASE,
        "cacheBypass": "unique query and Cache-Control/Pragma no-cache; no browser caches changed",
        "releaseFiles": len(manifest["files"]),
        "passed": passed,
        "total": len(results),
        "allPassed": passed == len(results),
        "results": results,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in [
        "version", "releaseFiles", "passed", "total", "allPassed",
    ]}))
    for result in results:
        if not result["passed"]:
            print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
    return 0 if report["allPassed"] else 1


if __name__ == "__main__":
    sys.exit(main())
