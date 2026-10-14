import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourcePerlinGlsl} from './source-perlin.js';

// object_water_zhucheng.hlsl. Environment is explicitly scoped to the authored
// BAG preview; this does not claim native dynamic ReflectionProbeA selection.
export async function configureBathWater(m,p,macros,load,o={},warnings=[]){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(light)||Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unverified water permutation/scale9');
  if(normal&&!o.sourceTangents)throw Error('Original water tangent basis required');
  if(scalar(p.LerpEnable,0)>0)throw Error('Submesh bounds gradient not integrated');
  const env=o.previewEnvironment;
  if(env?.profile!=='authored-bag-sky-reflection'||!env.reflectionProbe?.url)throw Error('Authored preview reflection input required');
  const I=vector(p.Intensity,[1,1,0,0]),waveSpeed=vector(p.WaveSpeed,[0,0]);
  const val=(k,d)=>f(scalar(p[k],d)),col=k=>rgb(vector(p[k],[1,1,1,1]));
  // Validate every active scalar before asynchronous loading or shader compilation.
  const v=Object.fromEntries(Object.entries({WorldKey:1,RepeatScale:1,NormalScale1:6,NormalScale2:4,SpeedX:1,SpeedY:0,WaveScale:1,WaveDistortStrength:.1,WateColorMask:0,BaseColorKey:0,Lightness:1,NormalStep:.2,OpacityDist:1,OpacityMax:.7,HighlightStep:.2,RefIntensity:0,WaveLightness:1,VtxHeight:0,VtxSpeed:0}).map(([k,d])=>[k,val(k,d)]));
  const colors=Object.fromEntries(['MaskColor0','MaskColor1','WaterColor','WaveColor'].map(k=>[k,col(k)]));
  const keys=q<2?['Tex0','Tex1','Tex2']:['Tex0','Tex2'];
  const maps=await Promise.all(keys.map(k=>load(k,false))),cube=await load('ReflectionProbeA',false,env.reflectionProbe.url);
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture)||!cube?.isCubeTexture)throw Error('Missing original water texture/cube');
  const u={neoTime:{value:0},neoEmissionScale:{value:1},bwProbe:{value:cube}};keys.forEach((k,i)=>u['bw'+k]={value:maps[i]});setup(m,normal===1);
  m.userData.previewEnvironment=env;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.vertexShader=`uniform float neoTime;varying vec3 bwWorld;varying float bwOffset;${q<2?sourcePerlinGlsl:''}\n`+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nbwOffset=${q<2?`abs(neoPerlinNoise(position.xz*2.+vec2(neoTime*${v.VtxSpeed}))*${v.VtxHeight})`:'0.'};transformed.y+=bwOffset;`)
    .replace('#include <project_vertex>',`#include <project_vertex>\nbwWorld=(modelMatrix*vec4(transformed,1.)).xyz*vec3(-1.,1.,1.);`);
   s.fragmentShader=`uniform float neoTime,neoEmissionScale;varying vec3 bwWorld;varying float bwOffset;uniform samplerCube bwProbe;${keys.map(k=>'uniform sampler2D bw'+k+';').join('')}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 bwUv=mix(t107Uv,bwWorld.xz,${v.WorldKey})*${v.RepeatScale};
    vec2 bwUv1=bwUv*${v.NormalScale1}*.001+vec2(${v.SpeedX},${v.SpeedY})*neoTime*.01;
    vec2 bwUv2=bwUv*${v.NormalScale2}*.001;
    vec3 bwN1=texture2D(bwTex0,bwUv1).xyz*2.-1.,bwN2=texture2D(bwTex0,bwUv2).xyz*2.-1.;
    vec3 bwRaw=normalize(vec3(bwN1.xy+bwN2.xy,bwN1.z*bwN2.z));bwRaw.xy*=${f(I[0])};
    mat3 bwTbn=${normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 bwNormalW=bwTbn*normalize(bwRaw);
    vec3 bwV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 bwViewN=mat3(viewMatrix)*(bwNormalW*vec3(-1.,1.,1.)),bwViewV=normalize(vViewPosition);
    vec3 bwViewT=normalize(cross(bwViewV,vec3(0.,1.,0.))),bwViewB=normalize(cross(bwViewV,bwViewT));
    vec2 bwCapUv=vec2(dot(bwViewN,bwViewT),dot(bwViewN,bwViewB))*.5+.5;
    float bwRef=texture2D(bwTex2,bwCapUv).b;
    vec3 bwReflect=reflect(-bwV,bwTbn*normalize(vec3(bwRaw.xy*.1,bwRaw.z)));
    vec3 bwCube=textureLod(bwProbe,bwReflect,0.).rgb;
    vec4 bwWave=vec4(0.);float bwMask=0.;
    ${q<2?`bwWave=texture2D(bwTex1,bwUv*${v.WaveScale}+bwN1.xy*${v.WaveDistortStrength}+neoTime*vec2(${waveSpeed.map(f).join(',')}));bwWave.rgb*=pow(max(${colors.WaveColor},vec3(0.)),vec3(2.2));bwMask=mix(.5,bwWave.a,${v.WateColorMask});`:''}
    vec3 bwBase=mix(mix(mix(${colors.MaskColor0},${colors.MaskColor1},bwMask),${colors.WaterColor},${v.BaseColorKey}),bwCube,.2);
    vec3 bwAlbedo=${q<2?'pow(max(bwBase,vec3(0.)),vec3(2.2))':'bwBase*bwBase'}*${v.Lightness};
    float bwOpacity=${q===2?'1.':`max(smoothstep(.5,.7,1.-distance(t107Uv,vec2(.5))),${v.OpacityDist})*${v.OpacityMax}`};
    vec3 bwN=${q<2&&normal&&light?`abs(t107N.y)>${v.NormalStep}?bwNormalW:t107N`:'t107N'};
    float bwNoV=clamp(1.-dot(bwN,bwV),0.,1.),bwEdge=max(max(t107Uv.x,1.-t107Uv.x),max(t107Uv.y,1.-t107Uv.y));
    float bwFresnel=bwNoV*bwNoV*smoothstep(.985,1.,bwEdge);
    float bwHighlight=abs(t107N.y)>${v.HighlightStep}?step(.973,max(0.,dot(bwRaw,normalize(vec3(1.,1.,6.))))):0.;
    vec3 bwEmission=vec3(bwHighlight+bwFresnel*${f(I[3])}+bwRef*${v.RefIntensity})+bwWave.rgb*${v.WaveLightness};
    diffuseColor=vec4(bwAlbedo,bwOpacity*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(bwN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${f(I[1])}${q<2?'*texture2D(bwTex2,bwUv*.02+vec2(neoTime*.05,0.)).r':''};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(I[2])};`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=bwEmission*neoEmissionScale;').replace('#include <aomap_fragment>','');
  };
  return u;
 }catch(e){warnings.push('Water remains unsupported: '+e.message);return null;}
}
