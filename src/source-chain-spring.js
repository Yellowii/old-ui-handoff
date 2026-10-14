import {Matrix4,Vector3,Quaternion} from 'three';

// Legacy type0 serial chain. Source: 2a01c5c, 29fed24, 2e9f718,
// 2e9d8f0 and 2a00470. Unsimulated bones keep their authored model matrices.
export class SourceChainSpring {
 constructor(config,matrices){
  this.config=config;
  const targets=this.targets(matrices);
  this.positions=[targets[0].back.clone(),...targets.map(t=>t.tip.clone())];
  this.velocities=this.positions.map(()=>new Vector3());this.forces=this.positions.map(()=>new Vector3());
  // 29fed24 reads immutable mesh bind transforms through 2c2055c when
  // creating link lengths. Enabling then seeds masses from the current pose
  // (29fc86c); an idle/add-pose frame must not redefine those rest lengths.
  const rest=config.bones.map(b=>{
   const m=new Matrix4().fromArray(b.initialMatrix),center=new Vector3().setFromMatrixPosition(m),axis=new Vector3().setFromMatrixColumn(m,0).normalize();
   return {back:center.clone().addScaledVector(axis,-b.halfLength),tip:center.clone().addScaledVector(axis,b.halfLength)};
  });
  const points=[rest[0].back,...rest.map(t=>t.tip)];this.lengths=rest.map((_,i)=>points[i+1].distanceTo(points[i]));
 }
 targets(matrices){return matrices.map((m,i)=>{
  const center=new Vector3().setFromMatrixPosition(m),axis=new Vector3().setFromMatrixColumn(m,0).normalize(),half=this.config.bones[i].halfLength*this.config.scale;
  return {center,axis,half,back:center.clone().addScaledVector(axis,-half),tip:center.clone().addScaledVector(axis,half)};
 });}
 step(matrices,delta){
  const c=this.config,targets=this.targets(matrices),count=matrices.length;
  const dt=Math.max(Math.fround(.002),Math.min(1,Math.fround(Math.fround(Math.min(Math.fround(delta),Math.fround(.033))*3)*c.speed)));
  for(let i=0;i<this.positions.length;i++){
   const p=this.positions[i],v=this.velocities[i],old=p.clone(),acc=this.forces[i].clone().addScaledVector(v,-Math.min(c.airFriction+c.idleFriction,1));
   p.addScaledVector(v,dt*c.damping).addScaledVector(acc,dt*dt);v.copy(p).sub(old).multiplyScalar(1/dt);this.forces[i].set(0,0,0);
  }
  const iterations=Math.floor(Math.fround(dt/Math.fround(.002)))+1;
  for(let pass=0;pass<iterations;pass++){
   this.positions[0].copy(targets[0].back);
   for(let i=0;i<count;i++){
    const a=this.positions[i],b=this.positions[i+1],link=b.clone().sub(a),length=link.length();
    if(!(length>0))throw Error('Degenerate source chain link');
    link.multiplyScalar((length-this.lengths[i]*c.scale)/length);
    if(i===0)b.sub(link);else{a.addScaledVector(link,.5);b.addScaledVector(link,-.5);}
   }
  }
  return matrices.map((matrix,i)=>{
   const t=targets[i],mixedBack=t.back.clone().lerp(this.positions[i],c.mix),mixedTip=t.tip.clone().lerp(this.positions[i+1],c.mix);
   this.forces[i+1].copy(t.tip).sub(mixedTip).multiplyScalar(c.stiffness*(1-i/count)*10);
   const from=t.tip.clone().sub(i===0?t.back:targets[i-1].tip).normalize(),to=mixedTip.clone().sub(mixedBack).normalize(),dot=from.dot(to),output=matrix.clone();
   if(Math.abs(dot)<Math.fround(.99999))output.premultiply(new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(from,to)));
   else if(dot<0)for(const column of [0,4,8])for(let j=0;j<3;j++)output.elements[column+j]*=-1;
   output.setPosition(mixedTip.clone().addScaledVector(new Vector3().setFromMatrixColumn(output,0).normalize(),-t.half));return output;
  });
 }
}
