const POSE_STRIDE=10;

function normalized(x,y,z,w){
  const length=Math.hypot(x,y,z,w);
  return length?[x/length,y/length,z/length,w/length]:[0,0,0,0];
}

function multiply(ax,ay,az,aw,bx,by,bz,bw){
  return [
    aw*bx+ax*bw+ay*bz-az*by,
    aw*by-ax*bz+ay*bw+az*bx,
    aw*bz+ax*by-ay*bx+az*bw,
    aw*bw-ax*bx-ay*by-az*bz,
  ];
}

function outputFor(first,out){
  if(first.length%POSE_STRIDE)throw new RangeError('Source pose length must be a multiple of 10');
  if(out&&out.length!==first.length)throw new RangeError('Source pose output length mismatch');
  return out||new Float32Array(first.length);
}

// Poses are consecutive T3, Qxyzw4, S3 values. This is the source's local-space path.
export function generateAdditivePose(target,reference,out){
  if(target.length!==reference.length)throw new RangeError('Source pose length mismatch');
  out=outputFor(target,out);
  for(let i=0;i<target.length;i+=POSE_STRIDE){
    const tx=target[i],ty=target[i+1],tz=target[i+2],tqx=target[i+3],tqy=target[i+4],tqz=target[i+5],tqw=target[i+6],tsx=target[i+7],tsy=target[i+8],tsz=target[i+9];
    const rx=reference[i],ry=reference[i+1],rz=reference[i+2],rqx=reference[i+3],rqy=reference[i+4],rqz=reference[i+5],rqw=reference[i+6],rsx=reference[i+7],rsy=reference[i+8],rsz=reference[i+9];
    const q=normalized(...multiply(tqx,tqy,tqz,tqw,-rqx,-rqy,-rqz,rqw));
    out[i]=tx-rx;out[i+1]=ty-ry;out[i+2]=tz-rz;
    out[i+3]=q[0];out[i+4]=q[1];out[i+5]=q[2];out[i+6]=q[3];
    out[i+7]=tsx*(Math.abs(rsx)>1e-8?1/rsx:0)-1;
    out[i+8]=tsy*(Math.abs(rsy)>1e-8?1/rsy:0)-1;
    out[i+9]=tsz*(Math.abs(rsz)>1e-8?1/rsz:0)-1;
  }
  return out;
}

export function applyAdditivePose(base,delta,weight,out){
  if(base.length!==delta.length)throw new RangeError('Source pose length mismatch');
  out=outputFor(base,out);
  for(let i=0;i<base.length;i+=POSE_STRIDE){
    const bx=base[i],by=base[i+1],bz=base[i+2],bqx=base[i+3],bqy=base[i+4],bqz=base[i+5],bqw=base[i+6],bsx=base[i+7],bsy=base[i+8],bsz=base[i+9];
    const dx=delta[i],dy=delta[i+1],dz=delta[i+2],dqx=delta[i+3],dqy=delta[i+4],dqz=delta[i+5],dqw=delta[i+6],dsx=delta[i+7],dsy=delta[i+8],dsz=delta[i+9];
    let q=[bqx,bqy,bqz,bqw];
    if(weight>.001){
      const w=weight>=.999?1:weight;let x=dqx,y=dqy,z=dqz,scalar=dqw;
      if(w<1){
        const sign=scalar>1e-8?1:-1;x*=w;y*=w;z*=w;scalar=scalar*w+sign*(1-w);
        [x,y,z,scalar]=scalar*scalar>1e-8?normalized(x,y,z,scalar):[0,0,0,1];
      }
      if(w<1||scalar*scalar>1e-8)q=multiply(x,y,z,scalar,bqx,bqy,bqz,bqw);
      out[i]=bx+dx*w;out[i+1]=by+dy*w;out[i+2]=bz+dz*w;
      out[i+7]=bsx*(1+dsx*w);out[i+8]=bsy*(1+dsy*w);out[i+9]=bsz*(1+dsz*w);
    }else{
      out[i]=bx;out[i+1]=by;out[i+2]=bz;out[i+7]=bsx;out[i+8]=bsy;out[i+9]=bsz;
    }
    q=normalized(...q);out[i+3]=q[0];out[i+4]=q[1];out[i+5]=q[2];out[i+6]=q[3];
  }
  return out;
}
