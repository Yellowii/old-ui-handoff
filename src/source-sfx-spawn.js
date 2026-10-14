import {sourceSfxRandom} from './source-sfx-random.js';
import {sourceSfxAtlasStartPhase} from './source-sfx-atlas.js';
import {sourceSfxNormalize3,sourceSfxCross3} from './source-sfx-vector.js';
const f32=Math.fround;
const pi=f32(Math.PI);
function draw(stream,min,max){
  if(!Number.isInteger(stream?.seed)||stream.seed<0||stream.seed>0xffffffff)throw new TypeError('Live source uint32 RNG seed required');
  const result=sourceSfxRandom({seed:stream.seed,min,max});stream.seed=result.seed;return result.value;
}
function number(x,name){
  if(typeof x!=='number'||!Number.isFinite(x))throw new TypeError(`${name}: resolved source number required`);
  return f32(x);
}
function vector(v,name,size=3){
  if(!v||v.length!==size)throw new TypeError(`${name}: ${size} source components required`);
  return Array.from(v,(x,i)=>number(x,`${name}[${i}]`));
}

// EmissionType0 -> 2b460a0. A spherical shell, not a point emitter.
// The dispatch reads EmissionType; MeshEmissionType is not consumed here.
export function sourceSfxSampleType0(stream,{radius,thickness,inside,minVelocity,maxVelocity}){
  thickness=number(thickness,'thickness');
  minVelocity=number(minVelocity,'minVelocity');maxVelocity=number(maxVelocity,'maxVelocity');
  if(typeof inside!=='boolean')throw new TypeError('Explicit Inside required');
  const direction=sourceSfxNormalize3([draw(stream,-1,1),draw(stream,-1,1),draw(stream,-1,1)]);
  const speed=draw(stream,minVelocity,maxVelocity);
  radius=number(typeof radius==='function'?radius():radius,'radius');
  const distance=draw(stream,inside?thickness:radius,inside?radius:f32(radius+thickness));
  return {position:direction.map(x=>f32(x*distance)),velocity:direction.map(x=>f32(x*speed))};
}

// Emitter type4, 2b46c58: six draws including zero-height/equal-speed ranges.
export function sourceSfxSampleType4(stream,{planeDirection,radius,thickness,height,inside,minVelocity,maxVelocity}){
  const plane=vector(planeDirection,'planeDirection');
  thickness=number(thickness,'thickness');height=number(height,'height');
  minVelocity=number(minVelocity,'minVelocity');maxVelocity=number(maxVelocity,'maxVelocity');
  if(typeof inside!=='boolean')throw new TypeError('Explicit Inside required');
  const random=sourceSfxNormalize3([draw(stream,-1,1),draw(stream,-1,1),draw(stream,-1,1)]);
  const radial=sourceSfxNormalize3(sourceSfxCross3(plane,random));
  radius=number(typeof radius==='function'?radius():radius,'radius');
  const distance=draw(stream,inside?thickness:radius,inside?radius:f32(radius+thickness));
  const position=radial.map(x=>f32(x*distance));
  const elevation=draw(stream,0,height);
  for(let i=0;i<3;i++)position[i]=f32(position[i]+f32(plane[i]*elevation));
  const speed=draw(stream,minVelocity,maxVelocity);
  return {position,velocity:plane.map(x=>f32(x*speed))};
}

// 2b46978, the zero emission-radius branch used by champion-belt lightning.
// Preserve draws for the two basis coefficients even though radius removes them.
export function sourceSfxSampleType3ZeroRadius(stream,{planeDirection,radius,height,inside,minVelocity,maxVelocity}){
  const plane=vector(planeDirection,'planeDirection');height=number(height,'height');
  if(typeof inside!=='boolean')throw new TypeError('Explicit Inside required');
  minVelocity=number(minVelocity,'minVelocity');maxVelocity=number(maxVelocity,'maxVelocity');
  draw(stream,-1,1);draw(stream,-1,1);
  const axial=inside?draw(stream,0,1):1;
  radius=number(typeof radius==='function'?radius():radius,'radius');
  if(radius!==0)throw new RangeError('Type3 nonzero radius requires source plane basis');
  if(inside)draw(stream,0,0);
  const position=plane.map(v=>f32(f32(axial*v)*height));
  if(f32(f32(Math.abs(position[0])+Math.abs(position[1]))+Math.abs(position[2]))<f32(.0001))return {position,velocity:[...position]};
  const direction=sourceSfxNormalize3(position),speed=draw(stream,minVelocity,maxVelocity);
  return {position:[0,0,0],velocity:direction.map(v=>f32(v*speed))};
}

