import * as THREE from 'three';

const finite = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const vector = (value, fallback) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) && parsed.length === 4 && parsed.every(Number.isFinite) ? parsed : fallback;
  } catch { return fallback; }
};
const gl3 = value => `vec3(${value.map(component => Number(component).toFixed(8)).join(',')})`;

export function alienLinear(color, quality) {
  if (![0, 1, 2].includes(quality)) throw new TypeError('ALIEN_RENDER_QUALITY_INVALID');
  return color.map(component => quality < 2 ? Math.pow(Math.max(component, 0), 2.2) : component * component);
}

export function alienOracle({grid, tex1, tex2, uv, time, quality, baseColor, pathColor}) {
  const linear = color => alienLinear(color, quality);
  const base = vector(baseColor, null), path = vector(pathColor, null);
  if (!base || !path || ![grid, tex1, tex2].every(value => Array.isArray(value) && value.length >= 3) || ![...uv, time].every(Number.isFinite)) throw new TypeError('ALIEN_INPUT_INVALID');
  const radial = (1 - ((uv[0] - .5) ** 2 + (uv[1] - .5) ** 2)) ** 2;
  const pathMask = tex1.slice(0, 3).map((value, index) => ((value >= .95 ? 1 : 0) * 3 + value) * tex2[index]);
  return {
    albedo: quality === 2 ? linear(grid.slice(0, 3)).map((value, index) => value * base[index]) : [0, 0, 0],
    emissive: linear(grid.slice(0, 3).map((value, index) => (value * .2 + radial) * base[index])).map((value, index) => value + linear(pathMask.map((component, channel) => component * path[channel]))[index] * 5),
    opacity: base[3],
    pannerUv: [uv[0] - .5 * time, uv[1]],
  };
}

export async function configureAlien(m, parameters, load, warnings, permutation) {
  const quality = permutation?.renderQuality;
  if (![0, 1, 2].includes(quality)) { warnings.push('ALIEN_RENDER_QUALITY_INVALID'); return null; }
  if (permutation.light !== true && permutation.light !== false || permutation.normalMap !== true && permutation.normalMap !== false || permutation.standardMaterial !== true && permutation.standardMaterial !== false) { warnings.push('ALIEN_PERMUTATION_INVALID'); return null; }
  // GetNormal supplies a WORLD-space constant. SetupNormal normalizes it; no TBN is read.
  const inputs = await Promise.all([load('Grid', false), load('Tex1', false), load('Tex2', false)]);
  if (inputs.some(t=>!t?.isTexture||t.isCubeTexture)) { warnings.push('ALIEN_REQUIRED_TEXTURE_MISSING'); return null; }
  const tiling = finite(parameters.TilingValue);
  const base = vector(parameters.BaseColor, null), path = vector(parameters.PathColor, null);
  if (!Number.isFinite(tiling) || !base || !path) { warnings.push('ALIEN_PARAMETER_INVALID'); return null; }
  const [grid,tex1,tex2]=inputs.map(t=>t.clone());
  m.addEventListener('dispose',()=>[grid,tex1,tex2].forEach(t=>t.dispose()));
  for (const texture of [grid, tex1, tex2]) {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
  }
  // The kernel owns all sampled channels. Leaving a host emissive map enabled
  // would multiply totalEmissiveRadiance after the injected source formula.
  m.map = null; m.emissiveMap = null; m.normalMap=null; m.roughnessMap=null; m.metalnessMap=null; m.aoMap=null; m.vertexColors=false; m.roughness = 1; m.metalness = 0; m.specularIntensity = .5;
  const uniforms = {neoAlienGrid: {value: grid}, neoAlienTex1: {value: tex1}, neoAlienTex2: {value: tex2}, neoTime: {value: 0}};
  const linear = quality < 2 ? 'pow(max(c,vec3(0.0)),vec3(2.2))' : 'c*c';
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    if(permutation.light&&permutation.normalMap)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*normalize(vec3(-.5,.5,.5)))${permutation.twoSided?'*(gl_FrontFacing?1.:-1.)':''};`);
    if(!permutation.light)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`${permutation.standardMaterial?'outgoingLight=totalEmissiveRadiance;':'outgoingLight=diffuseColor.rgb;'}\n#include <opaque_fragment>`);
    shader.vertexShader = `varying vec2 neoAlienUv;\n${shader.vertexShader}`.replace('#include <uv_vertex>', '#include <uv_vertex>\nneoAlienUv=uv;');
    shader.fragmentShader = `uniform sampler2D neoAlienGrid,neoAlienTex1,neoAlienTex2;uniform float neoTime;varying vec2 neoAlienUv;vec3 neoAlienLinear(vec3 c){return ${linear};}\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `vec2 neoAlienPanner=neoAlienUv+vec2(-0.5,0.0)*neoTime;vec3 neoAlienGridRgb=texture2D(neoAlienGrid,neoAlienUv*${tiling.toFixed(8)}).rgb;vec3 neoAlienX=texture2D(neoAlienTex1,neoAlienPanner).rgb;vec3 neoAlienP=texture2D(neoAlienTex2,neoAlienUv).rgb;diffuseColor.rgb=${quality === 2 ? `neoAlienLinear(neoAlienGridRgb)*${gl3(base.slice(0,3))}` : 'vec3(0.0)'};diffuseColor.a=${base[3].toFixed(8)}*opacity;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `float neoAlienRadial=pow(1.0-(pow(neoAlienUv.x-.5,2.0)+pow(neoAlienUv.y-.5,2.0)),2.0);vec3 neoAlienBase=neoAlienLinear((neoAlienGridRgb*.2+neoAlienRadial)*${gl3(base.slice(0,3))});vec3 neoAlienMask=(step(vec3(.95),neoAlienX)*3.0+neoAlienX)*neoAlienP;totalEmissiveRadiance=neoAlienBase+neoAlienLinear(neoAlienMask*${gl3(path.slice(0,3))})*5.0;`);
  };
  warnings.push('char_alien source channels and constant world normal; Web clock, source mip/half and full original lighting remain unproven.');
  return uniforms;
}
