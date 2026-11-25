import struct
import json
from pathlib import Path

def extract_textures(glb_path, out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(glb_path, "rb") as f:
        f.seek(12)
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        json_data = json.loads(f.read(chunk_len).decode("utf-8"))
        
        # Binary chunk
        bin_chunk_len, bin_chunk_type = struct.unpack("<II", f.read(8))
        bin_offset = 12 + 8 + chunk_len + 8
        
        buffer_views = json_data.get("bufferViews", [])
        for i, img in enumerate(json_data.get("images", [])):
            bv_idx = img.get("bufferView")
            if bv_idx is not None:
                bv = buffer_views[bv_idx]
                byte_offset = bin_offset + bv.get("byteOffset", 0)
                byte_length = bv["byteLength"]
                f.seek(byte_offset)
                img_data = f.read(byte_length)
                ext = "png" if img.get("mimeType") == "image/png" else "jpg"
                fn = out_dir / f"{Path(glb_path).stem}_tex_{i}.{ext}"
                with open(fn, "wb") as img_f:
                    img_f.write(img_data)
                print(f"Saved: {fn} ({len(img_data):,} bytes)")

extract_textures(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_organ3d.glb", r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\textures")
extract_textures(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_nih.glb", r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\textures")
