"""Small data-form reader, only used for source metadata (never executes ZIL)."""
import re
from pathlib import Path

def read_forms(text):
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|[<>()\[\];]|[^\s<>()\[\];"]+', text)
    i = 0
    def read():
        nonlocal i
        token = tokens[i]; i += 1
        if token == ';':
            read()
            return None
        if token in '<([':
            close = {'<':'>','(':')','[':']'}[token]
            values = []
            while i < len(tokens) and tokens[i] != close:
                v = read()
                if v is not None: values.append(v)
            i += 1
            return values
        return token
    forms=[]
    while i<len(tokens):
        v=read()
        if isinstance(v,list): forms.append(v)
    return forms

def source_objects():
    result={}
    for filename in ['1dungeon.zil','gglobals.zil']:
        for f in read_forms((Path(__file__).resolve().parents[2]/'story_version_control/zork/source-r119'/filename).read_text()):
            if f and f[0] in ('ROOM','OBJECT'):
                props={v[0]:v[1:] for v in f[2:] if isinstance(v,list) and v}
                result[f[1]]={'symbol':f[1],'kind':f[0], 'props':props}
    return result

if __name__=='__main__':
    import json
    print(json.dumps(source_objects(),indent=2))
