import {sourceInverseSqrt} from './source-nstb-rsqrt.js';
import {projectSpatialContact,spatialVelocity} from './source-nstb-spatial.js';
// Android 0x33474b8/0x334508c/0x3344424. Source NSTB particle integration; angular/collision constraints are gated by the publisher.
const F=Math.fround,add=(a,b)=>F(a+b),sub=(a,b)=>F(a-b),mul=(a,b)=>F(a*b),div=(a,b)=>F(a/b),length=v=>F(Math.sqrt(add(add(mul(v[0],v[0]),mul(v[1],v[1])),mul(v[2],v[2]))));
export class SourcePbd {
 constructor(config){this.config=config;this.particles=config.particles.map(p=>({...p,mass:F(p.mass),damping:F(p.damping),drag:F(p.drag),area:F(p.area),position:p.position.map(F),velocity:p.velocity.map(F),force:[0,0,0],correction:[0,0,0]}));}
 step(delta){
  const c=this.config,dt=Math.max(Math.fround(.001),Math.min(1,Math.fround(Math.fround(delta)*Math.fround(c.speed))));
  for(const p of this.particles){
   p.previous=[...p.position];
   if(!p.mass)continue;
   const speed=length(p.velocity),square=add(add(mul(p.velocity[0],p.velocity[0]),mul(p.velocity[1],p.velocity[1])),mul(p.velocity[2],p.velocity[2]));
   const drag=Math.min(mul(square,mul(p.drag,p.area)),mul(div(mul(speed,p.mass),dt),F(.9))),damping=F(Math.pow(sub(1,p.damping),F(.3)));
   p.position=p.position.map((x,i)=>add(x,mul(add(mul(p.velocity[i],dt),mul(mul(mul(mul(add(p.force[i],speed?mul(mul(-p.velocity[i],sourceInverseSqrt(square)),drag):0),.5),div(1,p.mass)),dt),dt)),damping)));
   p.force.fill(0);
  }
  const iterations=Math.min(c.steps,Math.trunc(Math.fround(dt*1000))+1);
  let contacts=0;
  for(let pass=0;pass<iterations;pass++){
   for(const l of c.links){
   const a=this.particles[l.a],b=this.particles[l.b],ia=a.mass?div(1,a.mass):0,ib=b.mass?div(1,b.mass):0;
   if(ia+ib<=Math.fround(1e-4))continue;
   const d=a.position.map((x,i)=>sub(x,b.position[i])),len=length(d),base=mul(F(l.length),F(c.scale)),target=Math.max(mul(base,F(l.minimum)),Math.min(len,mul(base,F(l.maximum))));
   const correction=d.map(x=>len?mul(mul(mul(x,sourceInverseSqrt(add(add(mul(d[0],d[0]),mul(d[1],d[1])),mul(d[2],d[2])))),sub(len,target)),F(l.stiffness)):0);
   if(l.mode===1){b.position=b.position.map((x,i)=>add(x,correction[i]));a.correction=[...correction];}
   else if(l.mode===0){const inv=div(1,add(ia,ib));a.position=a.position.map((x,i)=>sub(x,mul(correction[i],mul(ia,inv))));b.position=b.position.map((x,i)=>add(x,mul(correction[i],mul(ib,inv))));}
   else throw Error('Unimplemented stretch mode');
   }
   // 33474b8: spatial constraints follow the stretch constraints each pass.
   // A particle with a contact is skipped until velocity response clears it.
   for(const spatial of c.spatialConstraints||[])for(const p of this.particles){
    if(!p.mass||p.contact)continue;
    p.contact=spatial.contact(p.previous,p.position);
    if(p.contact){p.position=projectSpatialContact(p.position,p.contact);contacts++;}
   }
  }
  for(const p of this.particles){
   let velocity=p.position.map((x,i)=>mul(sub(x,p.previous[i]),div(1,dt)));
   if(p.contact){velocity=spatialVelocity(velocity,p.contact,p.bounce,p.friction);p.contact=null;}
   p.velocity=velocity.map((x,i)=>sub(x,mul(mul(p.correction[i],div(1,dt)),F(.9))));
  }
  return {dt,iterations,contacts,states:this.particles.map(p=>({position:[...p.position],velocity:[...p.velocity],correction:[...p.correction],force:[...p.force]}))};
 }
}
