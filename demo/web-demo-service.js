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
