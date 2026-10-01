/* Video reconstruction, revision 1. Source timecodes and limitations are in
 * V31_VIDEO_ANIMATION_REANALYSIS_2026-09-26.md. This renderer is paired with
 * AluvisionReferenceEffectsV31.h; no random clocks or per-receiver restarts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LightningReferenceAnimations=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
  const mod=v=>((v%1)+1)%1, ease=v=>{const x=clamp(v);return x*x*(3-2*x);};
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const rgb=hex=>/^#[0-9a-f]{6}$/i.test(hex||'')?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):[0,0,0];
  const physical=(hex,w=0)=>[...rgb(hex),clamp(w,0,255)];
  const display=channels=>channels.slice(0,3).map(c=>Math.round(clamp(255-(255-c)*(1-channels[3]/255),0,255)));
  // Numeric IDs 1..30 belong to older releases. Never reuse them.
  const recipes=[
    [31,'sheet','Samen vooruit','tunnel','Een brede lichtbaan schuift tegelijk over alle ledlines.',1.55,['#DDD8FF'],1,'0–17,8 s','canopy'],
    [32,'stagger','Verspringende lichtstaarten','tunnel','Zachte lichtstaarten lopen naast elkaar, steeds iets verschoven.',2.2,['#E4DEFF'],1,'18–26,6 s','canopy'],
    [33,'ribbons','Kleurlinten','tunnel','Brede kleurbanen glijden over de lijnen met een heldere kop en zachte uitloop.',3,['#FF165B','#20DCE8','#AF20FF'],2,'0,8–8,9 s','canopy'],
    [34,'packets','Kleurpakketjes','tunnel','Korte gekleurde stukken volgen elkaar, met donkere ruimte ertussen.',2,['#115AFF','#17DDEB','#EE168A'],2,'9–13,3 / 17–26,8 s','canopy'],
    [35,'curtain','Kleur over de breedte','tunnel','Hele ledlines geven je kleuren van links naar rechts door.',7,['#14E72B','#FFFFFF','#F22C35'],2,'13,4–14,7 s','canopy'],
    [36,'fill','Zachte kleurvulling','tunnel','Alle lijnen lichten samen op, houden hun kleur vast en doven zacht.',6,['#FFA239'],2,'15–16,8 s','canopy'],
    [37,'amber','Amber waaier','tunnel','Een warme golf schuift over de opstelling, met een heldere kern.',4.8,['#FF741F','#FFE9AA'],3,'0–15 s','canopy'],
    [38,'outline','Contourloop','tunnel','Een helder stukje loopt langs elke contour, gevolgd door een donkere pauze.',.95,['#F3F0FF'],4,'0–14,8 s','frames'],
    [39,'warm-contour','Warme contour','brand','Een warm verlichte lijn met een langzaam reizend, helder accent.',6,['#FF842A','#FFF0C1'],3,'15–18,3 s','single'],
    [40,'silk','Zijden merklicht','brand','Een brede, zachte lichtgloed glijdt rustig door je merkkleuren.',16,['#C94E46','#F0B95F'],null,null,'single'],
    [41,'brand-ribbons','Vloeiende merklinten','brand','Je merkkleuren vloeien in lange banen over de lijn.',20,['#C94E46','#F0B95F','#FFFFFF'],null,null,'single'],
    [42,'brand-trail','Rustig merkaccent','brand','Een klein lichtaccent met een lange, zachte staart.',14,['#C94E46','#FFF1CE'],null,null,'single'],
    [43,'brand-outline','Contour in merkkleur','brand','Een rustig gekleurd segment tekent de lijn en laat weer ruimte vrij.',18,['#C94E46'],null,null,'single']
  ];
  const entries=recipes.map(([wire,key,name,category,description,seconds,colors,video,timecode,view])=>({
    id:'v31-ref-'+key,wire,name,category,family:category==='brand'?'Brand':'Tunnel',description,
    sourceVideo:video,sourceTimecode:timecode,referenceView:view,referenceVariant:video===null,
    spatialResolution:['curtain','fill'].includes(key)?'receiver':'pixel',minimumReceivers:category==='tunnel'?2:1,
    receiverTypes:['SPI'],paletteEditable:true,colorCountRange:{min:1,max:4},backgroundEditable:!['curtain','fill','silk','brand-ribbons','warm-contour'].includes(key),
    controls:['speed','smooth',...(['fill','curtain'].includes(key)?[]:['width']),...(['fill'].includes(key)?[]:['direction'])],
    directions:key==='fill'?[]:['forward','reverse'],firmwareSupport:'SPI-21.1.45',
    state:{engine:'V30',v30Effect:'v31-ref-'+key,variant:0,category,colors,whiteChannels:colors.map(()=>0),rgbEnabled:colors.map(()=>true),whiteEnabled:colors.map(()=>false),colorCount:colors.length,
      speed:30,smooth:100,width:50,fadeAmount:90,delayMs:0,direction:'forward',bri:100,brightness:100,on:true,power:true,brandColor:colors[0]},seconds
  }));
  const byId=new Map(entries.map(e=>[e.id,e]));
  const supports=id=>byId.has(id);
  const wireId=id=>byId.get(id)?.wire||0;
  const period=state=>{
    const base=byId.get(state.v30Effect)?.seconds||12;
    // Calibrated nominal video timing at 30%; slow end remains moving. The
    // calm Brand variants have their own long period, not a cosmetic label.
    return base*Math.pow(4,(30-clamp(state.speed??30,0,100))/50);
  };
  function catalog(type){return type==='SPI'?JSON.parse(JSON.stringify(entries)):[];}
  function palette(state){const cs=state.colors?.length?state.colors:['#FFFFFF'];return cs.slice(0,clamp(state.colorCount??cs.length,1,4)).map((c,i)=>physical(state.rgbEnabled?.[i]===false?'#000000':c,state.whiteEnabled?.[i]===false?0:state.whiteChannels?.[i]||0));}
  function sample(input){
    const state=input.state||{},entry=byId.get(state.v30Effect);
    if(!entry||input.receiverType!=='SPI'||state.on===false||state.power===false)return [0,0,0];
    const continuous=input.layout==='continuous',count=continuous?1:Math.max(1,input.receiverCount||1),index=continuous?0:clamp(input.receiverIndex||0,0,count-1);
    const pixels=Math.max(1,continuous?input.totalPixels:input.pixelCount),pixel=continuous?input.globalPixel:input.pixelIndex;
    let u=(clamp(pixel||0,0,pixels-1)+.5)/pixels;
    let y=count>1?index/(count-1):.5;
    if(['reverse','left'].includes(state.direction)){u=1-u;y=1-y;}
    const duration=period(state),raw=Math.max(0,Number(input.time)||0)/duration,smooth=clamp(state.smooth??100,0,100)/100;
    const time=Math.floor(raw*80)/80*(1-smooth)+raw*smooth,p=mod(time),w=clamp(state.width??50,0,100)/100;
    const colors=palette(state),cycle=Math.floor(time),at=x=>{const z=mod(x)*colors.length,i=Math.floor(z);return mix(colors[i],colors[(i+1)%colors.length],ease(z-i));};
    const soft=d=>ease(1-Math.abs(d)),pulse=(x,width)=>soft((mod(x+.5)-.5)/width);
    const band=(position,length,edge)=>ease((position-u)/edge)*ease((u-position+length)/edge);
    let color=colors[((cycle%colors.length)+colors.length)%colors.length],amount=0;
    const key=entry.wire;
    if(key===31){amount=band(p*2.15-.1,.72+w*.35,.06+w*.12);if(smooth){const x=clamp((1-p)/.08);amount*=clamp(x*x*x*(x*(x*6-15)+10));}}
    if(key===32||key===42){
      const offset=key===32?y*.6+Math.sin(y*Math.PI*2)*.1:0;
      const distance=mod(p-u*(key===32?1.7:1)-offset),length=.13+w*.32;
      amount=ease(1-distance/length)*ease(distance/.025);color=at(time*.25+y*.15);
    }
    if(key===33||key===41){
      const phase=p-u*.85-y*.2;
      amount=key===41?.65+.35*pulse(phase,.32+w*.16):.06+.94*pulse(phase,.2+w*.23);
      color=at(time*.22-u*.55-y*.16);
    }
    if(key===34){
      const travel=time*3-u*3-y*.38,distance=mod(travel),length=.18+w*.28;
      amount=ease(distance/.035)*ease((length-distance)/.13);color=colors[((Math.floor(travel)%colors.length)+colors.length)%colors.length];
    }
    if(key===35){
      const pos=mod(y*.78-p)*colors.length,i=Math.floor(pos),f=pos-i;
      color=mix(colors[i],colors[(i+1)%colors.length],ease((f-.82)/.18));amount=1;
    }
    if(key===36){amount=ease(p/.18)*(1-ease((p-.74)/.2));color=colors[cycle%colors.length];}
    if(key===37){
      // Sweeping oblique plane: both across the ceiling rows and along each
      // line. White-hot core comes from the chosen second colour, not forced W.
      const distance=mod(y*.65+u*.24-p+.5)-.5,radius=.16+w*.28;
      amount=.025+.975*soft(distance/radius);color=at(time*.12+.05+soft(distance/(radius*.42))*.45);
    }
    if(key===38||key===43){amount=band(p*2.6-.16,.36+w*.45,.025+w*.035);}
    if(key===39){const glow=pulse(u-p,.11+w*.3);amount=.22+.78*glow;color=mix(at(time*.25),at(time*.25+1/colors.length),glow);}
    if(key===40){const glow=pulse(u*.68-p,.22+w*.26);amount=.3+.7*glow;color=at(time*.16-u*.32);}
    const brightness=clamp(state.bri??state.brightness??100,0,100)/100;
    const background=state.backgroundOn?physical(state.backgroundRgbEnabled===false?'#000000':state.background||'#000000',state.backgroundWhiteEnabled===false?0:state.backgroundWhite||0).map(c=>c*clamp(state.bgBrightness??10,0,100)/100):[0,0,0,0];
    return display(mix(background,color.map(c=>c*brightness),clamp(amount)));
  }
  return Object.freeze({catalog,supports,wireId,period,sample,version:1});
});
