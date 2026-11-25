"""
High-Resolution 3D Medical Anatomical Heart Renderer.
Renders 4 canonical clinical views directly from the 24,026-vertex 3D GLB anatomical mesh:
  1. Anterior (AP) View
  2. Posterior (PA) View
  3. Left Lateral (LAO) View
  4. Right Lateral (RAO) View
"""

import struct
import json
import math
from pathlib import Path
import cv2
import numpy as np

def load_glb_mesh(glb_path):
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
        pos_acc = accessors[prim["attributes"]["POSITION"]]
        pos_bv = buffer_views[pos_acc["bufferView"]]
        
        f.seek(bin_offset + pos_bv.get("byteOffset", 0))
        verts = np.frombuffer(f.read(pos_bv["byteLength"]), dtype=np.float32).reshape(-1, 3)
        
        indices_acc = accessors[prim["indices"]]
        ind_bv = buffer_views[indices_acc["bufferView"]]
        f.seek(bin_offset + ind_bv.get("byteOffset", 0))
        dtype = np.uint16 if indices_acc["componentType"] == 5123 else np.uint32
        faces = np.frombuffer(f.read(ind_bv["byteLength"]), dtype=dtype).reshape(-1, 3)
        
        return verts, faces

def rotation_matrix(rx_deg, ry_deg, rz_deg):
    rx, ry, rz = np.radians([rx_deg, ry_deg, rz_deg])
    Rx = np.array([[1, 0, 0], [0, np.cos(rx), -np.sin(rx)], [0, np.sin(rx), np.cos(rx)]])
    Ry = np.array([[np.cos(ry), 0, np.sin(ry)], [0, 1, 0], [-np.sin(ry), 0, np.cos(ry)]])
    Rz = np.array([[np.cos(rz), -np.sin(rz), 0], [np.sin(rz), np.cos(rz), 0], [0, 0, 1]])
    return Rz @ Ry @ Rx

