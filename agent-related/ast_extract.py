import sys, json
from graphify.extract import collect_files, extract
from pathlib import Path

code_files = []
try:
    detect = json.loads(Path('graphify-out/.graphify_incremental.json').read_text())
    files_dict = detect.get('new_files', {})
except:
    detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text())
    files_dict = detect.get('files', {})

for f in files_dict.get('code', []):
    code_files.extend(collect_files(Path(f)) if Path(f).is_dir() else [Path(f)])

if code_files:
    result = extract(code_files)
    Path('graphify-out/.graphify_ast.json').write_text(json.dumps(result, indent=2))
    print(f"AST: {len(result['nodes'])} nodes, {len(result['edges'])} edges")
else:
    Path('graphify-out/.graphify_ast.json').write_text(json.dumps({'nodes':[],'edges':[],'input_tokens':0,'output_tokens':0}))
    print('No code files - skipping AST extraction')
