/* Product-oriented, code-native 3D preview. Geometry is projected and depth
 * sorted, not an image or a hardware wiring diagram. RGBW has one logical
 * four-channel output with a reference-style four-way physical splitter;
 * actual enclosure and connector positions are unconfirmed.
 * The SPI enclosure/port positions are indicative.
 * No timers, transport, state persistence or physical identification commands.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningReceiverVisual=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RED='#C94E46',INK='#393C3B',SILVER='#E4E5E1';
  // Only the most recent geometry for each live canvas is retained. Animation
  // time and lighting pulses remain per-frame; no app state is cached here.
  const sceneCache=new WeakMap();
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,Number(value)||0));
  const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const mod=(value,divisor)=>((value%divisor)+divisor)%divisor;
  function outline(x,y,w,h,bevel,samples=5){
    const radius=Math.max(.2,Math.min(bevel,w/2,h/2));
    return [[x+w-radius,y+radius,-Math.PI/2],[x+w-radius,y+h-radius,0],
      [x+radius,y+h-radius,Math.PI/2],[x+radius,y+radius,Math.PI]].flatMap(([cx,cy,start])=>
      Array.from({length:samples},(_,index)=>{const angle=start+index/(samples-1)*Math.PI/2;return [cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius];}));
  }
  function box(result,id,x,y,z,w,h,depth,material=SILVER,bevel=4){
    const shoulder=Math.min(2.2,depth*.22),inset=Math.min(1.8,depth*.2);
    const section=(offset,height)=>outline(x+offset,y+offset,w-offset*2,h-offset*2,Math.max(.6,bevel-offset),result.compact?3:5).map(([a,b])=>[a,b,z+height]);
    const rings=result.compact?[section(0,0),section(inset,depth)]:[section(inset,0),section(0,shoulder),section(0,depth-shoulder),section(inset,depth)];
    const roof=rings[rings.length-1],faces=[{points:roof,fill:material,surface:'top'}];
    rings.slice(0,-1).forEach((base,index)=>base.forEach((p,i)=>faces.push({points:[p,base[(i+1)%base.length],rings[index+1][(i+1)%base.length],rings[index+1][i]],fill:material,surface:index===1?'side':'bevel'})));
    const overlay=['spi-inset','controller-cover','power-label'].includes(id);
    result.meshes.push({id,kind:'faceted-body',overlay,footprint:rings[0],vertices:rings.flat(),faces});
  }
  function cylinder(result,id,x,y,z,radius,length,active=false,axis='y'){
    const segments=result.compact?12:28;
    const ring=(distance,r)=>Array.from({length:segments},(_,i)=>axis==='x'
      ?[x+distance,y+Math.cos(i/segments*Math.PI*2)*r,z+Math.sin(i/segments*Math.PI*2)*r]
      :[x+Math.cos(i/segments*Math.PI*2)*r,y+distance,z+Math.sin(i/segments*Math.PI*2)*r]);
    const sections=result.compact?[[0,.65],[.2,.65],[.32,1],[1,.88]]:axis==='x'?[[0,.62],[.22,.62],[.28,.88],[.48,.88],[.54,1],[.90,1],[.95,.93],[1,.88]]:[[0,.72],[.2,.72],[.24,.96],[.35,.96],[.4,1],[.88,1],[.94,.92],[1,.88]];
    const rings=sections.map(([distance,r])=>ring(distance*length,r*radius)),faces=[];
    const splitter=id==='splitter-hub';
    rings.slice(0,-1).forEach((a,section)=>{const b=rings[section+1];a.forEach((p,i)=>faces.push({points:[p,a[(i+1)%segments],b[(i+1)%segments],b[i]],fill:splitter?(section<2?'#424742':'#B5BBB2'):section<2?'#626760':section===5?(active?'#DDA9A1':'#D2D6CE'):'#F2F2EC'}));});
    faces.push({points:rings[rings.length-1],fill:splitter?'#A2AAA0':'#E5E8E0',surface:'end'});
    result.meshes.push({id,kind:'round-connector',axis,active,vertices:rings.flat(),faces});
    result.rings.push({id,axis,hub:splitter,center:axis==='x'?[x+length+.4,y,z]:[x,y+length+.4,z],radius:radius*.62,active});
  }
  function cable(result,id,points,width=4,active=false,color=INK){result.cables.push({id,points,controlPoints:points.controlPoints,width,active,color});}
  function curve(a,b,c,d){
    const points=Array.from({length:33},(_,i)=>{const t=i/32,u=1-t;return a.map((v,j)=>u*u*u*v+3*u*u*t*b[j]+3*u*t*t*c[j]+t*t*t*d[j]);});
    points.controlPoints=[a,b,c,d];return points;
  }
  function pointOnCable(cable,amount){
    const t=clamp(amount,0,1),u=1-t;
    if(cable.controlPoints){const [a,b,c,d]=cable.controlPoints;return a.map((v,j)=>u*u*u*v+3*u*u*t*b[j]+3*u*t*t*c[j]+t*t*t*d[j]);}
    const at=t*(cable.points.length-1),first=Math.floor(at);
    return lerp(cable.points[first],cable.points[Math.min(first+1,cable.points.length-1)],at-first);
  }
  function rgbw(result,options){
    box(result,'power-supply',-133,-135,0,277,29,23,'#F2F2EF',3);
    box(result,'power-left-cap',-135,-135,0,22,29,24,'#E6E7E3',3);
    box(result,'power-right-cap',122,-135,0,25,29,24,'#E6E7E3',3);
    box(result,'controller',-80,16,0,157,59,22,'#E9ECE6',9);
    box(result,'controller-cover',-60,19,22,104,53,1.2,'#F7F7F2',3.5);
    box(result,'controller-left-cap',-78,19,22,18,53,1,'#E5E7E1',5);
    box(result,'controller-end',45,19,21,29,53,2,'#E5E7E1',8);
    box(result,'power-label',-90,-125,23.1,21,7,.4,'#434645',1);
    cable(result,'power-to-controller',curve([145,-120,11],[280,-70,1],[180,153,1],[77,49,11]),4.8,false,'#D8DBD4');
    // The reference assembly has a loop from the controller into a small
    // splitter and four matching white plugs. They are one RGBW light output,
    // not four selectable ports or a diagram of the internal PWM wiring.
    cable(result,'controller-to-splitter',curve([-80,44,11],[-180,40,5],[-238,76,5],[-190,136,9]),5.2,options.identifying,'#DDE0D7');
    box(result,'splitter-hub',-194,127,0,23,22,18,'#DDE2D6',4);
    result.meshes[result.meshes.length-1].active=Boolean(options.identifying);
    const ends=[[-25,226],[10,218],[45,210],[80,202]];
    ends.forEach(([x,y],index)=>{
      const origin=[-170,139+index*1.2,9],target=[x,y,9];
      cable(result,'splitter-branch-'+(index+1),curve(origin,
        [-116,149+index*1.2,6],[x-42,y-23,6],target),3.2,options.identifying,'#DDE0D7');
      cylinder(result,'rgbw-plug-'+(index+1),x,y,9,8.3,21,options.identifying,'x');
    });
    result.seams.push([[-59,20,24],[-59,71,24]],[[44,20,24],[44,71,24]],
      [[-114,-133,24],[-114,-108,24]],[[122,-133,24],[122,-108,24]],
      [[-59,71,23],[44,71,23]],[[-113,-109,23],[121,-109,23]]);
    result.screws.push(...[[-70,25,24],[-70,66,24],[67,25,24],[67,66,24],[-127,-124,25],[137,-116,25]].map(point=>({point,radius:1.65})));
    result.indicators.push({id:'receiver-status',point:[57,43,24],radius:2.5,active:options.identifying});
    result.labels.push({text:'ALUVISION',point:[-8,35,24.4],size:7,color:'#738078'},
      {text:'RGBW',point:[-8,51,24.4],size:12,color:'#46514A'});
    // RGBW is one logical line: identification always covers the whole path.
    for(const item of [...result.meshes,...result.rings,...result.cables])item.identifying=Boolean(item.active&&options.identifying);
    result.metadata={type:'RGBW',logicalOutputs:1,physicalConnectors:4,selectedPort:null,
      activePorts:[],identifyingPorts:[],identifying:Boolean(options.identifying),reference:'rgbw-four-way-reference',
      physicalPositionsConfirmed:false,label:'RGBW-receiver · één uitgang',
      description:'Vier fysieke stekkers aan één RGBW-uitgang; alle vier volgen hetzelfde lichtgedrag.'};
  }
  function spi(result,options){
    const validPort=port=>Number.isInteger(port)&&port>=1&&port<=4;
    const enabled=new Set((Array.isArray(options.enabledPorts)?options.enabledPorts.map(Number):[1,2,3,4]).filter(validPort));
    const selected=Number.isInteger(Number(options.selectedPort))&&Number(options.selectedPort)>=1&&Number(options.selectedPort)<=4?Number(options.selectedPort):null;
    // An explicit target list must not follow the currently selected port.
    // Keeping the boolean as the master switch makes stopping identification
    // safe even when a caller retains its previous list. Omitted lists preserve
    // the selected-port/all-ports onboarding behaviour.
    const requested=Array.isArray(options.identifyingPorts)?options.identifyingPorts.map(Number):selected===null?[...enabled]:[selected];
    const identifyingPorts=options.identifying?[...new Set(requested)].filter(port=>validPort(port)&&enabled.has(port)).sort((a,b)=>a-b):[];
    const identifying=new Set(identifyingPorts);
    // Authorized concept in the same family as the supplied RGBW casing:
    // warm neutral cover, chamfered shell and separate rounded end caps.
    // Four direct outputs remain structurally different from the RGBW splitter.
    box(result,'spi-controller',-88,-80,0,176,68,25,'#E9ECE6',10);
    box(result,'spi-inset',-66,-75,25,130,56,1.6,'#F7F7F2',5);
    box(result,'spi-left-cap',-85,-77,24,16,62,1.4,'#E1E5DC',7);
    box(result,'spi-right-cap',68,-77,24,17,62,1.4,'#E1E5DC',7);
    result.seams.push([[-68,-73,26],[-68,-20,26]],[[66,-73,26],[66,-20,26]]);
    result.screws.push(...[[-77,-65,27],[-77,-27,27],[78,-65,27],[78,-27,27]].map(point=>({point,radius:2})));
    const activePorts=[],highlightedPorts=[];
    for(let port=1;port<=4;port++){
      const x=-57+(port-1)*38,identified=identifying.has(port),highlighted=selected===port||identified;
      // Enabled LED lines stay visible together. Selection highlights the
      // connector being edited; it must never hide another enabled output.
      const active=enabled.has(port);
      if(highlighted)highlightedPorts.push(port);
      if(active)activePorts.push(port);
      cylinder(result,'spi-port-'+port,x,-13,14,8.5,19,highlighted);
      result.meshes[result.meshes.length-1].identifying=identified;
      result.rings[result.rings.length-1].identifying=identified;
      const lineX=x*1.10;
      const cablePoints=curve([x,6,14],[x,34,7],[lineX,52,3],[lineX,80,3]);
      cable(result,'spi-cable-'+port,cablePoints,3.4,active,'#DDE0D7');
      result.cables[result.cables.length-1].identifying=identified;
      result.strips.push({port,active,identifying:identified,points:outline(lineX-4,80,8,73,2).map(([a,b])=>[a,b,2])});
      const pixels=Array.from({length:10},(_,i)=>({point:[lineX-2.5,85+i*6.5,2.25],active,identifying:identified,port,index:i}));
      result.pixels.push(...pixels);
      if(!options.compact)result.labels.push({text:String(port),point:[x,37,3],size:11,color:highlighted?RED:'#596159',port,active:highlighted});
    }
    result.labels.push({text:'ALUVISION',point:[0,-57,31],size:8,color:'#69746A'},
      {text:'SPI',point:[0,-39,31],size:15,color:'#333F36'});
    result.indicators.push({id:'receiver-status',point:[52,-46,31],radius:2.5,active:identifyingPorts.length>0});
    result.metadata={type:'SPI',logicalOutputs:4,physicalConnectors:4,selectedPort:selected,activePorts,highlightedPorts,
      enabledPorts:[...enabled].sort((a,b)=>a-b),identifyingPorts,identifying:identifyingPorts.length>0,portLabelsVisible:!options.compact,
      reference:'indicative-spi-model',physicalPositionsConfirmed:false,
      label:selected?`SPI-receiver · uitgang ${selected}`:'SPI-receiver · vier uitgangen',
      description:'Ontwerpvoorstel · vier afzonderlijke SPI-uitgangen.'};
  }
  function scene(options={}){
    const type=String(options.type||'RGBW').toUpperCase();
    if(type!=='RGBW'&&type!=='SPI')throw new Error('Unknown receiver visual type: '+type);
    const result={compact:Boolean(options.compact),meshes:[],cables:[],labels:[],rings:[],pixels:[],strips:[],indicators:[],screws:[],seams:[],metadata:{}};
    if(type==='RGBW')rgbw(result,options);else spi(result,options);
    result.renderFaces=result.meshes.flatMap(mesh=>mesh.faces.map(face=>({...face,
      material:shade(face.fill,face.points),overlay:mesh.overlay,kind:mesh.kind,active:mesh.active,identifying:mesh.identifying,
      center:[0,1,2].map(axis=>face.points.reduce((sum,point)=>sum+point[axis],0)/face.points.length)})));
    result.renderFaces.forEach((face,index)=>face.index=index);
    return result;
  }
  function projection(point,yaw){
    const [x,y,z]=point,a=x*Math.cos(yaw)-y*Math.sin(yaw),b=x*Math.sin(yaw)+y*Math.cos(yaw);
    // The viewer is above and in front of the assembly. Negative depth is
    // nearer (larger perspective scale); paint positive/far depths first.
    const depth=-b*.82-z*.58,factor=920/(920+depth);
    return {x:a*factor,y:(b*.58-z*.82)*factor,depth};
  }
  function shade(fill,points){
    const hex=String(fill).replace('#','');if(!/^[\da-f]{6}$/i.test(hex))return fill;
    const a=points[0],b=points[1],c=points[2],u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...normal)||1,light=[-.35,-.42,.84];
    const diffuse=Math.max(0,normal.reduce((sum,n,i)=>sum+n/length*light[i],0));
    const brightness=.79+.21*diffuse;
    const channels=[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*brightness));
    return `rgb(${channels.join(',')})`;
  }
  function draw(canvas,options={}){
    const key=JSON.stringify([String(options.type||'RGBW').toUpperCase(),options.selectedPort,options.enabledPorts,Boolean(options.identifying),options.identifyingPorts,Boolean(options.compact)]);
    let cached=sceneCache.get(canvas);
    if(!cached||cached.key!==key){cached={key,model:scene(options)};sceneCache.set(canvas,cached);}
    const model=cached.model,ctx=canvas.getContext('2d');if(!ctx)return model.metadata;
    const width=Math.max(1,canvas.clientWidth||canvas.width||400),height=Math.max(1,canvas.clientHeight||canvas.height||240);
    const dpr=typeof devicePixelRatio==='number'?Math.min(2,devicePixelRatio):1;
    if(canvas.width!==Math.round(width*dpr))canvas.width=Math.round(width*dpr);
    if(canvas.height!==Math.round(height*dpr))canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const time=options.reducedMotion?0:Number(options.time)||0;
    const entrance=options.reducedMotion?1:options.entranceProgress===undefined?1:clamp(options.entranceProgress,0,1);
    const reveal=1-Math.pow(1-entrance,3);
    const yaw=(model.metadata.type==='RGBW'?.82:-.14)+(options.reducedMotion||options.compact?0:Math.sin(time*.38)*.018);
    const points=model.meshes.flatMap(m=>m.vertices).concat(model.cables.flatMap(c=>c.points),model.pixels.map(p=>p.point),model.strips.flatMap(strip=>strip.points));
    const projected=points.map(point=>projection(point,yaw));
    const bounds={minX:Math.min(...projected.map(p=>p.x))-12,maxX:Math.max(...projected.map(p=>p.x))+12,minY:Math.min(...projected.map(p=>p.y))-14,maxY:Math.max(...projected.map(p=>p.y))+16};
    const pad=options.compact?5:14;
    const scale=Math.max(.001,Math.min((width-pad*2)/(bounds.maxX-bounds.minX),(height-pad*2)/(bounds.maxY-bounds.minY)))*(.965+.035*reveal);
    const dx=(width-(bounds.maxX-bounds.minX)*scale)/2-bounds.minX*scale,dy=(height-(bounds.maxY-bounds.minY)*scale)/2-bounds.minY*scale+(1-reveal)*Math.min(4,pad/2);
    const project=point=>{const p=projection(point,yaw);return [p.x*scale+dx,p.y*scale+dy,p.depth];};
    const pulse=options.reducedMotion?1:.82+(1+Math.sin(time*1.6))/2*.18;
    const identifyLevel=options.reducedMotion?1:.16+.84*(.5-.5*Math.cos(time*4.4));
    const identificationColor=`rgb(${[0,1,2].map(()=>Math.round(58+197*identifyLevel)).join(',')})`;
    function path(world,close=false){ctx.beginPath();world.forEach((point,i)=>{const p=project(point);if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);});if(close)ctx.closePath();}
    function cablePath(cable){
      if(!cable.controlPoints||typeof ctx.bezierCurveTo!=='function'){path(cable.points);return;}
      const [a,b,c,d]=cable.controlPoints.map(project);ctx.beginPath();ctx.moveTo(a[0],a[1]);
      ctx.bezierCurveTo(b[0],b[1],c[0],c[1],d[0],d[1]);
    }
    const faces=model.renderFaces;
    for(const face of faces)face.depth=(face.overlay?-1000:0)+projection(face.center,yaw).depth;
    faces.sort((a,b)=>b.depth-a.depth||a.index-b.index);
    // Ground the actual footprint rather than a large floating oval. The
    // shell and cable geometry stays shared by every app illustration.
    for(const mesh of model.meshes.filter(m=>['power-supply','controller','spi-controller'].includes(m.id))){
      ctx.save();path(mesh.footprint.map(([x,y])=>[x,y,-2]),true);
      ctx.fillStyle='rgba(35,39,32,.09)';ctx.shadowColor='rgba(35,39,32,.18)';ctx.shadowBlur=Math.max(2,7*scale);ctx.shadowOffsetY=2.5*scale;ctx.fill();ctx.restore();
    }
    // Cables rest on the assembly plane, followed by depth-sorted 3D faces.
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const cable of model.cables){
      cablePath(cable);ctx.strokeStyle='rgba(62,67,56,.25)';ctx.lineWidth=(cable.width+1.2)*scale;ctx.stroke();
      cablePath(cable);ctx.strokeStyle=cable.identifying?identificationColor:cable.color;ctx.lineWidth=cable.width*scale;ctx.stroke();
      if(!options.compact){cablePath(cable);ctx.strokeStyle='rgba(255,255,252,.72)';ctx.lineWidth=Math.max(.3,cable.width*.28*scale);ctx.stroke();}
      if(cable.active&&!cable.identifying){cablePath(cable);ctx.strokeStyle=`rgba(201,78,70,${pulse*.6})`;ctx.lineWidth=Math.max(.5,.8*scale);ctx.stroke();}
      if(cable.active&&!cable.identifying){
        const at=options.reducedMotion?.6:mod(time*.24,1),p=project(pointOnCable(cable,at));
        ctx.beginPath();ctx.arc(p[0],p[1],Math.max(1,1.6*scale),0,Math.PI*2);ctx.fillStyle='#FFF4EB';ctx.shadowColor=RED;ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;
      }
    }
    for(const strip of model.strips){
      path(strip.points,true);ctx.fillStyle=strip.active?'#28362E':'#D7DDD5';ctx.fill();ctx.strokeStyle=strip.active?'#79877B':'#BAC3B8';ctx.lineWidth=Math.max(.4,.65*scale);ctx.stroke();
    }
    for(const face of faces){
      path(face.points,true);let material=face.identifying?identificationColor:face.material;
      if(face.surface==='top'&&!face.identifying&&!options.compact&&typeof ctx.createLinearGradient==='function'){
        const points=face.points.map(project),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
        const gradient=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
        if(gradient&&typeof gradient.addColorStop==='function'){
          gradient.addColorStop(0,face.fill);gradient.addColorStop(.4,face.fill);gradient.addColorStop(1,material);material=gradient;
        }
      }
      ctx.fillStyle=material;ctx.fill();
      // Internal mesh edges made the old model look like a wireframe. Only
      // the actual cover/end contour receives a fine, restrained seam.
      if(face.surface==='top'||face.surface==='end'){
        ctx.strokeStyle=face.surface==='top'?'rgba(96,107,91,.22)':'rgba(68,77,62,.24)';
        ctx.lineWidth=Math.max(.25,.4*scale);ctx.stroke();
      }
    }
    for(const ring of model.rings){
      const points=Array.from({length:24},(_,i)=>ring.axis==='x'
        ?[ring.center[0],ring.center[1]+Math.cos(i/24*Math.PI*2)*ring.radius,ring.center[2]+Math.sin(i/24*Math.PI*2)*ring.radius]
        :[ring.center[0]+Math.cos(i/24*Math.PI*2)*ring.radius,ring.center[1],ring.center[2]+Math.sin(i/24*Math.PI*2)*ring.radius]);
      path(points,true);ctx.fillStyle=ring.hub?'#B7BFB2':ring.active?(ring.identifying?identificationColor:'#FFF3EC'):'#354136';ctx.fill();ctx.strokeStyle=ring.active?(ring.identifying?'#F4F7F0':RED):'#CFD6C9';ctx.lineWidth=Math.max(.6,1.25*scale);ctx.stroke();
      if(!ring.hub)for(const [ox,oz]of ring.axis==='x'?[[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]:[[-.3,-.2],[.3,-.2],[0,.35]]){
        const p=project(ring.axis==='x'?[ring.center[0]+.2,ring.center[1]+ox*ring.radius,ring.center[2]+oz*ring.radius]:[ring.center[0]+ox*ring.radius,ring.center[1]+.2,ring.center[2]+oz*ring.radius]);
        ctx.beginPath();ctx.arc(p[0],p[1],Math.max(.45,ring.radius*.12*scale),0,Math.PI*2);ctx.fillStyle=ring.active?RED:'#C4CEBD';ctx.fill();
      }
    }
    if(!options.compact)for(const seam of model.seams){path(seam);ctx.strokeStyle='rgba(74,84,66,.34)';ctx.lineWidth=Math.max(.35,.45*scale);ctx.stroke();}
    for(const pixel of model.pixels){
      const p=project(pixel.point),px=project([pixel.point[0]+1,pixel.point[1],pixel.point[2]]),py=project([pixel.point[0],pixel.point[1]+1,pixel.point[2]]);
      const traveling=options.reducedMotion?1:.24+.76*Math.pow(.5+.5*Math.cos((pixel.index/10-time*.32)*Math.PI*2),1.5);
      ctx.save();ctx.transform(px[0]-p[0],px[1]-p[1],py[0]-p[0],py[1]-p[1],p[0],p[1]);
      ctx.fillStyle=pixel.active?(pixel.identifying?identificationColor:`rgba(201,78,70,${Math.max(.4,traveling*pulse)})`):'#C6CFC7';
      ctx.shadowColor=pixel.identifying?'#FFFFFF':RED;ctx.shadowBlur=pixel.active?3.5*(pixel.identifying?identifyLevel:traveling):0;ctx.fillRect(0,0,5,4.3);ctx.restore();
    }
    for(const indicator of model.indicators){const p=project(indicator.point);ctx.beginPath();ctx.arc(p[0],p[1],Math.max(1,indicator.radius*scale),0,Math.PI*2);ctx.fillStyle='#D1DACB';ctx.fill();ctx.beginPath();ctx.arc(p[0],p[1],Math.max(.7,indicator.radius*.62*scale),0,Math.PI*2);ctx.fillStyle=indicator.active?identificationColor:'#7E9B82';ctx.fill();}
    if(!options.compact)for(const screw of model.screws){
      const rim=Array.from({length:12},(_,i)=>[screw.point[0]+Math.cos(i/12*Math.PI*2)*screw.radius,screw.point[1]+Math.sin(i/12*Math.PI*2)*screw.radius,screw.point[2]]);
      path(rim,true);ctx.fillStyle='#B9C2B8';ctx.strokeStyle='#8E9C8E';ctx.lineWidth=Math.max(.4,.5*scale);ctx.fill();ctx.stroke();
      path([[screw.point[0]-screw.radius*.6,screw.point[1],screw.point[2]+.1],[screw.point[0]+screw.radius*.6,screw.point[1],screw.point[2]+.1]]);ctx.strokeStyle='#647665';ctx.stroke();
    }
    for(const label of model.labels){
      if(options.compact)continue;
      const p=project(label.point);
      if(label.port){ctx.beginPath();ctx.arc(p[0],p[1],Math.max(7,10*scale),0,Math.PI*2);ctx.fillStyle='#F7F8F4';ctx.strokeStyle=label.active?RED:'#ACB7AC';ctx.lineWidth=label.active?1.4:.7;ctx.fill();ctx.stroke();}
      ctx.fillStyle=label.color;ctx.textAlign='center';ctx.textBaseline='middle';
      if(label.port){ctx.font=`750 ${Math.max(options.compact?6:8,label.size*scale)}px system-ui`;ctx.fillText(label.text,p[0],p[1]);}
      else{
        const px=project([label.point[0]+1,label.point[1],label.point[2]]),py=project([label.point[0],label.point[1]+1,label.point[2]]);
        ctx.save();ctx.transform(px[0]-p[0],px[1]-p[1],py[0]-p[0],py[1]-p[1],p[0],p[1]);
        ctx.font=`650 ${label.size}px system-ui`;ctx.fillText(label.text,0,0);ctx.restore();
      }
    }
    return {...model.metadata,projectedBounds:{width,height},motionReduced:Boolean(options.reducedMotion),entranceProgress:entrance,
      identificationLevel:model.metadata.identifying?identifyLevel:0};
  }
  return Object.freeze({scene,draw,version:'30-receiver-visual-5',isLocalPreview:true});
}));
