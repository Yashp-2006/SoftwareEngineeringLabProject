import sys, json
from graphify.build import build_from_json
from graphify.export import to_json
from networkx.readwrite import json_graph
import networkx as nx
from pathlib import Path

existing_data = json.loads(Path('graphify-out/graph.json').read_text())
G_existing = json_graph.node_link_graph(existing_data, edges='links')

new_extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text())
G_new = build_from_json(new_extraction)

incremental = json.loads(Path('graphify-out/.graphify_incremental.json').read_text())
deleted = set(incremental.get('deleted_files', []))
if deleted:
    to_remove = [n for n, d in G_existing.nodes(data=True) if d.get('source_file') in deleted]
    G_existing.remove_nodes_from(to_remove)
    print(f'Pruned {len(to_remove)} ghost nodes from {len(deleted)} deleted file(s)')

G_existing.update(G_new)
print(f'Merged: {G_existing.number_of_nodes()} nodes, {G_existing.number_of_edges()} edges')

to_json(G_existing, {}, 'graphify-out/.graphify_updated.json')
