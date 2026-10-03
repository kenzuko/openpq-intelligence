"""Bounded GET-only capture of the actual OpenPQ consumer surface. No credentials."""
import concurrent.futures
import hashlib
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

MAX_BYTES = 10_000_000
TIMEOUT = 20
WEATHER = ['critical.json', 'local-now.json', 'groundtruth.json', 'current-bundle.json',
           'nowcast-compact.json', 'jotrip-forecast.json', 'air-quality.json',
           'dashboard-data.json', 'tide.json', 'weather-runtime/cloud.json',
           'weather-runtime/compact.json', 'weather-runtime/current.json',
           'weather-runtime/forecast.json', 'weather-runtime/marine.json', 'weather-runtime/meta.json']
TARGETS = {**{'weather-' + x.replace('/', '-'): 'https://openphuquoc.com/weather/data/' + x for x in WEATHER},
           'weather-health': 'https://openphuquoc.com/weather/data/edge-health.json',
           'airport-live': 'https://jotrip-airport-live.kenzuko.workers.dev/',
           'airport-version': 'https://jotrip-airport-live.kenzuko.workers.dev/version',
           'transit': 'https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json',
           'cano': 'https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json',
           'nearme': 'https://openphuquoc.com/data/views/location-index.json',
           'nearme-support': 'https://openphuquoc.com/data/home-support.json',
           'nearme-venues': 'https://openphuquoc.com/data/entities/destination-venues.json'}
SAFE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified', 'age',
                'x-openpq-weather-edge', 'x-openpq-weather-source-time', 'x-openpq-weather-kind',
                'x-jotrip-source', 'x-jotrip-version', 'x-jotrip-cache']

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def analyze(raw):
    body = json.loads(raw.decode('utf-8'))
    if not isinstance(body, dict):
        raise ValueError('OBJECT_REQUIRED')
    allowed = ['schema_version', 'engine', 'data_class', 'generated_at', 'sampled_time',
               'source_date', 'collected_at_vn', 'run_time', 'status', 'report_state']
    metadata = {k: body[k] for k in allowed if k in body and not isinstance(body[k], (dict, list))}
    metadata['top_level_keys'] = sorted(body)
    metadata['source_semantics_activated'] = False
    return metadata

def capture(key, url, output, opener=None):
    started = time.monotonic()
    checked = datetime.now(timezone.utc).isoformat()
    evidence = {'key': key, 'url': url, 'checked_at': checked, 'method': 'GET', 'status': 'ERROR'}
    try:
        req = urllib.request.Request(url, headers={'accept': 'application/json', 'user-agent': 'OpenPQ-Core2-Consumer-Audit/1.0'})
        with (opener or urllib.request.build_opener(NoRedirect)).open(req, timeout=TIMEOUT) as response:
            evidence['http_status'] = response.status
            evidence['headers'] = {k: response.headers[k] for k in SAFE_HEADERS if k in response.headers}
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError('BODY_LIMIT_EXCEEDED')
        evidence['bytes'] = len(raw)
        evidence['sha256'] = hashlib.sha256(raw).hexdigest()
        evidence['metadata'] = analyze(raw)
        path = pathlib.Path(output) / (key + '.json')
        path.write_bytes(raw)
        evidence.update(status='CAPTURED_JSON_OBJECT', file=path.name)
    except urllib.error.HTTPError as error:
        evidence.update(http_status=error.code, error='HTTP_ERROR')
    except Exception as error:
        # Exception strings may contain response bodies or unexpected upstream data.
        evidence['error'] = str(error) if isinstance(error, ValueError) and str(error) in ['OBJECT_REQUIRED', 'BODY_LIMIT_EXCEEDED'] else type(error).__name__
    evidence['latency_ms'] = round((time.monotonic() - started) * 1000)
    return evidence

def main(output):
    pathlib.Path(output).mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(capture, key, url, output) for key, url in TARGETS.items()]
        rows = [future.result() for future in futures]
    result = {'contract': 'openpq-current-consumer-capture-v1', 'read_only': True,
              'source_policies_activated': False, 'production_ready_claim': False,
              'captured': sum(x['status'] == 'CAPTURED_JSON_OBJECT' for x in rows),
              'total': len(rows), 'captures': rows}
    (pathlib.Path(output) / 'CAPTURE.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'captured': result['captured'], 'total': result['total']}))
    # Keep all failures reviewable; network success is never inferred from workflow success.

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.consumer-audit')
