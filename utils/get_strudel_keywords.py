import json
from sys import argv, exit as sys_exit

if len(argv) != 2:
    print('usage: %s doc.json' % argv[0])
    sys_exit(1)

with open(argv[1]) as doc:
    doc_data = json.loads(doc.read())

def item_generator(json_input, lookup_key):
    if isinstance(json_input, dict):
        for k, v in json_input.items():
            if k == lookup_key:
                yield v
            else:
                yield from item_generator(v, lookup_key)
    elif isinstance(json_input, list):
        for item in json_input:
            yield from item_generator(item, lookup_key)

names = item_generator(doc_data, 'name')
names = [ n.replace('Pattern#', '') for n in names ]
names = [ n.replace('Pattern.prototype.', '') for n in names ]
names = [ n.replace('exports.', '') for n in names ]
names = list(dict.fromkeys(names))
print('|'.join(names).replace('||', '|'))
