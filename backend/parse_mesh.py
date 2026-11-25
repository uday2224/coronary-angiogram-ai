import struct
import json
import numpy as np
from pathlib import Path

def parse_glb_mesh(glb_path):
    with open(glb_path, "rb") as f:
        f.seek(12)
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        json_data = json.loads(f.read(chunk_len).decode("utf-8"))
        
        bin_chunk_len, bin_chunk_type = struct.unpack("<II", f.read(8))
        bin_offset = 12 + 8 + chunk_len + 8
        
        accessors = json_data.get("accessors", [])
        buffer_views = json_data.get("bufferViews", [])
        
        mesh = json_data["meshes"][0]
        prim = mesh["primitives"][0]
        pos_acc_idx = prim["attributes"]["POSITION"]
        pos_acc = accessors[pos_acc_idx]
        pos_bv = buffer_views[pos_acc["bufferView"]]
        
        # Read vertices
        f.seek(bin_offset + pos_bv.get("byteOffset", 0))
        verts = np.frombuffer(f.read(pos_bv["byteLength"]), dtype=np.float32).reshape(-1, 3)
        print(f"Loaded {len(verts)} vertices from {Path(glb_path).name}")
        print(f"Bounding box min: {verts.min(axis=0)}, max: {verts.max(axis=0)}")
        
        # Read indices/faces
        indices_acc_idx = prim.get("indices")
        if indices_acc_idx is not None:
            ind_acc = accessors[indices_acc_idx]
            ind_bv = buffer_views[ind_acc["bufferView"]]
            f.seek(bin_offset + ind_bv.get("byteOffset", 0))
            dtype = np.uint16 if ind_acc["componentType"] == 5123 else np.uint32
            indices = np.frombuffer(f.read(ind_bv["byteLength"]), dtype=dtype).reshape(-1, 3)
            print(f"Loaded {len(indices)} triangle faces")
            return verts, indices
        return verts, None

parse_glb_mesh(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_organ3d.glb")
