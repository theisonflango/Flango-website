import{o as g}from"./main-pz2Pzlsp.js";const b="flango-keyboard-tip-dismissed",c={MIN_MOUSE_CLICKS:10,TIME_WINDOW_MS:3e5};let o=[],s=[],a=!1;function d(){try{return localStorage.getItem(b)==="true"}catch{return!1}}function x(){try{localStorage.setItem(b,"true")}catch{}}function l(t){if(!a||d())return;const n=Date.now();o.push({type:t,timestamp:n});const e=n-c.TIME_WINDOW_MS;o=o.filter(i=>i.timestamp>e),E()}function p(t){if(!a||d())return;const n=Date.now();s.push({key:t,timestamp:n});const e=n-c.TIME_WINDOW_MS;s=s.filter(i=>i.timestamp>e)}function E(){if(d())return;const n=Date.now()-c.TIME_WINDOW_MS;o.filter(i=>i.timestamp>n).length>=c.MIN_MOUSE_CLICKS&&(h(),o=[],s=[])}function h(){if(d())return;I("Hr. Flango har et tip! 😄",`
        <div style="display: flex; align-items: center; gap: 20px;">
            <img src="Icons/webp/Avatar/Ekspedient-mand-Flango1.webp" alt="Hr. Flango" style="width: 120px; height: auto; flex-shrink: 0;">
            <div style="text-align: left; line-height: 1.6;">
                Du er hurtig med musen! 😄 Vil du være endnu hurtigere?<br><br>
                <strong>Prøv tastaturet:</strong><br>
                • Åben brugerliste med <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">TAB</kbd> eller <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">+</kbd><br>
                • Vælg produkter med <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">1-9</kbd><br>
                • Gennemfør køb med <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">ENTER</kbd>
            </div>
        </div>
    `)}function I(t,n){let e=document.getElementById("keyboard-tip-modal");if(!e){e=document.createElement("div"),e.id="keyboard-tip-modal",e.className="modal",e.innerHTML=`
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 id="keyboard-tip-title">${t}</h2>
                    <span class="close-btn">&times;</span>
                </div>
                <div id="keyboard-tip-body" style="padding: 20px;"></div>
                <div id="keyboard-tip-buttons" style="display: flex; gap: 10px; padding: 20px; justify-content: flex-end; border-top: 1px solid #ddd;">
                    <button id="keyboard-tip-guide-btn" class="action-button" style="background-color: var(--info-color);">Se guide</button>
                    <button id="keyboard-tip-dismiss-btn" class="action-button secondary-action">Vis ikke igen</button>
                    <button id="keyboard-tip-close-btn" class="action-button">Luk</button>
                </div>
            </div>
        `,document.body.appendChild(e);const f=e.querySelector(".close-btn"),m=document.getElementById("keyboard-tip-guide-btn"),y=document.getElementById("keyboard-tip-dismiss-btn"),k=document.getElementById("keyboard-tip-close-btn"),r=()=>{e.style.display="none"};f?.addEventListener("click",r),k?.addEventListener("click",r),m?.addEventListener("click",()=>{r(),g()}),y?.addEventListener("click",()=>{x(),r()})}const i=document.getElementById("keyboard-tip-title"),u=document.getElementById("keyboard-tip-body");i&&(i.textContent=t),u&&(u.innerHTML=n),e.style.display="flex"}function v(t){t&&t.addEventListener("click",n=>{const e=n.target.closest(".product-btn");e&&!e.disabled&&l("product")},!0)}function T(t){t&&t.addEventListener("click",()=>{l("selectUser")},!0)}function M(t){t&&t.addEventListener("click",()=>{l("completePurchase")},!0)}function B(){document.addEventListener("keydown",t=>{document.querySelector('.modal[style*="display: flex"]')||t.target.tagName==="INPUT"||t.target.tagName==="TEXTAREA"||(t.key>="1"&&t.key<="9"?p(t.key):t.key==="Enter"&&p("Enter"))},!0)}function w(t={}){const{productsContainer:n,selectUserButton:e,completePurchaseButton:i}=t;d()||(a=!0,n&&v(n),e&&T(e),i&&M(i),B())}export{w as initKeyboardUsageTip};
