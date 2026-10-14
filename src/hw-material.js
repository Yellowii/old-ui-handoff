const number=(v,d=0)=>v===undefined?d:Number(v);
const flag=(v,d=0)=>typeof v==='string'&&/^(true|false)$/i.test(v)?Number(v.toLowerCase()==='true'):number(v,d);
const vector=(v,d)=>{const a=v===undefined?d:Array.isArray(v)?v:JSON.parse(String(v).trim().startsWith('[')?v:'['+v+']');if(a.length!==d.length||!a.every(Number.isFinite))throw Error('Invalid source vector');return a;};
const literal=v=>{if(!Number.isFinite(v))throw Error('Invalid source scalar');return v.toFixed(8);};
const noise=`float hwRandom(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453123);}
float hwNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float a=hwRandom(i),b=hwRandom(i+vec2(1,0)),c=hwRandom(i+vec2(0,1)),d=hwRandom(i+vec2(1));return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}
`;

// standard_char_hw.hlsl: original UV1 noise, post-skin local offset and opacity.
export async function configureHw(m,p,macros,load,warnings,o={}){
 try{
  const q=flag(macros.RENDER_QUALITY),low=q===2,tbn=flag(macros.NORMAL_MAP_ENABLE,1)!==0;
  const f=(k,d=0)=>literal(number(p[k],d)),v=(k,d)=>vector(p[k],d),rgb=(k,d)=>'vec3('+v(k,d).slice(0,3).map(literal).join(',')+')';
  if(![0,1,2].includes(q)||!o.sourceSecondUv)throw Error('Missing original UV1 or quality');
  if(tbn&&(!o.sourceTangents||flag(macros.LIGHT_ENABLE,1)===0))throw Error('Missing active original TBN');
  if(flag(macros.ENABLE_SOFT_BODY2)&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('Active soft body is unresolved');
  const maps=[];for(let i=0;i<3;i++){maps[i]=await load('Tex'+i,false);if(!maps[i]||maps[i].isCubeTexture)throw Error('Missing original Tex'+i);}
  const u={neoTime:{value:0},neoEmissionScale:{value:1},hwTex0:{value:maps[0]},hwTex1:{value:maps[1]},hwTex2:{value:maps[2]}};
  const linear=x=>`pow(max(${x},vec3(0)),vec3(${low?'2.0':'2.2'}))`;
  m.map=maps[1];m.normalMap=null;m.vertexColors=false;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.defines={...m.defines,USE_UV1:'',...(tbn?{USE_TANGENT:''}:{})};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   const vary='varying vec2 hwUv,hwUv1;varying vec3 hwN,hwT,hwB;varying float hwDisplace;\n';
   s.vertexShader=vary+'uniform float neoTime;\n'+noise+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nhwUv=uv;hwUv1=uv1;')
    .replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 hwNormal=transformedNormal;
     #ifdef FLIP_SIDED
     hwNormal=-hwNormal;
     #endif
     hwN=inverseTransformDirection(hwNormal,viewMatrix)*vec3(-1,1,1);hwT=vec3(1,0,0);hwB=vec3(0,1,0);
     ${tbn?'hwT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1,1,1);hwB=cross(hwN,hwT)*tangent.w;':''}`)
    .replace('#include <project_vertex>',`hwDisplace=0.0;
     ${low?'':`hwDisplace=(clamp(hwNoise(uv1*10.0+neoTime*10.0*vec2(.3,1)),0.0,1.0)-.2)*1.2*uv1.x*clamp(1.0-uv1.y-${f('OffsetMaskValue',.6)},0.0,1.0);
     transformed+=hwDisplace*vec3(-1,1,1);`}
     #include <project_vertex>`);
   s.fragmentShader=vary+'uniform sampler2D hwTex0,hwTex1,hwTex2;uniform float neoTime,neoEmissionScale;\n'+noise+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    float hwG=texture2D(hwTex0,hwUv1*3.0+neoTime*.1).g*.1;
    float hwR=texture2D(hwTex0,hwUv1+hwG+neoTime*.1).r;
    float hwAlphaMask=clamp(pow(texture2D(hwTex0,hwUv+neoTime*vec2(${f('FlowAlphaSpeed')},0)).b,1.2),0.0,1.0);
    float hwNoiseAB=clamp(hwNoise(hwUv1*15.0+neoTime*8.0)*hwNoise(hwUv1*14.0*vec2(2,1)+neoTime*4.0),0.0,1.0);
    float hwOpacity=mix(step(.5,hwNoiseAB)*hwNoiseAB*${f('NoiseStrength',1)},1.0,hwAlphaMask);
    vec2 hwFlowUv=mix(hwUv,hwUv+hwNoiseAB*.01,hwAlphaMask);
    vec3 hwBase=${linear('texture2D(hwTex1,hwFlowUv).rgb')};
    vec3 hwAlbedo=${flag(macros.CHAR_CHANGE_COLOR,1)?linear('vec3(dot(vec3(hwR,hwG,hwAlphaMask),vec3(.2125,.7154,.0721)))*'+rgb('BaseColor',[1,1,1,1]))+'*'+f('TintValue',1):'hwBase'};
    vec3 hwSurfaceN=hwN;
    ${low?'':`vec3 hwSampleN=normalize(texture2D(hwTex2,hwUv).xyz*2.0-1.0);hwSurfaceN=${tbn?'mat3(hwT,hwB,hwN)*hwSampleN':'hwSampleN'};`}
    diffuseColor=vec4(hwAlbedo,hwOpacity*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(hwSurfaceN*vec3(-1,1,1)));')
    // Source's MakeMaterialRoughness expression is discarded after assignment.
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':'1.0'};`)
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.0;')
    .replace('#include <aomap_fragment>','')
    .replace('#include <emissivemap_fragment>',`
     vec3 hwView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1,1,1);
     float hwFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(hwSurfaceN,hwView),5.0),0.0,1.0);
     vec3 hwEmission=mix(hwNoiseAB*vec3(4.595,0,1)*2.0,hwBase*.3,hwAlphaMask)*${f('EmissiveValue',1)};
     hwEmission+=hwFresnel*${literal(v('Intensity',[1,1,1,0])[3])}*${rgb('RimColor',[0,0,0,0])}*hwBase;
     totalEmissiveRadiance=hwEmission*neoEmissionScale;`);
  };
  warnings.push('HW原UV1位移、噪声透明与质量分支已接入；原噪声浮点精度和场景光照未完全等价');return u;
 }catch(e){warnings.push('HW未适配：'+e.message);return null;}
}
