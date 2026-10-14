// standard_char_tangzhi.hlsl; original character TBN and camera-space matcaps.
const number=(v,d)=>{if(v===undefined)return d;if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))||!Number.isFinite(Number(v)))throw Error('无效数值');return Number(v);};
const vector=(v,d)=>{if(v===undefined)return d;const a=typeof v==='string'?JSON.parse(v):v;if(!Array.isArray(a)||a.length!==d.length||!a.every(Number.isFinite))throw Error('无效向量');return a;};
const f=v=>Number(v).toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(f).join(',')})`;

export async function configureTangzhi(m,p,macros,load,warnings,overrides={}){
  try{
    const n=(k,d)=>number(p[k],d),v=(k,d)=>vector(p[k],d);
    const quality=number(macros.RENDER_QUALITY,0),hasNormal=number(macros.NORMAL_MAP_ENABLE,1),light=number(macros.LIGHT_ENABLE,1),low=quality===2;
    const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','CHAR_CHANGE_COLOR','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER']);
    if(![0,1,2].includes(quality)||[hasNormal,light].some(x=>x!==0&&x!==1)||Object.entries(macros).some(([k,x])=>!known.has(k)&&number(x,0)!==0))throw Error('未知活动宏');
    if(!low&&hasNormal&&(!overrides.sourceTangents||!light))throw Error('缺少有效原切线或光照关闭的切线初始化证据');
    for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(v(k,[0,0,0]).some(x=>x!==0))throw Error('活动软体未接入');
    const base=v('BaseColor',[1,1,1,1]),intensity=v('Intensity',[1,1,1,0]),rim=v('RimColor',[0,0,0,0]),reflect=v('reflectColor',[1,1,1,1]);
    const defaults={TintValue:1,FresnelScale:0,Matcao_reflectMult:0,Matcao_specularMult:0,UseAddNormal:0,AddNormalTile_X:1,AddNormalTile_Y:1,AddNormalStrength:0,HUEColorMult:0,HUEColorPow:1,BaseColorPow:1,BaseColorMult:0,FresnelMult:0};
    const a=Object.fromEntries(Object.entries(defaults).map(([k,d])=>[k,n(k,d)])),s=k=>f(a[k]);
    if(a.HUEColorPow<=0||a.BaseColorPow<=0||a.TintValue<0)throw Error('pow输入边界未定义');
    const keys=[0,1,3,4,5,6],maps=await Promise.all(keys.map(i=>load('Tex'+i,false)));
    if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('缺少原Tex0/1/3/4/5/6');
    const u={neoEmissionScale:{value:1}};maps.forEach((t,i)=>{u['neoTzTex'+keys[i]]={value:t};});
    m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    if(!low&&hasNormal)m.defines={...m.defines,USE_TANGENT:''};
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,u);
      const vary='varying vec2 neoTzUv;varying vec3 neoTzN,neoTzT,neoTzB;\n';
      shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoTzUv=uv;')
        .replace('#include <normal_vertex>',`#include <normal_vertex>
          vec3 neoTzNormal=transformedNormal;
          #ifdef FLIP_SIDED
          neoTzNormal=-neoTzNormal;
          #endif
          neoTzN=normalize(neoTzNormal)*vec3(1.0,1.0,-1.0);neoTzT=vec3(0.0);neoTzB=vec3(0.0);
          ${!low&&hasNormal?'neoTzT=normalize(transformedTangent)*vec3(1.0,1.0,-1.0);neoTzB=cross(neoTzN,neoTzT)*tangent.w;':''}
        `);
      shader.fragmentShader=vary+`uniform sampler2D neoTzTex0,neoTzTex1,neoTzTex3,neoTzTex4,neoTzTex5,neoTzTex6;
        uniform float neoEmissionScale;
        vec3 neoTzLinear(vec3 x){return ${low?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        vec4 neoTzD=texture2D(neoTzTex0,neoTzUv),neoTzMix=texture2D(neoTzTex6,neoTzUv);
        neoTzD.rgb=neoTzLinear(neoTzD.rgb)*${s('TintValue')};
        vec3 neoTzRawN=neoTzN;
        ${!low&&hasNormal?`vec3 neoTzSample=texture2D(neoTzTex1,neoTzUv).xyz*2.0-1.0;
          neoTzSample.xy*=${f(intensity[0])};neoTzSample=normalize(neoTzSample);
          vec3 neoTzDetail=texture2D(neoTzTex4,neoTzUv*vec2(${s('AddNormalTile_X')},${s('AddNormalTile_Y')})).xyz*2.0-1.0;
          neoTzDetail.xy*=${s('AddNormalStrength')};neoTzDetail=normalize(neoTzDetail);
          vec3 neoTzA=vec3(neoTzSample.xy,neoTzSample.z+1.0),neoTzB2=vec3(-neoTzDetail.xy,neoTzDetail.z);
          vec3 neoTzBlend=normalize(neoTzA*dot(neoTzA,neoTzB2)-neoTzB2*(neoTzSample.z+1.0));
          mat3 neoTzBasis=mat3(neoTzT,neoTzB,neoTzN);
          neoTzRawN=mix(neoTzBasis*neoTzSample,neoTzBasis*neoTzBlend,clamp(1.0-neoTzMix.g,0.0,1.0)*${s('UseAddNormal')});`:''}
        vec3 neoTzView=normalize(vViewPosition*vec3(1.0,1.0,-1.0));
        float neoTzNV=dot(neoTzView,neoTzRawN),neoTzFresnelAlpha=0.0;
        vec4 neoTzCap=vec4(0.0),neoTzCap2=vec4(0.0);
        ${!low?`vec3 neoTzCameraT=normalize(cross(neoTzView,vec3(0.0,1.0,0.0))),neoTzCameraB=normalize(cross(neoTzView,neoTzCameraT));
          vec2 neoTzCapUv=vec2(dot(neoTzRawN,neoTzCameraT),dot(neoTzRawN,neoTzCameraB))*.5+.5;
          neoTzCap=texture2D(neoTzTex3,neoTzCapUv);neoTzCap2=texture2D(neoTzTex5,neoTzCapUv);neoTzCap2.rgb=neoTzLinear(neoTzCap2.rgb);
          float neoTzNormalAlpha=smoothstep(.5,1.0,neoTzNV*neoTzNV);
          neoTzFresnelAlpha=smoothstep(.2,.9,pow(1.0-clamp(neoTzNV,0.0,1.0),1.5));
          diffuseColor.a=clamp(.05+neoTzCap.b*.3+neoTzNormalAlpha*.35+neoTzFresnelAlpha*5.0+neoTzD.a,0.0,1.0)*mix(1.0,.6,neoTzMix.g)*opacity;
        `:'diffuseColor.a=clamp(neoTzD.a+.4,0.0,1.0)*opacity;'}
        diffuseColor.rgb=mix(neoTzD.rgb*neoTzLinear(${rgb(base)}),neoTzD.rgb,neoTzD.a);
      `).replace('#include <normal_fragment_maps>','normal=normalize(neoTzRawN*vec3(1.0,1.0,-1.0));')
        .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(mix(mix(${f(intensity[1])},.1,neoTzD.a),1.0,neoTzMix.g),0.0,1.0);`)
        .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(mix(mix(${f(intensity[2])},.1,neoTzD.a),.1,neoTzMix.g),0.0,1.0);`)
        .replace('#include <aomap_fragment>','')
        .replace('#include <emissivemap_fragment>',`
          float neoTzPow=1.0-neoTzNV,neoTzPow2=neoTzPow*neoTzPow;
          float neoTzFresnel=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*neoTzPow2*neoTzPow2*neoTzPow,0.0,1.0);
          totalEmissiveRadiance=neoTzFresnel*${rgb(rim)}*${f(intensity[3])}+pow(neoTzD.rgb,vec3(${s('BaseColorPow')}))*${s('BaseColorMult')};
          ${!low?`totalEmissiveRadiance+=neoTzCap.r*neoTzCap.r*mix(${s('Matcao_reflectMult')},0.0,neoTzMix.r)*${rgb(reflect)}
            +vec3(neoTzCap.g*mix(${s('Matcao_specularMult')},2.0,neoTzMix.r))
            +pow(neoTzCap2.rgb,vec3(${s('HUEColorPow')}))*${s('HUEColorMult')}
            +neoTzFresnelAlpha*neoTzD.rgb*${s('FresnelMult')};`:''}
          totalEmissiveRadiance*=neoEmissionScale;
        `);
    };
    warnings.push('tangzhi原双层法线/Matcap/透明/发光已接入；原场景光照及BRDF仍待标定');return u;
  }catch(e){warnings.push('tangzhi保持未适配：'+e.message);return null;}
}
