// Current PPK unlit_wing + DefaultVF: world-space vectors in NeoX coordinates.
export async function configureWing(m,p,macros,load,warnings){
  const number=(key,fallback=0)=>Number.isFinite(Number(p[key]))?Number(p[key]):fallback;
  const f=(key,fallback=0)=>number(key,fallback).toFixed(8);
  const vector=(key,fallback)=>{try{const v=JSON.parse(p[key]);if(Array.isArray(v)&&v.length===4&&v.every(Number.isFinite))return v;}catch{}return fallback;};
  const rgb=key=>`vec3(${vector(key,[1,1,1,1]).slice(0,3).join(',')})`;
  const tiling=vector('SparklesTiling',[1,1,1,1]);
  const low=Number(macros.RENDER_QUALITY)>=2,hasTbn=Number(macros.NORMAL_MAP_ENABLE)!==0;
  if(hasTbn&&Number(macros.LIGHT_ENABLE)===0){warnings.push('翅膀关闭光照时源 TBN 初始化尚未验证');return null;}
  const n=await load('Tex0'),noise=await load('Tex1'),diffuse=await load('Tex2'),cube=await load('Tex3');
  const missing=[['Tex0',n],['Tex1',noise],['Tex2',diffuse]].filter(([,t])=>!t||t.isCubeTexture);
  if(number('RefCubeStr',1)!==0&&!cube?.isCubeTexture)missing.push(['Tex3 (Cube)',null]);
  for(const [key] of missing)warnings.push(`翅膀源贴图缺失或类型错误：${key}`);
  if(missing.length)return null;
  const sample=(_texture,uniform,uv,bias='')=>`texture2D(${uniform},${uv}${bias})`;
  // TBN depends on geometry, not on success loading the color-normal texture.
  m.map=n;m.normalMap=null;m.defines=hasTbn?{USE_TANGENT:''}:{};m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},neoWingN:{value:n},neoWingNoise:{value:noise},neoWingD:{value:diffuse},neoWingCube:{value:cube}};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoWingUv;varying vec3 neoWingNormal;varying vec3 neoWingTangent;varying vec3 neoWingBinormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoWingUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
      vec3 neoSourceNormal=transformedNormal;
      #ifdef FLIP_SIDED
      neoSourceNormal=-neoSourceNormal;
      #endif
      neoWingNormal=inverseTransformDirection(neoSourceNormal,viewMatrix)*vec3(-1.0,1.0,1.0);
      neoWingTangent=vec3(1.0,0.0,0.0);neoWingBinormal=vec3(0.0,1.0,0.0);
      #ifdef USE_TANGENT
      neoWingTangent=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.0,1.0,1.0);
      float neoMirror=tangent.w*-sign(determinant(mat3(modelMatrix)));
      neoWingBinormal=cross(neoWingNormal,neoWingTangent)*neoMirror;
      #endif
    `);
    shader.fragmentShader=`varying vec2 neoWingUv;varying vec3 neoWingNormal;varying vec3 neoWingTangent;varying vec3 neoWingBinormal;
      uniform sampler2D neoWingN;uniform sampler2D neoWingNoise;uniform sampler2D neoWingD;uniform samplerCube neoWingCube;
      uniform float neoTime;uniform float neoEmissionScale;
      vec3 neoWingLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 neoColorN=${sample(n,'neoWingN','neoWingUv')};
      vec3 neoNormal01=(neoWingLinear(neoColorN.rgb)-.5)*(1.0-neoColorN.a);
      vec3 neoView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0);
      float neoHighlight=pow(clamp(dot(neoNormal01,-neoView),0.0,1.0),4.0);
      vec4 neoMask=${sample(noise,'neoWingNoise','neoWingUv',',-1.0')};
      float neoGlow=neoMask.a*neoMask.a;
      mat3 neoTbn=${hasTbn?'mat3(neoWingTangent,neoWingBinormal,neoWingNormal)':'mat3(1.0)'};
      vec3 neoTangentView=normalize(transpose(neoTbn)*neoView);
      vec2 neoOffset=neoTangentView.xy*-.1;
      vec2 neoPan=neoTime*vec2(0.0,${f('SparklesSpeed')});
      float neoS1=${sample(noise,'neoWingNoise',`neoWingUv*${tiling[0].toFixed(8)}+neoOffset`)}.r;
      float neoS2=${sample(noise,'neoWingNoise',`neoWingUv*1.5*${tiling[1].toFixed(8)}+neoPan`)}.r;
      float neoS3=${sample(noise,'neoWingNoise',`neoWingUv*2.0*${tiling[2].toFixed(8)}+neoOffset`)}.r;
      float neoS4=${sample(noise,'neoWingNoise',`neoWingUv*3.0*${tiling[3].toFixed(8)}+neoPan`)}.r;
      float neoSparkles=neoS1*neoS2*neoMask.g*5.0+neoS3*neoS4*neoMask.b+neoMask.g*.3*${f('SparklesEmptyG',1)};
      vec4 neoDifMask=${sample(diffuse,'neoWingD','neoWingUv')};
      vec4 neoDif=${sample(diffuse,'neoWingD',`neoWingUv*${f('DiffuseUVTiling',.1)}-neoTangentView.xy*${f('DiffuseViewOffset',1)}`)};
      vec3 neoNormal02=${hasTbn&&!low?'neoTbn*normalize(neoColorN.rgb*2.0-1.0)':'neoWingNormal'};
      vec3 neoRefNormal=mix(mix(neoWingNormal,neoNormal02,${f('RefUseWorldNormal')}),neoNormal01,${f('RefUseNormalTex',1)});
      vec3 neoRefView=reflect(-neoView,neoRefNormal);
      vec3 neoRef=${cube?.isCubeTexture?'neoWingLinear(textureLod(neoWingCube,neoRefView,0.0).rgb)':'vec3(0.0)'};
      vec3 neoDiffuse=neoWingLinear(mix(neoDifMask.rgb,neoDif.rgb,neoDifMask.a));
      totalEmissiveRadiance=(neoDiffuse*(neoSparkles*2.0+neoGlow)+neoGlow*.3*${f('GlowStr',1)}+neoHighlight
        +neoRef*${f('RefCubeStr',1)}*mix(1.0,neoDif.a,${f('RefEnableMask')})
        +${rgb('AddEmisColor')}*neoDiffuse*neoColorN.a*${f('AddEmisStr')}
        +neoSparkles*${f('SparklesAddStr')}*${rgb('SparklesColor')})*neoEmissionScale;
      diffuseColor=vec4(0.0,0.0,0.0,clamp(neoHighlight+neoSparkles+neoGlow,0.0,1.0)*opacity);
    `).replace('#include <normal_fragment_maps>','').replace('#include <emissivemap_fragment>','').replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('翅膀使用源切线、Cube、闪点及透明公式；原后处理与配套特效尚未完整还原');
  return uniforms;
}
