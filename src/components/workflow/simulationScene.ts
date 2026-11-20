import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { simulationFrame } from "../../domain/simulationView";
import type { SceneKind } from "../../domain/simulationView";
import type { SimulationInput } from "../../services/simulationService";

function materialsOf(node: THREE.Object3D): THREE.Material[] {
  if (!("material" in node) || !node.material) return [];
  return Array.isArray(node.material) ? node.material : [node.material as THREE.Material];
}

export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if ("geometry" in node && node.geometry instanceof THREE.BufferGeometry) geometries.add(node.geometry);
    for (const material of materialsOf(node)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function buildSpecimen(type: string, imported: THREE.Object3D | null) {
  const group = new THREE.Group();
  const material = (color, metalness = 0.65, roughness = 0.3) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const silver = material(0xaebcc9), gold = material(0xb99342, 0.85, 0.36), dark = material(0x162536), blue = material(0x122b64, 0.62, 0.22);
  const mesh = (geometry, mat, x, y, z) => {
    const part = new THREE.Mesh(geometry, mat);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
    return part;
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const cylinder = (r, h, mat, x, y, z) => mesh(new THREE.CylinderGeometry(r, r, h, 24), mat, x, y, z);

  if (imported) {
    const object = imported.clone(true);
    const cloneMaterial = (original: THREE.Material) => {
      const copy = original.clone();
      // Every scene owns its GPU resources. Keep the retained upload reusable
      // when changing the specimen or equipment family.
      for (const [key, value] of Object.entries(copy)) {
        if (value instanceof THREE.Texture) Object.assign(copy, { [key]: value.clone() });
      }
      return copy;
    };
    object.traverse((node) => {
      if ("geometry" in node && node.geometry instanceof THREE.BufferGeometry) node.geometry = node.geometry.clone();
      if ("material" in node && node.material) {
        const materials = materialsOf(node).map(cloneMaterial);
        node.material = Array.isArray(node.material) ? materials : materials[0];
      }
      node.castShadow = true;
      node.receiveShadow = true;
    });
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1.9 / Math.max(size.x, size.y, size.z, 0.001);
    // Parent offset also works for models with a transformed root node.
    const normalized = new THREE.Group();
    normalized.add(object);
    normalized.scale.setScalar(scale);
    normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    group.add(normalized);
  } else if (type === "satellite") {
    box(0.9, 1.65, 0.9, gold, 0, 0.87);
    box(0.91, 0.31, 0.91, dark, 0, 1.37);
    for (const x of [-0.47, 0.47]) for (const z of [-0.47, 0.47]) {
      box(0.075, 1.85, 0.075, silver, x, 0.96, z);
      box(0.14, 0.08, 0.14, silver, x, 0.07, z);
      box(0.14, 0.08, 0.14, silver, x, 1.86, z);
    }
    for (const y of [0.17, 0.63, 1.1, 1.72]) {
      box(1, 0.055, 0.99, silver, 0, y);
      for (const x of [-0.35, 0.35]) {
        const bolt = cylinder(0.025, 0.025, dark, x, y, 0.505);
        bolt.rotation.x = Math.PI / 2;
      }
    }
    // Individually modeled solar cells and frame give the object readable depth.
    for (const side of [-1, 1]) {
      box(0.28, 0.065, 0.1, silver, side * 0.61, 0.98);
      box(0.98, 1.47, 0.055, silver, side * 1.18, 0.98);
      for (let col = 0; col < 3; col++) for (let row = 0; row < 6; row++) {
        box(0.29, 0.218, 0.012, blue, side * 1.18 + (col - 1) * 0.31, 0.98 + (row - 2.5) * 0.235, 0.038);
      }
    }
    box(0.91, 0.065, 0.91, silver, 0, 1.8);
    const lens = cylinder(0.19, 0.14, dark, 0, 1.91, 0);
    lens.rotation.x = 0;
    cylinder(0.12, 0.015, blue, 0, 1.99, 0);
    cylinder(0.012, 0.59, silver, 0.33, 2.08, 0.3);
  } else if (type === "electronics") {
    box(1.6, 0.85, 1.15, silver, 0, 0.5);
    box(1.67, 0.09, 1.2, dark, 0, 0.97);
    for (let i = 0; i < 13; i++) box(1.48, 0.1, 0.035, silver, 0, 1.04, -0.5 + i * 0.083);
    for (const x of [-0.65, 0.65]) for (const z of [-0.48, 0.48]) {
      box(0.26, 0.06, 0.25, silver, x, 0.05, z);
      cylinder(0.035, 0.02, dark, x, 0.09, z);
    }
    for (const x of [-0.46, 0, 0.46]) {
      const connector = cylinder(0.105, 0.15, gold, x, 0.5, 0.64);
      connector.rotation.x = Math.PI / 2;
      const socket = cylinder(0.065, 0.155, dark, x, 0.5, 0.65);
      socket.rotation.x = Math.PI / 2;
    }
    box(0.55, 0.21, 0.012, dark, 0, 0.78, 0.582);
  } else {
    // A machined tensile coupon with widened grip ends.
    const shape = new THREE.Shape();
    shape.moveTo(-0.33, 0);
    shape.lineTo(0.33, 0); shape.lineTo(0.33, 0.42);
    shape.quadraticCurveTo(0.16, 0.58, 0.14, 0.7);
    shape.lineTo(0.14, 1.2); shape.quadraticCurveTo(0.16, 1.32, 0.33, 1.48);
    shape.lineTo(0.33, 1.9); shape.lineTo(-0.33, 1.9); shape.lineTo(-0.33, 1.48);
    shape.quadraticCurveTo(-0.16, 1.32, -0.14, 1.2);
    shape.lineTo(-0.14, 0.7); shape.quadraticCurveTo(-0.16, 0.58, -0.33, 0.42);
    shape.closePath();
    mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3, steps: 1 }), silver, 0, 0, -0.06);
    for (const y of [0.15, 1.73]) {
      const mark = cylinder(0.055, 0.015, dark, 0, y, 0.077);
      mark.rotation.x = Math.PI / 2;
    }
  }
  // Materials not used by this specimen can be released immediately.
  const used = new Set<THREE.Material>();
  group.traverse((node) => {
    for (const mat of materialsOf(node)) used.add(mat);
  });
  for (const mat of [silver, gold, dark, blue]) if (!used.has(mat)) mat.dispose();
  return group;
}

