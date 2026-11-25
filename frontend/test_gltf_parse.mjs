import fs from 'fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Setup mock DOM for Three.js loader in Node
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.self = global.window;

const loader = new GLTFLoader();
const glbBuffer = fs.readFileSync('c:/Users/sgoud/Downloads/coronary_angiogram_ai_starter_antigravity/frontend/public/models/heart_organ3d.glb');
const arrayBuffer = glbBuffer.buffer.slice(glbBuffer.byteOffset, glbBuffer.byteOffset + glbBuffer.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  console.log('Successfully loaded GLTF!');
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  console.log('Bounding Box Size:', size);
  console.log('Bounding Box Center:', center);
  
  let meshCount = 0;
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      meshCount++;
      console.log(`Mesh ${meshCount}: ${child.name}, vertices: ${child.geometry.attributes.position.count}`);
    }
  });
}, (err) => {
  console.error('GLTF parse error:', err);
});
