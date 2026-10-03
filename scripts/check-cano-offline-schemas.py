"""Validate local Draft 2020-12 contracts and complete positive/negative sample coverage.
Never install dependencies or retrieve remote references.
"""
import json, sys
from pathlib import Path
try:
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource
except ImportError:
    print(json.dumps({'status': 'NOT_RUN_VALIDATOR_UNAVAILABLE'}))
    sys.exit(3)

def reject_remote(uri):
    raise RuntimeError('REMOTE_SCHEMA_REFERENCE_FORBIDDEN: ' + uri)

try:
    root = Path(sys.argv[1])
    schemas = {}
    registry = Registry(retrieve=reject_remote)
    for path in sorted(root.glob('openpq-cano-*.schema.json')):
        schema = json.loads(path.read_text())
        Draft202012Validator.check_schema(schema)
        schemas[path.name] = schema
        registry = registry.with_resource(schema['$id'], Resource.from_contents(schema))
    if not schemas:
        raise ValueError('NO_SCHEMAS')
    coverage = {name: {'positive': 0, 'negative': 0} for name in schemas}
    samples = json.loads(Path(sys.argv[2]).read_text())
    for index, sample in enumerate(samples):
        name = sample['schema']
        expected = sample.get('expect_valid', True)
        if not isinstance(expected, bool):
            raise ValueError('EXPECT_VALID_NOT_BOOLEAN')
        validator = Draft202012Validator(schemas[name], registry=registry)
        valid = validator.is_valid(sample['value'])
        if valid != expected:
            raise ValueError(f'SAMPLE_EXPECTATION_MISMATCH: {index} {name}')
        coverage[name]['positive' if expected else 'negative'] += 1
    missing = [name for name, counts in coverage.items() if not counts['positive'] or not counts['negative']]
    if missing:
        raise ValueError('SCHEMA_COVERAGE_INCOMPLETE: ' + ', '.join(missing))
    print(json.dumps({'status': 'PASS', 'draft': '2020-12', 'schemas': len(schemas),
                      'samples': len(samples), 'positive_samples': sum(c['positive'] for c in coverage.values()),
                      'negative_samples': sum(c['negative'] for c in coverage.values()),
                      'coverage': coverage, 'remote_references': 'FORBIDDEN'}))
except Exception as error:
    print(json.dumps({'status': 'FAILED', 'error': str(error)}))
    sys.exit(1)
