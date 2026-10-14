import {
  createSourceSfxFloatCurve,
  createSourceSfxPackedColorCurve,
  sourceSfxShaderPhase,
} from './source-sfx-curves.js';

function nodeName(path) {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\[\d+\]$/, '');
}

// T201 closes only BXML's four integral byte form. Its reader stores source
// order A,R,G,B, while source-sfx-curves converts packed ARGB to shader RGBA.
export function sourceSfxBxmlArgb(value) {
  if (typeof value !== 'string' || !/^\[\s*[^,]+\s*,\s*[^,]+\s*,\s*[^,]+\s*,\s*[^\]]+\s*\]$/.test(value)) {
    throw new TypeError('BXML color must be a four-element array string');
  }
  const bytes = value.slice(1, -1).split(',').map(token => Number(token.trim()));
  if (!bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    throw new RangeError('BXML color bytes must be integers in [0, 255]');
  }
  return (((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0);
}

function curveNodes(orderedNodes, uniformsPath) {
  const result = new Map();
  for (const node of orderedNodes) {
    if (node.path.slice(0, node.path.lastIndexOf('/')) === uniformsPath) result.set(nodeName(node.path), node);
  }
  return result;
}

// Creates one node-local material binding. update builds all scalar and color
// values before the sole setParameters call, preserving source update atomicity.
export function createSourceSfxMaterialBinding(orderedNodes, uniformsPath, materialBinding) {
  if (!materialBinding || typeof materialBinding.setParameters !== 'function') {
    throw new TypeError('Source material setParameters binding required');
  }
  const curves = curveNodes(orderedNodes, uniformsPath);
  const scalars = [], colors = [], textures = [];
  for (const node of orderedNodes) {
    if (!node.path.startsWith(`${uniformsPath}/Variables[`)) continue;
    const {Name: name, Type: type, Value: reference} = node.attributes;
    if (!name) continue;
    if (type === 'FloatKeyFrame') {
      const curve = curves.get(reference);
      if (!curve) throw new Error(`Missing source scalar curve ${reference} for ${name}`);
      scalars.push({name, sample: createSourceSfxFloatCurve(curve)});
    } else if (type === 'ColorKeyFrame') {
      const curve = curves.get(reference);
      if (!curve) throw new Error(`Missing source color curve ${reference} for ${name}`);
      colors.push({name, sample: createSourceSfxPackedColorCurve({
        attributes: curve.attributes,
        frames: curve.frames.map(frame => ({...frame, Value: sourceSfxBxmlArgb(frame.Value)})),
      })});
    } else if (type === 'String') {
      textures.push({name, sourcePath: reference, type});
    }
  }
  return {
    scalarCount: scalars.length,
    colorCount: colors.length,
    dynamicCount: scalars.length + colors.length,
    textures,
    update(time, lifespan) {
      const phase = sourceSfxShaderPhase(time, lifespan);
      const changes = {};
      for (const {name, sample} of scalars) changes[name] = sample(phase);
      for (const {name, sample} of colors) changes[name] = sample(phase);
      materialBinding.setParameters(changes);
    },
  };
}

// Enumerates only the actual common7 ShaderComponent sections. The caller
// allocates one common7 material per entry; no parameter state is shared.
export function createSourceSfxEffectMaterialBindings(effect, createMaterialBinding) {
  const result = [];
  for (const node of effect.orderedNodes) {
    if (!node.attributes.DecalTech?.endsWith('u5_vfx_common_7.surf')) continue;
    const uniforms = effect.orderedNodes.find(candidate =>
      candidate.path.startsWith(`${node.path}/ShaderComponent[`) && /\/Uniforms\[\d+\]$/.test(candidate.path));
    if (!uniforms) throw new Error(`Missing ShaderComponent Uniforms for ${node.path}`);
    const materialBinding = createMaterialBinding({node, uniformsPath: uniforms.path});
    result.push({nodePath: node.path, uniformsPath: uniforms.path, lifespan: Number(node.attributes.FxLifeSpan),
      binding: createSourceSfxMaterialBinding(effect.orderedNodes, uniforms.path, materialBinding)});
  }
  return result;
}
