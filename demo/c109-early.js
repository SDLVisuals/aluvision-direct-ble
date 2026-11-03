/* C109: paint the right background before any stylesheet loads, so the app
 * never flashes white on a dark theme (cold start, reload). Reads only the
 * saved theme choice; everything else stays with the app. */
(function(){
  'use strict';
  let theme='system';
  try{const saved=JSON.parse(localStorage.getItem('aluvision.v30.ui-preferences.v1')||'null');if(saved&&['system','light','dark'].includes(saved.theme))theme=saved.theme;}catch(_){}
  const dark=theme==='dark'||(theme==='system'&&!!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const root=document.documentElement;
  root.style.backgroundColor=dark?'#131512':'#f5f4f2';root.style.colorScheme=dark?'dark':'light';
}());
