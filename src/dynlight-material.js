// standard_jgjl_dynlight.hlsl. The original zero shadowAddMult path needs no SunDirection.
const number=(v,d)=>{if(v===undefined)return d;if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))||!Number.isFinite(Number(v)))throw Error('无效数值');return Number(v);};
const vector=(v,d)=>{if(v===undefined)return d;const a=typeof v==='string'?JSON.parse(v):v;if(!Array.isArray(a)||a.length!==d.length||!a.every(Number.isFinite))throw Error('无效向量');return a;};
const f=v=>Number(v).toFixed(8),gv=a=>`vec${a.length}(${a.map(f).join(',')})`;

export async function configureDynlight(m,p,macros,load,warnings,overrides={}){
  try{
    const n=(k,d=0)=>number(p[k],d),v=(k,d)=>vector(p[k],d);
    const quality=number(macros.RENDER_QUALITY,0),change=number(macros.CHAR_CHANGE_COLOR,1),uv2=number(macros.TEXCOORD1_ENABLE,0),normalMap=number(macros.NORMAL_MAP_ENABLE,1),light=number(macros.LIGHT_ENABLE,1);
    const known=new Set(['RENDER_QUALITY','CHAR_CHANGE_COLOR','TEXCOORD1_ENABLE','USE_TEXCOORD1','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER']);
    if(![0,1,2].includes(quality)||[change,uv2,normalMap,light].some(x=>x!==0&&x!==1)||Object.entries(macros).some(([k,x])=>!known.has(k)&&number(x,0)!==0))throw Error('未知活动宏');
    if(uv2&&(!overrides.sourceSecondUv||number(macros.USE_TEXCOORD1,1)!==1))throw Error('缺少原第二UV');
    if(normalMap&&(!overrides.sourceTangents||!light))throw Error('缺少源切线/光照关闭时切线初始化未闭合');
    if(!change&&n('shadowAddMult')!==0)throw Error('非零太阳附加项需要原SunDirection');
    for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(v(k,[0,0,0]).some(x=>x!==0))throw Error('活动软体未接入');
    const base=v('BaseColor',[1,1,1,1]),intensity=v('Intensity',[1,1,1,0]),rim=v('RimColor',[0,0,0,0]);
    const tiling=v('dynlightUVTiling',[1,1]),speed=v('dynlightSpeed',[0,0]),main=v('MainTexPara',[1,1,0,0]),main2=v('MainTexPara2',[1,1,0,0]);
    const tint=n('TintValue',1),strength=n('dynlightIntensity'),power=n('dynlightMPow',1),breathSpeed=n('dynLBreathSpeed',1),breathClamp=n('dynLBreathClmap',1),emission=n('EmissiveValue',1),effectRim=n('Effect_RimIntensity'),fresnel=n('FresnelScale'),charOffset=n('CharOffset',1);
    if(power<=0||breathClamp<0)throw Error('未验证pow/呼吸clamp边界');
    const maps=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
    if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('缺少原Tex0–Tex4');
    const u={neoTime:{value:0},neoEmissionScale:{value:1},neoFaceOffset:{value:n('FaceUVOffset')}};
    maps.forEach((t,i)=>{u['neoDynTex'+i]={value:t};});
    m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    m.defines={...m.defines,...(uv2?{USE_UV1:''}:{}),...(normalMap?{USE_TANGENT:''}:{})};
    m.onBeforeCompile=s=>{
      Object.assign(s.uniforms,u);
      const vary='varying vec2 neoDynUv,neoDynUv1;varying vec3 neoDynN,neoDynT,neoDynB;\n';
      s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nneoDynUv=uv;neoDynUv1=${uv2?'uv1':'uv'};`)
        .replace('#include <normal_vertex>',`#include <normal_vertex>
          vec3 neoDynNormal=transformedNormal;
          #ifdef FLIP_SIDED
          neoDynNormal=-neoDynNormal;
          #endif
          neoDynN=normalize(neoDynNormal)*vec3(1.0,1.0,-1.0);neoDynT=vec3(0.0);neoDynB=vec3(0.0);
          ${normalMap?`neoDynT=normalize(transformedTangent)*vec3(1.0,1.0,-1.0);
          float neoDynMirror=tangent.w*sign(dot(cross(modelMatrix[0].xyz,modelMatrix[1].xyz),modelMatrix[2].xyz));
          neoDynB=cross(neoDynN,neoDynT)*neoDynMirror;`:''}
        `);
      s.fragmentShader=vary+`uniform sampler2D neoDynTex0,neoDynTex1,neoDynTex2,neoDynTex3,neoDynTex4;
        uniform float neoTime,neoEmissionScale,neoFaceOffset;
        vec3 neoDynLinear(vec3 x){return ${quality===2?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
      `+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
        vec2 neoDynUv0=neoDynUv;neoDynUv0.x+=neoDynUv0.y<.25?neoFaceOffset*${f(charOffset)}:0.0;
        vec2 neoDynEffectUv=${uv2?'neoDynUv1':'neoDynUv0'};
        vec4 neoDynD=texture2D(neoDynTex0,neoDynUv0),neoDynM=texture2D(neoDynTex2,neoDynUv0);
        vec4 neoDynNoise=texture2D(neoDynTex3,neoDynEffectUv*${gv(tiling)}+neoTime*${gv(speed)});
        float neoDynMainNoise=texture2D(neoDynTex4,neoDynEffectUv*${gv(main.slice(0,2))}+neoTime*${gv(main.slice(2))}).a;
        vec3 neoDynColor=texture2D(neoDynTex4,neoDynEffectUv*${gv(main2.slice(0,2))}+neoTime*${gv(main2.slice(2))}+neoDynMainNoise*.3).rgb;
        float neoDynMask=texture2D(neoDynTex3,neoDynEffectUv).g;
        diffuseColor.rgb=neoDynLinear(${change?'vec3(dot(neoDynD.rgb,vec3(.2125,.7154,.0721)))':'neoDynD.rgb'}*${gv(base.slice(0,3))})*${f(tint)};
        diffuseColor.a=neoDynD.a*${f(base[3])}*opacity;
      `).replace('#include <normal_fragment_maps>',`
        vec3 neoDynSurfaceN=neoDynN;
        ${quality!==2&&normalMap?`vec3 neoDynSn=texture2D(neoDynTex1,neoDynUv0).xyz*2.0-1.0;neoDynSn.xy*=${f(intensity[0])};neoDynSurfaceN=mat3(neoDynT,neoDynB,neoDynN)*normalize(neoDynSn);`:''}
        normal=normalize(neoDynSurfaceN*vec3(1.0,1.0,-1.0));
      `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${quality===2?'.5':`clamp(neoDynM.g*${f(intensity[1])},0.0,1.0)`};`)
        .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${quality===2?'0.0':`clamp(neoDynM.b*${f(intensity[2])},0.0,1.0)`};`)
        .replace('#include <aomap_fragment>',quality===2?'':`
          reflectedLight.indirectDiffuse*=neoDynM.r;
          #if defined(USE_ENVMAP) && defined(STANDARD)
          reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),neoDynM.r,material.roughness);
          #endif
        `).replace('#include <emissivemap_fragment>',`
          float neoDynA=1.0-dot(neoDynSurfaceN,normalize(vViewPosition)*vec3(1.0,1.0,-1.0));
          float neoDynF=clamp(${f(fresnel)}+(1.0-${f(fresnel)})*neoDynA*neoDynA*neoDynA*neoDynA*neoDynA,0.0,1.0);
          float neoDynBreath=clamp(sin(neoTime*${f(breathSpeed)})+1.0,0.0,${f(breathClamp)});
          totalEmissiveRadiance=(neoDynF*${gv(rim.slice(0,3))}*${f(intensity[3]+effectRim)}+neoDynM.a*neoDynD.rgb*neoDynD.rgb*${f(emission)}+neoDynColor*neoDynColor*neoDynNoise.r*${f(strength)}*neoDynBreath*pow(neoDynMask,${f(power)}))*neoEmissionScale;
        `);
    };
    warnings.push('dynlight原UV流光/呼吸/源切线已接入；原场景光照及BRDF仍待标定');return u;
  }catch(e){warnings.push('dynlight保持未适配：'+e.message);return null;}
}
