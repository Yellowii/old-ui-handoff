import {FrontSide} from 'three';

// fried_chicken.hlsl / fried_chicken2.hlsl. Source channels, with Three lighting.
export async function configureFriedChicken(m,p,macros,load,warnings,o={}){
 const outside=o.sourcePass===1,quality=Number(macros.RENDER_QUALITY??0),low=quality===2;
 const tbn=!low&&Number(macros.NORMAL_MAP_ENABLE??1)!==0;
 const n=k=>Number(p[k]),v=(k,size=4)=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)&&a.length===size&&a.every(Number.isFinite)?a:null;}catch{return null;}};
 const vectors=['Intensity','BaseColor','RimColor','EmissiveColor','MaskColor0','MaskColor1','MaskColor2','MaskColor3'];
 const scalars=['FaceUVOffset','CharOffset','TintValue','EmissiveValue','FresnelScale',...(outside?['OutsideTiling','OutsideColorAdd','VertexOffsetStr','VertexNoiseTiling']:['FacialFuncEnable'])];
 const gaps=[];
 if(![0,1,2].includes(quality)||!vectors.every(k=>v(k))||!scalars.every(k=>Number.isFinite(n(k))))gaps.push('源参数无效');
 if(tbn&&!o.sourceTangents)gaps.push('缺少已验证源切线');
 if(outside&&!low&&n('VertexOffsetStr')!==0&&!o.sourceVertexColors)gaps.push('Outside 位移缺少源顶点色');
 if(Number(macros.ENABLE_SOFT_BODY2??1)!==0)for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ']){const a=v(k,3);if(!a||a.some(x=>x!==0))gaps.push('活动软体未接入');}
 if(['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING'].some(k=>Number(macros[k]??0)!==0))gaps.push('未验证顶点分支');
 if(gaps.length){warnings.push(...gaps.map(x=>'fried_chicken：'+x));return null;}
 const required=outside&&low?[]:['Tex0',...(!low?['Tex1','Tex2','Tex4',...(outside?['Tex3']:[])]:[])];
 const maps={};for(const k of required)maps[k]=await load(k,false);
 if(required.some(k=>!maps[k]?.isTexture||maps[k].isCubeTexture)){warnings.push('fried_chicken 缺少活动二维贴图：'+required.filter(k=>!maps[k]?.isTexture||maps[k].isCubeTexture).join(','));return null;}
 const f=x=>Number(x).toFixed(8),s=k=>f(n(k)),rgb=k=>'vec3('+v(k).slice(0,3).map(f).join(',')+')',i=v('Intensity');
 const u={neoFaceOffset:{value:n('FaceUVOffset')},neoEmissionScale:{value:1}};for(const k of required)u['fc'+k]={value:maps[k]};
 m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
 // SURF CullMode="Back" culls back faces; all other states inherit the MTG.
 if(outside)m.side=FrontSide;
 const displace=outside&&!low&&n('VertexOffsetStr')!==0;
 m.defines={...m.defines,...(tbn?{USE_TANGENT:''}:{}),...(displace?{USE_COLOR:''}:{})};
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,u);
  if(outside&&low){shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\ndiscard;');return;}
  const vary='varying vec2 fcUv;varying vec3 fcN,fcT,fcB,fcWorld;\n';
  shader.vertexShader=vary+(displace?'uniform sampler2D fcTex3;\n':'')+shader.vertexShader;
  shader.vertexShader=shader.vertexShader
   .replace('#include <uv_vertex>','#include <uv_vertex>\nfcUv=uv;')
   .replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 fcSourceN=transformedNormal;
    #ifdef FLIP_SIDED
    fcSourceN=-fcSourceN;
    #endif
    fcN=normalize(inverseTransformDirection(fcSourceN,viewMatrix))*vec3(-1,1,1);
    fcT=vec3(1,0,0);fcB=vec3(0,1,0);
    ${tbn?'fcT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1,1,1);fcB=cross(fcN,fcT)*tangent.w;':''}`)
   .replace('#include <displacementmap_vertex>',`#include <displacementmap_vertex>
    ${displace?`transformed+=objectNormal*(textureLod(fcTex3,uv*${s('VertexNoiseTiling')},0.0).b-.35)*.05*${s('VertexOffsetStr')}*color.r;`:''}`)
   .replace('#include <project_vertex>','#include <project_vertex>\nfcWorld=(modelMatrix*vec4(transformed,1)).xyz*vec3(-1,1,1);');
  shader.fragmentShader=vary+`uniform sampler2D fcTex0,fcTex1,fcTex2,fcTex3,fcTex4;uniform float neoFaceOffset,neoEmissionScale;
    vec3 fcLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0)),vec3(2.2))'};}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <map_fragment>',`
    vec2 fcFace=fcUv;fcFace.x+=fcFace.y<.25?neoFaceOffset*${s('CharOffset')}*${outside?'1.0':s('FacialFuncEnable')}:0.0;
    vec4 fc0=texture2D(fcTex0,fcFace);fc0.rgb=fcLinear(fc0.rgb);
    vec4 fc1=vec4(.5,.5,1,1),fc2=vec4(1,1,0,0),fc3=vec4(0),fc4=vec4(0);
    vec3 fcNormal=fcN,fcView=normalize(cameraPosition*vec3(-1,1,1)-fcWorld);
    ${low?'':`
     fc1=texture2D(fcTex1,fcFace);fc2=texture2D(fcTex2,fcFace);
     vec3 fcRawN=fc1.xyz*2.0-1.0;fcRawN.xy*=${f(i[0])};
     fcNormal=${tbn?'mat3(fcT,fcB,fcN)*':''}normalize(fcRawN);
     vec3 fcNV=(mat3(viewMatrix)*(fcNormal*vec3(-1,1,1)))*vec3(1,1,-1);
     vec3 fcVV=(mat3(viewMatrix)*(fcView*vec3(-1,1,1)))*vec3(1,1,-1);
     vec3 fcTV=normalize(cross(fcVV,vec3(0,1,0))),fcBV=normalize(cross(fcVV,fcTV));
     fc4=texture2D(fcTex4,vec2(dot(fcNV,fcTV),dot(fcNV,fcBV))*.5+.5);
     ${outside?`float fcRegion=clamp(ceil(fcFace.y-.25)+ceil(1.0-fcFace.x-.75),0.0,1.0);
     vec2 fcMaskUv=mix(fract(fcFace*4.0)*${s('OutsideTiling')}/4.0,fcFace*${s('OutsideTiling')},fcRegion);
     fc3=texture2D(fcTex3,fcMaskUv);`:''}`}
    vec3 fcAlbedo=${Number(macros.CHAR_CHANGE_COLOR)===1?'vec3(dot(fc0.rgb,vec3(.2125,.7154,.0721)))':'fc0.rgb'}*${rgb('BaseColor')}*${s('TintValue')};
    ${outside?`fcAlbedo*=fc3.g+${s('OutsideColorAdd')};`:''}
    diffuseColor=vec4(fcAlbedo,${outside?'fc3.r*fc0.a':'1.0'}*opacity);`)
   .replace('#include <color_fragment>','')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(fc2.g*${f(i[1])},0.0,1.0)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(fc2.b*${f(i[2])},0.0,1.0)`};`)
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(fcNormal*vec3(-1,1,1)));')
   .replace('#include <emissivemap_fragment>',`
    float fcF=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*pow(1.0-dot(fcNormal,fcView),5.0),0.0,1.0);
    vec3 fcEmission=fcF*${rgb('RimColor')}*${f(i[3])}+fc0.rgb*${rgb('EmissiveColor')}*${s('EmissiveValue')}*fc2.a;
    ${low?'':`fcEmission+=(fc4.r*${rgb('MaskColor0')}+fc4.g*${rgb('MaskColor1')}+fc4.b*${rgb('MaskColor2')}+fc4.a*${rgb('MaskColor3')})*fc1.a;`}
    totalEmissiveRadiance=fcEmission*neoEmissionScale;`)
   .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(.04);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);')
   .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=fc2.r;');
 };
 if(!low)warnings.push('fried_chicken 通道预览：原 Sun/SH/SSS 项未提供，未使用常量伪造；不代表完整原版光照');
 return u;
}