def render_heart_view(verts, faces, ry, rx, title, subtitle, out_path, artery_lines=[]):
    img_size = 900
    canvas = np.zeros((img_size, img_size, 3), dtype=np.uint8)
    
    # 1. Subtle clinical gradient background (Midnight blue #060f1c to #0b1a2e)
    for y in range(img_size):
        factor = y / img_size
        canvas[y, :, 0] = int(28 * (1 - factor * 0.4))
        canvas[y, :, 1] = int(15 * (1 - factor * 0.4))
        canvas[y, :, 2] = int(6 + 8 * factor)
        
    # Grid lines
    for x in range(0, img_size, 60):
        cv2.line(canvas, (x, 0), (x, img_size), (24, 18, 10), 1)
    for y in range(0, img_size, 60):
        cv2.line(canvas, (0, y), (img_size, y), (24, 18, 10), 1)

    # 2. Normalize & Center Mesh
    center = (verts.max(axis=0) + verts.min(axis=0)) / 2.0
    scale = 320.0 / np.max(verts.max(axis=0) - verts.min(axis=0))
    norm_verts = (verts - center) * scale

    # 3. Apply Camera Rotation
    R = rotation_matrix(rx, ry, 0)
    rot_verts = norm_verts @ R.T

    # 4. Compute Face Normals & Lighting
    v0 = rot_verts[faces[:, 0]]
    v1 = rot_verts[faces[:, 1]]
    v2 = rot_verts[faces[:, 2]]
    
    face_normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(face_normals, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    face_normals = face_normals / norms
    
    # Only render front-facing triangles
    front_facing = face_normals[:, 2] > -0.1
    valid_faces = faces[front_facing]
    valid_normals = face_normals[front_facing]
    
    # Depth sort (Painter's algorithm: render back to front)
    face_depths = rot_verts[valid_faces, 2].mean(axis=1)
    sort_order = np.argsort(face_depths)
    sorted_faces = valid_faces[sort_order]
    sorted_normals = valid_normals[sort_order]

    # Lighting vectors
    key_light = np.array([0.4, 0.6, 0.7])
    key_light /= np.linalg.norm(key_light)
    fill_light = np.array([-0.6, -0.2, 0.7])
    fill_light /= np.linalg.norm(fill_light)

    # 5. Project to 2D Screen
    cx, cy = img_size // 2, img_size // 2 + 30
    pts_2d = np.zeros((len(rot_verts), 2), dtype=np.int32)
    # Perspective projection
    dist = 900.0
    z_proj = (dist / (dist - rot_verts[:, 2]))[:, np.newaxis]
    pts_2d[:, 0] = np.int32(cx + rot_verts[:, 0] * z_proj[:, 0])
    pts_2d[:, 1] = np.int32(cy - rot_verts[:, 1] * z_proj[:, 0])

    # 6. Render Shaded Myocardial Mesh
    base_color = np.array([40, 35, 160], dtype=np.float32) # BGR: deep myocardial crimson/red

    for i in range(len(sorted_faces)):
        f = sorted_faces[i]
        n = sorted_normals[i]
        
        diff_key = max(0.0, np.dot(n, key_light))
        diff_fill = max(0.0, np.dot(n, fill_light))
        ambient = 0.28
        
        # Great vessels vs myocardium color based on height/position
        y_pos = rot_verts[f, 1].mean()
        x_pos = rot_verts[f, 0].mean()
        
        if y_pos > 110: # Aorta / Pulmonary trunk region
            if x_pos > 10:
                face_base = np.array([55, 65, 205]) # Aorta (Crimson/Red)
            else:
                face_base = np.array([120, 85, 45]) # Pulmonary trunk (Venous Slate Blue)
        elif y_pos > 50 and abs(x_pos) > 80:
            face_base = np.array([80, 50, 110]) # Atria
        else:
            face_base = base_color # Ventricles
            
        intensity = ambient + diff_key * 0.62 + diff_fill * 0.25
        intensity = min(1.0, max(0.1, intensity))
        color = (face_base * intensity).astype(np.uint8)
        color_tuple = (int(color[0]), int(color[1]), int(color[2]))

        tri = pts_2d[f]
        cv2.fillConvexPoly(canvas, tri, color_tuple)
        cv2.polylines(canvas, [tri], True, (max(0, color_tuple[0]-8), max(0, color_tuple[1]-8), max(0, color_tuple[2]-8)), 1, cv2.LINE_AA)

    # 7. Render Coronary Arterial Overlay Curves
    for art in artery_lines:
        curve_pts = np.array(art["points"]) * (scale / 1.0)
        rot_pts = curve_pts @ R.T
        proj_pts = []
        for p in rot_pts:
            zp = dist / (dist - p[2])
            px = int(cx + p[0] * zp)
            py = int(cy - p[1] * zp)
            proj_pts.append([px, py])
        proj_pts = np.array(proj_pts, dtype=np.int32)
        
        # Glow outline
        cv2.polylines(canvas, [proj_pts], False, (art["glow"]), art["thickness"] + 3, cv2.LINE_AA)
        # Inner vessel core
        cv2.polylines(canvas, [proj_pts], False, (art["color"]), art["thickness"], cv2.LINE_AA)
        
        # Label marker
        if "label" in art and art.get("show_in_view", True):
            lp = proj_pts[art["label_idx"]]
            cv2.circle(canvas, tuple(lp), 4, (255, 255, 255), -1)
            cv2.putText(canvas, art["label"], (lp[0] + 10, lp[1] + 4), cv2.FONT_HERSHEY_DUPLEX, 0.42, (0, 210, 211), 1, cv2.LINE_AA)

    # 8. Medical Workstation HUD Overlays
    # Top title bar
    cv2.rectangle(canvas, (24, 24), (img_size - 24, 88), (14, 22, 35), -1)
    cv2.rectangle(canvas, (24, 24), (img_size - 24, 88), (35, 52, 75), 1)
    cv2.putText(canvas, title, (42, 54), cv2.FONT_HERSHEY_DUPLEX, 0.72, (240, 246, 252), 1, cv2.LINE_AA)
    cv2.putText(canvas, subtitle, (42, 76), cv2.FONT_HERSHEY_DUPLEX, 0.40, (156, 177, 201), 1, cv2.LINE_AA)

    # Orientation badge
    cv2.rectangle(canvas, (img_size - 140, 36), (img_size - 40, 74), (20, 32, 50), -1)
    cv2.rectangle(canvas, (img_size - 140, 36), (img_size - 40, 74), (0, 210, 211), 1)
    cv2.putText(canvas, art_badge(ry), (img_size - 130, 60), cv2.FONT_HERSHEY_DUPLEX, 0.48, (0, 210, 211), 1, cv2.LINE_AA)

    # Bottom footer with anatomical legend
    cv2.rectangle(canvas, (24, img_size - 64), (img_size - 24, img_size - 24), (14, 22, 35), -1)
    cv2.rectangle(canvas, (24, img_size - 64), (img_size - 24, img_size - 24), (35, 52, 75), 1)
    
    cv2.circle(canvas, (45, img_size - 44), 6, (70, 70, 255), -1) # LAD Red
    cv2.putText(canvas, "LAD (Anterior Sulcus)", (58, img_size - 40), cv2.FONT_HERSHEY_DUPLEX, 0.38, (200, 210, 225), 1, cv2.LINE_AA)
    
    cv2.circle(canvas, (250, img_size - 44), 6, (40, 165, 255), -1) # LCX Amber
    cv2.putText(canvas, "LCX (Left AV Groove)", (263, img_size - 40), cv2.FONT_HERSHEY_DUPLEX, 0.38, (200, 210, 225), 1, cv2.LINE_AA)

    cv2.circle(canvas, (460, img_size - 44), 6, (115, 213, 46), -1) # RCA Green
    cv2.putText(canvas, "RCA (Right AV Groove)", (473, img_size - 40), cv2.FONT_HERSHEY_DUPLEX, 0.38, (200, 210, 225), 1, cv2.LINE_AA)

    cv2.circle(canvas, (670, img_size - 44), 6, (211, 210, 0), -1) # LMCA Cyan
    cv2.putText(canvas, "LMCA (Left Main)", (683, img_size - 40), cv2.FONT_HERSHEY_DUPLEX, 0.38, (200, 210, 225), 1, cv2.LINE_AA)

    # Save output image
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(out_path, canvas)
    print(f"Rendered: {out_path} ({canvas.shape[1]}x{canvas.shape[0]})")

def art_badge(ry):
    if abs(ry) < 45: return "ANTERIOR"
    if abs(ry - 180) < 45 or abs(ry + 180) < 45: return "POSTERIOR"
    if ry < -45: return "LEFT LAT"
    return "RIGHT LAT"

def main():
    glb_path = r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\frontend\public\models\heart_organ3d.glb"
    verts, faces = load_glb_mesh(glb_path)
    
    out_dir = Path(r"c:\Users\sgoud\Downloads\coronary_angiogram_ai_starter_antigravity\docs\heart_views")
    
    # Define coronary artery splines for anatomical overlay
    # LAD (Anterior interventricular sulcus to apex)
    lad_pts = [
        [-0.30, 0.64, 0.48], [-0.27, 0.44, 0.70], [-0.22, 0.20, 0.86],
        [-0.18, -0.08, 0.90], [-0.14, -0.38, 0.82], [-0.16, -0.72, 0.56],
        [-0.19, -0.96, 0.24]
    ]
    # D1 (First Diagonal Branch)
    d1_pts = [
        [-0.22, 0.20, 0.86], [-0.46, 0.08, 0.80], [-0.68, -0.14, 0.64]
    ]
    # LCX (Left AV Groove)
    lcx_pts = [
        [-0.30, 0.64, 0.48], [-0.56, 0.56, 0.35], [-0.82, 0.44, 0.08],
        [-0.90, 0.22, -0.26], [-0.78, -0.04, -0.56], [-0.56, -0.28, -0.68]
    ]
    # OM1 (First Obtuse Marginal Branch)
    om1_pts = [
        [-0.82, 0.44, 0.08], [-0.98, 0.18, 0.04], [-0.96, -0.22, -0.04]
    ]
    # RCA (Right AV Groove)
    rca_pts = [
        [0.22, 0.72, 0.20], [0.58, 0.60, 0.26], [0.82, 0.38, 0.34],
        [0.88, 0.06, 0.32], [0.84, -0.26, 0.20], [0.70, -0.54, -0.04],
        [0.48, -0.72, -0.30]
    ]
    # PDA (Posterior Descending Artery)
    pda_pts = [
        [0.25, -0.76, -0.45], [0.12, -0.80, -0.32], [0.00, -0.85, -0.15],
        [-0.08, -0.92, 0.05], [-0.19, -0.96, 0.24]
    ]
    # LMCA (Left Main Trunk)
    lmca_pts = [
        [0.02, 0.75, 0.24], [-0.16, 0.70, 0.38], [-0.30, 0.64, 0.48]
    ]

    arteries = [
        {"name": "LMCA", "points": lmca_pts, "color": (211, 210, 0), "glow": (100, 100, 0), "thickness": 5, "label": "LMCA", "label_idx": 1},
        {"name": "LAD", "points": lad_pts, "color": (70, 70, 255), "glow": (20, 20, 160), "thickness": 4, "label": "LAD (Anterior Sulcus)", "label_idx": 3},
        {"name": "D1", "points": d1_pts, "color": (90, 90, 240), "glow": (30, 30, 140), "thickness": 3, "label": "D1 Branch", "label_idx": 2},
        {"name": "LCX", "points": lcx_pts, "color": (40, 165, 255), "glow": (10, 80, 160), "thickness": 4, "label": "LCX (Left AV Groove)", "label_idx": 3},
        {"name": "OM1", "points": om1_pts, "color": (50, 180, 255), "glow": (10, 90, 170), "thickness": 3, "label": "OM1 Branch", "label_idx": 1},
        {"name": "RCA", "points": rca_pts, "color": (115, 213, 46), "glow": (40, 120, 20), "thickness": 4, "label": "RCA (Right AV Groove)", "label_idx": 3},
        {"name": "PDA", "points": pda_pts, "color": (90, 220, 60), "glow": (30, 110, 20), "thickness": 3, "label": "PDA (Posterior Sulcus)", "label_idx": 2},
    ]

    # 1. Anterior (AP) View
    render_heart_view(
        verts, faces, ry=0, rx=10,
        title="ANTERIOR (AP) VIEW — 3D ANATOMICAL VIRTUAL HEART",
        subtitle="Showing RV, Anterior LV, LAD traversing Anterior Interventricular Sulcus & Ascending Aorta",
        out_path=str(out_dir / "anterior_view.png"),
        artery_lines=arteries
    )

    # 2. Posterior (PA) View
    render_heart_view(
        verts, faces, ry=180, rx=-8,
        title="POSTERIOR (PA) VIEW — 3D ANATOMICAL VIRTUAL HEART",
        subtitle="Showing Left Atrium, Pulmonary Veins, Diaphragmatic LV & Posterior Descending Artery (PDA)",
        out_path=str(out_dir / "posterior_view.png"),
        artery_lines=arteries
    )

    # 3. Left Lateral (LAO) View
    render_heart_view(
        verts, faces, ry=-90, rx=6,
        title="LEFT LATERAL (LAO) VIEW — 3D ANATOMICAL VIRTUAL HEART",
        subtitle="Showing LV Free Wall, Apex, LCX traversing Left AV Groove & Obtuse Marginal Branches",
        out_path=str(out_dir / "left_lateral_view.png"),
        artery_lines=arteries
    )

    # 4. Right Lateral (RAO) View
    render_heart_view(
        verts, faces, ry=90, rx=6,
        title="RIGHT LATERAL (RAO) VIEW — 3D ANATOMICAL VIRTUAL HEART",
        subtitle="Showing Right Atrium, Superior/Inferior Vena Cava & RCA traversing Right Coronary Sulcus",
        out_path=str(out_dir / "right_lateral_view.png"),
        artery_lines=arteries
    )

if __name__ == "__main__":
    main()
