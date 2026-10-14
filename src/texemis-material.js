const number=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const vector=(v,f)=>{try{const a=JSON.parse(v);if(Array.isArray(a)&&a.length===4&&a.every(Number.isFinite))return a;}catch{}return f;};
const scalar=v=>Number(v).toFixed(8);
const rgb=v=>`vec3(${v.slice(0,3).map(scalar).join(',')})`;

export function texemisGaps(p,macros,overrides={}){
  const gaps=[],low=Number(macros.RENDER_QUALITY)===2;
  const dissolve=vector(p.DissolvePara,[0,.1,1,1]),dot=vector(p.DotPara,[1,0,0,1]),dyn=vector(p.DynPara,[0,0,0,1]);
  const half=overrides.sourceBounds?.half;
  // When the mesh has no published tangent stream, the runtime can rebuild
  // the normal basis from position/UV derivatives. Keep the source light
  // permutation gate, but do not reject a complete UV0/normal-map case.
  if((dissolve[0]!==0||number(p.DissolveEmisStr)!==0)&&(!Array.isArray(half)||!Number.isFinite(half[2])||half[2]===0))gaps.push('溶解需要已发布的原根 BoundHalfSize.z');
  if(!low&&number(p.DotPower)!==0&&dot[2]!==0&&Number(macros.NORMAL_MAP_ENABLE)!==0){
    // derivative TBN supplies the same local basis for the preview path
    if(Number(macros.LIGHT_ENABLE)===0)gaps.push('关闭光照时源切线初始化为零，视差基底需要原引擎数值验证');
  }
  // HLSL smoothstep at coincident edges must not acquire an invented GLSL result.
  if(!low&&dyn[2]!==0&&dyn[1]<=0&&vector(p.dynColor,[0,0,0,0]).slice(0,3).some(x=>x!==0))gaps.push('扫光零宽边界需原引擎数值验证');
  return gaps;
}