// Initializer2b459bc..2b45d20, zero EmissionDirDegree. The authored direction
// is normalized before building two perpendicular (not separately normalized)
// basis vectors. Other initial direction-curve angles remain unimplemented.
export function sourceSfxType3Basis(planeDirection){
  const plane=sourceSfxNormalize3(vector(planeDirection,'planeDirection'));
  const first=sourceSfxCross3(plane,Math.abs(plane[1])===1?[1,0,0]:[0,1,0]);
  return {plane,first,second:sourceSfxCross3(plane,first)};
}

// Original cone sampler2b46978. Radius controls the cone direction; for a
// nondegenerate direction the source clears the actual birth position to zero.
export function sourceSfxSampleType3(stream,{type3Basis,radius,height,inside,minVelocity,maxVelocity}){
  if(!type3Basis)throw new TypeError('Source type3 basis required');
  const plane=vector(type3Basis.plane,'plane'),first=vector(type3Basis.first,'first'),second=vector(type3Basis.second,'second');
  height=number(height,'height');minVelocity=number(minVelocity,'minVelocity');maxVelocity=number(maxVelocity,'maxVelocity');
  if(typeof inside!=='boolean')throw new TypeError('Explicit Inside required');
  const a=draw(stream,-1,1),b=draw(stream,-1,1);
  const radial=sourceSfxNormalize3(first.map((x,i)=>f32(f32(x*a)+f32(second[i]*b))));
  const axial=inside?draw(stream,0,1):1;
  radius=number(typeof radius==='function'?radius():radius,'radius');
  const distance=inside?draw(stream,0,f32(axial*radius)):radius;
  const position=radial.map((v,i)=>f32(f32(v*distance)+f32(f32(axial*plane[i])*height)));
  if(f32(f32(Math.abs(position[0])+Math.abs(position[1]))+Math.abs(position[2]))<f32(.0001))return {position,velocity:[...position]};
  const direction=sourceSfxNormalize3(position),speed=draw(stream,minVelocity,maxVelocity);
  return {position:[0,0,0],velocity:direction.map(v=>f32(v*speed))};
}

// Native affine input is supplied after controller action-mode/external-scale
// resolution. Position and velocity deliberately use different sum orders.
function transformBirth(sample,matrix,inheritedVelocity){
  const p=sample.position,v=sample.velocity.map((x,i)=>f32(x+inheritedVelocity[i]));
  return {
    position:[0,1,2].map(i=>f32(f32(f32(matrix[12+i]+f32(matrix[i]*p[0]))+f32(matrix[4+i]*p[1]))+f32(matrix[8+i]*p[2]))),
    velocity:[0,1,2].map(i=>f32(f32(f32(f32(matrix[i]*v[0])+f32(matrix[4+i]*v[1]))+f32(matrix[8+i]*v[2]))+f32(matrix[12+i]*0))),
  };
}

