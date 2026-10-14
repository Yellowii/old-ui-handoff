import * as THREE from 'three';

const finite=v=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v):NaN;return Number.isFinite(n)&&Number.isFinite(Math.fround(n))?n:null;};
const vector=(v, fallback)=>{try{const a=typeof v==='string'?JSON.parse(v):v;return Array.isArray(a)&&a.length===4&&a.every(x=>typeof x==='number'&&finite(x)!==null)?a:fallback;}catch{return fallback;}};
const gl=v=>`vec3(${v.slice(0,3).map(x=>Number(x).toFixed(8)).join(',')})`;
export const specialWingsLinear=(rgb,q)=>rgb.map(v=>q<2?Math.pow(Math.max(v,0),2.2):v*v);

export async function configureSpecialWings(m,p,load,warnings,permutation,secondUv){
 const q=permutation?.renderQuality;
 if(![0,1,2].includes(q)){warnings.push('SPECIAL_WINGS_RENDER_QUALITY_INVALID');return null;}
 if(secondUv!==true){warnings.push('SPECIAL_WINGS_SOURCE_UV1_REQUIRED');return null;}
 const required=['Tex0','Tex1','Tex2','Tex3']; const textures=await Promise.all(required.map(k=>load(k,false)));
 if(textures.some(t=>t?.isTexture!==true||t.isCubeTexture||t.isData3DTexture||t.isDataArrayTexture||t.isCompressedArrayTexture)){warnings.push('SPECIAL_WINGS_REQUIRED_TEXTURE_MISSING');return null;}
 const noise=Object.hasOwn(p,'NoiseColor')?vector(p.NoiseColor,null):[1,1,1,1],stars=vector(p.xingxingColor,null),spread=vector(p.kuosanColor,null),jb=vector(p.JBEmissiveColor,null);
 const scalars=['kuosanColorIntensity','NoiseIntensity','JBEmissiveColorIntensity'].map(k=>finite(p[k]));
 if(!noise||!stars||!spread||!jb||scalars.some(v=>v===null)){warnings.push('SPECIAL_WINGS_PARAMETER_INVALID');return null;}
 const samplers=[];let released=false;
 const releaseSamplers=()=>{if(released)return;released=true;samplers.forEach(texture=>texture.dispose());};
 try{
  for(const texture of textures){const sampler=texture.clone();samplers.push(sampler);sampler.colorSpace=THREE.NoColorSpace;sampler.wrapS=sampler.wrapT=THREE.RepeatWrapping;sampler.magFilter=sampler.minFilter=THREE.LinearFilter;sampler.generateMipmaps=false;sampler.needsUpdate=true;}
 }catch{releaseSamplers();warnings.push('SPECIAL_WINGS_SAMPLER_CLONE_FAILED');return null;}
 let previewTime=0;
 const [ki,ni,ji]=scalars;const uniforms={neoTime:{get value(){return previewTime;},set value(v){if(typeof v!=='number'||finite(v)===null)throw new TypeError('SPECIAL_WINGS_TIME_INVALID');previewTime=Math.fround(v);}},neoSw0:{value:samplers[0]},neoSw1:{value:samplers[1]},neoSw2:{value:samplers[2]},neoSw3:{value:samplers[3]}};
 const linear=q<2?'pow(max(c,vec3(0.0)),vec3(2.2))':'c*c';m.defines={...m.defines,USE_UV1:''};m.map=null;m.emissiveMap=null;m.roughness=1;m.metalness=0;m.specularIntensity=.3;
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=`varying vec2 neoSwUv0;varying vec2 neoSwUv1;\n${shader.vertexShader}`.replace('#include <uv_vertex>','#include <uv_vertex>\nneoSwUv0=uv;neoSwUv1=uv1;');shader.fragmentShader=`const float neoSwSpecular=0.3;const float neoSwOcclusion=1.0;uniform sampler2D neoSw0,neoSw1,neoSw2,neoSw3;uniform float neoTime;varying vec2 neoSwUv0,neoSwUv1;vec3 neoSwLinear(vec3 c){return ${linear};}\n${shader.fragmentShader}`;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec4 neoT0=texture2D(neoSw0,neoSwUv0);vec4 neoX=texture2D(neoSw1,neoSwUv0*15.0+neoTime*.05);float neoXa=texture2D(neoSw1,neoSwUv0*4.0-neoTime*.01).a;float neoNb=texture2D(neoSw2,neoSwUv0*.7+neoTime*.001).b;float neoNg=texture2D(neoSw2,neoSwUv0*.3+neoTime*.009+neoNb*.02).g;float neoXb=texture2D(neoSw1,vec2(neoSwUv0.x*1.2,neoSwUv0.y*3.0)+neoNb*.01).b;vec4 neoM=texture2D(neoSw3,neoSwUv0);diffuseColor=vec4(0.0,0.0,0.0,neoT0.a*opacity);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',q===2?`totalEmissiveRadiance=neoSwLinear(neoT0.rgb)*1.5;`:`vec2 neoD=(neoSwUv1-.5);float neoR=sqrt(dot(neoD*neoD*100.0,vec2(1.0)));float neoSpread=clamp(cos(neoR-neoTime*2.0)*neoXb-.6,0.0,1.0)*${ki.toFixed(8)};vec3 neoBase=neoSwLinear(neoT0.rgb);vec3 neoNoise=neoNg*${gl(noise)}*${ni.toFixed(8)};vec3 neoStars=neoXa*20.0*${gl(stars)}*neoM.a;vec3 neoMasked=mix(neoBase,neoBase+neoNoise,neoM.b);vec3 neoJb=(neoX.r*${ji.toFixed(8)}*texture2D(neoSw2,neoSwUv0+neoTime*.08).r)*neoSwLinear(${gl(jb)})*neoM.r;totalEmissiveRadiance=neoSpread*${gl(spread)}*${ki.toFixed(8)}+neoJb+neoMasked+neoStars;`);};
 m.addEventListener('dispose',releaseSamplers);
 warnings.push('special_wings explicit web preview: source FrameTime, mip choice, active quality and common lighting are unproven.');return uniforms;
}
