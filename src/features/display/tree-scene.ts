import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  HemisphereLight,
  DirectionalLight,
  Vector3,
  Matrix4,
  MathUtils,
  Color,
  Spherical,
  Mesh,
  BufferGeometry,
  Material,
  MeshToonMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  NeutralToneMapping,
  PCFSoftShadowMap,
  Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTreeModel, type GrowthMetrics } from "./tree-model";
import { treePalettes, type TreeSettings } from "@/lib/tree-settings";
import type { Leaf } from "@/lib/catalog";
import { createTreeEnvironment } from "./tree-environment";

export type ProjectedLeaf = {
  id: string;
  x: number;
  y: number;
  visible: boolean;
};
export type SceneController = {
  update(
    leaves: Leaf[],
    activeId?: string,
    arrivalId?: string,
    count?: number,
    arrivals?: readonly string[],
  ): void;
  configure(settings: TreeSettings): void;
  breeze(): void;
  resetView(): void;
  zoom(factor: number): void;
  orbit(horizontal: number, vertical?: number): void;
  capture(pixelRatio?: number): Promise<Blob>;
  exportGlb(): Promise<ArrayBuffer>;
  dispose(): void;
};
export function createTreeScene(
  host: HTMLElement,
  initial: TreeSettings,
  onProject: (items: ProjectedLeaf[], metrics?: GrowthMetrics) => void,
  onFailure: () => void,
  environment: "transparent" | "garden" = "transparent",
): SceneController {
  let settings = initial,
    disposed = false,
    dirty = true,
    lastFrame = 0,
    lastTick = 0,
    first = true,
    userView = false,
    interacting = false,
    lastInteraction = -10000,
    gustStarted = -10000;
  let leaves: Leaf[] = [],
    activeId: string | undefined,
    arrivalId: string | undefined,
    arrivalIds: readonly string[] = [],
    count = 0;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: settings.quality !== "low",
    powerPreference: "high-performance",
  });
  const gl = renderer.getContext(),
    debug = gl.getExtension("WEBGL_debug_renderer_info");
  const software = debug
    ? /swiftshader|llvmpipe|software/i.test(
        String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)),
      )
    : false;
  const isLow = () =>
    settings.quality === "low" ||
    (settings.quality === "auto" &&
      (software ||
        innerWidth < 700 ||
        (navigator.hardwareConcurrency || 4) <= 4));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "procedural-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new Scene(),
    camera = new PerspectiveCamera(34, 1, 0.05, 160);
  const controls = new OrbitControls(camera, host);
  controls.enableDamping = !motion.matches;
  controls.dampingFactor = 0.1;
  controls.enablePan = false;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.8;
  let model: ReturnType<typeof createTreeModel>;
  try {
    model = createTreeModel(settings, isLow());
  } catch (error) {
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
  scene.add(model.group);
  const sky = new HemisphereLight(
      "#bfd8ff",
      "#6b5a45",
      settings.skyIntensity,
    ),
    sun = new DirectionalLight("#fff3df", settings.sunIntensity * 1.4),
    rim = new DirectionalLight("#e7f4df", 0.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(
    software ? 512 : isLow() ? 1024 : 2048,
    software ? 512 : isLow() ? 1024 : 2048,
  );
  sun.shadow.camera.left = sun.shadow.camera.bottom = -settings.size * 2;
  sun.shadow.camera.right = sun.shadow.camera.top = settings.size * 2;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  rim.position.set(4, 4, -4);
  scene.add(sky, sun, sun.target, rim);
  let garden = createTreeEnvironment(scene, settings, isLow());
  host.dataset.grassBlades = String(garden.grassCount);
  host.dataset.shadows = "true";
  const centre = new Vector3(),
    corner = new Vector3();
  let fittedDistance = 10;
  function fit() {
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight),
      budget = software
        ? 1600000
        : isLow()
          ? 2000000
          : settings.quality === "high"
            ? 9000000
            : 6000000;
    renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        isLow() ? 1 : 1.5,
        Math.sqrt(budget / (width * height)),
      ),
    );
    renderer.setSize(width, height, false);
    // Keep one continuous sky/ground canvas while framing a portrait tree
    // above its controls and stories. Zoomed branches can still cross them.
    const framing = getComputedStyle(host);
    const frameHeight =
      (height *
        (parseFloat(framing.getPropertyValue("--tree-frame-height")) || 100)) /
      100;
    const frameTop =
      (height *
        (parseFloat(framing.getPropertyValue("--tree-frame-top")) || 0)) /
      100;
    camera.clearViewOffset();
    camera.aspect = width / frameHeight;
    if (frameHeight !== height || frameTop)
      camera.setViewOffset(width, frameHeight, 0, -frameTop, width, height);
    const box = model.bounds
      .clone()
      .expandByScalar(0.15)
      .applyMatrix4(
        new Matrix4().makeRotationY(
          MathUtils.degToRad(settings.rotation),
        ),
      );
    box.min.multiplyScalar(environment === "garden" ? 1.04 : 1.14);
    box.max.multiplyScalar(environment === "garden" ? 1.04 : 1.14);
    box.getCenter(centre);
    const tanY = Math.tan(MathUtils.degToRad(camera.fov) / 2),
      tanX = tanY * camera.aspect;
    let distance = 1;
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        )
        .sub(centre);
      distance = Math.max(
        distance,
        corner.z + Math.abs(corner.x) / tanX,
        corner.z + Math.abs(corner.y) / tanY,
      );
    }
    fittedDistance = distance * (environment === "garden" ? 0.9 : 1.04);
    controls.target.copy(centre);
    controls.minDistance = Math.max(1, fittedDistance * 0.25);
    controls.maxDistance = fittedDistance * 2.4;
    if (!userView) {
      camera.position
        .copy(centre)
        .add(
          new Vector3(0, 0.08, 1)
            .normalize()
            .multiplyScalar(fittedDistance),
        );
      camera.lookAt(centre);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    controls.update();
    controls.saveState();
    dirty = true;
  }
  function lighting() {
    const shadowSize = software ? 512 : isLow() ? 1024 : 2048;
    if (sun.shadow.mapSize.x !== shadowSize) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
    }
    sun.shadow.camera.left = sun.shadow.camera.bottom = -settings.size * 2;
    sun.shadow.camera.right = sun.shadow.camera.top = settings.size * 2;
    sun.shadow.camera.updateProjectionMatrix();
    const angle = MathUtils.degToRad(settings.sunAngle);
    sun.position.set(
      Math.sin(angle) * 7,
      settings.sunHeight * 9,
      Math.cos(angle) * 7,
    );
    sun.intensity = settings.sunIntensity * 1.4;
    sun.target.position.set(0, settings.size * 0.3, 0);
    if (environment === "garden")
      scene.background = new Color(
        treePalettes[settings.palette].background,
      );
    sky.intensity = settings.skyIntensity;
    controls.autoRotate = settings.autoRotate && !motion.matches;
    controls.autoRotateSpeed = 0.35;
  }
  const changed = () => {
      dirty = true;
    },
    start = () => {
      userView = true;
      interacting = true;
      lastInteraction = performance.now();
      dirty = true;
    };
  const end = () => {
    interacting = false;
    lastInteraction = performance.now();
  };
  controls.addEventListener("change", changed);
  controls.addEventListener("start", start);
  controls.addEventListener("end", end);
  function configure(next: TreeSettings) {
    if (JSON.stringify(next) === JSON.stringify(settings)) return;
    const liveKeys = new Set([
      "headline",
      "acceptingContributions",
      "wind",
      "windSpeed",
      "windDirection",
      "flutter",
      "sunAngle",
      "sunHeight",
      "sunIntensity",
      "skyIntensity",
      "autoRotate",
    ]);
    const shape = (value: TreeSettings) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(value).filter(([key]) => !liveKeys.has(key)),
        ),
      );
    if (shape(next) === shape(settings)) {
      if (next.autoRotate && !settings.autoRotate) lastInteraction = -10000;
      settings = next;
      model.configureMotion(next);
      garden.configure(next);
      lighting();
      dirty = true;
      return;
    }
    const replacement = createTreeModel(
      next,
      next.quality === "low" || (next.quality === "auto" && software),
    );
    scene.remove(model.group);
    model.dispose();
    model = replacement;
    settings = next;
    scene.add(model.group);
    model.setContributions(leaves, count, activeId, arrivalIds, false);
    model.step(performance.now(), 1, true);
    garden.dispose();
    garden = createTreeEnvironment(scene, settings, isLow());
    host.dataset.grassBlades = String(garden.grassCount);
    lighting();
    fit();
    first = false;
    dirty = true;
  }
  function update(
    nextLeaves: Leaf[],
    nextActive?: string,
    nextArrival?: string,
    total = nextLeaves.length,
    arrivals: readonly string[] = [],
  ) {
    leaves = nextLeaves;
    count = Math.max(total, nextLeaves.length);
    activeId = nextActive;
    arrivalId = nextArrival;
    arrivalIds = arrivals;
    model.setContributions(
      leaves,
      count,
      activeId,
      arrivals.length ? arrivals : arrivalId,
      !first,
    );
    first = false;
    dirty = true;
  }
  const projected = new Vector3();
  function render(now: number, force = false) {
    if (disposed || (document.hidden && !force)) return;
    const frameRate = software ? 24 : isLow() ? 30 : 60;
    if (!force && now - lastFrame < 1000 / frameRate) return;
    const delta = Math.min(0.1, (now - lastTick) / 1000 || 0.016);
    lastTick = lastFrame = now;
    controls.autoRotate =
      settings.autoRotate &&
      !motion.matches &&
      !interacting &&
      now - lastInteraction > 5000;
    const gust = Math.max(0, 1 - (now - gustStarted) / 2400) ** 2 * 2;
    const moved = controls.update(delta),
      grew = model.step(now, delta, motion.matches, gust);
    garden.step(now, motion.matches, count, gust);
    if (!force && !dirty && !moved && !grew && !controls.autoRotate) return;
    camera.updateMatrixWorld(true);
    model.group.updateMatrixWorld(true);
    const items: ProjectedLeaf[] = [];
    for (const [id, position] of model.known) {
      projected
        .copy(position)
        .applyMatrix4(model.group.matrixWorld)
        .project(camera);
      items.push({
        id,
        x: (projected.x * 0.5 + 0.5) * host.clientWidth,
        y: (-projected.y * 0.5 + 0.5) * host.clientHeight,
        visible: projected.z > -1 && projected.z < 1,
      });
    }
    onProject(items, { ...model.metrics });
    host.dataset.autoRotating = String(controls.autoRotate);
    host.dataset.windStrength = String(motion.matches ? 0 : settings.wind);
    host.dataset.windTime = (now / 1000).toFixed(3);
    host.dataset.windOffset = model
      .windOffset()
      .toArray()
      .map((v) => v.toFixed(4))
      .join(",");
    host.dataset.gust = gust.toFixed(3);
    host.dataset.azimuth = controls.getAzimuthalAngle().toFixed(3);
    host.dataset.distance = camera.position
      .distanceTo(controls.target)
      .toFixed(3);
    renderer.render(scene, camera);
    dirty = false;
  }
  lighting();
  fit();
  const observer = new ResizeObserver(() => {
    fit();
  });
  observer.observe(host);
  const lost = (event: Event) => {
    event.preventDefault();
    if (!disposed) onFailure();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  renderer.setAnimationLoop((now) => render(now));
  async function capture(pixelRatio = renderer.getPixelRatio()) {
    const previous = renderer.getPixelRatio();
    try {
      renderer.setPixelRatio(Math.max(1, Math.min(3, pixelRatio)));
      render(performance.now(), true);
      return await new Promise<Blob>((resolve, reject) =>
        renderer.domElement.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Could not capture the tree.")),
          "image/png",
        ),
      );
    } finally {
      renderer.setPixelRatio(previous);
      dirty = true;
    }
  }
  async function exportGlb() {
    const { GLTFExporter } =
      await import("three/addons/exporters/GLTFExporter.js");
    render(performance.now(), true);
    const copy = model.group.clone(true),
      geometries: BufferGeometry[] = [],
      materials: Material[] = [];
    copy.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        object.geometry = object.geometry.clone();
        geometries.push(object.geometry);
        const original = Array.isArray(object.material)
          ? object.material[0]
          : object.material;
        const source = original as MeshToonMaterial;
        object.material = new MeshStandardMaterial({
          color: source.color,
          map: source.map,
          side: source.side,
          alphaTest: source.alphaTest,
          roughness: 1,
          metalness: 0,
        });
        materials.push(object.material);
      }
    });
    try {
      return (await new GLTFExporter().parseAsync(copy, {
        binary: true,
        onlyVisible: true,
        copyright:
          "GM Tree; procedural geometry adapted from Mike Fernandez (MIT)",
      })) as ArrayBuffer;
    } finally {
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    renderer.setAnimationLoop(null);
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    controls.removeEventListener("change", changed);
    controls.removeEventListener("start", start);
    controls.removeEventListener("end", end);
    controls.dispose();
    model.dispose();
    garden.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }
  return {
    update,
    breeze() {
      gustStarted = performance.now();
      dirty = true;
      render(gustStarted, true);
    },
    configure,
    capture,
    exportGlb,
    dispose,
    orbit(horizontal, vertical = 0) {
      userView = true;
      lastInteraction = performance.now();
      const spherical = new Spherical().setFromVector3(
        camera.position.clone().sub(controls.target),
      );
      spherical.theta += horizontal;
      spherical.phi = MathUtils.clamp(
        spherical.phi + vertical,
        controls.minPolarAngle,
        controls.maxPolarAngle,
      );
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();
      dirty = true;
      render(performance.now(), true);
    },
    resetView() {
      userView = false;
      interacting = false;
      lastInteraction = -10000;
      gustStarted = -10000;
      fit();
      render(performance.now(), true);
    },
    zoom(factor) {
      userView = true;
      lastInteraction = performance.now();
      camera.position
        .sub(controls.target)
        .multiplyScalar(factor)
        .clampLength(controls.minDistance, controls.maxDistance)
        .add(controls.target);
      controls.update();
      dirty = true;
      render(performance.now(), true);
    },
  };
}
