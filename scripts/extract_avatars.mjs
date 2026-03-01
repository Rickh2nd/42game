import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const INPUT_ZIP = '/Users/rickhale/Downloads/drive-download-20260301T010607Z-1-001.zip';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AVATAR_ROOT = path.join(ROOT, 'client', 'assets', 'avatars');
const GLB_DIR = path.join(AVATAR_ROOT, 'glb');
const OBJ_DIR = path.join(AVATAR_ROOT, 'obj');
const LEGACY_MODELS_DIR = path.join(AVATAR_ROOT, 'models');
const MANIFEST_PATH = path.join(AVATAR_ROOT, 'manifest.json');
const LEGACY_CATALOG_PATH = path.join(AVATAR_ROOT, 'avatars.json');

const MODELS_ROOT = path.join(ROOT, 'client', 'assets', 'models');
const TABLE_GLB = path.join(MODELS_ROOT, 'table.glb');
const CHAIR_GLB = path.join(MODELS_ROOT, 'chair.glb');

const MALE = [
  'BlueSoldier_Male', 'Casual2_Male', 'Casual3_Male', 'Casual_Male', 'Chef_Male', 'Cowboy_Male',
  'Doctor_Male_Old', 'Doctor_Male_Young', 'Goblin_Male', 'Kimono_Male', 'Knight_Golden_Male',
  'Knight_Male', 'Ninja_Male', 'OldClassy_Male', 'Pirate_Male', 'Soldier_Male', 'Suit_Male',
  'Viking_Male', 'Worker_Male', 'Zombie_Male'
];

const FEMALE = [
  'BlueSoldier_Female', 'Casual2_Female', 'Casual3_Female', 'Casual_Female', 'Chef_Female', 'Cowboy_Female',
  'Doctor_Female_Old', 'Doctor_Female_Young', 'Goblin_Female', 'Kimono_Female', 'Knight_Golden_Female',
  'Ninja_Female', 'Ninja_Sand_Female', 'OldClassy_Female', 'Pirate_Female', 'Soldier_Female', 'Suit_Female',
  'Viking_Female', 'Worker_Female', 'Zombie_Female'
];

const SPECIAL = ['Elf', 'Ninja_Sand', 'Witch', 'Wizard'];

const EXCLUDED = new Set([
  'Cow',
  'Pug',
  'VikingHelmet',
  'Chef_Hat',
  'Cowboy_Hair',
  'Ninja_Male_Hair',
  'BaseCharacter',
  'OBJ'
]);

const INCLUDED = [...MALE, ...FEMALE, ...SPECIAL];
const INCLUDED_SET = new Set(INCLUDED);

function normalizePosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function isMetadataPath(rel) {
  const norm = normalizePosix(rel);
  const parts = norm.split('/');
  return parts.includes('__MACOSX') || parts.some((part) => part.startsWith('._'));
}

