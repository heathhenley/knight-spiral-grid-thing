(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=64,t=4096,n=512,r=1,i=5,a=2,o={Knight:[2,1],Fers:[1,1],Vazir:[1,0],Camel:[3,1],Zebra:[3,2],Antelope:[4,3],Eland:[5,3],Satrap:[2,0],Aspbad:[2,2],Spehbed:[3,0],Marzban:[3,3]},s=Object.keys(o),c=[16724787,3368703,4499968,16755200,11163135];function l(e,t,n,r){return Number.isFinite(e)?Math.min(n,Math.max(t,Math.round(e))):r}function u(e){return s.includes(e)}function d(e,t,n,r){return e===null||e.trim()===``?r:l(Number(e),t,n,r)}function f(e,t){return Array.from({length:t},(e,t)=>t+1).filter(t=>t!==e)}function p(e,t,n){return[...new Set(e)].filter(e=>Number.isInteger(e)).filter(e=>e>=1&&e<=n&&e!==t).sort((e,t)=>e-t)}function m(e){return c[(e-1)%c.length]}function h(e){return`#${e.toString(16).padStart(6,`0`)}`}function g(e,t){if(!e)return t;let n=e.startsWith(`#`)?e.slice(1):e;return/^[0-9a-fA-F]{6}$/.test(n)?Number.parseInt(n,16):t}function _(e,t){return{moveKey:`Knight`,color:m(e),attackedBy:f(e,t)}}function v(){let o=new URLSearchParams(window.location.search),s=d(o.get(`size`),e,t,n),c=d(o.get(`pieces`),r,i,a),l=o.get(`moves`)?.split(`,`)??[],f=o.get(`colors`)?.split(`,`)??[],m=o.get(`attacks`)?.split(`|`)??[];return{gridSize:s,pieces:Array.from({length:c},(e,t)=>{let n=t+1,r=_(n,c),i=l[t]??``;return{moveKey:u(i)?i:r.moveKey,color:g(f[t]??null,r.color),attackedBy:m[t]===void 0?r.attackedBy:p(m[t].split(`,`).map(e=>Number(e)),n,c)}})}}function y(e){let t=new URLSearchParams(window.location.search);t.set(`size`,String(e.gridSize)),t.set(`pieces`,String(e.pieces.length)),t.set(`moves`,e.pieces.map(e=>e.moveKey).join(`,`)),t.set(`colors`,e.pieces.map(e=>h(e.color).slice(1)).join(`,`)),t.set(`attacks`,e.pieces.map(e=>e.attackedBy.join(`,`)).join(`|`)),window.history.replaceState(null,``,`${window.location.pathname}?${t}${window.location.hash}`)}function b(e,t){let n=document.getElementById(`piece-${e}-move`),r=n instanceof HTMLSelectElement&&u(n.value)?n.value:_(e,t).moveKey,i=document.getElementById(`piece-${e}-color`),a=i instanceof HTMLInputElement?g(i.value,m(e)):m(e),o=[];for(let n=1;n<=t;n++){if(n===e)continue;let t=document.getElementById(`piece-${e}-attacked-by-${n}`);(!(t instanceof HTMLInputElement)||t.checked)&&o.push(n)}return{moveKey:r,color:a,attackedBy:p(o,e,t)}}function x(e){return s.map(t=>{let[n,r]=o[t];return`<option value="${t}"${t===e?` selected`:``}>${t} (${n}, ${r})</option>`}).join(``)}function S(e,t,n){return Array.from({length:t},(e,t)=>t+1).filter(t=>t!==e).map(t=>`
        <label class="attack-option">
          <input
            id="piece-${e}-attacked-by-${t}"
            type="checkbox"
            ${n.includes(t)?` checked`:``}
          >
          Piece ${t}
        </label>
      `).join(``)}function C(){let a=v(),o=document.createElement(`form`);o.id=`controls`,o.innerHTML=`
    <div class="controls-header">
      <div>
        <h1>Simulation Controls</h1>
        <p>Shareable settings live in the URL.</p>
      </div>
      <button
        id="toggle-controls"
        class="secondary-button"
        type="button"
        aria-expanded="true"
        aria-controls="controls-body"
      >
        Hide
      </button>
    </div>
    <div id="controls-body">
      <div class="control-grid">
        <label>
          <span>Board</span>
          <input
            id="grid-size"
            type="number"
            min="${e}"
            max="${t}"
            step="64"
            value="${a.gridSize}"
          >
        </label>
        <div class="piece-count-control">
          <span>Pieces</span>
          <div class="piece-count-actions">
            <button id="remove-piece" class="secondary-button piece-count-button" type="button" aria-label="Remove piece">-</button>
            <output id="piece-count" aria-live="polite">${a.pieces.length}</output>
            <button id="add-piece" class="secondary-button piece-count-button" type="button" aria-label="Add piece">+</button>
          </div>
        </div>
      </div>
      <div id="piece-controls"></div>
      <button id="reset-simulation" type="submit">Reset Simulation</button>
    </div>
  `,document.body.appendChild(o);let s=document.getElementById(`grid-size`),c=document.getElementById(`controls-body`),u=document.getElementById(`toggle-controls`),d=document.getElementById(`piece-count`),f=document.getElementById(`remove-piece`),m=document.getElementById(`add-piece`),g=document.getElementById(`piece-controls`),C=document.getElementById(`reset-simulation`),w=a.pieces.length,T=()=>{let r=l(Number(s.value),e,t,n);return s.value=String(r),{gridSize:r,pieces:Array.from({length:w},(e,t)=>b(t+1,w))}},E=()=>{d.value=String(w),d.textContent=String(w),f.disabled=w<=r,m.disabled=w>=i},D=e=>{g.innerHTML=Array.from({length:w},(t,n)=>{let r=n+1,i=e?.[n]??b(r,w);return{...i,attackedBy:p(i.attackedBy,r,w)}}).map((e,t)=>{let n=t+1;return`
        <fieldset class="piece-control">
          <legend>
            <span class="piece-swatch" style="background: ${h(e.color)}"></span>
            Piece ${n}
          </legend>
          <div class="piece-fields">
            <label class="move-field">
              <span>Move</span>
              <select id="piece-${n}-move">
                ${x(e.moveKey)}
              </select>
            </label>
            <label class="color-field">
              <span>Color</span>
              <input
                id="piece-${n}-color"
                type="color"
                value="${h(e.color)}"
              >
            </label>
          </div>
          <div class="attacked-by-group">
            <span>Attacked by</span>
            <div class="attack-options">
              ${S(n,w,e.attackedBy)}
            </div>
          </div>
        </fieldset>
      `}).join(``),E()},O=e=>{o.classList.toggle(`is-collapsed`,e),c.hidden=e,u.textContent=e?`Show`:`Hide`,u.setAttribute(`aria-expanded`,String(!e))},k=e=>{let t=w,n=Array.from({length:t},(e,n)=>b(n+1,t));w=l(e,r,i,w),D(Array.from({length:w},(e,r)=>{let i=r+1,a=n[r]??_(i,w),o=w>t?Array.from({length:w-t},(e,n)=>t+n+1):[];return{...a,attackedBy:p([...a.attackedBy,...o],i,w)}})),y(T())};return u.addEventListener(`click`,()=>O(!o.classList.contains(`is-collapsed`))),f.addEventListener(`click`,()=>k(w-1)),m.addEventListener(`click`,()=>k(w+1)),o.addEventListener(`change`,()=>y(T())),D(a.pieces),O(window.matchMedia(`(max-width: 700px)`).matches),{form:o,resetButton:C,readConfig:T,writeConfigToUrl:y}}function w(e,t){return{x:e%t,y:Math.floor(e/t)}}function T(e,t){return D(w(e,t),t)}function E({x:e,y:t},n){let r=Math.floor(n/2),i=Math.floor(n/2);return{x:e+r,y:t+i}}function D({x:e,y:t},n){let r=Math.floor(n/2),i=Math.floor(n/2);return{x:e-r,y:t-i}}function O({x:e,y:t}){let n=Math.max(Math.abs(e),Math.abs(t));if(n===0)return 0;let r=(2*n-1)**2;return e===n&&t>=1-n?r+(t-(1-n)):t===n&&e>=-n?r+2*n+(n-1-e):e===-n&&t>=-n?r+4*n+(n-1-t):r+6*n+(e-(-n+1))}function k(e){let t=0;for(let n=0;n<e*e;n++)t=Math.max(t,O(T(n,e)));return t}function A(e){if(e===0)return{x:0,y:0};let t=Math.ceil((Math.sqrt(e+1)-1)/2),n=e-(2*t-1)**2;return n<2*t?{x:t,y:1-t+n}:n<4*t?{x:t-1-(n-2*t),y:t}:n<6*t?{x:-t,y:t-1-(n-4*t)}:{x:-t+1+(n-6*t),y:-t}}var j=1710618;function M(e,t,n){let r=t*4;e[r]=n>>16&255,e[r+1]=n>>8&255,e[r+2]=n&255,e[r+3]=255}function N(e,t){let n=E(e,t);return n.x<0||n.x>=t||n.y<0||n.y>=t?null:n.y*t+n.x}function P(e){if(e<1||e>32)throw Error(`Piece id ${e} cannot be stored in the attack mask`);return 2**(e-1)}function F(e,t){if(t===0)return!1;for(let n=1;n<=32;n++)if((t&P(n))!==0&&e.isAttackedBy(n))return!0;return!1}function I(e,t,n,r,i){let a=N(A(e),r);return a===null||n[a]!==0?!1:!F(t,i[a])}function L(e,t,n,r,i,a){let o=t;for(;o++<=a;)if(I(o,e,n,r,i))return o;return null}var R=class{context;canvas;pixelCanvas;pixelContext;imageData;requestAnimationFrameId=null;onResize=()=>this.resizeCanvas();onPointerDown=e=>this.startPan(e);onPointerMove=e=>this.pan(e);onPointerUp=e=>this.endPan(e);onWheel=e=>this.zoom(e);viewScale=1;viewOffsetX=0;viewOffsetY=0;isPanning=!1;lastPointerX=0;lastPointerY=0;hasCustomView=!1;maxSpiralIndex;state;config;cells;dirtyRows;occupied;attackedByMasks;constructor(e,t){this.canvas=e,this.config=t,this.state={placementsCompleted:0,pieceToPlaceNext:0,frameCount:0,nextSpiralIndexPerPiece:new Map,exhaustedPieceIds:new Set,isComplete:!1},this.config.pieces.forEach(e=>{this.state.nextSpiralIndexPerPiece.set(e.id,0)})}async initialize(){let e=this.canvas.getContext(`2d`);if(!e)throw Error(`No Canvas 2D context found`);this.context=e,this.context.imageSmoothingEnabled=!1;let{gridSize:t}=this.config,n=t*t;this.maxSpiralIndex=k(t),this.cells=new Uint8ClampedArray(n*4),this.dirtyRows=new Uint8Array(t),this.occupied=new Uint8Array(n),this.attackedByMasks=new Uint32Array(n);for(let e=0;e<n;e++)M(this.cells,e,j);this.dirtyRows.fill(1),this.pixelCanvas=document.createElement(`canvas`),this.pixelCanvas.width=t,this.pixelCanvas.height=t;let r=this.pixelCanvas.getContext(`2d`);if(!r)throw Error(`No pixel buffer Canvas 2D context found`);this.pixelContext=r,this.pixelContext.imageSmoothingEnabled=!1,this.imageData=new ImageData(this.cells,t,t),this.resizeCanvas(),window.addEventListener(`resize`,this.onResize),this.canvas.addEventListener(`pointerdown`,this.onPointerDown),this.canvas.addEventListener(`pointermove`,this.onPointerMove),this.canvas.addEventListener(`pointerup`,this.onPointerUp),this.canvas.addEventListener(`pointercancel`,this.onPointerUp),this.canvas.addEventListener(`wheel`,this.onWheel,{passive:!1})}setCellColor(e,t){M(this.cells,e,t),this.dirtyRows[Math.floor(e/this.config.gridSize)]=1}flushPixels(){let{dirtyRows:e}=this,t=0;for(;t<e.length;){for(;t<e.length&&e[t]===0;)t++;let n=t;for(;t<e.length&&e[t]!==0;)t++;t>n&&this.pixelContext.putImageData(this.imageData,0,0,0,n,this.config.gridSize,t-n)}e.fill(0)}markPieceExhausted(e){this.state.exhaustedPieceIds.add(e),this.state.exhaustedPieceIds.size>=this.config.pieces.length&&(this.state.isComplete=!0)}advancePieceTurn(){if(!this.state.isComplete){for(let e=1;e<=this.config.pieces.length;e++){let t=(this.state.pieceToPlaceNext+e)%this.config.pieces.length,n=this.config.pieces[t];if(!this.state.exhaustedPieceIds.has(n.id)){this.state.pieceToPlaceNext=t;return}}this.state.isComplete=!0}}placeNextPiece(){let e=this.config.pieces[this.state.pieceToPlaceNext];if(this.state.exhaustedPieceIds.has(e.id))return!1;let t=this.state.nextSpiralIndexPerPiece.get(e.id);if(t===void 0)return this.markPieceExhausted(e.id),!1;let n=A(t),r=N(n,this.config.gridSize);if(r===null)return this.markPieceExhausted(e.id),!1;this.setCellColor(r,e.color),this.occupied[r]=1;let i=P(e.id);e.getNeighbors(n).forEach(e=>{let t=N(e,this.config.gridSize);t!==null&&(this.attackedByMasks[t]|=i)});let a=L(e,t,this.occupied,this.config.gridSize,this.attackedByMasks,this.maxSpiralIndex);return a===null?this.markPieceExhausted(e.id):this.state.nextSpiralIndexPerPiece.set(e.id,a),this.config.pieces.forEach(t=>{if(t.id===e.id||this.state.exhaustedPieceIds.has(t.id))return;let n=this.state.nextSpiralIndexPerPiece.get(t.id);if(I(n,t,this.occupied,this.config.gridSize,this.attackedByMasks))return;let r=L(t,n,this.occupied,this.config.gridSize,this.attackedByMasks,this.maxSpiralIndex);r===null?this.markPieceExhausted(t.id):this.state.nextSpiralIndexPerPiece.set(t.id,r)}),!0}update(){if(!this.state.isComplete){this.state.frameCount++;for(let e=0;e<this.config.placementsPerFrame&&!this.state.isComplete;e++)this.placeNextPiece()&&this.state.placementsCompleted++,this.advancePieceTurn()}}render(){this.flushPixels(),this.context.imageSmoothingEnabled=!1,this.context.clearRect(0,0,this.canvas.width,this.canvas.height),this.context.drawImage(this.pixelCanvas,this.viewOffsetX,this.viewOffsetY,this.config.gridSize*this.viewScale,this.config.gridSize*this.viewScale)}async start(){await this.initialize();let e=()=>{this.state.isComplete||this.update(),this.render(),this.requestAnimationFrameId=requestAnimationFrame(e)};e()}async stop(){this.requestAnimationFrameId&&=(cancelAnimationFrame(this.requestAnimationFrameId),null)}async destroy(){this.stop(),window.removeEventListener(`resize`,this.onResize),this.canvas.removeEventListener(`pointerdown`,this.onPointerDown),this.canvas.removeEventListener(`pointermove`,this.onPointerMove),this.canvas.removeEventListener(`pointerup`,this.onPointerUp),this.canvas.removeEventListener(`pointercancel`,this.onPointerUp),this.canvas.removeEventListener(`wheel`,this.onWheel)}resizeCanvas(){let e=this.canvasToBoardPoint(this.canvas.width/2,this.canvas.height/2),t=window.devicePixelRatio||1,n=this.canvas.getBoundingClientRect();if(this.canvas.width=Math.floor((n.width||window.innerWidth)*t),this.canvas.height=Math.floor((n.height||window.innerHeight)*t),this.context.imageSmoothingEnabled=!1,!this.hasCustomView||!e){this.resetViewToFillWidth();return}this.viewOffsetX=this.canvas.width/2-e.x*this.viewScale,this.viewOffsetY=this.canvas.height/2-e.y*this.viewScale}resetViewToFillWidth(){this.viewScale=this.canvas.width/this.config.gridSize,this.viewOffsetX=(this.canvas.width-this.config.gridSize*this.viewScale)/2,this.viewOffsetY=(this.canvas.height-this.config.gridSize*this.viewScale)/2}getCanvasPoint(e){let t=this.canvas.getBoundingClientRect();return{x:(e.clientX-t.left)/t.width*this.canvas.width,y:(e.clientY-t.top)/t.height*this.canvas.height}}canvasToBoardPoint(e,t){return this.viewScale===0?null:{x:(e-this.viewOffsetX)/this.viewScale,y:(t-this.viewOffsetY)/this.viewScale}}startPan(e){if(e.button!==0)return;let t=this.getCanvasPoint(e);this.isPanning=!0,this.hasCustomView=!0,this.lastPointerX=t.x,this.lastPointerY=t.y,this.canvas.setPointerCapture(e.pointerId)}pan(e){if(!this.isPanning)return;let t=this.getCanvasPoint(e);this.viewOffsetX+=t.x-this.lastPointerX,this.viewOffsetY+=t.y-this.lastPointerY,this.lastPointerX=t.x,this.lastPointerY=t.y}endPan(e){this.isPanning&&(this.isPanning=!1,this.canvas.releasePointerCapture(e.pointerId))}zoom(e){e.preventDefault();let t=this.getCanvasPoint(e),n=this.canvasToBoardPoint(t.x,t.y);if(!n)return;let r=Math.exp(-e.deltaY*.001),i=Math.min(this.canvas.width,this.canvas.height)/this.config.gridSize/8;this.viewScale=Math.min(128,Math.max(i,this.viewScale*r)),this.viewOffsetX=t.x-n.x*this.viewScale,this.viewOffsetY=t.y-n.y*this.viewScale,this.hasCustomView=!0}},z=e=>t=>[{x:t.x+e[0],y:t.y+e[1]},{x:t.x-e[0],y:t.y+e[1]},{x:t.x+e[0],y:t.y-e[1]},{x:t.x-e[0],y:t.y-e[1]},{x:t.x+e[1],y:t.y+e[0]},{x:t.x-e[1],y:t.y+e[0]},{x:t.x+e[1],y:t.y-e[0]},{x:t.x-e[1],y:t.y-e[0]}],B=e=>t=>e.includes(t),V=document.getElementById(`canvas`);if(!(V instanceof HTMLCanvasElement))throw Error(`Canvas element not found`);var H=V,U=1e4,W=C(),G=null;function K(){let e=W.readConfig();return W.writeConfigToUrl(e),new R(H,{gridSize:e.gridSize,placementsPerFrame:U,pieces:e.pieces.map((e,t)=>{let n=o[e.moveKey];return{id:t+1,color:e.color,getNeighbors:z([n[0],n[1]]),isAttackedBy:B(e.attackedBy)}})})}function q(e){let t=e instanceof Error?e.message:String(e);console.error(`Error initializing engine:`,e),document.body.innerHTML=`
    <div style="">
      <h1>Error initializing engine</h1>
      <p>Please check your browser's Canvas 2D support and try again.</p>
      <p>${t}</p>
    </div>
  `}async function J(){W.resetButton.disabled=!0;try{G&&await G.destroy(),G=K(),await G.start(),console.log(`Engine initialized`)}catch(e){q(e)}finally{W.resetButton.disabled=!1}}W.form.addEventListener(`submit`,e=>{e.preventDefault(),J()}),await J();