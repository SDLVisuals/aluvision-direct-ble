/* Browser-only walkthrough for the separately published /demo/ page.
 * These receipts are IN-MEMORY UI fixtures, never receiver or ownership proof.
 * The native iPhone app and the public root page do not use this service. */
(function(root){
  'use strict';
  const path=root.location?.pathname||'';
  const native=root.__lightningV30NativeHost===true||root.location?.protocol==='file:'||root.LightningNativeRuntime?.native===true;
  const available=!native&&root.AluvisionSecurityMode?.pinRequired===false&&/(?:^|\/)demo\/(?:index\.html)?$/.test(path);
  const copy=value=>JSON.parse(JSON.stringify(value));
  function create(){
    if(!available)throw Error('WEB_DEMO_UNAVAILABLE');
    // /demo/ shares an origin with the public root. Never touch that origin's
    // localStorage or sessionStorage: the walkthrough resets on page reload.
    const memory=new Map();
    const storage=Object.freeze({
      getItem:key=>memory.has(String(key))?memory.get(String(key)):null,
      setItem:(key,value)=>{memory.set(String(key),String(value));},
      removeItem:key=>{memory.delete(String(key));},
      clear:()=>{memory.clear();}
    });
    // Ten of each family can be added during a walkthrough. Keep the original
    // four identities stable; the additional identities are deterministic UI
    // fixtures too, never physical device fingerprints or security evidence.
    const legacyFingerprints=['A','B','C','D'];
    const units=Array.from({length:20},(_,index)=>{
      const type=index%2?'SPI':'RGBW',number=Math.floor(index/2)+1;
      const serial=(index+1).toString(16).toUpperCase();
      return {
        id:`demo-${type.toLowerCase()}-${number}`,
        rid:`D${serial.padStart(15,'0')}`,
        deviceFingerprint:index<4?legacyFingerprints[index].repeat(64):serial.padStart(64,'0'),
        type,name:`Demo ${type} ${number}`
      };
    });
    const receipts=new Map();let serial=0;
    const receipt=(kind,configuration)=>{
      const receiptRef=`receipt:demo-walkthrough-${++serial}`;
      receipts.set(receiptRef,{kind,configuration:copy(configuration)});
      return {receiptRef};
    };
    return Object.freeze({
      factoryGuidePreview:true,
      // Fictional browser receipts: never LED, firmware, identity or ownership proof.
      previewCapabilities:Object.freeze({identifyPorts:true,power:false,editorIsolation:false}),
      previewPixels:async request=>{
        const r=request?.receiver,unit=units.find(u=>u.type==='SPI'&&u.id===r?.id&&u.rid===r?.rid&&u.deviceFingerprint===r?.deviceFingerprint);
        if(!unit||r.type!=='SPI'||!['start','update','stop'].includes(request.action)||
          !['standId','transactionId'].every(k=>typeof request[k]==='string'&&request[k].length>0&&request[k].length<=128)||
          !['main','node'].includes(request.role)||request.role==='main'&&request.mainReceiverId!==null||
          request.role==='node'&&request.mainReceiverId!==null&&!units.some(u=>u.id===request.mainReceiverId)||
          Object.keys(request).some(k=>!['action','standId','transactionId','receiver','role','mainReceiverId','guide','port','pixels','previewTTLMS','outputs'].includes(k)))throw Error('WEB_DEMO_PREVIEW_INVALID');
        const count=n=>Number.isInteger(n)&&n>=0&&n<=163,stopped=request.action==='stop';
        if(request.guide==='ports'){
          if(request.port!==null||request.pixels!==0||request.previewTTLMS!==12000||
            !Array.isArray(request.outputs)||request.outputs.length!==4||!root.LightningPixelSetup?.portPalette(request.outputs)||
            request.outputs.some((o,i)=>Object.keys(o).sort().join(',')!=='colour,enabled,pixels,port,reversed'||o.port!==i+1||typeof o.enabled!=='boolean'||typeof o.reversed!=='boolean'||!count(o.pixels)))throw Error('WEB_DEMO_PREVIEW_INVALID');
          const colours=['#ff0000','#0000ff','#ffff00','#ff1700'];
          return {applied:true,port:null,pixels:0,guide:'ports',previewTTLMS:stopped||!request.outputs.some(o=>o.enabled&&o.pixels>0)?0:12000,
            paletteVersion:5,outputs:request.outputs.map((o,i)=>({...o,colour:colours[i]})),demoOnly:true,hardwareAccess:false};
        }
        if(![undefined,'length'].includes(request.guide)||!Number.isInteger(request.port)||request.port<1||request.port>4||!count(request.pixels)||request.outputs!==undefined||request.previewTTLMS!==undefined)throw Error('WEB_DEMO_PREVIEW_INVALID');
        return {applied:true,port:request.port,pixels:request.pixels,guide:'length',previewTTLMS:stopped||!request.pixels?0:12000,demoOnly:true,hardwareAccess:false};
      },
      storage,
      search:async()=>({receivers:copy(units.map(unit=>({...unit,canConfigure:true,canVerifyIdentity:true})))}),
      select:async({receiver})=>copy(receiver),
      identifyFactoryMain:async()=>({confirmed:true,ttlMs:5000}),
      identifyCandidate:async()=>({confirmed:true,ttlMs:5000}),
      secure:async({configuration})=>receipt('security-confirmed',configuration),
      reconcileSecurity:async({configuration})=>receipt('security-confirmed',configuration),
      finalize:async({configuration})=>receipt('receiver-added',configuration),
      verifyFinalReceipt:async({receiptRef})=>{
        const proof=receipts.get(receiptRef);
        if(!proof)throw Error('DEMO_RECEIPT_UNKNOWN');
        return copy(proof);
      }
    });
  }
  root.LightningWebDemo=Object.freeze({available,create});
}(window));
