const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/main-CUi4xrCa.js","assets/kitchen-sound-ypT-jTxO.js","assets/main-C7NUfeeJ.css"])))=>i.map(i=>d[i]);
import{_ as C,h as M}from"./main-CUi4xrCa.js";import{N,Q as K,e as q,V as j,W as z,s as p,X as A,U as D,T as F,Y as P,Z as B,_ as R,$ as U,a0 as V}from"./kitchen-sound-ypT-jTxO.js";let S=!1,_=null,c=[],g=null,y=null,m=null,v=JSON.parse(localStorage.getItem("flango_kitchen_fs_sort")||"null")||{column:"time",direction:"asc"},h=localStorage.getItem("flango_kitchen_fs_served_pos")||"merged";const l=e=>m?.querySelector(e);function W(){S?E():J()}function de(){return S}window.__flangoToggleKitchenFullscreen=W;async function J(){_=localStorage.getItem("flango_institution_id");const e=window.__flangoGetInstitutionById?.(_);if(!e?.restaurant_mode_enabled){console.warn("[kitchen-fs] Restaurant mode not enabled");return}if(typeof window.__flangoToggleKitchenPanel=="function"){const{isKitchenModeActive:i}=await C(async()=>{const{isKitchenModeActive:s}=await import("./main-CUi4xrCa.js").then(r=>r.k);return{isKitchenModeActive:s}},__vite__mapDeps([0,1,2]));i()&&window.__flangoToggleKitchenPanel(!1)}if(document.body.classList.contains("calculator-mode")){const{toggleCalculatorMode:i}=await C(async()=>{const{toggleCalculatorMode:s}=await import("./main-CUi4xrCa.js").then(r=>r.j);return{toggleCalculatorMode:s}},__vite__mapDeps([0,1,2]));i(!1)}const t=e.restaurant_sound||null,n=e.restaurant_serve_sound||null;N(t?`sounds/${t}`:null,n?`sounds/${n}`:null),m=Z(e),document.body.appendChild(m),S=!0,document.body.classList.add("kitchen-fullscreen-mode"),G(),O(),await Q(),te(),y=setInterval(()=>{K(l("#kfs-active-orders"))},15e3),document.addEventListener("keydown",I)}function E(){S=!1,document.body.classList.remove("kitchen-fullscreen-mode"),g&&(p.removeChannel(g),g=null),y&&(clearInterval(y),y=null),document.removeEventListener("keydown",I),m&&(m.remove(),m=null),c=[]}function I(e){e.key==="Escape"&&E()}function Z(e){const t=document.createElement("div");t.id="kitchen-fullscreen-overlay",t.className="kitchen-fullscreen-overlay";const n=e?.name||localStorage.getItem("flango_institution_name")||"";return t.innerHTML=`
        <header class="kfs-header">
            <div class="kfs-header-left">
                <span class="kfs-logo">🍽️</span>
                <span class="kfs-title">Køkkenskærm</span>
                <span class="kfs-divider">·</span>
                <span class="kfs-inst-name">${q(n)}</span>
            </div>
            <div class="kfs-header-center">
                <div class="kfs-stat-group">
                    <div class="kfs-stat kfs-stat-active">
                        <span id="kfs-order-count" class="kfs-stat-number">0</span>
                        <span class="kfs-stat-label">aktive</span>
                    </div>
                    <div class="kfs-stat kfs-stat-total">
                        <span id="kfs-total-orders" class="kfs-stat-number">0</span>
                        <span class="kfs-stat-label">i dag</span>
                    </div>
                    <div class="kfs-stat kfs-stat-revenue">
                        <span id="kfs-daily-revenue" class="kfs-stat-number">0 kr</span>
                        <span class="kfs-stat-label">omsætning</span>
                    </div>
                </div>
            </div>
            <div class="kfs-header-right">
                <button id="kfs-settings-btn" class="kfs-ctrl-btn" title="Lydindstillinger">⚙️</button>
                <button id="kfs-sound-btn" class="kfs-ctrl-btn" title="Lyd">🔊</button>
                <button id="kfs-served-toggle" class="kfs-ctrl-btn" title="Serveret">☰ Samlet</button>
                <button id="kfs-back-btn" class="kfs-ctrl-btn kfs-ctrl-back" title="Tilbage til café">← Café</button>
            </div>
        </header>
        <div class="kfs-content layout-merged">
            <div id="kfs-active-zone" class="kfs-zone kfs-zone-active">
                <div class="kfs-zone-header">
                    <h2>Aktive ordrer</h2>
                </div>
                <div id="kfs-active-orders" class="kfs-orders-container"></div>
            </div>
            <div id="kfs-served-zone" class="kfs-zone kfs-zone-served">
                <div class="kfs-zone-header">
                    <h2>Serveret</h2>
                </div>
                <div id="kfs-served-orders" class="kfs-orders-container"></div>
            </div>
        </div>
    `,t}function G(){l("#kfs-back-btn")?.addEventListener("click",E),l("#kfs-sound-btn")?.addEventListener("click",()=>{const t=j(),n=l("#kfs-sound-btn");n.textContent=t?"🔇":"🔊",n.title=t?"Lyd slået fra":"Lyd slået til"});const e=l("#kfs-sound-btn");e&&(e.textContent=z()?"🔇":"🔊"),l("#kfs-served-toggle")?.addEventListener("click",()=>{const t=["bottom","side","hidden","merged"],n=t.indexOf(h);h=t[(n+1)%t.length],localStorage.setItem("flango_kitchen_fs_served_pos",h),O(),k()}),l("#kfs-settings-btn")?.addEventListener("click",ae)}function O(){const e=m?.querySelector(".kfs-content"),t=l("#kfs-served-zone"),n=l("#kfs-active-zone .kfs-zone-header"),i=l("#kfs-served-toggle");if(!e)return;let s=h;s==="side"&&window.innerWidth<900&&(s="bottom"),e.classList.remove("layout-bottom","layout-side","layout-hidden","layout-merged"),e.classList.add(`layout-${s}`),t&&(t.style.display=s==="hidden"||s==="merged"?"none":""),n&&(n.style.display=s==="merged"?"none":"");const r={bottom:"⬇ Bund",side:"➡ Side",hidden:"👁 Skjult",merged:"☰ Samlet"};i&&(i.textContent=r[h]||"Serveret",i.title=`Serveret: ${h}`)}async function Q(){const e=new Date;e.setHours(0,0,0,0);const{data:t,error:n}=await p.from("sales").select(`
            id, created_at, customer_id, clerk_user_id, admin_user_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
            ),
            users:customer_id ( name ),
            clerk:clerk_user_id ( name ),
            admin:admin_user_id ( name )
        `).eq("institution_id",_).eq("is_restaurant_order",!0).gte("created_at",e.toISOString()).order("created_at",{ascending:!1});if(n){console.error("[kitchen-fs] Error loading orders:",n);return}c=(t||[]).map(x),L(),k()}function x(e){const t=(e.sale_items||[]).map(n=>({name:n.products?.name||"Produkt",emoji:n.products?.emoji||"🍽️",icon_url:n.products?.icon_url||null,icon_storage_path:n.products?.icon_storage_path||null,quantity:n.quantity||1,unit_price:n.price_at_purchase,item_variant:n.item_variant||null,item_note:n.item_note||null}));return{id:e.id,created_at:e.created_at,customer_id:e.customer_id,customer_name:e.users?.name||"Ukendt kunde",clerk_name:e.clerk?.name||null,admin_name:e.admin?.name||null,table_number:e.table_number,kitchen_note:e.kitchen_note,kitchen_served:e.kitchen_served||!1,kitchen_served_at:e.kitchen_served_at,total_amount:e.total_amount,items:t}}function k(){const e=l("#kfs-active-orders"),t=l("#kfs-served-orders");if(!e)return;if(h==="merged"){if(e.innerHTML="",t&&(t.innerHTML=""),c.length===0)e.innerHTML='<div class="kitchen-empty">Ingen ordrer i dag</div>';else{const a=A(c,v),u=w(a,!1);e.appendChild(u)}L(),requestAnimationFrame(()=>T());return}const n=c.filter(a=>!a.kitchen_served),i=c.filter(a=>a.kitchen_served),s=A(n,v),r=[...i].sort((a,u)=>new Date(u.kitchen_served_at||u.created_at)-new Date(a.kitchen_served_at||a.created_at));e.innerHTML="",s.length===0?e.innerHTML='<div class="kitchen-empty">Ingen aktive ordrer 🎉</div>':e.appendChild(w(s,!1)),t&&(t.innerHTML="",r.length===0?t.innerHTML='<div class="kitchen-empty">Ingen serverede ordrer endnu</div>':t.appendChild(w(r,!0))),L(),requestAnimationFrame(()=>T())}function w(e,t,n){const i=document.createElement("table");i.className="kitchen-table";const s=document.createElement("thead"),r=document.createElement("tr"),a=[{key:"time",label:"Tid"},{key:"customer",label:"Kunde"},{key:"table",label:"Bord"},{key:"items",label:"Bestilling"},{key:"amount",label:"Beløb"},{key:"server",label:"Ekspedient"},{key:"served",label:t?"":"Handling"}],u=!t;for(const o of a){const d=document.createElement("th");if(d.className=o.key?`kitchen-th-${o.key}`:"",o.key&&u){d.style.cursor="pointer",d.dataset.sortColumn=o.key;let b="";v.column===o.key&&(b=v.direction==="asc"?" ▲":" ▼",d.classList.add("sort-active")),d.textContent=o.label+b,d.addEventListener("click",()=>{v.column===o.key?v.direction=v.direction==="asc"?"desc":"asc":(v.column=o.key,v.direction="asc"),localStorage.setItem("flango_kitchen_fs_sort",JSON.stringify(v)),k()})}else d.textContent=o.label;r.appendChild(d)}s.appendChild(r),i.appendChild(s);const f=document.createElement("tbody");for(const o of e){const d=F(o,!1),b=d.querySelector(".kitchen-serve-btn");b&&b.addEventListener("click",H=>{H.stopPropagation(),X(o.id)}),o.kitchen_served&&(d.style.cursor="pointer",d.title="Klik for at markere som ikke-serveret",d.addEventListener("click",()=>Y(o))),f.appendChild(d)}return i.appendChild(f),i}function L(){const e=c.filter(r=>!r.kitchen_served).length,t=l("#kfs-order-count");t&&(t.textContent=e);const n=l("#kfs-total-orders");n&&(n.textContent=c.length);const i=c.reduce((r,a)=>r+(Number(a.total_amount)||0),0),s=l("#kfs-daily-revenue");s&&(s.textContent=`${i.toLocaleString("da-DK")} kr`)}function T(){const e=[l("#kfs-active-orders"),l("#kfs-served-orders")];for(const t of e){if(!t||t.offsetParent===null)continue;const n=t.querySelector(".kitchen-table");if(!n)continue;n.style.transform="",n.style.transformOrigin="top left",n.style.width="100%",n.offsetHeight;const i=t.clientHeight,s=n.scrollHeight;if(s>i&&s>0){const r=Math.max(i/s,.55);n.style.transform=`scale(${r})`,n.style.transformOrigin="top left",n.style.width=`${100/r}%`}}}async function X(e){const t=c.find(i=>i.id===e);if(!t)return;t.kitchen_served=!0,t.kitchen_served_at=new Date().toISOString(),k(),V();const{error:n}=await p.rpc("mark_sale_served",{p_sale_id:e,p_institution_id:_});n&&(console.error("[kitchen-fs] Error marking served:",n),t.kitchen_served=!1,t.kitchen_served_at=null,k())}async function Y(e){await M("Bekræft",`Markér "${e.customer_name}" som IKKE serveret?`,"confirm")&&ee(e.id)}async function ee(e){const t=c.find(i=>i.id===e);if(!t)return;t.kitchen_served=!1,t.kitchen_served_at=null,k();const{error:n}=await p.rpc("unmark_sale_served",{p_sale_id:e,p_institution_id:_});n&&(console.error("[kitchen-fs] Error unmarking served:",n),t.kitchen_served=!0,t.kitchen_served_at=new Date().toISOString(),k())}function te(){g&&p.removeChannel(g),g=p.channel("kitchen-fullscreen-sales").on("postgres_changes",{event:"INSERT",schema:"public",table:"sales",filter:`institution_id=eq.${_}`},ne).on("postgres_changes",{event:"UPDATE",schema:"public",table:"sales",filter:`institution_id=eq.${_}`},se).on("postgres_changes",{event:"DELETE",schema:"public",table:"sales",filter:`institution_id=eq.${_}`},ie).subscribe()}async function ne(e){const t=e.new;if(!t?.id||!t.is_restaurant_order||c.some(s=>s.id===t.id))return;const{data:n}=await p.from("sales").select(`
            id, created_at, customer_id, clerk_user_id, admin_user_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
            ),
            users:customer_id ( name ),
            clerk:clerk_user_id ( name ),
            admin:admin_user_id ( name )
        `).eq("id",t.id).single();if(!n)return;const i=x(n);c.push(i),k(),re(i),D()}function se(e){const t=e.new;if(!t?.id)return;const n=c.findIndex(i=>i.id===t.id);n!==-1&&(c[n].table_number=t.table_number,c[n].kitchen_note=t.kitchen_note,c[n].kitchen_served=t.kitchen_served||!1,c[n].kitchen_served_at=t.kitchen_served_at,k())}function ie(e){const t=e.old;t?.id&&(c=c.filter(n=>n.id!==t.id),k())}function re(e){if(!m)return;let t=m.querySelector("#kfs-toast-container");t||(t=document.createElement("div"),t.id="kfs-toast-container",t.className="kitchen-toast-container",m.appendChild(t));const n=document.createElement("div");n.className="kitchen-toast kitchen-toast-enter";const i=(e.items||[]).slice(0,3).map(o=>`${o.emoji&&o.emoji.startsWith("::icon::")?"🍽️":o.emoji||"🍽️"} ${o.name}${o.quantity>1?` x${o.quantity}`:""}`).join(", "),s=(e.items||[]).length-3,r=s>0?` +${s}`:"",a=e.table_number?` · Bord ${e.table_number}`:"",u=e.total_amount!=null?` · ${Number(e.total_amount).toLocaleString("da-DK")} kr`:"";n.innerHTML=`
        <div class="kitchen-toast-icon">🍽️</div>
        <div class="kitchen-toast-body">
            <div class="kitchen-toast-title">Ny ordre${a}${u}</div>
            <div class="kitchen-toast-subtitle">${q(e.customer_name)}</div>
            <div class="kitchen-toast-items">${i}${r}</div>
        </div>
        <button class="kitchen-toast-close">✕</button>
    `,n.addEventListener("click",()=>$(n)),t.appendChild(n),requestAnimationFrame(()=>{n.classList.remove("kitchen-toast-enter")});const f=setTimeout(()=>$(n),5e3);n._timer=f}function $(e){e._dismissed||(e._dismissed=!0,clearTimeout(e._timer),e.classList.add("kitchen-toast-exit"),e.addEventListener("animationend",()=>e.remove(),{once:!0}),setTimeout(()=>e.remove(),600))}function ae(){const e=m?.querySelector("#kfs-settings-overlay");if(e){e.remove();return}oe()}function oe(){const e=P(),t=B(),n=[{value:"",label:"Ingen lyd"},{value:"sounds/Accept/accepter-1.mp3",label:"Acceptér 1"},{value:"sounds/Accept/accepter-2.mp3",label:"Acceptér 2"},{value:"sounds/Accept/accepter-3.mp3",label:"Acceptér 3"},{value:"sounds/Accept/accepter-4.mp3",label:"Acceptér 4"},{value:"sounds/Accept/accepter-5.mp3",label:"Acceptér 5"},{value:"sounds/Accept/accepter-6.mp3",label:"Acceptér 6"},{value:"sounds/Accept/accepter-7.mp3",label:"Acceptér 7"},{value:"sounds/Add Item/Add1.mp3",label:"Tilføj 1"},{value:"sounds/Add Item/Add2.mp3",label:"Tilføj 2"},{value:"sounds/Login/Login1.mp3",label:"Login 1"},{value:"sounds/Login/Login2.mp3",label:"Login 2"}];function i(a,u){return n.map(f=>`<option value="${f.value}"${f.value===(u||"")?" selected":""}>${f.label}</option>`).join("")}const s=document.createElement("div");s.id="kfs-settings-overlay",s.className="kitchen-settings-overlay",s.innerHTML=`
        <div class="kitchen-settings-header">
            <span>⚙️ Lydindstillinger</span>
            <button class="kitchen-settings-close">✕</button>
        </div>
        <div class="kitchen-settings-body">
            <div class="kitchen-settings-row">
                <label for="kfs-order-sound">Ny ordre lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="kfs-order-sound">${i("kfs-order-sound",e)}</select>
                    <button class="kitchen-settings-preview" data-target="kfs-order-sound">▶</button>
                </div>
            </div>
            <div class="kitchen-settings-row">
                <label for="kfs-serve-sound">Serveret lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="kfs-serve-sound">${i("kfs-serve-sound",t)}</select>
                    <button class="kitchen-settings-preview" data-target="kfs-serve-sound">▶</button>
                </div>
            </div>
        </div>
    `,m.appendChild(s),s.querySelector(".kitchen-settings-close").addEventListener("click",()=>{s.remove()}),s.querySelector("#kfs-order-sound").addEventListener("change",a=>{R(a.target.value||null)}),s.querySelector("#kfs-serve-sound").addEventListener("change",a=>{U(a.target.value||null)});let r=null;s.querySelectorAll(".kitchen-settings-preview").forEach(a=>{a.addEventListener("click",()=>{const f=s.querySelector(`#${a.dataset.target}`)?.value;f&&(r&&r.pause(),r=new Audio(f),r.volume=.7,r.play().catch(()=>{}))})}),requestAnimationFrame(()=>{const a=u=>{s.contains(u.target)||u.target===l("#kfs-settings-btn")||(s.remove(),document.removeEventListener("mousedown",a))};document.addEventListener("mousedown",a)})}export{de as isKitchenFullscreenActive,W as toggleKitchenFullscreen};
