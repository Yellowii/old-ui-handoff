import {DataTexture,RGBAFormat,FloatType} from 'three';

const builtins=Object.fromEntries(Object.entries({white:[1,1,1,1],green:[0,1,0,1],normal:[.5,.5,1,1]}).map(([key,rgba])=>{
  const t=new DataTexture(new Float32Array(rgba),1,1,RGBAFormat,FloatType);t.needsUpdate=true;return [key,t];
}));
export const sourceVector=value=>{try{return JSON.parse(value);}catch{return null;}};
export function validSourceInputs(p,macros,vectors,scalars){
  if(vectors.some(k=>{const a=sourceVector(p[k]);return !Array.isArray(a)||a.length!==4||!a.every(Number.isFinite);})||scalars.some(k=>p[k]===undefined||!Number.isFinite(Number(p[k]))))return false;
  if(Number(macros.ENABLE_SOFT_BODY2)!==0){
    // soft_body.hlsl consumes only these diagonal coefficients; zero means no displacement.
    if(['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some((k,j)=>{const a=sourceVector(p[k]);return !Array.isArray(a)||a.length!==3||!a.every(Number.isFinite)||a[j%3]!==0;}))return false;
  }
  return true;
}
export async function sourceMaps(keys,p,load,overrides,normalKey,warnings=[]){
  const result={};
  for(const key of keys){
    const override=key==='Tex0'?overrides.baseColor:key===normalKey?overrides.normal:null,binding=overrides.textureBindings?.[key];
    if(!override&&!binding?.url&&!binding?.path&&p[key]==='black')warnings.push(key+': source builtin black RGBA requires native verification; no fabricated alpha');
    // Failed authored paths/overrides must never fall back to a SURF builtin.
    result[key]=override||binding?.url||binding?.path?await load(key,false,override):builtins[p[key]]||await load(key,false);
  }
  return keys.every(k=>result[k])?result:null;
}
export const sourceMatcapGlsl=`
vec2 sourceMatcapUV(vec3 normalView,vec3 viewDir){
  // NeoX left-handed view differs from Three's view in Z, not in texture UV.
  vec3 n=normalView*vec3(1.0,1.0,-1.0),v=viewDir*vec3(1.0,1.0,-1.0);
  vec3 t=normalize(cross(v,vec3(0.0,1.0,0.0))),b=normalize(cross(v,t));
  return vec2(dot(n,t),dot(n,b))*0.5+0.5;
}
`;
