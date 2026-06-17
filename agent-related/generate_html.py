import sys, json
from graphify.build import build_from_json
from graphify.export import to_html
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding='utf-8'))
labels_raw = json.loads(Path('graphify-out/.graphify_labels.json').read_text(encoding='utf-8')) if Path('graphify-out/.graphify_labels.json').exists() else {}

communities = {int(k): v for k, v in analysis['communities'].items()}
labels = {int(k): v for k, v in labels_raw.items()}

to_html(G, communities, 'graphify-out/graph.html', community_labels=labels or None)
print('graph.html written')
