import * as THREE from "three";

/** Procedural artwork only. No maps, institution coordinates or simulated results. */
export function mountOrbitalScene(host: HTMLElement, motion: boolean) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.className = "orbital-scene";
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 100);
  camera.position.set(0, 1, 12);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xcceeff, 0x10223f, 3));
  const sun = new THREE.DirectionalLight(0xfff0d9, 7);
  sun.position.set(3, 6, 7);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x38bdf8, 5);
  rim.position.set(-5, -1, 2);
  scene.add(rim);

  const satellite = new THREE.Group();
  satellite.position.set(1, .65, 0);
  satellite.rotation.set(.3, -.45, -.35);
  satellite.scale.setScalar(.86);
  scene.add(satellite);
  const silver = new THREE.MeshStandardMaterial({ color: 0xd7e1ed, roughness: .27, metalness: .65 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb89a54, roughness: .48, metalness: .65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x162640, roughness: .4, metalness: .7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf0f3f6, roughness: .45, metalness: .3 });
  function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    satellite.add(mesh);
    return mesh;
  }
  function strut(from: THREE.Vector3, to: THREE.Vector3, radius = .015) {
    const delta = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), silver);
    mesh.position.copy(from.clone().add(to).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    satellite.add(mesh);
  }

  // Solar cells use an original generated texture, not externally hosted imagery.
  const cells = document.createElement("canvas");
  cells.width = 512; cells.height = 256;
  const cell = cells.getContext("2d");
  if (cell) {
    const gradient = cell.createLinearGradient(0, 0, 512, 256);
    gradient.addColorStop(0, "#072649"); gradient.addColorStop(.5, "#24547d"); gradient.addColorStop(1, "#071a37");
    cell.fillStyle = gradient; cell.fillRect(0, 0, 512, 256);
    cell.strokeStyle = "rgba(151,201,232,.48)"; cell.lineWidth = 1;
    for (let x = 0; x <= 512; x += 32) { cell.beginPath(); cell.moveTo(x, 0); cell.lineTo(x, 256); cell.stroke(); }
    for (let y = 0; y <= 256; y += 32) { cell.beginPath(); cell.moveTo(0, y); cell.lineTo(512, y); cell.stroke(); }
    cell.strokeStyle = "rgba(130,179,217,.18)";
    for (let y = 4; y < 256; y += 8) { cell.beginPath(); cell.moveTo(0, y); cell.lineTo(512, y); cell.stroke(); }
  }
  const solarTexture = new THREE.CanvasTexture(cells);
  solarTexture.colorSpace = THREE.SRGBColorSpace;
  const solar = new THREE.MeshStandardMaterial({ map: solarTexture, color: 0xa8d5ff, roughness: .28, metalness: .55 });
  for (const side of [-1, 1]) {
    box(2.4, 1.5, .045, silver, side * 1.85);
    box(2.32, 1.42, .055, solar, side * 1.85, 0, .03);
    box(.025, 1.5, .065, silver, side * 1.45);
    box(.025, 1.5, .065, silver, side * 2.25);
    strut(new THREE.Vector3(side * .4, -.28, 0), new THREE.Vector3(side * 1.3, -.55, -.04));
    strut(new THREE.Vector3(side * .4, .28, 0), new THREE.Vector3(side * 1.3, .55, -.04));
  }
  box(.85, 1.12, .8, gold);
  box(.89, .18, .84, silver, 0, -.52);
  box(.89, .12, .84, silver, 0, .52);
  box(.52, .64, .08, white, 0, 0, .45);
  for (let n = 0; n < 5; n++) box(.36, .018, .02, dark, 0, -.22 + n * .105, .5);
  for (const x of [-.4, .4]) box(.035, 1.1, .03, silver, x, 0, .42);

  const dish = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(.025, 0), new THREE.Vector2(.14, .02), new THREE.Vector2(.28, .08),
    new THREE.Vector2(.42, .2), new THREE.Vector2(.56, .4),
  ], 40), new THREE.MeshStandardMaterial({ color: 0xe6eef5, side: THREE.DoubleSide, metalness: .5, roughness: .32 }));
  dish.rotation.x = Math.PI / 2;
  dish.position.set(0, .67, .15);
  satellite.add(dish);
  strut(new THREE.Vector3(0, .67, .15), new THREE.Vector3(0, .67, .95), .025);
  const receiver = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), gold);
  receiver.position.set(0, .67, .95); satellite.add(receiver);
  strut(new THREE.Vector3(.24, -.5, 0), new THREE.Vector3(.38, -1.45, .12), .018);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), white);
  antennaTip.position.set(.38, -1.45, .12); satellite.add(antennaTip);

  const planetVertex = `varying vec3 p; varying vec3 normalWorld; varying vec3 positionWorld;
    void main(){p=position;normalWorld=normalize(mat3(modelMatrix)*normal);
    vec4 world=modelMatrix*vec4(position,1.);positionWorld=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;}`;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(9.1, 80, 56), new THREE.ShaderMaterial({
    vertexShader: planetVertex,
    fragmentShader: `precision highp float; varying vec3 p; varying vec3 normalWorld; varying vec3 positionWorld;
      float hash(vec3 a){return fract(sin(dot(a,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 a){vec3 i=floor(a),f=fract(a);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 a){return noise(a)*.55+noise(a*2.1)*.27+noise(a*4.3)*.12+noise(a*8.1)*.06;}
      void main(){vec3 n=normalize(normalWorld),v=normalize(cameraPosition-positionWorld);
        float cloud=fbm(p*2.8+vec3(fbm(p*.9)*3.));float detail=fbm(p*12.);
        float light=max(dot(n,normalize(vec3(2.,5.,5.))),0.);
        vec3 sea=mix(vec3(.008,.025,.065),vec3(.025,.12,.21),fbm(p*1.1));
        vec3 color=mix(sea,vec3(.35,.53,.64),smoothstep(.49,.76,cloud)*.65+detail*.07);
        color*=.25+light*.9;
        float edge=pow(1.-max(dot(n,v),0.),5.);
        color+=vec3(.07,.38,.7)*edge*.7;
        gl_FragColor=vec4(color,1.);}`,
  }));
  planet.position.set(.8, -9.7, -5);
  planet.rotation.set(.15, .2, -.25);
  scene.add(planet);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(9.23, 80, 56), new THREE.ShaderMaterial({
    vertexShader: planetVertex,
    fragmentShader: `varying vec3 normalWorld; varying vec3 positionWorld;
      void main(){float rim=1.-abs(dot(normalize(normalWorld),normalize(cameraPosition-positionWorld)));
        float glow=pow(rim,9.);gl_FragColor=vec4(.19,.65,1.,glow*.8);}`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  atmosphere.position.copy(planet.position); scene.add(atmosphere);

  const paths: THREE.Curve<THREE.Vector3>[] = [];
  const sparks: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const points = Array.from({ length: 161 }, (_, j) => {
      const angle = j / 160 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * (5.3 + i * .65), Math.sin(angle) * (1 + i * .2) - .65, Math.sin(angle) * 1.8 - 2 - i * .4);
    });
    const path = new THREE.CatmullRomCurve3(points, true);
    paths.push(path);
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({
      color: i === 1 ? 0x8da9ff : 0x5dd5f5, transparent: true, opacity: i === 0 ? .24 : .1,
    }));
    orbit.rotation.z = -.24 + i * .17; scene.add(orbit);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbbf3ff }));
    spark.rotation.copy(orbit.rotation); scene.add(spark); sparks.push(spark);
  }
  const starPositions: number[] = [];
  for (let i = 0; i < 170; i++) {
    const r = (n: number) => { const a = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return a - Math.floor(a); };
    starPositions.push((r(1) - .5) * 36, (r(2) - .35) * 18, -7 - r(3) * 12);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: .025, color: 0xa7d8f5, transparent: true, opacity: .8, sizeAttenuation: true }));
  scene.add(stars);

  let frame = 0, running = false, inView = true, last = 0, elapsed = 0;
  const pointer = { x: 0, y: 0 };
  const draw = () => renderer.render(scene, camera);
  function render(time: number) {
    if (!running) return;
    frame = requestAnimationFrame(render);
    if (time - last < 32) return; // Cap decorative work at about 30fps.
    elapsed += Math.min((time - last) / 1000, .05); last = time;
    satellite.position.y = .65 + Math.sin(elapsed * .55) * .16;
    satellite.rotation.y = -.45 + Math.sin(elapsed * .23) * .16;
    satellite.rotation.z = -.35 + Math.sin(elapsed * .35) * .05;
    planet.rotation.y = .2 + elapsed * .005;
    stars.rotation.z = elapsed * .002;
    camera.position.x += (pointer.x * .3 - camera.position.x) * .035;
    camera.position.y += (1 + pointer.y * .2 - camera.position.y) * .035;
    camera.lookAt(0, 0, 0);
    sparks.forEach((spark, i) => {
      spark.position.copy(paths[i].getPointAt((elapsed * (.035 + i * .008) + .14 + i * .31) % 1));
      spark.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), -.24 + i * .17);
    });
    draw();
  }
  function sync() {
    const shouldRun = motion && inView && !document.hidden;
    if (running === shouldRun) return;
    running = shouldRun;
    cancelAnimationFrame(frame);
    if (running) { last = performance.now(); frame = requestAnimationFrame(render); }
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false); camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix(); draw();
  });
  resize.observe(host);
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
  observer.observe(host);
  const banner = host.parentElement;
  function move(event: PointerEvent) {
    if (event.pointerType !== "mouse" || !motion || !banner) return;
    const rect = banner.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width - .5;
    pointer.y = (event.clientY - rect.top) / rect.height - .5;
  }
  function leave() { pointer.x = 0; pointer.y = 0; }
  function loseContext(event: Event) { event.preventDefault(); running = false; cancelAnimationFrame(frame); host.dataset.scene = "fallback"; }
  renderer.domElement.addEventListener("webglcontextlost", loseContext);
  banner?.addEventListener("pointermove", move); banner?.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", sync);
  host.dataset.scene = "ready";
  sparks.forEach((spark, i) => spark.position.copy(paths[i].getPointAt(.14 + i * .31)));
  draw(); sync();
  return () => {
    running = false; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
    banner?.removeEventListener("pointermove", move); banner?.removeEventListener("pointerleave", leave);
    renderer.domElement.removeEventListener("webglcontextlost", loseContext);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        const items = Array.isArray(object.material) ? object.material : [object.material];
        items.forEach(material => materials.add(material));
      }
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    solarTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); delete host.dataset.scene;
  };
}
