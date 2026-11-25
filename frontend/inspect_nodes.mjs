import fs from 'fs';
import path from 'path';

// Let's inspect node names inside both glb files using node
function inspectGLB(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
  const gltf = JSON.parse(jsonStr);
  console.log(`\n=== ${path.basename(filePath)} ===`);
  console.log('Meshes:', gltf.meshes?.map(m => m.name));
  console.log('Nodes:', gltf.nodes?.map(n => n.name));
  console.log('Materials:', gltf.materials?.map(m => m.name));
}

inspectGLB('c:/Users/sgoud/Downloads/coronary_angiogram_ai_starter_antigravity/frontend/public/models/heart_nih.glb');
inspectGLB('c:/Users/sgoud/Downloads/coronary_angiogram_ai_starter_antigravity/frontend/public/models/heart_organ3d.glb');
