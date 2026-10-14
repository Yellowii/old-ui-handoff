// SfxBaseData2b57bac. These are reader defaults, not guessed scene globals.
const f32=Math.fround;
const maxFloat=3.4028234663852886e38;
function number(a,key,fallback){
  const n=f32(a[key]===undefined?fallback:Number(a[key]));
  if(!Number.isFinite(n))throw new TypeError(`Finite source ${key} required`);
  return n;
}
function integer(a,key,fallback){
  const n=a[key]===undefined?fallback:Number(a[key]);
  if(!Number.isInteger(n)||n< -2147483648||n>2147483647)throw new TypeError(`Source int32 ${key} required`);
  return n;
}
function boolean(a,key,fallback){
  const v=a[key];
  if(v===undefined)return fallback;
  if(v===true||v==='true')return true;
  if(v===false||v==='false')return false;
  throw new TypeError(`Source boolean ${key} required`);
}

export function readSourceSfxDistanceFade(attributes){
  const a=attributes;
  const farEnd=number(a,'FarCull',maxFloat);
  // 2b58244: each comparison uses the already constrained previous value.
  const farStart=Math.min(farEnd,number(a,'FarFade',maxFloat));
  const nearEnd=Math.min(farStart,number(a,'NearFade',0));
  const nearStart=Math.min(nearEnd,number(a,'NearCull',0));
  return {farEnd,farStart,nearStart,nearEnd,
    farEnabled:boolean(a,'FarCullEnable',false),nearEnabled:boolean(a,'NearCullEnable',false)};
}

export function readSourceSfxBaseOptions(attributes,{resolveSocketName}={}){
  const a=attributes;
  let binding158=0;
  if(a.SocketName!==undefined&&a.SocketName!==''){
    // XML virtualb8 returns an intern-table ID, not the raw Murmur hash.
    if(typeof resolveSocketName!=='function')throw new TypeError('Source SocketName resolver required');
    binding158=resolveSocketName(a.SocketName);
    if(!Number.isInteger(binding158)||binding158<0||binding158>0xffffffff)throw new TypeError('Source uint32 SocketName ID required');
  }
  return {distanceFade:readSourceSfxDistanceFade(a),renderOrder:integer(a,'RenderOrder',0),
    inheritPrsOnce:boolean(a,'InheritPrsOnce',false),socketType:integer(a,'SocketType',0)&255,binding158,
    pauseWhenCulled:boolean(a,'PauseWhenCulled',false)};
}
