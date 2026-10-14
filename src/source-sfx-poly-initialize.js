const f32=Math.fround;
const number=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<0)throw new TypeError(`Nonnegative finite ${name} required`);return f32(x);};
const count=(x,name)=>{if(!Number.isInteger(x)||x<0||x>0x7fffffff)throw new TypeError(`Nonnegative int32 ${name} required`);return x;};

// Selected five profiles have EmitEven=true and EmitMoveRate=0 (T191).
// 2b45d24..2b45dc0: ceil is FCVTPS on an f32 product, before both caps.
export function sourceSfxPolyCapacity(profile,{loop,endless,globalParticleLimit}){
  if(typeof loop!=='boolean'||typeof endless!=='boolean')throw new TypeError('Resolved loop/endless required');
  if(profile.config?.emitEven!==true||profile.config?.emitMove!==false)throw new RangeError('Unresolved particle capacity profile');
  const maxLife=number(profile.birth.maxLife,'maxLife'),emissionLife=number(profile.emissionLife,'emissionLife');
  const horizon=loop||endless?maxLife:Math.min(maxLife,emissionLife);
  const target=Math.min(0x7fffffff,Math.ceil(f32(horizon*number(profile.particlesPerSecond,'particlesPerSecond'))));
  return Math.min(target,count(profile.maxSpriteNum,'MaxSpriteNum'),count(globalParticleLimit,'globalParticleLimit'));
}

// Constructor 2eda91c explicitly sets emissionScale=1; initialize2b454e4
// copies emissionLife to stopTime. This is fresh storage, never a restart.
// 2ee1c04 zeros the particle/extension allocation and builds reusable records.
export function initializeSourceSfxPolyStorage(node,profile,{globalParticleLimit}){
  const capacity=sourceSfxPolyCapacity(profile,{loop:node.loop,endless:node.endless,globalParticleLimit});
  const zero=()=>[0,0,0];
  const pool=Array.from({length:capacity},()=>({position:zero(),velocity:zero(),previousPosition:zero(),
    particleScale:zero(),extensionOffset:zero(),life:0,age:0,normalizedAge:0,randomAngularSpeed:0,
    accumulatedAngle:0,angularSpeed:0,originalAngle:0,radius:0,width:0,height:0,atlasStartTime:0}));
  Object.assign(node,{capacity,pool,liveCount:0,fractionalCarry:0,preEmissionElapsed:0,emissionScale:1,stopTime:f32(profile.emissionLife)});
  return node;
}
