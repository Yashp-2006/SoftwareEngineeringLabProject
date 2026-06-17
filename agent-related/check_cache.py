import json
from graphify.cache import check_semantic_cache
from pathlib import Path

try:
    detect = json.loads(Path('graphify-out/.graphify_incremental.json').read_text())
    files_dict = detect.get('new_files', {})
except:
    detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text())
    files_dict = detect.get('files', {})

all_files = [f for files in files_dict.values() for f in files]
cached_nodes, cached_edges, cached_hyperedges, uncached = check_semantic_cache(all_files)

if cached_nodes or cached_edges or cached_hyperedges:
    Path('graphify-out/.graphify_cached.json').write_text(json.dumps({'nodes': cached_nodes, 'edges': cached_edges, 'hyperedges': cached_hyperedges}))
Path('graphify-out/.graphify_uncached.txt').write_text('\n'.join(uncached))
print(f'Cache: {len(all_files)-len(uncached)} files hit, {len(uncached)} files need extraction')
