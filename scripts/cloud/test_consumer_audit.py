import importlib.util
import io
import pathlib
import tempfile
import unittest
import urllib.error

spec = importlib.util.spec_from_file_location('audit', pathlib.Path(__file__).with_name('consumer-audit.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class Response(io.BytesIO):
    status = 200
    headers = {'content-type': 'application/json', 'set-cookie': 'SECRET'}

class Opener:
    def __init__(self, value): self.value = value
    def open(self, req, timeout):
        assert req.get_method() == 'GET'
        assert timeout == 20
        if isinstance(self.value, Exception): raise self.value
        return Response(self.value)

class AuditTest(unittest.TestCase):
    def test_exact_bytes_and_safe_metadata(self):
        raw = b'{"generated_at":"2026-10-03T00:00:00Z", "value": -0}\n'
        with tempfile.TemporaryDirectory() as output:
            row = audit.capture('source', 'https://example.invalid', output, Opener(raw))
            self.assertEqual(row['status'], 'CAPTURED_JSON_OBJECT')
            self.assertEqual(pathlib.Path(output, 'source.json').read_bytes(), raw)
            self.assertNotIn('set-cookie', row['headers'])
            self.assertFalse(row['metadata']['source_semantics_activated'])

    def test_failures_never_create_source_files(self):
        cases = [b'[]', b'<html>error</html>', urllib.error.HTTPError('https://example.invalid', 503, 'fail', {}, None)]
        for value in cases:
            with tempfile.TemporaryDirectory() as output:
                row = audit.capture('source', 'https://example.invalid', output, Opener(value))
                self.assertEqual(row['status'], 'ERROR')
                self.assertFalse(pathlib.Path(output, 'source.json').exists())

    def test_oversize_and_redirect_denied(self):
        with tempfile.TemporaryDirectory() as output:
            row = audit.capture('source', 'https://example.invalid', output, Opener(b' ' * (audit.MAX_BYTES + 1)))
            self.assertEqual(row['error'], 'BODY_LIMIT_EXCEEDED')
        self.assertIsNone(audit.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.invalid'))

if __name__ == '__main__': unittest.main()
