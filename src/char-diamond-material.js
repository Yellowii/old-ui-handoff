import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';

// standard_char_diamond.hlsl: layer colors stay in their authored raw domain;
// only the base and emissive colors use the source gamma conversion.
export async function configureCharDiamond(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','CHAR_CHANGE_COLOR','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(![0,1,2].includes(q)||[normal,change,light].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active diamond permutation');
  if(['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ','SoftBodyCenter'].some(k=>vector(p[k],[0,0,0]).some(x=>x!==0))||vector(p.SoftBodyScale,[1,1,1,1]).some(x=>x!==1)||vector(p.SoftBodyBottom,[0,0,0,1]).some((x,i)=>x!==(i===3?1:0)))throw Error('Active source soft-body controller not connected');
  const high=q<2,useTangent=high&&normal===1;
  if(useTangent&&o.sourceTangents!==true)throw Error('Missing original tangent basis');
  const I=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]);
  const l1=vector(p.Layer01Para,[1,1,0,1]),l2=vector(p.Layer02Para,[1,1,0,1]),line=vector(p.LinePara,[1,1,0,1]);
  const n=(k,d)=>f(scalar(p[k],d)),c=(k,d=[1,1,1,1])=>rgb(vector(p[k],d));
  const u={neoEmissionScale:{value:1}};
  for(const key of high?['Tex0',...(useTangent?['Tex1']:[]),'Tex2','Tex3','Tex4']:['Tex0']){
   const texture=await load(key,false);
   if(!texture?.isTexture||(key==='Tex4'?!texture.isCubeTexture:texture.isCubeTexture))throw Error('Missing active original '+(key==='Tex4'?'cube: ':'2D texture: ')+key);
   u['cd'+key]={value:texture};
  }
  setup(m,useTangent);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,useTangent);
   s.fragmentShader=`uniform sampler2D cdTex0,cdTex1,cdTex2,cdTex3;uniform samplerCube cdTex4;
    uniform float neoEmissionScale;
    vec3 cdLinear(vec3 c){return ${high?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float cdPow5(float x){float x2=x*x;return x2*x2*x;}
    \n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 cd0=texture2D(cdTex0,t107Uv);cd0.rgb=cdLinear(cd0.rgb);
    cd0.rgb=${change?`dot(cd0.rgb,vec3(.2125,.7154,.0721))*cdLinear(${rgb(base)})`:'cd0.rgb'}*${n('TintValue',1)};
    vec4 cd2=vec4(1.,1.,0.,0.);vec3 cdN=t107N,cdAlbedo=cd0.rgb,cdCrystal=vec3(0.);float cdMask=0.;
    vec3 cdV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${high?`
    cd2=texture2D(cdTex2,t107Uv);vec4 cd3=texture2D(cdTex3,t107Uv);cdMask=cd3.r;
    mat3 cdTbn=${useTangent?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    ${useTangent?`vec3 cdLocal=texture2D(cdTex1,t107Uv).xyz*2.-1.;cdLocal.xy*=${f(I[0])};cdN=cdTbn*normalize(cdLocal);`:''}
    // Source mul(TBN, camera-to-surface): transpose basis, no divide by z.
    vec2 cdOffset=-vec2(dot(cdTbn[0],cdV),dot(cdTbn[1],cdV));
    vec2 cdUv1=t107Uv*vec2(${f(l1[0])},${f(l1[1])})+cdOffset*${f(l1[2])};
    vec2 cdUv2=t107Uv*vec2(${f(l2[0])},${f(l2[1])})+cdOffset*${f(l2[2])};
    vec3 cdLayer1=pow(texture2D(cdTex0,cdUv1).rgb,vec3(${f(l1[3])}))*${c('Layer01_Color')}*${n('Layer01_Strength',1)};
    vec3 cdLayer2=pow(texture2D(cdTex0,cdUv2).rgb,vec3(${f(l2[3])}))*${c('Layer02_Color')}*${n('Layer02_Strength',1)};
    float cdEdge=clamp(1.-dot(t107N,cdV),0.,1.);
    vec3 cdFresnel=clamp(pow(cdEdge,${n('FresnelPow',1)}),0.,1.)*${c('FresnelColor')}*${n('FresnelEmisMult',1)};
    float cdFake=.2+1.8*pow(clamp(dot(cdN,cdV),0.,1.),4.);
    float cdLineFactor=smoothstep(${f(line[2])},${f(line[3])},clamp(pow(1.-cdEdge,${f(line[0])})+${f(line[1])},0.,1.));
    vec3 cdLine=cdLineFactor*cd3.a*${n('Line_Strength',1)}*${c('Line_Color')};
    vec3 cdReflect=pow(textureLod(cdTex4,reflect(-cdV,cdN),1.).rgb*${n('ReflectCube_Mult',1)},vec3(${n('ReflectCube_Pow',1)}));
    cdAlbedo=mix(cd0.rgb,(cdLayer1+cdLayer2)*cdFake,cdMask);
    cdCrystal=(cdAlbedo*${n('Layer_EmisStrength',0)}+cdFresnel+cdReflect)*cdMask+cdLine;
    `:''}
    diffuseColor=vec4(cdAlbedo,cd0.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cdN*vec3(-1.,1.,1.)));')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(mix(cd2.g,${f(I[1])},cdMask),0.,1.);`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(mix(cd2.b,${f(I[2])},cdMask),0.,1.);`)
   .replace('#include <emissivemap_fragment>',`
    float cdRim=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*cdPow5(1.-dot(cdN,cdV)),0.,1.);
    vec3 cdBaseEmission=mix(vec3(cd2.a),cd2.a*cd0.rgb,${n('BaseEmissiveKey',0)})*cdLinear(${c('EmissiveColor')})*${n('EmissiveValue',1)};
    totalEmissiveRadiance=(cdRim*${c('RimColor',[0,0,0,0])}*${f(I[3])}+cdBaseEmission+cdCrystal)*neoEmissionScale;
   `)
   .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cd2.r;
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),cd2.r,material.roughness);
    #endif`)
   .replace('#include <lights_physical_fragment>',sourceSpecular('1.',sourceGrazing));
   sourceIsotropy(s,{quality:q,smoothDiffuse:true,light:light===1});
  };
  warnings.push('钻石材质通道已接入；原场景环境补光、完整光照及软体动态仍待还原');
  return u;
 }catch(e){warnings.push('Char diamond remains unsupported: '+e.message);return null;}
}
