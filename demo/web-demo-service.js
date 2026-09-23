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
    const units=[
      {id:'demo-rgbw-1',rid:'D000000000000001',deviceFingerprint:'A'.repeat(64),type:'RGBW',name:'Demo RGBW 1'},
      {id:'demo-spi-1',rid:'D000000000000002',deviceFingerprint:'B'.repeat(64),type:'SPI',name:'Demo SPI 1'},
      {id:'demo-rgbw-2',rid:'D000000000000003',deviceFingerprint:'C'.repeat(64),type:'RGBW',name:'Demo RGBW 2'},
      {id:'demo-spi-2',rid:'D000000000000004',deviceFingerprint:'D'.repeat(64),type:'SPI',name:'Demo SPI 2'}
    ];
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
