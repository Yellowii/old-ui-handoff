import {sourceSfxNormalize3} from './source-sfx-vector.js';

const f32=Math.fround,epsilon=f32(.0001),radians=0.01745329238474369,seconds=f32(.001);
const identityRotation=[1,0,0,0,1,0,0,0,1];
const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[...identityRotation],flags:0});
const copy=t=>({...t,translation:[...t.translation],scale:[...t.scale],rotation:[...t.rotation]});
const nearZero=v=>v.every(x=>x>=-epsilon&&x<=epsilon);
const int32=x=>Math.max(-2147483648,Math.min(2147483647,Math.trunc(x)));

// 2e72264..2e723a8: this is the engine's polynomial, not libm sincosf.
export function sourceSfxRotationSinCos(angle){
  angle=f32(angle);
  const turns=int32(f32(f32(angle*0.15915493667125702)+(angle<0?-.5:.5)));
  let x=f32(angle+f32(f32(turns)*-6.2831854820251465)),sign=1;
  if(x>1.5707963705062866){x=f32(3.1415927410125732-x);sign=-1;}
  else if(x< -1.5707963705062866){x=f32(-3.1415927410125732-x);sign=-1;}
  const x2=f32(x*x);
  const horner=coefficients=>coefficients.reduce((value,c)=>f32(f32(x2*value)+c));
  const sin=f32(x*horner([-2.388985897994189e-8,2.7525561563379597e-6,-.00019840874301735312,.008333330973982811,-.1666666716337204,1]));
  const cos=f32(sign*horner([-2.605161455448979e-7,2.47604948526714e-5,-.0013888378161936998,.04166663810610771,-.5,1]));
  return {sin,cos};
}

// Products of float32 operands are exact in double. Correct the rare halfway
// case after double addition so the result has the source FMLA/FMLS rounding.
const bits=new DataView(new ArrayBuffer(4));
function nextFloat(value,direction){
  if(value===0)return direction>0?2**-149:-(2**-149);
  bits.setFloat32(0,value);let word=bits.getUint32(0);
  word+=(value>0)===(direction>0)?1:-1;
  bits.setUint32(0,word);return bits.getFloat32(0);
}
function fused(a,b,c){
  const product=a*b,sum=product+c,rounded=f32(sum);
  const virtualC=sum-product;
  const error=(product-(sum-virtualC))+(c-virtualC);
  if(!error||!Number.isFinite(rounded)||sum===rounded)return rounded;
  const direction=Math.sign(sum-rounded),other=nextFloat(rounded,direction);
  if(sum===(rounded+other)/2)return Math.sign(error)===direction?other:rounded;
  return rounded;
}

// 2e723ac..2e724bc, row-vector Rodrigues basis with original multiply order.
export function sourceSfxAxisRotation(axis,angle){
  const [x,y,z]=axis,{sin,cos}=sourceSfxRotationSinCos(angle),t=f32(1-cos);
  const diagonal=axis.map(a=>fused(a,f32(a*t),cos));
  const yz=f32(z*f32(y*t)),zx=f32(x*f32(z*t)),xy=f32(y*f32(x*t));
  return [diagonal[0],fused(z,sin,xy),fused(-y,sin,zx),
    fused(-z,sin,xy),diagonal[1],fused(x,sin,yz),
    fused(y,sin,zx),fused(-x,sin,yz),diagonal[2]];
}

// SFX-specific TrackRotate initializer 2e71fb8 -> 2e71da4. Motion mode is
// linear regardless of XML CycleType; generic clock wrapping remains separate.
export function compileSourceSfxRotateProfile(attributes){
  const number=(value,name)=>{const n=Number(value);if(value==null||!Number.isFinite(n))throw new TypeError(`${name} required`);return f32(n);};
  const duration=number(attributes.TimeLen,'TimeLen'),cycle=number(attributes.CycleType,'CycleType');
  if(![0,1,2].includes(cycle)||duration<0)throw new RangeError('Unresolved Rotate duration/cycle');
  let axis=[0,0,0],start=0,delta=0,coefficient=0,period=0;
  if(duration!==0){
    const values=typeof attributes.AxesDir==='string'?JSON.parse(attributes.AxesDir):attributes.AxesDir;
    if(!Array.isArray(values)||values.length!==3)throw new TypeError('AxesDir requires three components');
    axis=values.map(x=>number(x,'AxesDir'));
    // Both the SFX adapter and the internal initializer normalize nonzero axes.
    if(!nearZero(axis))axis=sourceSfxNormalize3(axis);
    if(!nearZero(axis))axis=sourceSfxNormalize3(axis);
    start=f32(number(attributes.StartAngle,'StartAngle')*radians);
    delta=f32(f32(number(attributes.EndAngle,'EndAngle')*radians)-start);
    if(Math.abs(delta)>=epsilon){
      const durationSeconds=f32(f32(duration*1000)*seconds);
      coefficient=f32(f32(delta/durationSeconds)*seconds);
      period=f32(durationSeconds*1000);if(cycle===1)period=f32(period+period);
    }
  }
  const isStatic=period===0;
  const angleAt=time=>{
    if(isStatic)return start;
    const t=f32(time);let phase;
    if(cycle===0)phase=f32(t-f32(period*f32(int32(f32(t/period)))));
    else if(cycle===1){const q=f32(t/period);phase=f32(period*(q<.5?q:f32(1-q)));}
    else phase=Math.min(period,t);
    return f32(start+f32(phase*coefficient));
  };
  return {kind:'TrackRotate',periodMilliseconds:period,loop:duration===0||cycle!==2,isStatic,angleAt,
    sample(time,previousTransform){
      // 2e7224c exits without writing TRS when every axis component is near zero.
      if(nearZero(axis))return previousTransform?copy(previousTransform):identity();
      const result=identity();result.rotation=sourceSfxAxisRotation(axis,angleAt(time));
      result.flags=result.rotation.every((x,i)=>Object.is(x,identityRotation[i]))?0:2;
      return result;
    },
  };
}