function toDisplayName(base) {
  return base
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function toId(base) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

function safeDecodeUri(uri) {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

function uriIsExternal(uri) {
  return /^[a-z][a-z0-9+\-.]*:/i.test(uri) || uri.startsWith('//');
}

async function copyGltfDependencies(gltfPath, destRoot) {
  let parsed = null;
  try {
    const raw = await fs.readFile(gltfPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const uris = new Set();
  for (const sectionName of ['buffers', 'images']) {
    const list = Array.isArray(parsed?.[sectionName]) ? parsed[sectionName] : [];
    for (const item of list) {
      if (item?.uri && typeof item.uri === 'string') {
        uris.add(item.uri);
      }
    }
  }

  for (const uri of uris) {
    if (!uri || uri.startsWith('data:') || uriIsExternal(uri)) continue;
    const rel = safeDecodeUri(uri);
    const src = path.resolve(path.dirname(gltfPath), rel);
    const dst = path.resolve(destRoot, rel);
    if (dst !== destRoot && !dst.startsWith(`${destRoot}${path.sep}`)) continue;
    try {
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
    } catch {
      // Missing optional dependency: keep going so other avatars still build.
    }
  }
}

function addBox(target, center, size) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;

  const faces = [
    { n: [1, 0, 0], c: [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]] },
    { n: [-1, 0, 0], c: [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]] },
    { n: [0, 1, 0], c: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], c: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    { n: [0, 0, 1], c: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], c: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] }
  ];

  for (const face of faces) {
    const base = target.positions.length / 3;
    for (const [x, y, z] of face.c) {
      target.positions.push(cx + x, cy + y, cz + z);
      target.normals.push(face.n[0], face.n[1], face.n[2]);
    }
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function computeMinMax(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
  return { min, max };
}

async function writeGlb(meshDefs, outputPath) {
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const nodes = [];
  const materials = [];
  const parts = [];
  let offset = 0;

  const padTo4 = (value) => (4 - (value % 4)) % 4;

  const appendBinary = (buffer, target) => {
    const startPad = padTo4(offset);
    if (startPad) {
      parts.push(Buffer.alloc(startPad));
      offset += startPad;
    }
    const viewIndex = bufferViews.length;
    bufferViews.push({ byteOffset: offset, byteLength: buffer.length, target });
    parts.push(buffer);
    offset += buffer.length;
    return viewIndex;
  };

  for (const def of meshDefs) {
    const matIndex = materials.length;
    materials.push({
      name: def.material.name,
      pbrMetallicRoughness: {
        baseColorFactor: def.material.baseColor,
        roughnessFactor: def.material.roughness,
        metallicFactor: def.material.metalness
      }
    });

    const positions = Float32Array.from(def.positions);
    const normals = Float32Array.from(def.normals);
    const indices = Uint16Array.from(def.indices);

    const posView = appendBinary(Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength), 34962);
    const normView = appendBinary(Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength), 34962);
    const idxView = appendBinary(Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength), 34963);

    const { min, max } = computeMinMax(def.positions);

    const posAccessor = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: positions.length / 3,
      type: 'VEC3',
      min,
      max
    });

    const normAccessor = accessors.length;
    accessors.push({
      bufferView: normView,
      componentType: 5126,
      count: normals.length / 3,
      type: 'VEC3'
    });

    const idxAccessor = accessors.length;
    accessors.push({
      bufferView: idxView,
      componentType: 5123,
      count: indices.length,
      type: 'SCALAR'
    });

    const meshIndex = meshes.length;
    meshes.push({
      name: def.name,
      primitives: [
        {
          attributes: {
            POSITION: posAccessor,
            NORMAL: normAccessor
          },
          indices: idxAccessor,
          material: matIndex
        }
      ]
    });

    nodes.push({ name: `${def.name}Node`, mesh: meshIndex });
  }

  let binBuffer = Buffer.concat(parts);
  const endPad = padTo4(binBuffer.length);
  if (endPad) {
    binBuffer = Buffer.concat([binBuffer, Buffer.alloc(endPad)]);
  }

  const gltf = {
    asset: { version: '2.0', generator: 'Texas42 model builder' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, idx) => idx) }],
    nodes,
    meshes,
    materials,
    buffers: [{ byteLength: binBuffer.length }],
    bufferViews,
    accessors
  };

  const jsonText = JSON.stringify(gltf);
  let jsonBuffer = Buffer.from(jsonText, 'utf8');
  const jsonPad = padTo4(jsonBuffer.length);
  if (jsonPad) {
    jsonBuffer = Buffer.concat([jsonBuffer, Buffer.from(' '.repeat(jsonPad), 'utf8')]);
  }

  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(0x4E4F534A, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.writeUInt32LE(0x004E4942, 4);

  const glb = Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer]);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, glb);
}

async function generateEnvironmentModels() {
  const tableWood = {
    name: 'TableWood',
    positions: [],
    normals: [],
    indices: [],
    material: {
      name: 'TableWoodMat',
      baseColor: [0.34, 0.2, 0.11, 1],
      roughness: 0.62,
      metalness: 0.08
    }
  };

  const tableFelt = {
    name: 'TableFelt',
    positions: [],
    normals: [],
    indices: [],
    material: {
      name: 'TableFeltMat',
      baseColor: [0.08, 0.5, 0.33, 1],
      roughness: 0.95,
      metalness: 0.02
    }
  };

  addBox(tableWood, [0, 0.56, 0], [4.6, 0.08, 3.1]);
  addBox(tableWood, [0, 0.5, 0], [4.35, 0.08, 2.85]);
  addBox(tableWood, [0, 0.48, 1.34], [4.12, 0.14, 0.14]);
  addBox(tableWood, [0, 0.48, -1.34], [4.12, 0.14, 0.14]);
  addBox(tableWood, [2.01, 0.48, 0], [0.14, 0.14, 2.7]);
  addBox(tableWood, [-2.01, 0.48, 0], [0.14, 0.14, 2.7]);

  addBox(tableWood, [1.85, 0.21, 1.16], [0.14, 0.42, 0.14]);
  addBox(tableWood, [1.85, 0.21, -1.16], [0.14, 0.42, 0.14]);
  addBox(tableWood, [-1.85, 0.21, 1.16], [0.14, 0.42, 0.14]);
  addBox(tableWood, [-1.85, 0.21, -1.16], [0.14, 0.42, 0.14]);

  addBox(tableWood, [0, 0.13, 0], [1.75, 0.1, 1.12]);
  addBox(tableWood, [0, 0.03, 0], [1.25, 0.06, 0.75]);

  addBox(tableFelt, [0, 0.605, 0], [4.02, 0.01, 2.56]);

  await writeGlb([tableWood, tableFelt], TABLE_GLB);

  const chairWood = {
    name: 'ChairWood',
    positions: [],
    normals: [],
    indices: [],
    material: {
      name: 'ChairWoodMat',
      baseColor: [0.28, 0.18, 0.1, 1],
      roughness: 0.63,
      metalness: 0.07
    }
  };

  const chairFabric = {
    name: 'ChairFabric',
    positions: [],
    normals: [],
    indices: [],
    material: {
      name: 'ChairFabricMat',
      baseColor: [0.12, 0.17, 0.23, 1],
      roughness: 0.9,
      metalness: 0.02
    }
  };

  addBox(chairWood, [0, 0.42, 0], [0.64, 0.08, 0.64]);
  addBox(chairWood, [0, 0.86, -0.28], [0.64, 0.82, 0.08]);

  addBox(chairWood, [0.25, 0.2, 0.25], [0.09, 0.4, 0.09]);
  addBox(chairWood, [-0.25, 0.2, 0.25], [0.09, 0.4, 0.09]);
  addBox(chairWood, [0.25, 0.2, -0.25], [0.09, 0.4, 0.09]);
  addBox(chairWood, [-0.25, 0.2, -0.25], [0.09, 0.4, 0.09]);

  addBox(chairWood, [0, 0.1, 0.25], [0.56, 0.06, 0.06]);
  addBox(chairWood, [0, 0.1, -0.25], [0.56, 0.06, 0.06]);
  addBox(chairWood, [0.25, 0.1, 0], [0.06, 0.06, 0.56]);
  addBox(chairWood, [-0.25, 0.1, 0], [0.06, 0.06, 0.56]);

  addBox(chairFabric, [0, 0.47, 0.02], [0.55, 0.04, 0.52]);
  addBox(chairFabric, [0, 0.79, -0.24], [0.52, 0.5, 0.04]);

  await writeGlb([chairWood, chairFabric], CHAIR_GLB);
}

