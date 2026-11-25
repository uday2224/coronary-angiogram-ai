import struct
import json
from pathlib import Path

def inspect_glb(path):
    print(f"\n========================================================")
    print(f"=== INSPECTING: {Path(path).name} ===")
    print(f"========================================================")
    with open(path, "rb") as f:
        magic = f.read(4)
        if magic != b"glTF":
            print(f"Error: Not a glTF binary file (magic={magic})")
            return
        version, length = struct.unpack("<II", f.read(8))
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        json_data = json.loads(f.read(chunk_len).decode("utf-8"))
        
        print(f"Generator: {json_data.get('asset', {}).get('generator')}")
        print(f"Nodes count: {len(json_data.get('nodes', []))}")
        for i, node in enumerate(json_data.get("nodes", [])):
            mesh_idx = node.get("mesh")
            print(f"  Node {i:02d}: name='{node.get('name', 'Unnamed')}' (mesh_idx={mesh_idx})")
            
        print(f"\nMeshes count: {len(json_data.get('meshes', []))}")
        for i, mesh in enumerate(json_data.get("meshes", [])):
            print(f"  Mesh {i:02d}: name='{mesh.get('name', 'Unnamed')}' (primitives={len(mesh.get('primitives', []))})")
            
        print(f"\nMaterials count: {len(json_data.get('materials', []))}")
        for i, mat in enumerate(json_data.get("materials", [])):
            print(f"  Material {i:02d}: name='{mat.get('name', 'Unnamed')}'")

inspect_glb(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_nih.glb")
inspect_glb(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_organ3d.glb")
