import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

/**
 * STLThumbnailGenerator - Generate preview images from STL files
 * Uses Three.js to render STL to canvas, then exports as data URL
 */

// Cache for generated thumbnails
const thumbnailCache = new Map();

/**
 * Generate a thumbnail image from an STL file URL
 * @param {string} stlUrl - URL to the STL file
 * @param {object} options - Configuration options
 * @returns {Promise<string>} - Data URL of the thumbnail image
 */
export async function generateSTLThumbnail(stlUrl, options = {}) {
  const {
    width = 200,
    height = 200,
    backgroundColor = 0x1e293b,
    modelColor = 0x3b82f6,
    cameraAngle = { x: 1, y: 0.8, z: 1 },
  } = options;

  // Check cache first
  const cacheKey = `${stlUrl}-${width}x${height}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey);
  }

  return new Promise((resolve, reject) => {
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // Create camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-1, 0.5, -1);
    scene.add(directionalLight2);

    // Load STL
    const loader = new STLLoader();
    loader.load(
      stlUrl,
      (geometry) => {
        try {
          // Process geometry
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          geometry.center();

          // Rotate to Y-up orientation
          geometry.rotateX(-Math.PI / 2);
          geometry.computeBoundingBox();

          // Get bounding box for camera positioning
          const box = geometry.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);

          // Create mesh
          const material = new THREE.MeshStandardMaterial({
            color: modelColor,
            roughness: 0.4,
            metalness: 0.1,
          });
          const mesh = new THREE.Mesh(geometry, material);
          
          // Center on ground
          mesh.position.y = size.y / 2;
          scene.add(mesh);

          // Position camera
          const distance = maxDim * 2;
          camera.position.set(
            distance * cameraAngle.x,
            distance * cameraAngle.y,
            distance * cameraAngle.z
          );
          camera.lookAt(0, size.y / 3, 0);

          // Render
          renderer.render(scene, camera);

          // Export to data URL
          const dataUrl = renderer.domElement.toDataURL('image/png');

          // Cache the result
          thumbnailCache.set(cacheKey, dataUrl);

          // Cleanup
          geometry.dispose();
          material.dispose();
          renderer.dispose();

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      (error) => {
        console.error('STL load error for thumbnail:', error);
        reject(error);
      }
    );
  });
}

/**
 * Generate thumbnails for multiple STL files
 * @param {Array<{url: string, id: string}>} files - Array of file objects
 * @param {function} onProgress - Progress callback (current, total)
 * @returns {Promise<Map<string, string>>} - Map of file IDs to thumbnail data URLs
 */
export async function generateBatchThumbnails(files, onProgress) {
  const results = new Map();
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const thumbnail = await generateSTLThumbnail(file.url);
      results.set(file.id, thumbnail);
    } catch (err) {
      console.error(`Failed to generate thumbnail for ${file.id}:`, err);
      results.set(file.id, null);
    }
    
    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }
  
  return results;
}

/**
 * Store thumbnail in localStorage
 */
export function cacheThumbnail(fileId, dataUrl) {
  try {
    const cache = JSON.parse(localStorage.getItem('polywerk_stl_thumbnails') || '{}');
    cache[fileId] = {
      dataUrl,
      timestamp: Date.now(),
    };
    // Limit cache size (keep last 100 thumbnails)
    const entries = Object.entries(cache);
    if (entries.length > 100) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const newCache = Object.fromEntries(entries.slice(0, 100));
      localStorage.setItem('polywerk_stl_thumbnails', JSON.stringify(newCache));
    } else {
      localStorage.setItem('polywerk_stl_thumbnails', JSON.stringify(cache));
    }
  } catch (err) {
    console.error('Failed to cache thumbnail:', err);
  }
}

/**
 * Get cached thumbnail
 */
export function getCachedThumbnail(fileId) {
  try {
    const cache = JSON.parse(localStorage.getItem('polywerk_stl_thumbnails') || '{}');
    const entry = cache[fileId];
    if (entry) {
      // Check if cache is less than 7 days old
      const age = Date.now() - entry.timestamp;
      if (age < 7 * 24 * 60 * 60 * 1000) {
        return entry.dataUrl;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Clear thumbnail cache
 */
export function clearThumbnailCache() {
  localStorage.removeItem('polywerk_stl_thumbnails');
  thumbnailCache.clear();
}

export default {
  generateSTLThumbnail,
  generateBatchThumbnails,
  cacheThumbnail,
  getCachedThumbnail,
  clearThumbnailCache,
};
