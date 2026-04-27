const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/main-UInUQcC9.js","assets/main-BQKypENc.css"])))=>i.map(i=>d[i]);
import{_ as q,n as F,q as N,e as A,v as B,w as D,s as p,x as O,y as K,z as P,B as R,D as V,E as U,F as J,G as w,H as G}from"./main-UInUQcC9.js";let E=!1,_=null,a=[],y=null,L=null,v=null,m=JSON.parse(localStorage.getItem("flango_kitchen_fs_sort")||"null")||{column:"time",direction:"asc"},b=localStorage.getItem("flango_kitchen_fs_served_pos")||"merged",g=localStorage.getItem("flango_kitchen_fs_show_delete")==="true";const c=e=>v?.querySelector(e);function W(){E?T():Z()}function me(){return E}window.__flangoToggleKitchenFullscreen=W;async function Z(){_=localStorage.getItem("flango_institution_id");const e=window.__flangoGetInstitutionById?.(_);if(!e?.restaurant_mode_enabled){console.warn("[kitchen-fs] Restaurant mode not enabled");return}if(typeof window.__flangoToggleKitchenPanel=="function"){const{isKitchenModeActive:r}=await q(async()=>{const{isKitchenModeActive:s}=await import("./main-UInUQcC9.js").then(o=>o.J);return{isKitchenModeActive:s}},__vite__mapDeps([0,1]));r()&&window.__flangoToggleKitchenPanel(!1)}if(document.body.classList.contains("calculator-mode")){const{toggleCalculatorMode:r}=await q(async()=>{const{toggleCalculatorMode:s}=await import("./main-UInUQcC9.js").then(o=>o.I);return{toggleCalculatorMode:s}},__vite__mapDeps([0,1]));r(!1)}const t=e.restaurant_sound||null,n=e.restaurant_serve_sound||null;F(t?`sounds/${t}`:null,n?`sounds/${n}`:null),v=Q(e),document.body.appendChild(v),E=!0,document.body.classList.add("kitchen-fullscreen-mode"),X(),M(),await Y(),oe(),L=setInterval(()=>{N(c("#kfs-active-orders"))},15e3),document.addEventListener("keydown",j)}function T(){E=!1,document.body.classList.remove("kitchen-fullscreen-mode"),y&&(p.removeChannel(y),y=null),L&&(clearInterval(L),L=null),document.removeEventListener("keydown",j),v&&(v.remove(),v=null),a=[]}function j(e){e.key==="Escape"&&T()}function Q(e){const t=document.createElement("div");t.id="kitchen-fullscreen-overlay",t.className="kitchen-fullscreen-overlay"+(g?" show-delete-btn":"");const n=e?.name||localStorage.getItem("flango_institution_name")||"";return t.innerHTML=`
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
    `,t}function X(){c("#kfs-back-btn")?.addEventListener("click",T),c("#kfs-sound-btn")?.addEventListener("click",()=>{const t=B(),n=c("#kfs-sound-btn");n.textContent=t?"🔇":"🔊",n.title=t?"Lyd slået fra":"Lyd slået til"});const e=c("#kfs-sound-btn");e&&(e.textContent=D()?"🔇":"🔊"),c("#kfs-served-toggle")?.addEventListener("click",()=>{const t=["bottom","side","hidden","merged"],n=t.indexOf(b);b=t[(n+1)%t.length],localStorage.setItem("flango_kitchen_fs_served_pos",b),M(),f()}),c("#kfs-settings-btn")?.addEventListener("click",fe)}function M(){const e=v?.querySelector(".kfs-content"),t=c("#kfs-served-zone"),n=c("#kfs-active-zone .kfs-zone-header"),r=c("#kfs-served-toggle");if(!e)return;let s=b;s==="side"&&window.innerWidth<900&&(s="bottom"),e.classList.remove("layout-bottom","layout-side","layout-hidden","layout-merged"),e.classList.add(`layout-${s}`),t&&(t.style.display=s==="hidden"||s==="merged"?"none":""),n&&(n.style.display=s==="merged"?"none":"");const o={bottom:"⬇ Bund",side:"➡ Side",hidden:"👁 Skjult",merged:"☰ Samlet"};r&&(r.textContent=o[b]||"Serveret",r.title=`Serveret: ${b}`)}async function Y(){const e=new Date;e.setHours(0,0,0,0);const{data:t,error:n}=await p.from("sales").select(`
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
        `).eq("institution_id",_).eq("is_restaurant_order",!0).gte("created_at",e.toISOString()).order("created_at",{ascending:!1});if(n){console.error("[kitchen-fs] Error loading orders:",n);return}a=(t||[]).map(z),S(),f()}function z(e){const t=(e.sale_items||[]).map(n=>({name:n.products?.name||"Produkt",emoji:n.products?.emoji||"🍽️",icon_url:n.products?.icon_url||null,icon_storage_path:n.products?.icon_storage_path||null,quantity:n.quantity||1,unit_price:n.price_at_purchase,item_variant:n.item_variant||null,item_note:n.item_note||null}));return{id:e.id,created_at:e.created_at,customer_id:e.customer_id,customer_name:e.users?.name||"Ukendt kunde",clerk_name:e.clerk?.name||null,admin_name:e.admin?.name||null,table_number:e.table_number,kitchen_note:e.kitchen_note,kitchen_served:e.kitchen_served||!1,kitchen_served_at:e.kitchen_served_at,total_amount:e.total_amount,items:t}}function f(){const e=c("#kfs-active-orders"),t=c("#kfs-served-orders");if(!e)return;if(b==="merged"){if(e.innerHTML="",t&&(t.innerHTML=""),a.length===0)e.innerHTML='<div class="kitchen-empty">Ingen ordrer i dag</div>';else{const d=O(a,m),k=$(d,!1);e.appendChild(k)}S(),requestAnimationFrame(()=>x());return}const n=a.filter(d=>!d.kitchen_served),r=a.filter(d=>d.kitchen_served),s=O(n,m),o=[...r].sort((d,k)=>new Date(k.kitchen_served_at||k.created_at)-new Date(d.kitchen_served_at||d.created_at));e.innerHTML="",s.length===0?e.innerHTML='<div class="kitchen-empty">Ingen aktive ordrer 🎉</div>':e.appendChild($(s,!1)),t&&(t.innerHTML="",o.length===0?t.innerHTML='<div class="kitchen-empty">Ingen serverede ordrer endnu</div>':t.appendChild($(o,!0))),S(),requestAnimationFrame(()=>x())}function $(e,t,n){const r=document.createElement("table");r.className="kitchen-table";const s=document.createElement("thead"),o=document.createElement("tr"),d=[{key:"time",label:"Tid"},{key:"customer",label:"Kunde"},{key:"table",label:"Bord"},{key:"items",label:"Bestilling"},{key:"amount",label:"Beløb"},{key:"server",label:"Ekspedient"},{key:"served",label:t?"":"Handling"}],k=!t;for(const i of d){const l=document.createElement("th");if(l.className=i.key?`kitchen-th-${i.key}`:"",i.key&&k){l.style.cursor="pointer",l.dataset.sortColumn=i.key;let u="";m.column===i.key&&(u=m.direction==="asc"?" ▲":" ▼",l.classList.add("sort-active")),l.textContent=i.label+u,l.addEventListener("click",()=>{m.column===i.key?m.direction=m.direction==="asc"?"desc":"asc":(m.column=i.key,m.direction="asc"),localStorage.setItem("flango_kitchen_fs_sort",JSON.stringify(m)),f()})}else l.textContent=i.label;o.appendChild(l)}s.appendChild(o),r.appendChild(s);const h=document.createElement("tbody");for(const i of e){const l=P(i,!1),u=l.querySelector(".kitchen-serve-btn");u&&u.addEventListener("click",C=>{C.stopPropagation(),ee(i.id)});const I=l.querySelector(".kitchen-delete-btn");I&&I.addEventListener("click",C=>{C.stopPropagation(),re(i)}),i.kitchen_served&&(l.style.cursor="pointer",l.title="Klik for at markere som ikke-serveret",l.addEventListener("click",()=>te(i))),h.appendChild(l)}return r.appendChild(h),r}function S(){const e=a.filter(o=>!o.kitchen_served).length,t=c("#kfs-order-count");t&&(t.textContent=e);const n=c("#kfs-total-orders");n&&(n.textContent=a.length);const r=a.reduce((o,d)=>o+(Number(d.total_amount)||0),0),s=c("#kfs-daily-revenue");s&&(s.textContent=`${r.toLocaleString("da-DK")} kr`)}function x(){const e=[c("#kfs-active-orders"),c("#kfs-served-orders")];for(const t of e){if(!t||t.offsetParent===null)continue;const n=t.querySelector(".kitchen-table");if(!n)continue;n.style.transform="",n.style.transformOrigin="top left",n.style.width="100%",n.offsetHeight;const r=t.clientHeight,s=n.scrollHeight;if(s>r&&s>0){const o=Math.max(r/s,.55);n.style.transform=`scale(${o})`,n.style.transformOrigin="top left",n.style.width=`${100/o}%`}}}async function ee(e){const t=a.find(r=>r.id===e);if(!t)return;t.kitchen_served=!0,t.kitchen_served_at=new Date().toISOString(),f(),G();const{error:n}=await p.rpc("mark_sale_served",{p_sale_id:e,p_institution_id:_});n&&(console.error("[kitchen-fs] Error marking served:",n),t.kitchen_served=!1,t.kitchen_served_at=null,f())}async function te(e){await w("Bekræft",`Markér "${e.customer_name}" som IKKE serveret?`,{type:"confirm",zIndex:1e4})&&ne(e.id)}async function ne(e){const t=a.find(r=>r.id===e);if(!t)return;t.kitchen_served=!1,t.kitchen_served_at=null,f();const{error:n}=await p.rpc("unmark_sale_served",{p_sale_id:e,p_institution_id:_});n&&(console.error("[kitchen-fs] Error unmarking served:",n),t.kitchen_served=!0,t.kitchen_served_at=new Date().toISOString(),f())}async function se(){const e=a.filter(s=>!s.kitchen_served);if(e.length===0)return;const t=new Date().toISOString();for(const s of e)s.kitchen_served=!0,s.kitchen_served_at=t;f();const n=await Promise.allSettled(e.map(s=>p.rpc("mark_sale_served",{p_sale_id:s.id,p_institution_id:_})));let r=!1;n.forEach((s,o)=>{(s.status==="rejected"||s.value?.error)&&(r=!0,e[o].kitchen_served=!1,e[o].kitchen_served_at=null)}),r&&(console.error("[kitchen-fs] Some orders failed to serve"),f())}function ie(){a=a.filter(e=>!e.kitchen_served),S(),f()}async function re(e){const t=e.customer_name||"ordren";await w("Fjern fra listen?",`Fjern "${A(t)}" fra køkkenskærmen?<br><br>Ordren forsvinder kun fra visningen — ikke fra databasen.`,{type:"confirm",zIndex:1e4})&&(a=a.filter(r=>r.id!==e.id),S(),f())}function ae(){a=[],S(),f()}function oe(){y&&p.removeChannel(y),y=p.channel("kitchen-fullscreen-sales").on("postgres_changes",{event:"INSERT",schema:"public",table:"sales",filter:`institution_id=eq.${_}`},le).on("postgres_changes",{event:"UPDATE",schema:"public",table:"sales",filter:`institution_id=eq.${_}`},ce).on("postgres_changes",{event:"DELETE",schema:"public",table:"sales",filter:`institution_id=eq.${_}`},de).subscribe()}async function le(e){const t=e.new;if(!t?.id||!t.is_restaurant_order||a.some(s=>s.id===t.id))return;const{data:n}=await p.from("sales").select(`
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
        `).eq("id",t.id).single();if(!n)return;const r=z(n);a.push(r),f(),ue(r),K()}function ce(e){const t=e.new;if(!t?.id)return;const n=a.findIndex(r=>r.id===t.id);n!==-1&&(a[n].table_number=t.table_number,a[n].kitchen_note=t.kitchen_note,a[n].kitchen_served=t.kitchen_served||!1,a[n].kitchen_served_at=t.kitchen_served_at,f())}function de(e){const t=e.old;t?.id&&(a=a.filter(n=>n.id!==t.id),f())}function ue(e){if(!v)return;let t=v.querySelector("#kfs-toast-container");t||(t=document.createElement("div"),t.id="kfs-toast-container",t.className="kitchen-toast-container",v.appendChild(t));const n=document.createElement("div");n.className="kitchen-toast kitchen-toast-enter";const r=(e.items||[]).slice(0,3).map(i=>`${i.emoji&&i.emoji.startsWith("::icon::")?"🍽️":i.emoji||"🍽️"} ${i.name}${i.quantity>1?` x${i.quantity}`:""}`).join(", "),s=(e.items||[]).length-3,o=s>0?` +${s}`:"",d=e.table_number?` · Bord ${e.table_number}`:"",k=e.total_amount!=null?` · ${Number(e.total_amount).toLocaleString("da-DK")} kr`:"";n.innerHTML=`
        <div class="kitchen-toast-icon">🍽️</div>
        <div class="kitchen-toast-body">
            <div class="kitchen-toast-title">Ny ordre${d}${k}</div>
            <div class="kitchen-toast-subtitle">${A(e.customer_name)}</div>
            <div class="kitchen-toast-items">${r}${o}</div>
        </div>
        <button class="kitchen-toast-close">✕</button>
    `,n.addEventListener("click",()=>H(n)),t.appendChild(n),requestAnimationFrame(()=>{n.classList.remove("kitchen-toast-enter")});const h=setTimeout(()=>H(n),5e3);n._timer=h}function H(e){e._dismissed||(e._dismissed=!0,clearTimeout(e._timer),e.classList.add("kitchen-toast-exit"),e.addEventListener("animationend",()=>e.remove(),{once:!0}),setTimeout(()=>e.remove(),600))}function fe(){const e=v?.querySelector("#kfs-settings-overlay");if(e){e.remove();return}ke()}function ke(){const e=R(),t=V(),n=[{value:"",label:"Ingen lyd"},{value:"sounds/Accept/accepter-1.mp3",label:"Acceptér 1"},{value:"sounds/Accept/accepter-2.mp3",label:"Acceptér 2"},{value:"sounds/Accept/accepter-3.mp3",label:"Acceptér 3"},{value:"sounds/Accept/accepter-4.mp3",label:"Acceptér 4"},{value:"sounds/Accept/accepter-5.mp3",label:"Acceptér 5"},{value:"sounds/Accept/accepter-6.mp3",label:"Acceptér 6"},{value:"sounds/Accept/accepter-7.mp3",label:"Acceptér 7"},{value:"sounds/Add Item/Add1.mp3",label:"Tilføj 1"},{value:"sounds/Add Item/Add2.mp3",label:"Tilføj 2"},{value:"sounds/Login/Login1.mp3",label:"Login 1"},{value:"sounds/Login/Login2.mp3",label:"Login 2"}];function r(i,l){return n.map(u=>`<option value="${u.value}"${u.value===(l||"")?" selected":""}>${u.label}</option>`).join("")}const s=document.createElement("div");s.id="kfs-settings-overlay",s.className="kitchen-settings-overlay";const o=a.filter(i=>!i.kitchen_served).length,d=a.filter(i=>i.kitchen_served).length;s.innerHTML=`
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
                        ${g?"✓ Skjul slet-knap":"🗑️ Vis slet-knap"}
                    </button>
                </div>
            </div>
        </div>
    `,v.appendChild(s),s.querySelector(".kitchen-settings-close").addEventListener("click",()=>{s.remove()}),s.querySelector("#kfs-order-sound").addEventListener("change",i=>{U(i.target.value||null)}),s.querySelector("#kfs-serve-sound").addEventListener("change",i=>{J(i.target.value||null)});let k=null;s.querySelectorAll(".kitchen-settings-preview").forEach(i=>{i.addEventListener("click",()=>{const u=s.querySelector(`#${i.dataset.target}`)?.value;u&&(k&&k.pause(),k=new Audio(u),k.volume=.7,k.play().catch(()=>{}))})});const h=()=>{s.remove()};s.querySelector("#kfs-serve-all")?.addEventListener("click",async()=>{const i=a.filter(u=>!u.kitchen_served);i.length===0||!await w("Bekræft",`Markér alle ${i.length} aktive ordrer som serveret?`,{type:"confirm",zIndex:1e4})||(se(),h())}),s.querySelector("#kfs-clear-served")?.addEventListener("click",async()=>{const i=a.filter(u=>u.kitchen_served);i.length===0||!await w("Bekræft",`Fjern ${i.length} serverede ordrer fra listen?`,{type:"confirm",zIndex:1e4})||(ie(),h())}),s.querySelector("#kfs-reset-all")?.addEventListener("click",async()=>{a.length===0||!await w("Bekræft","Nulstil hele listen og statistikken?<br><br>Ordrer forsvinder kun fra køkkenskærmen — ikke fra databasen.",{type:"confirm",zIndex:1e4})||(ae(),h())}),s.querySelector("#kfs-toggle-delete")?.addEventListener("click",i=>{g=!g,localStorage.setItem("flango_kitchen_fs_show_delete",g?"true":"false"),v?.classList.toggle("show-delete-btn",g),i.currentTarget.textContent=g?"✓ Skjul slet-knap":"🗑️ Vis slet-knap"}),requestAnimationFrame(()=>{const i=l=>{s.contains(l.target)||l.target===c("#kfs-settings-btn")||(s.remove(),document.removeEventListener("mousedown",i))};document.addEventListener("mousedown",i)})}export{me as isKitchenFullscreenActive,W as toggleKitchenFullscreen};
