import {getHandoffServices} from './handoff/services.js';
const f32=Math.fround;
const storage=new ArrayBuffer(4),view=new DataView(storage);

// FRSQRTE's table is invariant under powers of four. Two native FRSQRTS
// refinements follow; their subtraction is fused before rounding to float32.
function reciprocalLength(length2){
  const table=getHandoffServices().runtimePolicy?.sfxRsqrtTable;
  if(!Array.isArray(table)||table.length!==2||table.some(row=>!Array.isArray(row)||row.length!==256||row.some(value=>!Number.isFinite(value))))throw new Error('SFX reciprocal-length table unavailable; provide runtimePolicy.sfxRsqrtTable');
  let normalized=length2,subnormalScale=1;
  if(normalized<2**-126){normalized=f32(normalized*2**24);subnormalScale=2**12;}
  view.setFloat32(0,normalized,true);
  const word=view.getUint32(0,true),exponent=(word>>>23)&255;
  const base=(exponent&1)?127:126;
  let reciprocal=f32(table[base-126][(word>>>15)&255]*2**(-(exponent-base)/2)*subnormalScale);
  for(let i=0;i<2;i++){
    const product=f32(length2*reciprocal);
    const correction=f32((3-product*reciprocal)/2);
    reciprocal=f32(reciprocal*correction);
  }
  return reciprocal;
}

const squareSum=v=>f32(f32(f32(v[0]*v[0])+f32(v[1]*v[1]))+f32(v[2]*v[2]));
export function sourceSfxNormalize3(input){
  const v=input.map(f32),length2=squareSum(v);
  if(length2===0)return [0,0,0];
  if(!Number.isFinite(length2))return [NaN,NaN,NaN];
  const reciprocal=reciprocalLength(length2);
  return v.map(value=>f32(value*reciprocal));
}

// d95768 stores squaredLength * refined reciprocal, rather than FSQRT.
export function sourceSfxDecompositionLength3(input){
  const length2=squareSum(input.map(f32));
  if(length2===0)return 0;
  if(!Number.isFinite(length2))return NaN;
  return f32(length2*reciprocalLength(length2));
}

export function sourceSfxCross3(a,b){
  return [f32(f32(a[1]*b[2])-f32(a[2]*b[1])),
    f32(f32(a[2]*b[0])-f32(a[0]*b[2])),f32(f32(a[0]*b[1])-f32(a[1]*b[0]))];
}
