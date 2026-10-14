// mult_emission_color_xced.hlsl; MakeSimpleFrenel from the verified source helper.
// Source material channels are mapped into Three lighting, not a native BRDF.
export async function configureXced(m,p,macros,load,warnings,o={}){
 const quality=Number(macros.RENDER_QUALITY??0),low=quality===2,normalMap=!low&&Number(macros.NORMAL_MAP_ENABLE??1)!==0;
 const n=k=>Number(p[k]),v=(k,size=4)=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)&&a.length===size&&a.every(Number.isFinite)?a:null;}catch{return null;}};
 const gaps=[],tint=Number(macros.CHAR_CHANGE_COLOR),intensity=v('Intensity');
 if(![0,1,2].includes(quality)||![0,1].includes(tint)||!intensity||!v('BaseColor')||!v('RimColor')||!['TintValue','FaceUVOffset','CharOffset','FresnelScale','FrenelExp','FrenelMult','EmissionExp','EmissionMult','StarEmiStrength','AlphaPow','ColorBandSpeedX','ColorBandSpeedY','CBAlphaPow'].every(k=>Number.isFinite(n(k))))gaps.push('源参数无效');
 if(['FrenelExp','EmissionExp','AlphaPow','CBAlphaPow'].some(k=>n(k)<=0))gaps.push('非正幂边界尚未核验');
 if(!o.sourceSecondUv||Number(macros.TEXCOORD1_ENABLE)!==1)gaps.push('缺少已验证第二 UV');
 if(normalMap&&!o.sourceTangents)gaps.push('活动法线分支缺少已验证源切线');
 if(Number(macros.LIGHT_ENABLE??1)!==1)gaps.push('无光照输出分支尚未核验');
 if(['INSTANCE_TYPE','USE_TEXCOORD1','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT'].some(k=>Number(macros[k]??0)!==0))gaps.push('未验证顶点分支');
 if(Number(macros.ENABLE_SOFT_BODY2??1)!==0)for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ']){const a=v(k,3);if(!a||a.some(x=>x!==0))gaps.push('活动软体尚未接入');}
 if(gaps.length){warnings.push(...gaps.map(s=>'星尘色带：'+s));return null;}
 const required=['Tex0','Tex3','Tex4',...(!low?['Tex2']:[]),...(normalMap?['Tex1']:[])],maps={};
 for(const key of required)maps[key]=await load(key,false);
 if(required.some(k=>!maps[k]?.isTexture||maps[k].isCubeTexture)){warnings.push('星尘色带缺少源二维贴图：'+required.filter(k=>!maps[k]?.isTexture||maps[k].isCubeTexture).join(', '));return null;}
 const f=x=>Number(x).toFixed(8),s=k=>f(n(k)),rgb=k=>'vec3('+v(k).slice(0,3).map(f).join(',')+')';
 const uniforms={neoTime:{value:0},neoFaceOffset:{value:n('FaceUVOffset')},neoEmissionScale:{value:1}};
 for(const key of required)uniforms['xc'+key]={value:maps[key]};
 m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
 m.defines={...m.defines,USE_UV1:'',...(normalMap?{USE_TANGENT:''}:{})};
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const vary='varying vec2 xcUv,xcUv1;varying vec3 xcN,xcT,xcB,xcWorld;\n';
  shader.vertexShader=vary+shader.vertexShader
   .replace('#include <uv_vertex>','#include <uv_vertex>\nxcUv=uv;xcUv1=uv1;')
   .replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 xcSourceN=transformedNormal;
    #ifdef FLIP_SIDED
    xcSourceN=-xcSourceN;
    #endif
    xcN=normalize(inverseTransformDirection(xcSourceN,viewMatrix))*vec3(-1,1,1);
    xcT=vec3(1,0,0);xcB=vec3(0,1,0);
    ${normalMap?'xcT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1,1,1);xcB=cross(xcN,xcT)*tangent.w;':''}`)
   .replace('#include <project_vertex>','#include <project_vertex>\nxcWorld=(modelMatrix*vec4(transformed,1)).xyz*vec3(-1,1,1);');
  shader.fragmentShader=vary+`uniform sampler2D xcTex0,xcTex1,xcTex2,xcTex3,xcTex4;uniform float neoTime,neoFaceOffset,neoEmissionScale;
   vec3 xcLinear(vec3 x){return ${low?'x*x':'pow(max(x,vec3(0)),vec3(2.2))'};}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <map_fragment>',`
    vec2 xcFaceUv=xcUv;xcFaceUv.x+=xcFaceUv.y<.25?neoFaceOffset*${s('CharOffset')}:0.0;
    vec4 xc0=texture2D(xcTex0,xcFaceUv),xc3=texture2D(xcTex3,xcUv1+vec2(${s('ColorBandSpeedX')},${s('ColorBandSpeedY')})*neoTime),xc4=texture2D(xcTex4,xcUv1);
    vec4 xcMix=${low?'vec4(1,.5,0,0)':'texture2D(xcTex2,xcFaceUv)'};
    vec3 xcView=normalize(cameraPosition*vec3(-1,1,1)-xcWorld),xcNormal=xcN;
    ${normalMap?`vec3 xcRawN=texture2D(xcTex1,xcFaceUv).rgb*2.0-1.0;xcRawN.xy*=${f(intensity[0])};xcNormal=mat3(xcT,xcB,xcN)*normalize(xcRawN);`:''}
    float xcFrenel=clamp(pow(1.0-abs(dot(xcN,xcView)),${s('FrenelExp')})*${s('FrenelMult')},0.0,1.0);
    vec3 xcAlbedo=${tint?`xcLinear(vec3(dot(xc0.rgb,vec3(.2125,.7154,.0721)))*${rgb('BaseColor')})`:`xcLinear(xc0.rgb+xc3.rgb*xc3.a*pow(xc4.r,${s('CBAlphaPow')})*(1.0-xc0.a))`}*${s('TintValue')};
    diffuseColor=vec4(xcAlbedo,clamp(pow(1.0-xc4.r,${s('AlphaPow')})+xc0.a,0.0,1.0)*${f(v('BaseColor')[3])}*opacity);`)
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(xcMix.g*${f(intensity[1])},0.0,1.0)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(xcMix.b*${f(intensity[2])},0.0,1.0)`};`)
   .replace('#include <normal_fragment_maps>','normal=mat3(viewMatrix)*(xcNormal*vec3(-1,1,1));')
   .replace('#include <emissivemap_fragment>',`
    float xcRim=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*pow(1.0-dot(xcNormal,xcView),5.0),0.0,1.0);
    totalEmissiveRadiance=(vec3(xcFrenel*pow(xc4.r,${s('EmissionExp')})*${s('EmissionMult')}*(1.0-xc0.a)*(1.0-xc3.a))+${s('StarEmiStrength')}*xc0.r*xc0.rgb+xcRim*${rgb('RimColor')}*${f(intensity[3])})*neoEmissionScale;`)
   .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(.04);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);')
   .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=xcMix.r;');
 };
 return uniforms;
}
