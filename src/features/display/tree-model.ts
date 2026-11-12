import {
  CanvasTexture,
  SRGBColorSpace,
  DataTexture,
  RGBAFormat,
  NearestFilter,
  MeshToonMaterial,
  Mesh,
  MeshDepthMaterial,
  RGBADepthPacking,
  Vector3,
  PlaneGeometry,
  DoubleSide,
  Color,
  InstancedMesh,
  DynamicDrawUsage,
  Box3,
  Object3D,
  Group,
  BufferAttribute,
  Euler,
  Quaternion,
  MathUtils,
} from "three";
import { generateTree } from "@/vendor/just-a-simple-tree";
import { createClusterTexture } from "@/vendor/just-a-simple-tree/leaf-textures.js";
import { treeGrowth, smoothGrowth } from "@/lib/tree-growth";
import { treePalettes, type TreeSettings } from "@/lib/tree-settings";
import { themes, type Leaf } from "@/lib/catalog";
import { createTreeWind } from "./tree-wind";

export function seeded(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export function hashLeaf(text: string) {
  return Array.from(text).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
}
export type GrowthMetrics = {
  count: number;
  foliage: number;
  branches: number;
  progress: number;
  scale: number;
  phase: string;
  arriving: number;
};
type Anchor = {
  center: Vector3;
  root: Vector3;
  birth: number;
  lift?: number;
  flex?: number;
  phase?: number;
};
type Card = {
  id?: string;
  leaf?: Leaf;
  anchor: Anchor;
  offset: Vector3;
  rotation: Euler;
  size: number;
  color: Color;
  arrival: number;
};

export function makeLeafTexture(shape: TreeSettings["leafShape"]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(64, 70);
  ctx.fillStyle = "white";
  ctx.beginPath();
  if (shape === "round") {
    ctx.ellipse(0, -8, 37, 49, 0, 0, Math.PI * 2);
  } else if (shape === "needle") {
    ctx.moveTo(-5, 45);
    ctx.quadraticCurveTo(-13, -10, 0, -61);
    ctx.quadraticCurveTo(13, -10, 5, 45);
  } else if (shape === "oak") {
    ctx.moveTo(0, 49);
    ctx.bezierCurveTo(-7, 31, -40, 32, -23, 16);
    ctx.bezierCurveTo(-55, 8, -28, -9, -20, -5);
    ctx.bezierCurveTo(-43, -28, -14, -35, -10, -27);
    ctx.bezierCurveTo(-18, -53, -4, -56, 0, -63);
    ctx.bezierCurveTo(4, -56, 18, -53, 10, -27);
    ctx.bezierCurveTo(14, -35, 43, -28, 20, -5);
    ctx.bezierCurveTo(28, -9, 55, 8, 23, 16);
    ctx.bezierCurveTo(40, 32, 7, 31, 0, 49);
  } else {
    ctx.moveTo(0, 48);
    ctx.bezierCurveTo(-48, 12, -45, -25, 0, -61);
    ctx.bezierCurveTo(45, -25, 48, 12, 0, 48);
  }
  ctx.fill();
  ctx.save();
  ctx.clip();
  const light = ctx.createLinearGradient(-35, 0, 35, 0);
  light.addColorStop(0, "rgba(30,55,20,.4)");
  light.addColorStop(0.46, "rgba(255,255,255,0)");
  light.addColorStop(0.51, "rgba(255,255,255,.08)");
  light.addColorStop(1, "rgba(35,65,20,.15)");
  ctx.fillStyle = light;
  ctx.fillRect(-64, -70, 128, 128);
  ctx.strokeStyle = "rgba(55,75,30,.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 43);
  ctx.lineTo(0, -49);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    const y = 23 - i * 13;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(side * 16, y - 10, side * (25 - i * 2), y - 20);
      ctx.stroke();
    }
  }
  ctx.restore();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createTreeModel(settings: TreeSettings, low: boolean) {
  const { geometry, clumps } = generateTree(settings),
    group = new Group(),
    windField = createTreeWind(settings);
  group.rotation.y = MathUtils.degToRad(settings.rotation);
  const palette = treePalettes[settings.palette],
    colors = settings.customColors
      ? [settings.leafShadow, settings.leafMid, settings.leafLight]
      : palette.leaves;
  const gradient = new DataTexture(
    new Uint8Array([
      60, 60, 60, 255, 150, 150, 150, 255, 220, 220, 220, 255, 255, 255, 255,
      255,
    ]),
    4,
    1,
    RGBAFormat,
  );
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.needsUpdate = true;
  const texture =
      settings.growthMode === "manual"
        ? createClusterTexture(settings.leafShape, settings.species)
        : makeLeafTexture(settings.leafShape),
    woodMaterial = new MeshToonMaterial({
      color: settings.customColors ? settings.woodColor : palette.wood,
      gradientMap: gradient,
    });
  const positions = geometry.getAttribute("position"),
    original = positions
      ? new Float32Array(positions.array)
      : new Float32Array();
  const centers = geometry.getAttribute("growCenter"),
    roots = geometry.getAttribute("growRoot"),
    births = geometry.getAttribute("birth");
  const wood = new Mesh(geometry, woodMaterial);
  wood.castShadow = wood.receiveShadow = true;
  const woodDepth = new MeshDepthMaterial({
    depthPacking: RGBADepthPacking,
  });
  windField.apply(woodMaterial);
  windField.apply(woodDepth);
  wood.customDepthMaterial = woodDepth;
  wood.frustumCulled = false;
  group.add(wood);
  wood.name = "GMC growing branches";
  const swayLifts = geometry.getAttribute("swayLift"),
    swayDetails = geometry.getAttribute("swayDetail");
  const anchors: Anchor[] = [],
    seen = new Set<string>();
  if (centers && births)
    for (let i = 0; i < centers.count; i++) {
      const center = new Vector3().fromBufferAttribute(centers, i),
        birth = births.getX(i),
        key = `${center.x.toFixed(3)}:${center.y.toFixed(3)}:${center.z.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        anchors.push({
          center,
          root: new Vector3().fromBufferAttribute(roots, i),
          birth,
          lift: swayLifts?.getX(i) || 0,
          flex: swayDetails?.getX(i) || 0,
          phase: swayDetails?.getY(i) || 0,
        });
      }
    }
  if (!anchors.length)
    for (const clump of clumps)
      anchors.push({
        center: clump.position,
        root: new Vector3(),
        birth: clump.birth || 0,
      });
  if (!anchors.length)
    anchors.push({
      center: new Vector3(0, settings.size * 0.25, 0),
      root: new Vector3(),
      birth: 0,
    });
  const clumpAnchors = clumps.map((clump) =>
    anchors.reduce(
      (nearest, anchor) =>
        anchor.center.distanceToSquared(clump.position) <
        nearest.center.distanceToSquared(clump.position)
          ? anchor
          : nearest,
      anchors[0],
    ),
  );
  const capacity = low ? 2400 : 6000,
    leafGeometry = new PlaneGeometry(
      1,
      1,
      settings.growthMode === "manual" ? 1 : 4,
      settings.growthMode === "manual" ? 1 : 5,
    ),
    leafMaterial = new MeshToonMaterial({
      map: texture,
      gradientMap: gradient,
      side: DoubleSide,
      alphaTest: 0.4,
      alphaToCoverage: true,
      color: "white",
    });
  // Upstream applies a color ramp after lighting instead of multiplying the
  // leaf color by the sun again. Preserve those bands and the fine leaf edges.
  leafMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uLeafShadow = { value: new Color(colors[0]) };
    shader.uniforms.uLeafMid = { value: new Color(colors[1]) };
    shader.uniforms.uLeafLight = { value: new Color(colors[2]) };
    shader.uniforms.uCanopyPreview = {
      value: settings.growthMode === "manual" ? 1 : 0,
    };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uLeafShadow, uLeafMid, uLeafLight;
        uniform float uCanopyPreview;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `
        float lightLevel = dot(outgoingLight, vec3(.2126, .7152, .0722))
          / max(dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)), .0001);
        vec3 leafBand = mix(uLeafShadow, uLeafMid, step(.8, lightLevel));
        leafBand = mix(leafBand, uLeafLight, step(1.6, lightLevel));
        vec3 leafTint = clamp(diffuseColor.rgb / max(uLeafMid, vec3(.001)), .65, 1.15);
        vec3 visitorLeaf = diffuseColor.rgb * mix(.65, 1., smoothstep(.4, 1.8, lightLevel));
        outgoingLight = mix(visitorLeaf, leafBand * leafTint, uCanopyPreview);
        #include <opaque_fragment>`,
      );
  };
  // A curled surface catches light on both sides of the central vein, instead
  // of every contribution looking like a flat rectangular sticker.
  const bladePositions = leafGeometry.getAttribute("position");
  if (settings.growthMode === "contributions") {
    for (let i = 0; i < bladePositions.count; i++) {
      const x = bladePositions.getX(i),
        y = bladePositions.getY(i);
      bladePositions.setZ(i, Math.abs(x) * 0.2 + Math.sin(y * 3.14) * 0.055);
    }
    leafGeometry.computeVertexNormals();
  }
  const foliage = new InstancedMesh(leafGeometry, leafMaterial, capacity);
  foliage.castShadow = foliage.receiveShadow = true;
  foliage.count = 0;
  foliage.instanceMatrix.setUsage(DynamicDrawUsage);
  foliage.frustumCulled = false;
  foliage.name = "GMC contribution leaves";
  group.add(foliage);
  const bounds = new Box3();
  if (positions?.count)
    bounds.setFromBufferAttribute(positions as BufferAttribute);
  for (const clump of clumps) {
    bounds.expandByPoint(clump.position.clone().addScalar(clump.radius * 1.2));
    bounds.expandByPoint(clump.position.clone().addScalar(-clump.radius * 1.2));
  }
  if (bounds.isEmpty())
    bounds.set(
      new Vector3(-1, 0, -1),
      new Vector3(1, settings.size, 1),
    );
  const matureHeight = Math.max(bounds.max.y, 1),
    dummy = new Object3D(),
    known = new Map<string, Vector3>();
  windField.configure(settings, matureHeight);
  let target = treeGrowth(0, settings),
    progress = target.progress,
    scale = target.scale,
    currentCards: Card[] = [],
    activeId: string | undefined,
    lastArrivals = new Set<string>(),
    dirty = true;
  const metrics: GrowthMetrics = {
    count: 0,
    foliage: 0,
    branches: 0,
    progress,
    scale,
    phase: target.phase,
    arriving: 0,
  };
  function setContributions(
    leaves: Leaf[],
    count: number,
    selected?: string,
    arrival?: string | readonly string[],
    animate = true,
  ) {
    const ordered = [...leaves].sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
    const arrivals = new Set(
      typeof arrival === "string" ? [arrival] : arrival || [],
    );
    const freshArrivals = [...arrivals].filter((id) => !lastArrivals.has(id));
    const next = treeGrowth(count, settings),
      changed =
        count !== target.count ||
        selected !== activeId ||
        freshArrivals.length > 0 ||
        arrivals.size !== lastArrivals.size ||
        ordered.some((leaf) => !known.has(leaf.id)) ||
        ordered.length !== known.size;
    target = next;
    activeId = selected;
    if (!animate) {
      progress = target.progress;
      scale = target.scale;
    }
    if (!changed && !dirty) return;
    const previous = new Map(
      currentCards.filter((card) => card.id).map((card) => [card.id, card]),
    );
    const previousCards = currentCards,
      launchedAt = performance.now();
    const total =
      settings.growthMode === "contributions"
        ? Math.min(capacity, Math.max(ordered.length, count))
        : Math.min(
            capacity,
            Math.floor(
              clumps.length *
                (low ? 24 : 40) *
                settings.density *
                Math.max(0, 1 - settings.season) ** 0.7,
            ),
          );
    const visible = ordered.slice(-Math.min(total, ordered.length)),
      historical = total - visible.length;
    currentCards = [];
    known.clear();
    for (let i = 0; i < total; i++) {
      const leaf = i >= historical ? visible[i - historical] : undefined,
        seed = leaf ? hashLeaf(leaf.id) : settings.seed + i * 11;
      const reusable = leaf
        ? previous.get(leaf.id)
        : previousCards[i]?.id
          ? undefined
          : previousCards[i];
      if (reusable) {
        const card = { ...reusable };
        if (
          leaf &&
          arrivals.has(leaf.id) &&
          !lastArrivals.has(leaf.id) &&
          animate
        )
          card.arrival =
            launchedAt + Math.max(0, freshArrivals.indexOf(leaf.id)) * 80;
        currentCards.push(card);
        if (leaf) known.set(leaf.id, new Vector3());
        continue;
      }
      // A leaf keeps the branch it could reach when it arrived. Growing tips
      // extend with it instead of moving old leaves to unrelated new branches.
      const ordinal = leaf
        ? Math.max(1, count - ordered.length + ordered.indexOf(leaf) + 1)
        : Math.max(1, Math.floor(((i + 1) / Math.max(total, 1)) * count));
      const arrivalGrowth = treeGrowth(ordinal, settings).progress,
        reach = arrivalGrowth * 1.25 - 0.035;
      const eligible = anchors.filter(
          (anchor) => anchor.birth <= reach && anchor.birth > 0.025,
        ),
        pool = eligible.length ? eligible : anchors;
      let anchor = pool[seed % pool.length],
        offset = new Vector3((seeded(seed) - 0.5) * 0.08, 0.015, 0.045);
      let size = (0.28 + seeded(seed + 3) * 0.13) * settings.leafSize;
      if (settings.growthMode === "manual" && clumps.length) {
        const clump = clumps[i % clumps.length],
          angle = seeded(seed) * Math.PI * 2,
          y = seeded(seed + 1) * 2 - 1,
          r = clump.radius * Math.sqrt(1 - y * y);
        anchor = {
          ...clumpAnchors[i % clumps.length],
          center: clump.position,
          root: clumpAnchors[i % clumps.length].root,
          birth: clumpAnchors[i % clumps.length].birth,
        };
        offset = new Vector3(
          Math.cos(angle) * r,
          y * clump.radius * (clump.flatten || 1),
          Math.sin(angle) * r,
        );
        size = clump.radius * 0.9 * settings.leafSize;
      }
      const seasonal = new Color(colors[1]).lerp(
        new Color(settings.palette === "frost" ? "#dce8df" : "#b67735"),
        Math.max(0, settings.season - 0.45),
      );
      const card: Card = {
        id: leaf?.id,
        leaf,
        anchor,
        offset,
        rotation: new Euler(
          (seeded(seed + 5) - 0.5) * 1.1,
          (seeded(seed + 6) - 0.5) * 1.8,
          (seeded(seed + 7) - 0.5) * 1.4,
        ),
        size,
        color:
          leaf &&
          !settings.customColors &&
          settings.growthMode === "contributions"
            ? new Color(
                themes.find((theme) => theme.id === leaf.category)!.color,
              )
            : seasonal.lerp(
                new Color(colors[seed % colors.length]),
                0.15,
              ),
        arrival: previous.get(leaf?.id)?.arrival || 0,
      };
      if (settings.growthMode === "manual") {
        const normal = offset.clone().normalize();
        if (normal.lengthSq() > 0.01)
          card.rotation.setFromQuaternion(
            new Quaternion().setFromUnitVectors(
              new Vector3(0, 0, 1),
              normal,
            ),
          );
        card.rotation.z += seeded(seed + 9) * Math.PI * 2;
      }
      if (
        leaf &&
        arrivals.has(leaf.id) &&
        !lastArrivals.has(leaf.id) &&
        animate
      )
        card.arrival =
          launchedAt + Math.max(0, freshArrivals.indexOf(leaf.id)) * 80;
      currentCards.push(card);
      if (leaf) known.set(leaf.id, new Vector3());
    }
    lastArrivals = arrivals;
    foliage.count = total;
    dirty = true;
    metrics.count = count;
    metrics.foliage = total;
    metrics.phase = target.phase;
  }
  let lastProgress = -1,
    lastReduced: boolean | undefined;
  function step(now: number, delta: number, reduced: boolean, gust = 0) {
    if (lastReduced !== reduced) dirty = true;
    lastReduced = reduced;
    const moving =
      Math.abs(progress - target.progress) > 0.0001 ||
      Math.abs(scale - target.scale) > 0.0001;
    progress = reduced
      ? target.progress
      : MathUtils.damp(progress, target.progress, 4, delta);
    scale = reduced
      ? target.scale
      : MathUtils.damp(scale, target.scale, 4, delta);
    const arrivalCount = reduced
        ? 0
        : currentCards.reduce(
            (sum, card) =>
              sum + Number(Boolean(card.arrival && now - card.arrival < 2000)),
            0,
          ),
      wind = !reduced && settings.wind > 0;
    if (metrics.arriving !== arrivalCount) dirty = true;
    metrics.arriving = arrivalCount;
    if (!dirty && !moving && !arrivalCount && !wind) return false;
    if (
      Math.abs(progress - lastProgress) > 0.00001 &&
      positions &&
      centers &&
      roots &&
      births
    ) {
      for (let i = 0; i < positions.count; i++) {
        const k = smoothGrowth(births.getX(i), progress),
          p = i * 3;
        for (let axis = 0; axis < 3; axis++) {
          const c = centers.array[p + axis],
            r = roots.array[p + axis];
          positions.array[p + axis] =
            r +
            (c - r) * k +
            (original[p + axis] - c) * k * (0.3 + 0.7 * progress);
        }
      }
      positions.needsUpdate = true;
      lastProgress = progress;
    }
    windField.update(now, reduced, gust);
    group.scale.setScalar(scale);
    group.updateMatrixWorld(true);
    for (let i = 0; i < currentCards.length; i++) {
      const card = currentCards[i],
        k = smoothGrowth(card.anchor.birth, progress);
      dummy.position
        .copy(card.anchor.root)
        .lerp(card.anchor.center, k)
        .addScaledVector(card.offset, k);
      dummy.position.add(
        windField.sample(
          dummy.position,
          card.anchor.lift,
          card.anchor.flex,
          card.anchor.phase,
        ),
      );
      let pop = 1,
        turn = 0;
      if (!reduced && card.arrival && now - card.arrival < 2000) {
        const t = MathUtils.clamp((now - card.arrival) / 2000, 0, 1),
          ease = t * t * (3 - 2 * t),
          seed = hashLeaf(card.id || String(i)),
          end = dummy.position.clone(),
          start = new Vector3(
            (seeded(seed + 21) - 0.5) * matureHeight * 1.3,
            matureHeight * 0.04,
            matureHeight * 0.55,
          ),
          control = end
            .clone()
            .add(
              new Vector3(
                (seeded(seed + 22) - 0.5) * matureHeight * 0.85,
                matureHeight * 0.35,
                matureHeight * 0.3,
              ),
            );
        dummy.position
          .copy(start)
          .multiplyScalar((1 - ease) ** 2)
          .addScaledVector(control, 2 * ease * (1 - ease))
          .addScaledVector(end, ease * ease);
        pop =
          now < card.arrival
            ? 0
            : 0.25 + 0.75 * (1 - (1 - t) ** 3) + Math.sin(t * Math.PI) * 0.2;
        turn = (1 - ease) * Math.PI * 1.6;
      }
      dummy.rotation.copy(card.rotation);
      dummy.rotation.z += turn;
      if (wind) {
        dummy.rotation.z +=
          Math.sin(now * 0.003 * settings.windSpeed + i) *
          settings.flutter *
          (1 + gust);
        dummy.rotation.x +=
          Math.sin(now * 0.004 * settings.windSpeed + i * 1.7) *
          settings.flutter *
          0.7;
        dummy.rotation.y +=
          Math.sin(now * 0.0023 * settings.windSpeed + i * 2.1) *
          settings.flutter *
          0.6;
      }
      dummy.scale.setScalar(
        Math.max(
          0.00001,
          card.size *
            pop *
            (settings.growthMode === "manual" ? k : 1) *
            (card.id === activeId ? 1.25 : 1),
        ),
      );
      dummy.updateMatrix();
      foliage.setMatrixAt(i, dummy.matrix);
      if (dirty) foliage.setColorAt(i, card.color);
      if (card.id) {
        if (
          (!reduced && card.arrival > now) ||
          (settings.growthMode === "manual" && k < 0.01)
        )
          known.get(card.id)!.set(NaN, NaN, NaN);
        else known.get(card.id)!.copy(dummy.position);
      }
    }
    foliage.instanceMatrix.needsUpdate = true;
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
    const groups = new Set(
      anchors
        .filter((anchor) => smoothGrowth(anchor.birth, progress) > 0.2)
        .map(
          (anchor) =>
            `${anchor.root.x.toFixed(2)}:${anchor.root.y.toFixed(2)}:${anchor.root.z.toFixed(2)}`,
        ),
    );
    metrics.branches = groups.size;
    metrics.progress = progress;
    metrics.scale = scale;
    dirty = false;
    return true;
  }
  function dispose() {
    foliage.dispose();
    geometry.dispose();
    leafGeometry.dispose();
    woodMaterial.dispose();
    woodDepth.dispose();
    leafMaterial.dispose();
    texture.dispose();
    gradient.dispose();
  }
  return {
    group,
    bounds,
    known,
    metrics,
    setContributions,
    step,
    dispose,
    configureMotion(next: TreeSettings) {
      settings = next;
      windField.configure(next, matureHeight);
      dirty = true;
    },
    windOffset: () =>
      windField.sample(new Vector3(0, matureHeight, 0)).clone(),
  };
}
