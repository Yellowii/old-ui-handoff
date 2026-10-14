import {Vector2} from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl} from './source-scene-light.js';

export async function configureIcefloor(m,p,macros,load,o={},warnings=[]){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['ENABLE_SCALE_9','RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(scalar(macros.ENABLE_SCALE_9,0)!==1||![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(light)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unverified icefloor permutation');
  if(!o.sourceVertexColors||!o.sourceBounds?.half)throw Error('Original Scale9 colors/bounds required');
  if(q<2&&normal&&light&&!o.sourceTangents)throw Error('Original icefloor tangent basis required');
  const half=vector(o.sourceBounds.half,[1,1,1]),axis=vector(p.Scale9Axis,[1,1,1,1]),v=vector(p.Variable,[1,-2,1]),i=vector(p.Intensity,[1,1,0,1]);
  if(half.some(x=>x<=0)||v[0]<=0)throw Error('Invalid Scale9 bounds or ice depth power base');
  const down=rgb(vector(p.DownColor,[1,1,1,1])),up=rgb(vector(p.UpColor,[1,1,1,1]));
  const keys=q<2?['Tex0','Tex1']:['Tex0'],maps=await Promise.all(keys.map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original icefloor textures');
  const u={neoEmissionScale:{value:1},ifSceneColor:{value:null},ifSceneDepth:{value:null},ifScreenSize:{value:new Vector2(1,1)},ifNearFar:{value:new Vector2(.1,1000)},ifLogDepth:{value:0},ifPerspective:{value:1}};
  keys.forEach((k,j)=>u['if'+k]={value:maps[j]});setup(m,q<2&&normal===1&&light===1);m.vertexColors=true;m.userData.sceneRefraction=q<2;
  m.userData.previewEnvironment={profile:'current-preview-color-depth-and-authored-bag-sun',fullOriginalScene:false};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal===1&&light===1);
   const vary='varying vec3 ifTiling,ifScale,ifLocalNormal;\n';s.vertexShader=vary+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`
    ifScale=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));
    vec3 ifOffset=vec3(color.x*2.-1.,color.y*2.,color.z*2.-1.);
    vec3 ifScale9=(${rgb(half)}*ifScale-${rgb(half)})*ifOffset.zyx+transformed;
    transformed=mix(transformed,ifScale9/ifScale,${rgb(axis)});
    ifTiling=ifScale*transformed;ifLocalNormal=objectNormal;
    #include <project_vertex>
   `);
   s.fragmentShader=vary+`uniform float neoEmissionScale,ifLogDepth,ifPerspective;uniform vec2 ifScreenSize,ifNearFar;
    uniform sampler2D ifSceneColor,ifSceneDepth;${keys.map(k=>'uniform sampler2D if'+k+';').join('')}
    float ifViewDepth(float d){
     if(ifPerspective<.5)return mix(ifNearFar.x,ifNearFar.y,d);
     if(ifLogDepth>.5)return exp2(d*log2(ifNearFar.y+1.))-1.;
     return ifNearFar.x*ifNearFar.y/(ifNearFar.y-d*(ifNearFar.y-ifNearFar.x));
    }
    vec3 ifLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec3 ifAbs=abs(ifLocalNormal);float ifMax=max(max(ifAbs.x,ifAbs.y),ifAbs.z);
    vec2 ifNormalUv,ifVignetteUv;
    // Independent source conditions: z wins ties, then y, then x.
    if(ifMax==ifAbs.x){ifNormalUv=ifTiling.yz;ifVignetteUv=vec2(ifTiling.z/ifScale.z*.5+.5,ifTiling.y/ifScale.y*.5);}
    if(ifMax==ifAbs.y){ifNormalUv=ifTiling.xz;ifVignetteUv=ifTiling.xz/ifScale.xz*.5+.5;}
    if(ifMax==ifAbs.z){ifNormalUv=ifTiling.xy;ifVignetteUv=vec2(ifTiling.x/ifScale.x*.5+.5,ifTiling.y/ifScale.y*.5);}
    vec3 ifVignette=ifLinear(texture2D(ifTex0,ifVignetteUv).rgb);
    vec3 ifN=t107N,ifRaw=vec3(0.);float ifDepth=0.,ifMask=0.,ifColorMask=.5;vec2 ifScreenUv=gl_FragCoord.xy/ifScreenSize;
    ${q===2?`vec3 ifAlbedo=mix(${down},${up},.5)+ifVignette*${f(i[3])};`:`
     ifRaw=normalize(texture2D(ifTex1,ifNormalUv*${f(v[2])}).xyz*2.-1.);ifRaw.xy*=${f(i[0])};
     float ifDepth1=ifViewDepth(texture2D(ifSceneDepth,ifScreenUv+ifRaw.xy*.1).r);
     ifMask=clamp(ifDepth1-vViewPosition.z,0.,1.);
     vec2 ifRefractUv=ifScreenUv+ifRaw.xy*ifMask*.1;
     float ifDepth2=ifViewDepth(texture2D(ifSceneDepth,ifRefractUv).r);
     ifDepth=abs(ifDepth2-vViewPosition.z);
     ifColorMask=clamp(pow(ifDepth+${f(v[0])},${f(v[1])}),0.,1.);
     vec3 ifBase=ifLinear(mix(${down},${up},ifColorMask));
     vec3 ifAlbedo=mix(ifBase,texture2D(ifSceneColor,ifRefractUv).rgb,ifColorMask)+ifVignette*${f(i[3])};
     ${normal&&light?'ifN=mat3(t107T,t107B,t107N)*normalize(ifRaw);':''}
    `}
    vec3 ifView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 ifSun=${sourceSceneSunGlsl()};
    vec3 ifR=vec3(cos(3.14)*ifSun.x+sin(3.14)*ifSun.z,ifSun.y,-sin(3.14)*ifSun.x+cos(3.14)*ifSun.z);
    vec3 ifR1=vec3(cos(-.3)*ifR.x-sin(-.3)*ifR.y,sin(-.3)*ifR.x+cos(-.3)*ifR.y,ifR.z);
    vec3 ifH=normalize(-ifR1+ifView);
    vec3 ifEmission=pow(clamp(dot(ifN,ifH),0.,1.),1220.)*.2*${sourceSceneSunColorGlsl()};
    diffuseColor=vec4(ifAlbedo,opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(ifN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${f(i[1])};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(i[2])};`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=ifEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>','');
  };return u;
 }catch(e){warnings.push('Icefloor remains unsupported: '+e.message);return null;}
}
