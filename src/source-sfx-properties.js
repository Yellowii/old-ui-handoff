const bit=value=>{
  if(typeof value==='boolean')return value;
  if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Source uint32 property value required');
  return !!(value&1);
};
const required=(fn,name)=>{if(typeof fn!=='function')throw new TypeError(`${name} required`);return fn;};

// Base468=2b5233c. renderBinding mirrors runtime e8, including sort bytes
// and object50/b8 shader-control pointer. Read live values after the manager call.
export function sourceSfxSetMode2d(node,value,hooks={}){
  const enabled=bit(value);node.flag83=enabled;
  let binding=node.renderBinding;
  if(!binding)return;
  const object=binding.object;
  if(!object)throw new TypeError('Source render binding object50 required');
  if(enabled){
    object.shaderControl=required(hooks.readMode2dShaderControl,'source mode2d shader control')();
    binding=node.renderBinding;
  }else object.shaderControl=null;
  binding.mode=enabled?0x30:0x24;
  const raw=node.renderPriority;
  if(!Number.isInteger(raw)||raw<0||raw>255)throw new TypeError('Source render priority byte required');
  binding.priority=Math.max(-15,Math.min(16,(raw<<24)>>24))+15;
  node.flag85=false;
}

// Group setters propagate through the full controller vector, not active count.
// Merge uses canonical length but indexes the mutable controller vector.
export function bindSourceSfxProperties(node,type,hooks={}){
  if(!['FxDummy','ParticlePoly','FxGroup'].includes(type))throw new RangeError('Confirmed source property type required');
  const group=type==='FxGroup';
  function children(method,value,canonicalLength=false){
    for(let i=0;i<(canonicalLength?node.canonicalControllers:node.controllers).length;i++){
      const child=node.controllers[i].node;required(child[method],`actor ${method}`).call(child,value);
    }
  }
  node.setMode2d=value=>{const enabled=bit(value);sourceSfxSetMode2d(node,enabled,hooks);if(group)children('setMode2d',enabled);};
  node.setCanMergeRender=value=>{const enabled=bit(value);node.flag84=enabled;if(group)children('setCanMergeRender',enabled,true);};
  node.setWholeScale=value=>{const enabled=bit(value);node.separateScale=enabled;if(group)children('setWholeScale',enabled);};
  node.setPauseWhenCulled=value=>{node.flag81=bit(value);}; //2b512b4, no child propagation.
  node.setInheritanceToken=value=>{
    if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new TypeError('Source uint32 inheritance token required');
    if(!Number.isInteger(node.inheritanceToken)||node.inheritanceToken<0||node.inheritanceToken>65535)throw new TypeError('Initialized source inheritance token required');
    value&=65535;if(node.inheritanceToken===value)return;
    node.inheritanceToken=value;
    if(group){ //2b643fc snapshots vector bounds but reads each live cell/token.
      const vector=node.controllers,count=vector.length;
      for(let i=0;i<count;i++)required(vector[i].node.setInheritanceToken,'actor inheritance setter').call(vector[i].node,node.inheritanceToken);
    }else if(node.renderBinding)node.renderBinding.inheritanceToken=value; //2b541dc.
  };
  return node;
}

// 2b63304..2b63444: after scene-listener registration and active counts.
// Group's initializer invokes base468/340 directly; invoking its group virtual
// here and then iterating children would incorrectly propagate twice.
export function initializeSourceSfxGroupProperties(group,attributes,hooks={}){
  function read(key,fallback){const v=attributes[key];if(v===undefined)return fallback;if(v===true||v==='true')return true;if(v===false||v==='false')return false;throw new TypeError(`Source boolean ${key} required`);}
  const mode=read('Mode2d',false),merge=read('CanMergeRender',true),whole=read('IsEnableWholeScale',false);
  sourceSfxSetMode2d(group,mode,hooks);
  for(let i=0;i<group.controllers.length;i++)group.controllers[i].node.setMode2d(mode);
  group.flag84=merge;
  for(let i=0;i<group.canonicalControllers.length;i++)group.controllers[i].node.setCanMergeRender(merge);
  group.separateScale=whole;
  for(let i=0;i<group.controllers.length;i++)group.controllers[i].node.setWholeScale(whole);
  group.flag81=read('PauseWhenCulled',false);
  return group;
}
