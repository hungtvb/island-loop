// loaders.js - Helper load GLB
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export function loadGLB(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      resolve(gltf.scene);
    }, undefined, reject);
  });
}