// 2b4b304 + ParticlePoly virtual988/2ee0030. Inputs are runtime values
// (angles already in radians); this function does not reinterpret XML units.
export function sourceSfxInitializePolyParticle(particle,stream,birth,phase,parameters){
  const p=parameters;
  const drift=vector(p.positionDrift,'positionDrift'),scale=vector(p.particleScale,'particleScale');
  const scalarKeys=['minLife','maxLife','randomAngularSpeed','originalAngle','originalAngleRandom','minRadius','maxRadius','rotationScale'];
  const values=Object.fromEntries(scalarKeys.map(key=>[key,number(p[key],key)]));
  if(typeof p.oldRotationMode!=='boolean'||typeof p.randomHalfTurn!=='boolean'||typeof p.randomStartEnabled!=='boolean')throw new TypeError('Explicit particle rotation/atlas flags required');
  if(!Number.isInteger(p.textureType))throw new TypeError('Resolved textureType required');
  if(p.textureType===3&&p.randomStartEnabled)number(p.atlasDuration,'atlasDuration');
  const position=vector(birth.position,'position').map((x,i)=>f32(x+f32(drift[i]*f32(phase))));
  const velocity=vector(birth.velocity,'velocity');
  const life=draw(stream,values.minLife,values.maxLife);
  let randomAngularSpeed=draw(stream,-values.randomAngularSpeed,values.randomAngularSpeed);
  if(p.oldRotationMode)randomAngularSpeed=f32(randomAngularSpeed/life);
  const angle=f32(values.originalAngle+draw(stream,-values.originalAngleRandom,
    f32(values.originalAngleRandom+(p.randomHalfTurn?pi:0))));
  const radius=draw(stream,values.minRadius,values.maxRadius);
  const atlas=sourceSfxAtlasStartPhase({textureType:p.textureType,randomStartEnabled:p.randomStartEnabled,
    duration:p.atlasDuration,seed:stream.seed});
  stream.seed=atlas.seed;
  Object.assign(particle,{position,velocity,life,age:0,normalizedAge:0,randomAngularSpeed,
    accumulatedAngle:0,angularSpeed:f32(0*values.rotationScale),originalAngle:f32(angle*values.rotationScale),
    radius,particleScale:scale,width:f32(radius*scale[0]),height:f32(radius*scale[1]),
    previousPosition:[...position],atlasStartTime:atlas.startTime,extensionOffset:[0,0,0]});
  return particle;
}

// Direct T211 spawnBatch adapter. prepareSpawn resolves the actual controller
// matrix and runtime parameters at execution time, including deferred births.
// The caller must initialize the capacity-sized pool; expired objects are reused.
export function createSourceSfxPolySpawnBatch({stream,prepareSpawn}){
  if(typeof prepareSpawn!=='function')throw new TypeError('prepareSpawn required');
  return (emitter,requested,dt)=>{
    if(!Number.isInteger(requested)||requested<0)throw new RangeError('Birth count required');
    if(requested===0)return 0;
    const c=emitter.config;
    if(![0,3,4].includes(c?.emissionType)||c.anchorSum!==0||c.emitAtGround!==false)throw new RangeError('Unsupported particle birth profile');
    const p=prepareSpawn(emitter);
    const matrix=vector(p.matrix,'source spawn matrix',16);
    const inherited=vector(p.inheritedVelocity,'inheritedVelocity');
    if(!Array.isArray(emitter.pool)||emitter.pool.length<emitter.capacity)throw new TypeError('Preallocated source particle pool required');
    const births=Math.min(requested,emitter.capacity-emitter.liveCount);
    if(births<=0)return 0;
    const step=f32(Math.min(number(dt,'dt'),number(p.maxLife,'maxLife'))*f32(1/births));
    const time=number(emitter.time,'node time');
    if(typeof p.radiusCurve!=='function')throw new TypeError('radiusCurve required');
    for(let i=1;i<=births;i++){
      const particle=emitter.pool[emitter.liveCount++];
      const sampler=c.emissionType===0?sourceSfxSampleType0:c.emissionType===3?(p.type3Basis?sourceSfxSampleType3:sourceSfxSampleType3ZeroRadius):sourceSfxSampleType4;
      const sampled=sampler(stream,{...p,radius:()=>p.radiusCurve(time)});
      const birth=transformBirth(sampled,matrix,inherited);
      sourceSfxInitializePolyParticle(particle,stream,birth,f32(step*i),p);
      particle.sourceAnchor=true;
    }
    return births;
  };
}
