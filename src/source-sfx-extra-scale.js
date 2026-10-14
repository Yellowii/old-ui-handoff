import {sourceSfxNormalize3,sourceSfxCross3,sourceSfxDecompositionLength3} from './source-sfx-vector.js';
const f32=Math.fround,epsilon=f32(0.0001);
const axes=[[1,0,0],[0,1,0],[0,0,1]];

// Native comparisons preserve their tie order (X before Y before Z).
function rank(v){
  if(v[0]<v[1]){
    if(v[1]<v[2])return [2,1,0];
    return v[0]<v[2]?[1,2,0]:[1,0,2];
  }
  if(v[0]<v[2])return [2,0,1];
  return v[1]<v[2]?[0,2,1]:[0,1,2];
}

// d95768's scale output stops changing at d95c68. The following quaternion
// calculation is not consumed by the particle branch and is not substituted.
export function sourceSfxSignedScale(matrix){
  if(!Array.isArray(matrix)||matrix.length!==16||matrix.some(x=>!Number.isFinite(x)))throw new TypeError('Finite source affine matrix required');
  const rows=[0,1,2].map(i=>matrix.slice(4*i,4*i+3).map(f32));
  const scale=rows.map(sourceSfxDecompositionLength3);
  const [largest,middle,smallest]=rank(scale);
  if(scale[largest]<epsilon)rows[largest]=[...axes[largest]];
  rows[largest]=sourceSfxNormalize3(rows[largest]);
  if(scale[middle]<epsilon){
    const leastComponent=rank(rows[largest].map(Math.abs))[2];
    rows[middle]=sourceSfxCross3(rows[largest],axes[leastComponent]);
  }
  rows[middle]=sourceSfxNormalize3(rows[middle]);
  if(scale[smallest]<epsilon)rows[smallest]=sourceSfxCross3(rows[largest],rows[middle]);
  rows[smallest]=sourceSfxNormalize3(rows[smallest]);
  const [a,b,c]=rows;
  const determinant=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  if(determinant<0)scale[largest]=-scale[largest];
  return scale;
}

export function sourceSfxExtraScaleMatrix(matrix,externalScale){
  if(!Array.isArray(externalScale)||externalScale.length!==3||externalScale.some(x=>!Number.isFinite(x)))throw new TypeError('Source externalScale required');
  const signed=sourceSfxSignedScale(matrix),result=matrix.map(f32);
  for(let i=0;i<3;i++){
    const axis=sourceSfxNormalize3(matrix.slice(4*i,4*i+3));
    const scale=f32(f32(externalScale[i])*signed[i]);
    for(let j=0;j<3;j++)result[4*i+j]=f32(axis[j]*scale);
    result[4*i+3]=0;
  }
  return result;
}