export interface SimulationSceneState {
  modelType: string;
  input: SimulationInput;
  playing: boolean;
  speed: number;
  rotate: boolean;
  seek?: number;
}

interface SimulationSceneOptions {
  kind: SceneKind;
  specimen: string;
  imported: THREE.Object3D | null;
  getState: () => SimulationSceneState;
  onProgress: (progress: number) => void;
  onError: (message: string) => void;
  onReady: () => void;
}

export function createSimulationScene(host: HTMLElement, { kind, specimen, imported, getState, onProgress, onError, onReady }: SimulationSceneOptions) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1420);
  scene.fog = new THREE.Fog(0x0a1420, 12, 26);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute("aria-label", "시험장비와 시료의 3D 모델. 드래그로 회전하고 스크롤로 확대할 수 있습니다.");
  renderer.domElement.setAttribute("role", "img");
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(6.8, 4.5, 7.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.65, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 15;
  controls.maxPolarAngle = Math.PI / 2 - 0.015;
  controls.autoRotateSpeed = 0.6;

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(environment, 0.04);
  scene.environment = envMap.texture;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc6e7ff, 0x253548, 2.5));
  const light = new THREE.DirectionalLight(0xf3f4e9, 4.5);
  light.position.set(3, 8, 4);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -5, right: 5, top: 6, bottom: -5 });
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.025;
  scene.add(light);
  const rim = new THREE.DirectionalLight(0x5ecbe0, 3);
  rim.position.set(-5, 4, -3); scene.add(rim);

  const steel = new THREE.MeshStandardMaterial({ color: 0x7c8c9a, metalness: 0.8, roughness: 0.38 });
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x27394b, metalness: 0.7, roughness: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101a23, roughness: 0.85 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x42b8c9, emissive: 0x16768c, emissiveIntensity: 0.45, metalness: 0.4 });
  const box = (parent, w, h, d, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  const cylinder = (parent, r, h, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0c1825, roughness: 0.9, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.04; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(30, 60, 0x254153, 0x172b3b);
  grid.material.transparent = true; grid.material.opacity = 0.45; scene.add(grid);
  const rig = new THREE.Group(); scene.add(rig);
  const platform = new THREE.Group(); rig.add(platform);
  let specimenY = 0.95, movingHead = null;

  if (kind === "vibration") {
    box(rig, 3.9, 0.2, 3.1, charcoal, 0, 0.18);
    for (const x of [-1.55, 1.55]) for (const z of [-1.05, 1.05]) cylinder(rig, 0.18, 0.15, rubber, x, 0.075, z);
    cylinder(rig, 1.05, 0.55, charcoal, 0, 0.53);
    for (let i = 0; i < 7; i++) cylinder(rig, 1.09, 0.035, steel, 0, 0.33 + i * 0.075);
    cylinder(platform, 1.31, 0.13, steel, 0, 0.88);
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      if (x * x + z * z <= 17) cylinder(platform, 0.025, 0.008, rubber, x * 0.26, 0.95, z * 0.26);
    }
    box(rig, 0.45, 0.72, 0.65, charcoal, 1.55, 0.65, -0.65);
    box(rig, 0.28, 0.18, 0.015, cyan, 1.55, 0.82, -0.31);
  } else if (kind === "thermal") {
    specimenY = 0.55;
    box(rig, 4.3, 0.35, 3.1, charcoal, 0, 0.2);
    box(rig, 4.1, 3.2, 0.16, steel, 0, 1.95, -1.4);
    box(rig, 0.17, 3.2, 2.9, steel, -2.02, 1.95);
    box(rig, 0.17, 3.2, 2.9, steel, 2.02, 1.95);
    box(rig, 4.1, 0.16, 2.9, steel, 0, 3.55);
    box(rig, 3.85, 0.08, 2.7, charcoal, 0, 0.45);
    for (let i = 0; i < 12; i++) box(rig, 0.025, 2.7, 0.035, charcoal, -1.65 + i * 0.3, 1.9, -1.3);
    const fan = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 48), charcoal);
    fan.position.set(0, 2.5, -1.28); rig.add(fan);
    // The open front is a deliberate cutaway, so the specimen stays visible.
    box(rig, 4.2, 0.09, 0.12, cyan, 0, 3.57, 1.42);
  } else if (kind === "load") {
    specimenY = 0.68;
    box(rig, 3.8, 0.35, 2.6, charcoal, 0, 0.22);
    box(platform, 2.1, 0.2, 1.6, steel, 0, 0.55);
    for (const x of [-1.55, 1.55]) {
      cylinder(rig, 0.11, 3.5, steel, x, 1.94);
      box(rig, 0.33, 3.5, 0.4, charcoal, x, 1.94, -0.2);
    }
    box(rig, 3.7, 0.35, 0.95, charcoal, 0, 3.8);
    movingHead = box(rig, 2.9, 0.18, 0.9, steel, 0, 3.15);
  } else if (kind === "impact") {
    specimenY = 0.58;
    box(rig, 3.6, 0.25, 2.8, charcoal, 0, 0.2);
    box(rig, 2.4, 0.22, 2.1, steel, 0, 0.44);
    for (const x of [-1.45, 1.45]) cylinder(rig, 0.065, 4.1, steel, x, 2.3, -0.75);
    box(rig, 3.3, 0.18, 0.5, charcoal, 0, 4.35, -0.75);
  } else {
    specimenY = 0.7;
    cylinder(rig, 1.8, 0.15, charcoal, 0, 0.2);
    cylinder(platform, 1.45, 0.2, steel, 0, 0.4);
    cylinder(platform, 1.46, 0.03, cyan, 0, 0.51);
  }
  const sample = buildSpecimen(specimen, imported);
  if (kind === "thermal") sample.scale.setScalar(0.8);
  if (kind === "impact") sample.scale.setScalar(0.65);
  sample.position.y = specimenY;
  platform.add(sample);
  const colorMaterials: { material: THREE.Material & { color: THREE.Color }; color: THREE.Color }[] = [];
  const seenMaterials = new Set<THREE.Material>();
  sample.traverse((node) => {
    for (const material of materialsOf(node)) {
      if ("color" in material && material.color instanceof THREE.Color && !seenMaterials.has(material)) {
        colorMaterials.push({ material: material as THREE.Material & { color: THREE.Color }, color: material.color.clone() });
        seenMaterials.add(material);
      }
    }
  });
  // No actual material properties or thermal field are inferred from the mesh.
  const cold = new THREE.Color(0x3f8bea), hot = new THREE.Color(0xe76735), tint = new THREE.Color();
  const resize = () => {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize); observer.observe(host);
  let visible = true, stopped = false, ready = false, previous = 0, lastReport = 0, position = 0;
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  intersection.observe(host);
  const contextLost = (event) => { event.preventDefault(); onError("3D 연결이 중단되었습니다. 다시 열기로 복구할 수 있습니다."); };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const animate = (now) => {
    if (stopped) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.08) : 0;
    previous = now;
    const state = getState();
    if (!visible || document.hidden) return;
    if (state.seek !== undefined) { position = state.seek; state.seek = undefined; }
    if (state.playing) position = (position + dt * state.speed / 12) % 1;
    const frame = simulationFrame(state.modelType, state.input, position);
    const movement = frame.valid ? frame.movement : 0;
    platform.position.y = kind === "vibration" ? movement : 0;
    sample.position.y = specimenY + (kind === "impact" ? movement : 0);
    sample.scale.y = (kind === "thermal" ? 0.8 : kind === "impact" ? 0.65 : 1) * (1 - (frame.valid ? frame.compression : 0));
    if (movingHead) movingHead.position.y = 3.15 - (frame.valid ? frame.compression * 1.9 : 0);
    if (kind === "thermal" && frame.valid && frame.temperature !== undefined) {
      tint.copy(cold).lerp(hot, THREE.MathUtils.clamp((frame.temperature + 40) / 220, 0, 1));
      for (const { material, color } of colorMaterials) material.color.copy(color).lerp(tint, 0.62);
    } else for (const { material, color } of colorMaterials) material.color.copy(color);
    controls.autoRotate = state.rotate;
    controls.update(dt);
    renderer.render(scene, camera);
    if (!ready) { ready = true; onReady(); }
    if (now - lastReport > 100) { onProgress(position); lastReport = now; }
  };
  renderer.setAnimationLoop(animate);
  return {
    view(name) {
      const positions: Record<string, [number, number, number]> = { perspective: [6.8, 4.5, 7.2], front: [0, 2.6, 10], side: [10, 2.6, 0] };
      camera.position.set(...(positions[name] ?? positions.perspective));
      controls.target.set(0, 1.65, 0); controls.update();
    },
    zoom(factor) {
      const distance = camera.position.clone().sub(controls.target).multiplyScalar(factor);
      distance.clampLength(controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(distance); controls.update();
    },
    dispose() {
      stopped = true;
      renderer.setAnimationLoop(null);
      observer.disconnect(); intersection.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      disposeObject(scene);
      for (const mat of [steel, charcoal, rubber, cyan]) mat.dispose();
      envMap.dispose(); light.shadow.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
