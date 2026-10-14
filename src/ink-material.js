import {FrontSide,BackSide,NormalBlending,LessEqualDepth} from 'three';

// char_ink01.hlsl + current-PPK ink_outline.hlsl. Scene sun comes from the
// viewer's directional light; reproducing the source scene is a separate step.
export async function configureInk(m,p,macros,load,warnings,o={}){
 const outline=o.inkOutline===true,quality=Number(macros.RENDER_QUALITY??0),low=quality===2;
 const hasTbn=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0;
 const n=k=>Number(p[k]);
 const v=k=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)&&a.length===4&&a.every(Number.isFinite)?a:null;}catch{return null;}};
 const scalarKeys=['Line_Tiling_U','Line_Tiling_V','Line_Offset_U','Line_Offset_V','Line_Width','Dis_TX','Dis_TY','Dis_SX','Dis_SY','Dis_Strength','Metal_Strength','EmissiveAmount','FresnelScale','FaceUVOffset','CharOffset','TintValue'];
 const colors=['BaseColor','EmissiveColor','RimColor',...Array.from({length:8},(_,i)=>'Color0'+(i+1)),...Array.from({length:4},(_,i)=>'InkCol0'+(i+1))];
 const intensity=v('Intensity'),gaps=[];
 if(![0,1,2].includes(quality)||!scalarKeys.every(k=>Number.isFinite(n(k)))||!intensity||!colors.every(k=>v(k)))gaps.push('原始参数无效');
 if(hasTbn&&!o.sourceTangents)gaps.push('缺少已验证源切线');
 if(n('Line_Width')!==0&&!o.sourceVertexColors)gaps.push('描边需要源顶点色红通道');
 for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ']){
  try{const a=JSON.parse(p[k]??'[0,0,0]');if(!Array.isArray(a)||a.length!==3||a.some(x=>x!==0))gaps.push('活动软体输入未接入');}catch{gaps.push('软体参数无效');}
 }
 if(['INSTANCE_TYPE','USE_TEXCOORD1','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'].some(k=>Number(macros[k]??0)!==0))gaps.push('未验证顶点或实例分支');
 if(gaps.length){warnings.push(...gaps.map(s=>'水墨：'+s));return null;}
 // Validate the entire pass pair up front; never mark a body-only result ready.
 const required=low?['Tex0','Tex4','Tex5']:['Tex0',...(hasTbn?['Tex1']:[]),'Tex2','Tex3','Tex4','Tex5'];
 const maps={};for(const k of required)maps[k]=await load(k,false);
 const missing=required.filter(k=>!maps[k]?.isTexture||maps[k].isCubeTexture);
 if(missing.length){warnings.push('水墨缺少源二维贴图：'+missing.join(', '));return null;}
 const f=x=>Number(x).toFixed(8),s=k=>f(n(k)),rgb=k=>`vec3(${v(k).slice(0,3).map(f).join(',')})`;
 const uniforms={neoTime:{value:0},neoFaceOffset:{value:n('FaceUVOffset')},neoEmissionScale:{value:1}};
 for(const k of required)uniforms['ink'+k]={value:maps[k]};
 m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.roughness=1;m.metalness=0;
 m.side=outline?BackSide:FrontSide;
 if(outline){m.transparent=true;m.depthWrite=false;m.depthTest=true;m.depthFunc=LessEqualDepth;m.blending=NormalBlending;m.alphaTest=0;}
 m.defines={...m.defines,...(hasTbn?{USE_TANGENT:''}:{}),...(outline&&n('Line_Width')!==0?{USE_COLOR:''}:{})};
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const vary='varying vec2 inkUv;varying vec3 inkN,inkT,inkB,inkWorld,inkOrigin;\n';
  shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ninkUv=uv;')
   .replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 inkSourceN=transformedNormal;
    #ifdef FLIP_SIDED
    inkSourceN=-inkSourceN;
    #endif
    inkN=normalize(inverseTransformDirection(inkSourceN,viewMatrix))*vec3(-1.0,1.0,1.0);
    inkT=vec3(1,0,0);inkB=vec3(0,1,0);
    ${hasTbn?'inkT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.0,1.0,1.0);inkB=cross(inkN,inkT)*tangent.w;':''}
   `)
   .replace('#include <begin_vertex>',`#include <begin_vertex>${outline&&n('Line_Width')!==0?`\ntransformed+=objectNormal*${s('Line_Width')}*color.r;`:''}`)
   .replace('#include <project_vertex>','#include <project_vertex>\ninkWorld=(modelMatrix*vec4(transformed,1.0)).xyz*vec3(-1.0,1.0,1.0);inkOrigin=modelMatrix[3].xyz*vec3(-1.0,1.0,1.0);');
  shader.fragmentShader=vary+`uniform sampler2D inkTex0,inkTex1,inkTex2,inkTex3,inkTex4,inkTex5;
   uniform float neoTime,neoFaceOffset,neoEmissionScale;
   vec3 inkLinear(vec3 x){return ${low?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
  `+shader.fragmentShader;
  const normalCode=`vec3 inkNormal=inkN;${hasTbn?`vec3 inkRawN=texture2D(inkTex1,inkSampleUv).xyz*2.0-1.0;inkRawN.xy*=${f(intensity[0])};inkNormal=mat3(inkT,inkB,inkN)*normalize(inkRawN);`:''}
   vec3 inkView=normalize(cameraPosition*vec3(-1.0,1.0,1.0)-inkWorld);`;
  const body=`
   vec2 inkSampleUv=inkUv;inkSampleUv.x+=inkSampleUv.y<.25?neoFaceOffset*${s('CharOffset')}:0.0;
   vec4 inkBase=texture2D(inkTex0,inkSampleUv);inkBase.rgb=inkLinear(inkBase.rgb);
   ${normalCode}
   vec4 inkMC=vec4(1.0),inkEmis=vec4(0.0);float inkNoise=0.0;
   ${low?'':`
   vec3 inkNV=mat3(viewMatrix)*(inkNormal*vec3(-1.0,1.0,1.0));
   vec3 inkVV=mat3(viewMatrix)*(inkView*vec3(-1.0,1.0,1.0));
   vec3 inkTV=normalize(cross(inkVV,vec3(0,1,0))),inkBV=normalize(cross(inkVV,inkTV));
   inkMC=texture2D(inkTex2,vec2(dot(inkNV,inkTV),dot(inkNV,inkBV))*.5+.5);inkMC.rgb=inkLinear(inkMC.rgb);
   inkEmis=texture2D(inkTex3,inkSampleUv);inkEmis.rgb=inkLinear(inkEmis.rgb);
   inkNoise=texture2D(inkTex5,inkSampleUv*vec2(${s('Dis_TX')},${s('Dis_TY')})+neoTime*vec2(${s('Dis_SX')},${s('Dis_SY')})).g;`}
   vec4 inkMask=texture2D(inkTex4,inkSampleUv+inkNoise*${s('Dis_Strength')});
   ${Array.from({length:4},(_,i)=>`vec3 inkArea${i}=mix(inkLinear(${rgb('Color0'+(i*2+1))}),inkLinear(${rgb('Color0'+(i*2+2))}),inkMask.r);
   inkArea${i}=mix(inkLinear(${rgb('InkCol0'+(i+1))})*(1.0-inkMask.g),inkArea${i},inkMask.g);`).join('\n')}
   vec3 inkDiffuse=inkBase.rgb;
   inkDiffuse=mix(inkDiffuse,inkArea0,step(.05,inkMask.a)-step(.35,inkMask.a));
   inkDiffuse=mix(inkDiffuse,inkArea1,step(.35,inkMask.a)-step(.55,inkMask.a));
   inkDiffuse=mix(inkDiffuse,inkArea2,step(.55,inkMask.a)-step(.75,inkMask.a));
   inkDiffuse=mix(inkDiffuse,inkArea3,step(.75,inkMask.a)-step(1.05,inkMask.a));
   ${Number(macros.CHAR_CHANGE_COLOR)===1?`inkDiffuse=vec3(dot(inkDiffuse,vec3(.2125,.7154,.0721)))*inkLinear(${rgb('BaseColor')});`:''}
   inkDiffuse*=${s('TintValue')};
   // Keep the native ramp equation, with the preview scene's primary sun input.
   #if NUM_DIR_LIGHTS > 0
   vec3 inkSun=inverseTransformDirection(directionalLights[0].direction,viewMatrix)*vec3(-1.0,1.0,1.0);
   vec3 inkLR=normalize(-inkSun.xzy*vec3(1,1,-1));
   inkDiffuse*=texture2D(inkTex4,vec2(dot(inkNormal,inkSun),dot(inkNormal,inkLR))*.5+.5).b;
   #else
   inkDiffuse*=texture2D(inkTex4,vec2(.5)).b;
   #endif
   inkDiffuse=mix(inkDiffuse,inkMC.rgb*inkEmis.a*inkDiffuse*${s('Metal_Strength')}*1.5,inkEmis.a);
   float inkEdge=1.0-dot(inkNormal,inkView);
   float inkRim=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*inkEdge*inkEdge*inkEdge*inkEdge*inkEdge,0.0,1.0);
   vec3 inkOutput=inkDiffuse+inkRim*inkLinear(${rgb('RimColor')})*${f(intensity[3])}+inkEmis.rgb*${s('EmissiveAmount')}*inkLinear(${rgb('EmissiveColor')});
   diffuseColor=vec4(0,0,0,inkBase.a*opacity);totalEmissiveRadiance=inkOutput*neoEmissionScale;
  `;
  const line=`vec2 inkSampleUv=inkUv;vec4 inkBase=texture2D(inkTex0,inkSampleUv);${normalCode}
   vec3 inkTrick=normalize(inkWorld-inkOrigin-vec3(0,1.2,0));
   vec3 inkViewTrick=normalize(mat3(viewMatrix)*(inkTrick*vec3(-1.0,1.0,1.0)));
   float inkU=atan(inkViewTrick.x,inkViewTrick.y)/6.28+.5+${s('Line_Offset_U')};
   float inkV=clamp(dot(-inkNormal,inkView),0.0,1.0)+${s('Line_Offset_V')};
   float inkLine=texture2D(inkTex5,vec2(inkU*${s('Line_Tiling_U')},inkV*${s('Line_Tiling_V')})).r;
   diffuseColor=vec4(0,0,0,inkBase.a*inkLine*opacity);totalEmissiveRadiance=vec3(0.0);`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',outline?line:body)
   .replace('#include <color_fragment>','').replace('#include <emissivemap_fragment>','')
   .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
 };
 warnings.push('水墨原分区/扰动/Matcap/顶点色描边已接入；太阳方向使用当前预览场景，原背包场景光照、后处理和活动软体尚未复刻');
 return uniforms;
}