export async function configureTexemis(m,p,macros,load,warnings,overrides={}){
  const n=(k,f=0)=>number(p[k],f),f=(k,d=0)=>scalar(n(k,d));
  const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]);
  const emis=vector(p.TexEmisPara,[1,1,0,1]),dot=vector(p.DotPara,[1,0,0,1]),dyn=vector(p.DynPara,[0,0,0,1]);
  const dynColor=vector(p.dynColor,[0,0,0,0]),low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const dissolve=vector(p.DissolvePara,[0,.1,1,1]),dissolveActive=dissolve[0]!==0||n('DissolveEmisStr')!==0;
  const dissolveHalfZ=dissolveActive?overrides.sourceBounds.half[2]:0;
  const sparkle=!low&&n('DotPower')!==0,dynamic=!low&&dyn[2]!==0&&dynColor.slice(0,3).some(v=>v!==0);
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0&&Number(macros.LIGHT_ENABLE)!==0;
  const tangentParallax=sparkle&&dot[2]!==0&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const sourceBasis=useNormal||tangentParallax;
  const derivedTbn=sourceBasis&&overrides.sourceTangents!==true;
  const diffuse=await load('Tex0',false,overrides.baseColor),normal=useNormal||dynamic?await load('Tex1',false,overrides.normal):null;
  const mix=await load('Tex2'),spark=sparkle||dynamic?await load('Tex3'):null;
  const builtins={green:'vec4(0.0,1.0,0.0,1.0)',normal:'vec4(.5,.5,1.0,1.0)',black:'vec4(0.0,0.0,0.0,1.0)',white:'vec4(1.0)'};
  const required=[['Tex0',diffuse,overrides.baseColor],['Tex2',mix]];
  if(useNormal||dynamic)required.push(['Tex1',normal,overrides.normal]);
  if(sparkle||dynamic)required.push(['Tex3',spark]);
  const missing=required.filter(([key,t,url])=>!t&&(url||overrides.textureBindings?.[key]?.url||overrides.textureBindings?.[key]?.path||!builtins[p[key]]));
  for(const [key] of missing)warnings.push(`纹理发光贴图未绑定：${key} (${p[key]??'未声明'})`);
  if(missing.length)return null;
  const sample=(key,t,u,uv='neoTexemisUv')=>{
    if(t)return `texture2D(${u},${uv})`;
    return builtins[p[key]];
  };
  m.color.set(0xffffff);m.map=diffuse;
  m.normalMap=null;
  if(sourceBasis&&!derivedTbn)m.defines={...m.defines,USE_TANGENT:''};
  if(derivedTbn)m.extensions={...m.extensions,derivatives:true};
  m.normalScale.setScalar(intensity[0]);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoTexemisD:{value:diffuse},neoTexemisN:{value:normal},neoTexemisM:{value:mix},neoTexemisS:{value:spark},neoTime:{value:0},neoEmissionScale:{value:1}};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoTexemisUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoTexemisUv=uv;');
    if(dissolveActive)shader.vertexShader='varying vec3 neoTexemisDissolveLocal;\n'+shader.vertexShader.replace('#include <project_vertex>','neoTexemisDissolveLocal=transformed*vec3(-1.0,1.0,1.0);\n#include <project_vertex>');
    {
      const varyings='varying vec3 neoTexemisTangent;varying vec3 neoTexemisBinormal;varying vec3 neoTexemisVertexNormal;\n';
      shader.vertexShader=varyings+shader.vertexShader.replace('#include <normal_vertex>',`#include <normal_vertex>
        vec3 neoTexemisSourceNormal=transformedNormal;
        #ifdef FLIP_SIDED
        neoTexemisSourceNormal=-neoTexemisSourceNormal;
        #endif
        neoTexemisSourceNormal=inverseTransformDirection(neoTexemisSourceNormal,viewMatrix)*vec3(-1.0,1.0,1.0);
        neoTexemisVertexNormal=neoTexemisSourceNormal;
        neoTexemisTangent=${sourceBasis&&!derivedTbn?'inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.0,1.0,1.0)':'vec3(0.0)'};
        // DefaultVF: IS_CHARACTER=1 preserves source mirror; no world determinant factor.
        neoTexemisBinormal=${sourceBasis&&!derivedTbn?'cross(neoTexemisSourceNormal,neoTexemisTangent)*tangent.w':'vec3(0.0)'};
      `);
      shader.fragmentShader=varyings+shader.fragmentShader;
    }
    shader.fragmentShader=`varying vec2 neoTexemisUv;${dissolveActive?'varying vec3 neoTexemisDissolveLocal;\nfloat neoTexemisRandom(vec2 st){return fract(sin(dot(st,vec2(12.9898,78.233)))*43758.5453123);}\nfloat neoTexemisNoise(vec2 st){vec2 i=floor(st),f=fract(st),u=f*f*(3.0-2.0*f);float a=neoTexemisRandom(i),b=neoTexemisRandom(i+vec2(1.0,0.0)),c=neoTexemisRandom(i+vec2(0.0,1.0)),d=neoTexemisRandom(i+vec2(1.0));return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}\n':''}
      uniform sampler2D neoTexemisD,neoTexemisN,neoTexemisM,neoTexemisS;
      uniform float neoTime,neoEmissionScale;
      float neoTexemisFresnel(float scale,float ndv){float a=1.0-ndv;return clamp(scale+(1.0-scale)*a*a*a*a*a,0.0,1.0);}
      float neoTexemisSmooth(float a,float b,float x){if(a==b)return x>a?1.0:0.0;float t=clamp((x-a)/(b-a),0.0,1.0);return t*t*(3.0-2.0*t);}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 neoTexemisRaw=${sample('Tex0',diffuse,'neoTexemisD')};
      vec4 neoTexemisMix=${sample('Tex2',mix,'neoTexemisM')};
      ${derivedTbn?'vec3 neoTexemisTangentLocal=normalize(dFdx(vViewPosition)*dFdy(neoTexemisUv).y-dFdy(vViewPosition)*dFdx(neoTexemisUv).y),neoTexemisBinormalLocal=normalize(-dFdx(vViewPosition)*dFdy(neoTexemisUv).x+dFdy(vViewPosition)*dFdx(neoTexemisUv).x);if(dot(cross(neoTexemisTangentLocal,neoTexemisBinormalLocal),neoTexemisVertexNormal)<0.)neoTexemisBinormalLocal=-neoTexemisBinormalLocal;':'vec3 neoTexemisTangentLocal=neoTexemisTangent,neoTexemisBinormalLocal=neoTexemisBinormal;'}
      mat3 neoTexemisTbn=mat3(neoTexemisTangentLocal,neoTexemisBinormalLocal,neoTexemisVertexNormal);
      vec3 neoTexemisAlbedo=${change?'vec3(dot(neoTexemisRaw.rgb,vec3(.2125,.7154,.0721)))':'neoTexemisRaw.rgb'}*${rgb(base)};
      diffuseColor.rgb=${low?'neoTexemisAlbedo*neoTexemisAlbedo':'pow(max(neoTexemisAlbedo,vec3(0.0)),vec3(2.2))'}*${f('TintValue',1)};
      diffuseColor.a=neoTexemisRaw.a*${scalar(base[3])}*opacity;
      ${dissolveActive?`vec3 neoTexemisDissolveP=neoTexemisDissolveLocal*mix(1.0,-1.0,${f('DissolveReverse')});float neoTexemisOpTemp=.5*(neoTexemisDissolveP.z+${scalar(dissolveHalfZ)})/${scalar(dissolveHalfZ)};float neoTexemisOpMask=clamp(neoTexemisOpTemp+${scalar(dissolve[1])}*neoTexemisNoise(neoTexemisDissolveP.yz*vec2(5.0)*${scalar(dissolve[2])}+neoTime*vec2(0.0,3.0)*${scalar(dissolve[3])}),0.0,1.0);float neoTexemisDissolveMask=clamp((neoTexemisOpMask-${scalar(dissolve[0])})/.1,0.0,1.0);float neoTexemisDissolveEdge=clamp((neoTexemisOpMask-${scalar(dissolve[0])})/.01,0.0,1.0)-clamp((neoTexemisOpMask-${scalar(dissolve[0])}-.02)/.01,0.0,1.0);diffuseColor.a*=mix(1.0,neoTexemisDissolveMask,clamp(${scalar(dissolve[0])}*30.0,0.0,1.0));`:''}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(neoTexemisMix.g*${scalar(intensity[1])},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(neoTexemisMix.b*${scalar(intensity[2])},0.0,1.0)`};`);
    {
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        vec3 neoTexemisSurfaceNormal=neoTexemisVertexNormal;
        ${useNormal?`
        vec3 neoTexemisNormalSample=${sample('Tex1',normal,'neoTexemisN')}.xyz*2.0-1.0;
        neoTexemisNormalSample.xy*=${scalar(intensity[0])};
        neoTexemisSurfaceNormal=neoTexemisTbn*normalize(neoTexemisNormalSample);`:''}
        // Preserve raw source normal for Fresnel. Three's lighting consumes a unit view-space normal.
        normal=normalize(mat3(viewMatrix)*(neoTexemisSurfaceNormal*vec3(-1.0,1.0,1.0)));
      `);
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',low?'':`
      reflectedLight.indirectDiffuse*=neoTexemisMix.r;
      #if defined(USE_ENVMAP) && defined(STANDARD)
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),neoTexemisMix.r,material.roughness);
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      vec3 neoTexemisColor=pow(neoTexemisRaw.rgb,vec3(${scalar(emis[1])}));
      float neoTexemisNV=dot(neoTexemisSurfaceNormal,inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0));
      vec3 neoTexemisStar=vec3(0.0),neoTexemisDynamic=vec3(0.0);
      ${sparkle?`
      vec3 neoTexemisView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0);
      // Source multiplies interpolated TBN without renormalizing its rows or the result.
      vec2 neoTexemisOffset=${dot[2]===0?'vec2(0.0)':tangentParallax?`vec2(dot(neoTexemisTangentLocal,neoTexemisView),dot(neoTexemisBinormalLocal,neoTexemisView))*${scalar(.01*dot[2])}`:`neoTexemisView.xy*${scalar(.01*dot[2])}`};
      vec2 neoTexemisUvA=neoTexemisUv*${scalar(dot[0])}+vec2(.3,neoTime)*${scalar(dot[1])}+neoTexemisOffset;
      vec2 neoTexemisUvB=neoTexemisUv*${scalar(dot[0]*1.5)}+vec2(neoTime,.3)*${scalar(dot[1])}+neoTexemisOffset;
      float neoTexemisNoiseA=${sample('Tex3',spark,'neoTexemisS','neoTexemisUvA')}.r;
      float neoTexemisNoiseB=${sample('Tex3',spark,'neoTexemisS','neoTexemisUvB')}.r;
      neoTexemisStar=neoTexemisColor*pow(neoTexemisNoiseA*neoTexemisNoiseB,${scalar(dot[3])})*${sample('Tex3',spark,'neoTexemisS')}.a*${f('DotPower')};`:''}
      ${dynamic?`
      float neoTexemisPhase=fract(neoTime*${scalar(dyn[0])});
      float neoTexemisMask=${sample('Tex1',normal,'neoTexemisN')}.a;
      // Source chooses only the applicable rising/falling half of the pulse.
      float neoTexemisPulse=neoTexemisMask<=neoTexemisPhase?neoTexemisSmooth(clamp(neoTexemisPhase-${scalar(dyn[1]/2)},0.0,1.0),neoTexemisPhase,neoTexemisMask):neoTexemisSmooth(clamp(neoTexemisPhase+${scalar(dyn[1]/2)},0.0,1.0),neoTexemisPhase,neoTexemisMask);
      neoTexemisDynamic=pow(neoTexemisPulse,${scalar(dyn[3])})*${scalar(dyn[2])}*${rgb(dynColor)}*pow(${sample('Tex3',spark,'neoTexemisS')}.g,3.0);`:''}
      totalEmissiveRadiance=(neoTexemisFresnel(${f('FresnelScale')},neoTexemisNV)*${rgb(vector(p.RimColor,[0,0,0,0]))}*${scalar(intensity[3])}
        +neoTexemisMix.a*neoTexemisColor*${scalar(emis[0])}
        +neoTexemisFresnel(${scalar(emis[2])},neoTexemisNV)*neoTexemisColor*${scalar(emis[3])}
        +neoTexemisStar+neoTexemisDynamic${dissolveActive?`+neoTexemisDissolveEdge*${rgb(vector(p.DissolveEmisColor,[0,0,0,0]))}*${f('DissolveEmisStr')}`:''}
        +neoTexemisFresnel(${f('addFresnelScale')},neoTexemisNV)*${rgb(vector(p.addRimColor,[1,1,1,1]))}*${f('addRimIntensity')})*neoEmissionScale;
    `);
  };
  warnings.push('纹理发光法线与边缘光已接原基底，闪点视差保留原规则；原场景光照/BRDF 和软体尚未完整复刻');
  if(dynamic)warnings.push('扫光在周期起点且遮罩为零时，源 smoothstep 两端重合；该单点暂为预览边界值，尚未验证原引擎结果');
  return uniforms;
}