async function buildAvatarManifest(tempExtractDir) {
  const files = await walk(tempExtractDir);
  const byBasePreferred = new Map();
  const objByBase = new Map();
  const mtlByBase = new Map();

  for (const abs of files) {
    const rel = path.relative(tempExtractDir, abs);
    if (isMetadataPath(rel)) continue;

    const ext = path.extname(abs).toLowerCase();
    const base = path.basename(abs, ext);

    if (EXCLUDED.has(base)) continue;
    if (!INCLUDED_SET.has(base)) continue;

    if (ext === '.glb' || ext === '.gltf') {
      const existing = byBasePreferred.get(base);
      if (!existing || (existing.ext === '.gltf' && ext === '.glb')) {
        byBasePreferred.set(base, { abs, ext, name: base });
      }
      continue;
    }

    if (ext === '.obj') {
      objByBase.set(base, abs);
      continue;
    }

    if (ext === '.mtl') {
      mtlByBase.set(base, abs);
    }
  }

  await fs.rm(GLB_DIR, { recursive: true, force: true });
  await fs.rm(OBJ_DIR, { recursive: true, force: true });
  await fs.mkdir(GLB_DIR, { recursive: true });
  await fs.mkdir(OBJ_DIR, { recursive: true });

  const manifest = [];

  for (const name of INCLUDED) {
    const picked = byBasePreferred.get(name);
    if (!picked) continue;

    const outFile = `${name}${picked.ext}`;
    const destination = path.join(GLB_DIR, outFile);
    await fs.copyFile(picked.abs, destination);
    if (picked.ext === '.gltf') {
      await copyGltfDependencies(picked.abs, GLB_DIR);
    }

    const objSource = objByBase.get(name);
    const mtlSource = mtlByBase.get(name);
    if (objSource) {
      await fs.copyFile(objSource, path.join(OBJ_DIR, `${name}.obj`));
    }
    if (mtlSource) {
      await fs.copyFile(mtlSource, path.join(OBJ_DIR, `${name}.mtl`));
    }

    manifest.push({
      id: toId(name),
      name: toDisplayName(name),
      file: `/assets/avatars/glb/${outFile}`
    });
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const legacyCatalog = manifest.map((entry) => ({
    id: entry.id,
    label: entry.name,
    url: entry.file
  }));
  await fs.writeFile(LEGACY_CATALOG_PATH, `${JSON.stringify(legacyCatalog, null, 2)}\n`, 'utf8');

  return manifest;
}

async function main() {
  await fs.access(INPUT_ZIP);

  const tempExtractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'texas42-avatars-'));

  try {
    await fs.rm(LEGACY_MODELS_DIR, { recursive: true, force: true });
    await fs.mkdir(tempExtractDir, { recursive: true });

    const zip = new AdmZip(INPUT_ZIP);
    zip.extractAllTo(tempExtractDir, true);

    const manifest = await buildAvatarManifest(tempExtractDir);
    await generateEnvironmentModels();

    console.log(`Avatar manifest written: ${MANIFEST_PATH}`);
    console.log(`Selectable avatars: ${manifest.length}`);
    console.log(`Generated table model: ${TABLE_GLB}`);
    console.log(`Generated chair model: ${CHAIR_GLB}`);
  } finally {
    await fs.rm(tempExtractDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('Avatar extraction failed:', error.message);
  process.exitCode = 1;
});
