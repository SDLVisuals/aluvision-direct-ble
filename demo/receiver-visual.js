/* Product-oriented, code-native 3D preview. Geometry is projected and depth
 * sorted, not an image or a hardware wiring diagram. RGBW now shows the new
 * single-output/four-channel MOSFET concept; actual enclosure is unconfirmed.
 * The SPI enclosure/port positions are indicative.
 * No timers, transport, state persistence or physical identification commands.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningReceiverVisual=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RED='#C94E46',INK='#393C3B',SILVER='#E4E5E1';
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,Number(value)||0));
  const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const mod=(value,divisor)=>((value%divisor)+divisor)%divisor;
  function outline(x,y,w,h,bevel){
    const radius=Math.max(.2,Math.min(bevel,w/2,h/2));
    return [[x+w-radius,y+radius,-Math.PI/2],[x+w-radius,y+h-radius,0],
      [x+radius,y+h-radius,Math.PI/2],[x+radius,y+radius,Math.PI]].flatMap(([cx,cy,start])=>
      Array.from({length:5},(_,index)=>{const angle=start+index/4*Math.PI/2;return [cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius];}));
  }
  function box(result,id,x,y,z,w,h,depth,material=SILVER,bevel=4){
    const base=outline(x,y,w,h,bevel).map(([a,b])=>[a,b,z]);
    const roof=outline(x+1.5,y+1.5,w-3,h-3,Math.max(1,bevel)).map(([a,b])=>[a,b,z+depth]);
    const overlay=['spi-inset','controller-cover','power-label'].includes(id);
    result.meshes.push({id,kind:'faceted-body',overlay,vertices:base.concat(roof),faces:[{points:roof,fill:material,surface:'top'},...base.map((v,i)=>({points:[v,base[(i+1)%base.length],roof[(i+1)%roof.length],roof[i]],fill:material,surface:'side'}))]});
  }
  function cylinder(result,id,x,y,z,radius,length,active=false,axis='y'){
    const ring=(distance,r)=>Array.from({length:20},(_,i)=>axis==='x'
      ?[x+distance,y+Math.cos(i/20*Math.PI*2)*r,z+Math.sin(i/20*Math.PI*2)*r]
      :[x+Math.cos(i/20*Math.PI*2)*r,y+distance,z+Math.sin(i/20*Math.PI*2)*r]);
    const sections=axis==='x'?[[0,.62],[.22,.62],[.28,.88],[.48,.88],[.54,1],[.94,1],[1,.88]]:[[0,.86],[1,1]];
    const rings=sections.map(([distance,r])=>ring(distance*length,r*radius)),faces=[];
    rings.slice(0,-1).forEach((a,section)=>{const b=rings[section+1];a.forEach((p,i)=>faces.push({points:[p,a[(i+1)%20],b[(i+1)%20],b[i]],fill:active?RED:axis==='x'&&section<2?'#515352':'#E6E7E3'}));});
    faces.push({points:rings[rings.length-1],fill:active?RED:'#707570',surface:'end'});
    result.meshes.push({id,kind:'round-connector',axis,active,vertices:rings.flat(),faces});
    result.rings.push({id,axis,center:axis==='x'?[x+length+.4,y,z]:[x,y+length+.4,z],radius:radius*.62,active});
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
    box(result,'controller',-80,16,0,157,59,22,'#ECEDE9',8);
    box(result,'controller-cover',-60,19,22,104,53,2,'#F5F5F1',3);
    box(result,'controller-left-cap',-78,19,22,18,53,1,'#E5E7E1',5);
    box(result,'controller-end',45,19,21,29,53,2,'#E5E7E1',8);
    box(result,'power-label',-90,-125,23.1,21,7,.4,'#434645',1);
    cable(result,'power-to-controller',curve([145,-120,11],[280,-70,1],[180,153,1],[77,49,11]),4.8,false,'#D8DBD4');
    // Conceptual signal path: one LED output fed by four PWM channels. Four
    // coloured wires are channels R/G/B/W, never four independently selectable
    // outputs. The module and terminal locations are not a physical pinout.
    cable(result,'controller-to-mosfet',curve([-80,44,11],[-170,56,5],[-198,134,5],[-150,145,10]),5.2,options.identifying,'#DDE0D7');
    box(result,'mosfet-module',-150,122,3,96,48,17,'#DDE1D9',5);
    box(result,'mosfet-cover',-145,126,20,86,40,1,'#EFF1EA',4);
    const channelColors=['#C94E46','#57A477','#5278BE','#DBDED6'];
    ['R','G','B','W'].forEach((channel,index)=>{
      const y=133+index*10;
      cable(result,'pwm-channel-'+channel,curve([-54,y,12],[-25,y-4,8],[-8,143+index*2,8],[10,148+index*1.5,8]),2.4,options.identifying,channelColors[index]);
      result.labels.push({text:channel,point:[-129+index*20,144,21.6],size:8,color:channelColors[index]});
    });
    cylinder(result,'rgbw-output',10,151,8,8.2,22,options.identifying,'x');
    box(result,'ledline-diffuser',35,146,2,172,10,5,'#E8E8DD',2);
    result.meshes[result.meshes.length-1].active=Boolean(options.identifying);
    result.seams.push([[-59,20,24],[-59,71,24]],[[44,20,24],[44,71,24]],
      [[-114,-133,24],[-114,-108,24]],[[122,-133,24],[122,-108,24]],
      [[-59,71,23],[44,71,23]],[[-113,-109,23],[121,-109,23]]);
    result.screws.push(...[[-70,25,24],[-70,66,24],[67,25,24],[67,66,24],[-127,-124,25],[137,-116,25],[-143,128,21],[-63,164,21]].map(point=>({point,radius:1.65})));
    result.indicators.push({id:'receiver-status',point:[57,43,24],radius:2.5,active:options.identifying});
    result.labels.push({text:'ALUVISION',point:[-8,35,24.4],size:7,color:'#738078'},
      {text:'RGBW',point:[-8,51,24.4],size:12,color:'#46514A'});
    // RGBW is one logical line: identification always covers the whole path.
    for(const item of [...result.meshes,...result.rings,...result.cables])item.identifying=Boolean(item.active&&options.identifying);
    result.metadata={type:'RGBW',logicalOutputs:1,physicalConnectors:1,selectedPort:null,
      activePorts:[],identifyingPorts:[],identifying:Boolean(options.identifying),reference:'conceptual-rgbw-mosfet',
      physicalPositionsConfirmed:false,label:'RGBW-receiver · één uitgang',
      description:'Schematisch voorbeeld: vier PWM-kleurkanalen sturen samen één RGBW-ledline aan.'};
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
    box(result,'spi-controller',-88,-80,0,176,68,26,'#E8EAE5',10);
    box(result,'spi-inset',-66,-75,26,130,56,3,'#F2F3EF',4);
    box(result,'spi-left-cap',-85,-77,25,16,62,1,'#D9DDD7',7);
    box(result,'spi-right-cap',68,-77,25,17,62,1,'#D9DDD7',7);
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
      const cablePoints=curve([x,6,14],[x,35,6],[x,53,2],[x,77,2]);
      cable(result,'spi-cable-'+port,cablePoints,3.1,active,enabled.has(port)?'#88988B':'#C4CCC4');
      result.cables[result.cables.length-1].identifying=identified;
      const pixels=Array.from({length:10},(_,i)=>({point:[x-2,86+i*6.5,2],active,identifying:identified,port,index:i}));
      result.pixels.push(...pixels);
      if(!options.compact)result.labels.push({text:String(port),point:[x,27,2],size:13,color:highlighted?RED:'#526159',port,active:highlighted});
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
    const result={meshes:[],cables:[],labels:[],rings:[],pixels:[],indicators:[],screws:[],seams:[],metadata:{}};
    if(type==='RGBW')rgbw(result,options);else spi(result,options);
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
    const brightness=.71+.29*diffuse;
    const channels=[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*brightness));
    return `rgb(${channels.join(',')})`;
  }
  function draw(canvas,options={}){
    const model=scene(options),ctx=canvas.getContext('2d');if(!ctx)return model.metadata;
    const width=Math.max(1,canvas.clientWidth||canvas.width||400),height=Math.max(1,canvas.clientHeight||canvas.height||240);
    const dpr=typeof devicePixelRatio==='number'?Math.min(2,devicePixelRatio):1;
    if(canvas.width!==Math.round(width*dpr))canvas.width=Math.round(width*dpr);
    if(canvas.height!==Math.round(height*dpr))canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const time=options.reducedMotion?0:Number(options.time)||0;
    const entrance=options.reducedMotion?1:options.entranceProgress===undefined?1:clamp(options.entranceProgress,0,1);
    const reveal=1-Math.pow(1-entrance,3);
    const yaw=(model.metadata.type==='RGBW'?.82:-.14)+(options.reducedMotion||options.compact?0:Math.sin(time*.38)*.018);
    const points=model.meshes.flatMap(m=>m.vertices).concat(model.cables.flatMap(c=>c.points),model.pixels.map(p=>p.point));
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
    const faces=model.meshes.flatMap(mesh=>mesh.faces.map(face=>({...face,
      kind:mesh.kind,active:mesh.active,identifying:mesh.identifying,
      depth:(mesh.overlay?-1000:0)+face.points.reduce((sum,p)=>sum+projection(p,yaw).depth,0)/face.points.length}))).sort((a,b)=>b.depth-a.depth);
    // A few feathered ellipses form soft grounding shadows without per-frame
    // canvas filters or offscreen texture allocations.
    for(const mesh of model.meshes.filter(m=>['power-supply','controller','spi-controller'].includes(m.id))){
      const footprint=mesh.vertices.map(([x,y])=>project([x,y,-5]));
      const xs=footprint.map(p=>p[0]),ys=footprint.map(p=>p[1]);
      const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
      const rw=(Math.max(...xs)-Math.min(...xs))*.46,rh=Math.max(2,(Math.max(...ys)-Math.min(...ys))*.34);
      for(let layer=6;layer>=1;layer--){ctx.beginPath();ctx.ellipse(cx,cy+2,rw+layer*1.7,rh+layer*.8,0,0,Math.PI*2);ctx.fillStyle=`rgba(36,53,40,${.009+(6-layer)*.002})`;ctx.fill();}
    }
    // Cables rest on the assembly plane, followed by depth-sorted 3D faces.
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const cable of model.cables){
      cablePath(cable);ctx.strokeStyle='rgba(52,61,55,.34)';ctx.lineWidth=(cable.width+1.5)*scale;ctx.stroke();
      cablePath(cable);ctx.strokeStyle=cable.active?(cable.identifying?identificationColor:`rgba(201,78,70,${pulse})`):cable.color;ctx.lineWidth=cable.width*scale;ctx.stroke();
      if(!options.compact&&!cable.active){cablePath(cable);ctx.strokeStyle='rgba(255,255,250,.34)';ctx.lineWidth=Math.max(.3,cable.width*.24*scale);ctx.stroke();}
      if(cable.active&&!cable.identifying){
        const at=options.reducedMotion?.6:mod(time*.24,1),p=project(pointOnCable(cable,at));
        ctx.beginPath();ctx.arc(p[0],p[1],Math.max(1.2,2.7*scale),0,Math.PI*2);ctx.fillStyle='#FFF1DD';ctx.shadowColor=RED;ctx.shadowBlur=7;ctx.fill();ctx.shadowBlur=0;
      }
    }
    for(const face of faces){
      path(face.points,true);let material=face.identifying?identificationColor:shade(face.fill,face.points);
      if(face.surface==='top'&&!face.identifying&&!options.compact&&typeof ctx.createLinearGradient==='function'){
        const points=face.points.map(project),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
        const gradient=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
        if(gradient&&typeof gradient.addColorStop==='function'){
          gradient.addColorStop(0,face.fill);gradient.addColorStop(.45,material);gradient.addColorStop(1,shade(face.fill,[[0,0,0],[0,1,0],[1,1,0]]));material=gradient;
        }
      }
      ctx.fillStyle=material;ctx.fill();
      // Internal mesh edges made the old model look like a wireframe. Only
      // the actual cover/end contour receives a fine, restrained seam.
      if(face.surface==='top'||face.surface==='end'){
        ctx.strokeStyle=face.surface==='top'?'rgba(68,78,69,.28)':'rgba(54,63,56,.3)';
        ctx.lineWidth=Math.max(.28,.55*scale);ctx.stroke();
      }
    }
    for(const ring of model.rings){
      const points=Array.from({length:24},(_,i)=>ring.axis==='x'
        ?[ring.center[0],ring.center[1]+Math.cos(i/24*Math.PI*2)*ring.radius,ring.center[2]+Math.sin(i/24*Math.PI*2)*ring.radius]
        :[ring.center[0]+Math.cos(i/24*Math.PI*2)*ring.radius,ring.center[1],ring.center[2]+Math.sin(i/24*Math.PI*2)*ring.radius]);
      path(points,true);ctx.fillStyle=ring.active?(ring.identifying?identificationColor:'#FAE9E2'):'#303D34';ctx.fill();ctx.strokeStyle=ring.active?(ring.identifying?'#E7EEE4':RED):'#CAD4C9';ctx.lineWidth=Math.max(.6,1.4*scale);ctx.stroke();
      if(ring.axis!=='x')for(const [ox,oz]of [[-.28,-.2],[.28,-.2],[0,.35]]){const p=project([ring.center[0]+ox*ring.radius,ring.center[1]+.2,ring.center[2]+oz*ring.radius]);ctx.beginPath();ctx.arc(p[0],p[1],Math.max(.45,ring.radius*.12*scale),0,Math.PI*2);ctx.fillStyle=ring.active?RED:'#ADBBAE';ctx.fill();}
    }
    if(!options.compact)for(const seam of model.seams){path(seam);ctx.strokeStyle='rgba(45,49,44,.55)';ctx.lineWidth=Math.max(.45,.6*scale);ctx.stroke();}
    for(const pixel of model.pixels){
      const p=project(pixel.point),next=project([pixel.point[0]+5,pixel.point[1]+4,pixel.point[2]]);
      const traveling=options.reducedMotion?1:.24+.76*Math.pow(.5+.5*Math.cos((pixel.index/10-time*.32)*Math.PI*2),1.5);
      ctx.fillStyle=pixel.active?(pixel.identifying?identificationColor:`rgba(201,78,70,${Math.max(.4,traveling*pulse)})`):'#C6CFC7';
      ctx.shadowColor=pixel.identifying?'#FFFFFF':RED;ctx.shadowBlur=pixel.active?5*(pixel.identifying?identifyLevel:traveling):0;ctx.fillRect(p[0],p[1],Math.max(2,Math.abs(next[0]-p[0])),Math.max(2,Math.abs(next[1]-p[1])));ctx.shadowBlur=0;
    }
    for(const indicator of model.indicators){const p=project(indicator.point);ctx.beginPath();ctx.arc(p[0],p[1],Math.max(1,indicator.radius*scale),0,Math.PI*2);ctx.fillStyle=indicator.active?identificationColor:'#91A597';ctx.fill();}
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
  return Object.freeze({scene,draw,version:'30-receiver-visual-4',isLocalPreview:true});
}));
