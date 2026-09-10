const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/kitchen-inline-panel-BR0KrUud.js","assets/platform-CeQQ07fy.js","assets/session-store-BCtbJ-j8.js","assets/backend-config-D_9xaUNr.js","assets/cafe-client-compatibility-Ebz767RR.js","assets/kitchen-sound-BbBfOHMB.js","assets/escape-html-Qmj0EIDu.js","assets/portal-api-CyOwqvCq.js","assets/roster-BK1VVStM.js","assets/calculator-mode-SaCYiLe6.js"])))=>i.map(i=>d[i]);
import{_ as I}from"./platform-CeQQ07fy.js";import{c as M,s as y}from"./session-store-BCtbJ-j8.js";import{f as O}from"./roster-BK1VVStM.js";import{e as A,s as w}from"./escape-html-Qmj0EIDu.js";import{i as D,u as K,t as B,a as P,b as x,p as R,r as V,g as U,c as J,d as W,e as G,f as Z}from"./kitchen-sound-BbBfOHMB.js";import"./backend-config-D_9xaUNr.js";import"./cafe-client-compatibility-Ebz767RR.js";import"./portal-api-CyOwqvCq.js";let E=!1,_=null,a=[],b=null,L=null,v=null,m=JSON.parse(localStorage.getItem("flango_kitchen_fs_sort")||"null")||{column:"time",direction:"asc"},g=localStorage.getItem("flango_kitchen_fs_served_pos")||"merged",p=localStorage.getItem("flango_kitchen_fs_show_delete")==="true";const l=e=>v?.querySelector(e);function Q(){E?T():X()}function Le(){return E}window.__flangoToggleKitchenFullscreen=Q;async function X(){_=localStorage.getItem("flango_institution_id");const e=window.__flangoGetInstitutionById?.(_);if(!e?.restaurant_mode_enabled){console.warn("[kitchen-fs] Restaurant mode not enabled");return}if(typeof window.__flangoToggleKitchenPanel=="function"){const{isKitchenModeActive:r}=await I(async()=>{const{isKitchenModeActive:s}=await import("./kitchen-inline-panel-BR0KrUud.js");return{isKitchenModeActive:s}},__vite__mapDeps([0,1,2,3,4,5,6,7,8]));r()&&window.__flangoToggleKitchenPanel(!1)}if(document.body.classList.contains("calculator-mode")){const{toggleCalculatorMode:r}=await I(async()=>{const{toggleCalculatorMode:s}=await import("./calculator-mode-SaCYiLe6.js").then(o=>o.q);return{toggleCalculatorMode:s}},__vite__mapDeps([9,2,1,3,4,6,7,8]));r(!1)}const t=e.restaurant_sound||null,n=e.restaurant_serve_sound||null;D(t?`sounds/${t}`:null,n?`sounds/${n}`:null),v=Y(e),document.body.appendChild(v),E=!0,document.body.classList.add("kitchen-fullscreen-mode"),ee(),N(),await te(),le(),L=setInterval(()=>{K(l("#kfs-active-orders"))},15e3),document.addEventListener("keydown",z)}function T(){E=!1,document.body.classList.remove("kitchen-fullscreen-mode"),b&&(y.removeChannel(b),b=null),L&&(clearInterval(L),L=null),document.removeEventListener("keydown",z),v&&(v.remove(),v=null),a=[]}function z(e){e.key==="Escape"&&T()}function Y(e){const t=document.createElement("div");t.id="kitchen-fullscreen-overlay",t.className="kitchen-fullscreen-overlay"+(p?" show-delete-btn":"");const n=e?.name||localStorage.getItem("flango_institution_name")||"";return t.innerHTML=`
        <header class="kfs-header">
            <div class="kfs-header-left">
                <span class="kfs-logo">🍽️</span>
                <span class="kfs-title">Køkkenskærm</span>
                <span class="kfs-divider">·</span>
                <span class="kfs-inst-name">${A(n)}</span>
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
    `,t}function ee(){l("#kfs-back-btn")?.addEventListener("click",T),l("#kfs-sound-btn")?.addEventListener("click",()=>{const t=B(),n=l("#kfs-sound-btn");n.textContent=t?"🔇":"🔊",n.title=t?"Lyd slået fra":"Lyd slået til"});const e=l("#kfs-sound-btn");e&&(e.textContent=P()?"🔇":"🔊"),l("#kfs-served-toggle")?.addEventListener("click",()=>{const t=["bottom","side","hidden","merged"],n=t.indexOf(g);g=t[(n+1)%t.length],localStorage.setItem("flango_kitchen_fs_served_pos",g),N(),f()}),l("#kfs-settings-btn")?.addEventListener("click",ve)}function N(){const e=v?.querySelector(".kfs-content"),t=l("#kfs-served-zone"),n=l("#kfs-active-zone .kfs-zone-header"),r=l("#kfs-served-toggle");if(!e)return;let s=g;s==="side"&&window.innerWidth<900&&(s="bottom"),e.classList.remove("layout-bottom","layout-side","layout-hidden","layout-merged"),e.classList.add(`layout-${s}`),t&&(t.style.display=s==="hidden"||s==="merged"?"none":""),n&&(n.style.display=s==="merged"?"none":"");const o={bottom:"⬇ Bund",side:"➡ Side",hidden:"👁 Skjult",merged:"☰ Samlet"};r&&(r.textContent=o[g]||"Serveret",r.title=`Serveret: ${g}`)}async function te(){const e=new Date;e.setHours(0,0,0,0);const{data:t,error:n}=await M.from("sales").select(`
            id, created_at, cafe_membership_id, customer_name, clerk_child_id, admin_person_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
            ),
        `).eq("institution_id",_).eq("is_restaurant_order",!0).gte("created_at",e.toISOString()).order("created_at",{ascending:!1});if(n){console.error("[kitchen-fs] Error loading orders:",n);return}a=(t||[]).map(F),S(),f()}function F(e){const t=(e.sale_items||[]).map(n=>({name:n.products?.name||"Produkt",emoji:n.products?.emoji||"🍽️",icon_url:n.products?.icon_url||null,icon_storage_path:n.products?.icon_storage_path||null,quantity:n.quantity||1,unit_price:n.price_at_purchase,item_variant:n.item_variant||null,item_note:n.item_note||null}));return{id:e.id,created_at:e.created_at,cafe_membership_id:e.cafe_membership_id,customer_name:e.customer_name||"Ukendt kunde",clerk_name:O(e.clerk_child_id)?.name||null,admin_name:O(e.admin_person_id)?.name||null,table_number:e.table_number,kitchen_note:e.kitchen_note,kitchen_served:e.kitchen_served||!1,kitchen_served_at:e.kitchen_served_at,total_amount:e.total_amount,items:t}}function f(){const e=l("#kfs-active-orders"),t=l("#kfs-served-orders");if(!e)return;if(g==="merged"){if(e.innerHTML="",t&&(t.innerHTML=""),a.length===0)e.innerHTML='<div class="kitchen-empty">Ingen ordrer i dag</div>';else{const d=x(a,m),k=$(d,!1);e.appendChild(k)}S(),requestAnimationFrame(()=>j());return}const n=a.filter(d=>!d.kitchen_served),r=a.filter(d=>d.kitchen_served),s=x(n,m),o=[...r].sort((d,k)=>new Date(k.kitchen_served_at||k.created_at)-new Date(d.kitchen_served_at||d.created_at));e.innerHTML="",s.length===0?e.innerHTML='<div class="kitchen-empty">Ingen aktive ordrer 🎉</div>':e.appendChild($(s,!1)),t&&(t.innerHTML="",o.length===0?t.innerHTML='<div class="kitchen-empty">Ingen serverede ordrer endnu</div>':t.appendChild($(o,!0))),S(),requestAnimationFrame(()=>j())}function $(e,t,n){const r=document.createElement("table");r.className="kitchen-table";const s=document.createElement("thead"),o=document.createElement("tr"),d=[{key:"time",label:"Tid"},{key:"customer",label:"Kunde"},{key:"table",label:"Bord"},{key:"items",label:"Bestilling"},{key:"amount",label:"Beløb"},{key:"server",label:"Ekspedient"},{key:"served",label:t?"":"Handling"}],k=!t;for(const i of d){const c=document.createElement("th");if(c.className=i.key?`kitchen-th-${i.key}`:"",i.key&&k){c.style.cursor="pointer",c.dataset.sortColumn=i.key;let u="";m.column===i.key&&(u=m.direction==="asc"?" ▲":" ▼",c.classList.add("sort-active")),c.textContent=i.label+u,c.addEventListener("click",()=>{m.column===i.key?m.direction=m.direction==="asc"?"desc":"asc":(m.column=i.key,m.direction="asc"),localStorage.setItem("flango_kitchen_fs_sort",JSON.stringify(m)),f()})}else c.textContent=i.label;o.appendChild(c)}s.appendChild(o),r.appendChild(s);const h=document.createElement("tbody");for(const i of e){const c=V(i,!1),u=c.querySelector(".kitchen-serve-btn");u&&u.addEventListener("click",C=>{C.stopPropagation(),ne(i.id)});const q=c.querySelector(".kitchen-delete-btn");q&&q.addEventListener("click",C=>{C.stopPropagation(),oe(i)}),i.kitchen_served&&(c.style.cursor="pointer",c.title="Klik for at markere som ikke-serveret",c.addEventListener("click",()=>se(i))),h.appendChild(c)}return r.appendChild(h),r}function S(){const e=a.filter(o=>!o.kitchen_served).length,t=l("#kfs-order-count");t&&(t.textContent=e);const n=l("#kfs-total-orders");n&&(n.textContent=a.length);const r=a.reduce((o,d)=>o+(Number(d.total_amount)||0),0),s=l("#kfs-daily-revenue");s&&(s.textContent=`${r.toLocaleString("da-DK")} kr`)}function j(){const e=[l("#kfs-active-orders"),l("#kfs-served-orders")];for(const t of e){if(!t||t.offsetParent===null)continue;const n=t.querySelector(".kitchen-table");if(!n)continue;n.style.transform="",n.style.transformOrigin="top left",n.style.width="100%",n.offsetHeight;const r=t.clientHeight,s=n.scrollHeight;if(s>r&&s>0){const o=Math.max(r/s,.55);n.style.transform=`scale(${o})`,n.style.transformOrigin="top left",n.style.width=`${100/o}%`}}}async function ne(e){const t=a.find(r=>r.id===e);if(!t)return;t.kitchen_served=!0,t.kitchen_served_at=new Date().toISOString(),f(),Z();const{error:n}=await y.rpc("mark_sale_served",{p_sale_id:e,p_institution_id:_});n&&(console.error("[kitchen-fs] Error marking served:",n),t.kitchen_served=!1,t.kitchen_served_at=null,f())}async function se(e){await w("Bekræft",`Markér "${e.customer_name||"(slettet)"}" som IKKE serveret?`,{type:"confirm",zIndex:1e4})&&ie(e.id)}async function ie(e){const t=a.find(r=>r.id===e);if(!t)return;t.kitchen_served=!1,t.kitchen_served_at=null,f();const{error:n}=await y.rpc("unmark_sale_served",{p_sale_id:e,p_institution_id:_});n&&(console.error("[kitchen-fs] Error unmarking served:",n),t.kitchen_served=!0,t.kitchen_served_at=new Date().toISOString(),f())}async function re(){const e=a.filter(s=>!s.kitchen_served);if(e.length===0)return;const t=new Date().toISOString();for(const s of e)s.kitchen_served=!0,s.kitchen_served_at=t;f();const n=await Promise.allSettled(e.map(s=>y.rpc("mark_sale_served",{p_sale_id:s.id,p_institution_id:_})));let r=!1;n.forEach((s,o)=>{(s.status==="rejected"||s.value?.error)&&(r=!0,e[o].kitchen_served=!1,e[o].kitchen_served_at=null)}),r&&(console.error("[kitchen-fs] Some orders failed to serve"),f())}function ae(){a=a.filter(e=>!e.kitchen_served),S(),f()}async function oe(e){const t=e.customer_name||"ordren";await w("Fjern fra listen?",`Fjern "${A(t)}" fra køkkenskærmen?<br><br>Ordren forsvinder kun fra visningen — ikke fra databasen.`,{type:"confirm",zIndex:1e4})&&(a=a.filter(r=>r.id!==e.id),S(),f())}function ce(){a=[],S(),f()}function le(){b&&y.removeChannel(b),b=y.channel("kitchen-fullscreen-sales").on("postgres_changes",{event:"INSERT",schema:"cafe",table:"sales",filter:`institution_id=eq.${_}`},de).on("postgres_changes",{event:"UPDATE",schema:"cafe",table:"sales",filter:`institution_id=eq.${_}`},ue).on("postgres_changes",{event:"DELETE",schema:"cafe",table:"sales",filter:`institution_id=eq.${_}`},fe).subscribe()}async function de(e){const t=e.new;if(!t?.id||!t.is_restaurant_order||a.some(s=>s.id===t.id))return;const{data:n}=await M.from("sales").select(`
            id, created_at, cafe_membership_id, customer_name, clerk_child_id, admin_person_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
            ),
        `).eq("id",t.id).single();if(!n)return;const r=F(n);a.push(r),f(),ke(r),R()}function ue(e){const t=e.new;if(!t?.id)return;const n=a.findIndex(r=>r.id===t.id);n!==-1&&(a[n].table_number=t.table_number,a[n].kitchen_note=t.kitchen_note,a[n].kitchen_served=t.kitchen_served||!1,a[n].kitchen_served_at=t.kitchen_served_at,f())}function fe(e){const t=e.old;t?.id&&(a=a.filter(n=>n.id!==t.id),f())}function ke(e){if(!v)return;let t=v.querySelector("#kfs-toast-container");t||(t=document.createElement("div"),t.id="kfs-toast-container",t.className="kitchen-toast-container",v.appendChild(t));const n=document.createElement("div");n.className="kitchen-toast kitchen-toast-enter";const r=(e.items||[]).slice(0,3).map(i=>`${i.emoji&&i.emoji.startsWith("::icon::")?"🍽️":i.emoji||"🍽️"} ${i.name}${i.quantity>1?` x${i.quantity}`:""}`).join(", "),s=(e.items||[]).length-3,o=s>0?` +${s}`:"",d=e.table_number?` · Bord ${e.table_number}`:"",k=e.total_amount!=null?` · ${Number(e.total_amount).toLocaleString("da-DK")} kr`:"";n.innerHTML=`
        <div class="kitchen-toast-icon">🍽️</div>
        <div class="kitchen-toast-body">
            <div class="kitchen-toast-title">Ny ordre${d}${k}</div>
            <div class="kitchen-toast-subtitle">${A(e.customer_name||"(slettet)")}</div>
            <div class="kitchen-toast-items">${r}${o}</div>
        </div>
        <button class="kitchen-toast-close">✕</button>
    `,n.addEventListener("click",()=>H(n)),t.appendChild(n),requestAnimationFrame(()=>{n.classList.remove("kitchen-toast-enter")});const h=setTimeout(()=>H(n),5e3);n._timer=h}function H(e){e._dismissed||(e._dismissed=!0,clearTimeout(e._timer),e.classList.add("kitchen-toast-exit"),e.addEventListener("animationend",()=>e.remove(),{once:!0}),setTimeout(()=>e.remove(),600))}function ve(){const e=v?.querySelector("#kfs-settings-overlay");if(e){e.remove();return}me()}function me(){const e=U(),t=J(),n=[{value:"",label:"Ingen lyd"},{value:"sounds/Accept/accepter-1.mp3",label:"Acceptér 1"},{value:"sounds/Accept/accepter-2.mp3",label:"Acceptér 2"},{value:"sounds/Accept/accepter-3.mp3",label:"Acceptér 3"},{value:"sounds/Accept/accepter-4.mp3",label:"Acceptér 4"},{value:"sounds/Accept/accepter-5.mp3",label:"Acceptér 5"},{value:"sounds/Accept/accepter-6.mp3",label:"Acceptér 6"},{value:"sounds/Accept/accepter-7.mp3",label:"Acceptér 7"},{value:"sounds/Add Item/Add1.mp3",label:"Tilføj 1"},{value:"sounds/Add Item/Add2.mp3",label:"Tilføj 2"},{value:"sounds/Login/Login1.mp3",label:"Login 1"},{value:"sounds/Login/Login2.mp3",label:"Login 2"}];function r(i,c){return n.map(u=>`<option value="${u.value}"${u.value===(c||"")?" selected":""}>${u.label}</option>`).join("")}const s=document.createElement("div");s.id="kfs-settings-overlay",s.className="kitchen-settings-overlay";const o=a.filter(i=>!i.kitchen_served).length,d=a.filter(i=>i.kitchen_served).length;s.innerHTML=`
        <div class="kitchen-settings-header">
            <span>⚙️ Indstillinger</span>
            <button class="kitchen-settings-close">✕</button>
        </div>
        <div class="kitchen-settings-body">
            <div class="kitchen-settings-row">
                <label for="kfs-order-sound">Ny ordre lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="kfs-order-sound" class="select">${r("kfs-order-sound",e)}</select>
                    <button class="kitchen-settings-preview" data-target="kfs-order-sound">▶</button>
                </div>
            </div>
            <div class="kitchen-settings-row">
                <label for="kfs-serve-sound">Serveret lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="kfs-serve-sound" class="select">${r("kfs-serve-sound",t)}</select>
                    <button class="kitchen-settings-preview" data-target="kfs-serve-sound">▶</button>
                </div>
            </div>
            <div class="kitchen-settings-divider"></div>
            <div class="kitchen-settings-row">
                <label>Handlinger</label>
                <div class="kitchen-settings-actions">
                    <button id="kfs-serve-all" class="kitchen-settings-action-btn kitchen-settings-action-serve"${o===0?" disabled":""}>
                        ✓ Servér alle (${o})
                    </button>
                    <button id="kfs-clear-served" class="kitchen-settings-action-btn kitchen-settings-action-clear"${d===0?" disabled":""}>
                        🧹 Ryd serveret (${d})
                    </button>
                    <button id="kfs-reset-all" class="kitchen-settings-action-btn kitchen-settings-action-reset"${a.length===0?" disabled":""}>
                        🔄 Nulstil alt
                    </button>
                    <button id="kfs-toggle-delete" class="kitchen-settings-action-btn">
                        ${p?"✓ Skjul slet-knap":"🗑️ Vis slet-knap"}
                    </button>
                </div>
            </div>
        </div>
    `,v.appendChild(s),s.querySelector(".kitchen-settings-close").addEventListener("click",()=>{s.remove()}),s.querySelector("#kfs-order-sound").addEventListener("change",i=>{W(i.target.value||null)}),s.querySelector("#kfs-serve-sound").addEventListener("change",i=>{G(i.target.value||null)});let k=null;s.querySelectorAll(".kitchen-settings-preview").forEach(i=>{i.addEventListener("click",()=>{const u=s.querySelector(`#${i.dataset.target}`)?.value;u&&(k&&k.pause(),k=new Audio(u),k.volume=.7,k.play().catch(()=>{}))})});const h=()=>{s.remove()};s.querySelector("#kfs-serve-all")?.addEventListener("click",async()=>{const i=a.filter(u=>!u.kitchen_served);i.length===0||!await w("Bekræft",`Markér alle ${i.length} aktive ordrer som serveret?`,{type:"confirm",zIndex:1e4})||(re(),h())}),s.querySelector("#kfs-clear-served")?.addEventListener("click",async()=>{const i=a.filter(u=>u.kitchen_served);i.length===0||!await w("Bekræft",`Fjern ${i.length} serverede ordrer fra listen?`,{type:"confirm",zIndex:1e4})||(ae(),h())}),s.querySelector("#kfs-reset-all")?.addEventListener("click",async()=>{a.length===0||!await w("Bekræft","Nulstil hele listen og statistikken?<br><br>Ordrer forsvinder kun fra køkkenskærmen — ikke fra databasen.",{type:"confirm",zIndex:1e4})||(ce(),h())}),s.querySelector("#kfs-toggle-delete")?.addEventListener("click",i=>{p=!p,localStorage.setItem("flango_kitchen_fs_show_delete",p?"true":"false"),v?.classList.toggle("show-delete-btn",p),i.currentTarget.textContent=p?"✓ Skjul slet-knap":"🗑️ Vis slet-knap"}),requestAnimationFrame(()=>{const i=c=>{s.contains(c.target)||c.target===l("#kfs-settings-btn")||(s.remove(),document.removeEventListener("mousedown",i))};document.addEventListener("mousedown",i)})}export{Le as isKitchenFullscreenActive,Q as toggleKitchenFullscreen};
