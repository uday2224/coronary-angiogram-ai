import struct
import json

def inspect_details(path):
    print(f"\nDETAILS FOR: {path}")
    with open(path, "rb") as f:
        f.seek(12)
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        json_data = json.loads(f.read(chunk_len).decode("utf-8"))
        
        print(f"Images count: {len(json_data.get('images', []))}")
        for i, img in enumerate(json_data.get('images', [])):
            print(f"  Image {i}: name='{img.get('name')}', mimeType={img.get('mimeType')}")
            
        print(f"Accessors count: {len(json_data.get('accessors', []))}")
        # Look for position accessors to find vertex count
        for i, acc in enumerate(json_data.get('accessors', [])):
            if acc.get("type") == "VEC3" and "min" in acc and "max" in acc:
                print(f"  Accessor {i}: count={acc.get('count')} min={acc.get('min')} max={acc.get('max')}")

inspect_details(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_organ3d.glb")
inspect_details(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_nih.glb")
