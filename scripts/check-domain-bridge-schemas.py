#!/usr/bin/env python3
"""Independent structural checks; runtime/native tests enforce semantic and cryptographic constraints."""
import copy,json,pathlib,sys
from jsonschema import Draft202012Validator,FormatChecker
root=pathlib.Path(__file__).resolve().parent.parent
variant=sys.argv[2] if len(sys.argv)>2 else 'domain-bridge'
assert variant in ('domain-bridge','domain-bridge-isolated','domain-continuous-isolated')
samples=json.loads(pathlib.Path(sys.argv[1]).read_text())
validators={}
for kind in ('profile','bundle','proof','projection','codec'):
 schema=json.loads((root/'schemas'/variant/f'{kind}.schema.json').read_text());Draft202012Validator.check_schema(schema)
 validators[kind]=Draft202012Validator(schema,format_checker=FormatChecker())
positive=negative=0;coverage=set()
for sample in samples:
 kind,value=sample['kind'],sample['value'];v=validators[kind];errors=list(v.iter_errors(value))
 if errors:raise ValueError(f'{kind}: '+str(errors[0]))
 positive+=1;coverage.add(kind)
 bad=copy.deepcopy(value);del bad[next(iter(v.schema['required']))];assert not v.is_valid(bad);negative+=1
 bad=copy.deepcopy(value);bad['unexpected_field']=True;assert not v.is_valid(bad);negative+=1
 bad=copy.deepcopy(value)
 if kind=='profile':bad['environment_id']='production'
 elif kind=='proof':bad['action_allowed']=True
 elif kind=='projection':bad['production_enabled']=True
 elif kind=='codec':bad['uncompressed_bytes']=1500001
 else:bad['encoded_source']['encoding']='PLAIN'
 assert not v.is_valid(bad);negative+=1
assert coverage==set(validators)
print(json.dumps({'status':'PASS','schema_count':len(validators),'positive_samples':positive,'negative_samples':negative,'scope':'ISOLATED_BRIDGE_STRUCTURAL_ONLY' if variant.endswith('isolated') else 'LOCAL_BRIDGE_STRUCTURAL_ONLY','production_enabled':False},indent=2))
