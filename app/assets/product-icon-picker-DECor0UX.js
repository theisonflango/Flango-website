import{e as T,C as je,S as Ie,f as ot,p as ve,i as Pe,t as st,a as rt,b as pt,s as _e,c as Ot,u as Bt}from"./main-C6bVUxhW.js";const Dt="A single centered food product icon in soft 3D clay style. Rounded puffy shapes, smooth matte clay texture, subtle soft shadows on the object only. Pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic like premium mobile app UI icons. Skeuomorphic but simplified - Apple-like simplicity with minimal detail. No text, no labels, no table, no background elements. The object floats on a perfectly transparent background. Clean crisp edges suitable for UI overlay.",Nt="A single centered food product icon in Pixar-style 3D rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights, gentle ambient occlusion shadows on the object only. Friendly, appealing, child-safe aesthetic. Clean and simple - minimal detail, maximum charm. No text, no labels, no background elements. The object floats on a perfectly transparent background with clean crisp edges suitable for UI overlay.",Gt="3D clay-animated style rendering. Rounded puffy shapes, smooth matte clay texture, pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic. Characters should look like high-quality clay figurines with warm, expressive faces.",Vt="Pixar/Dreamworks-style 3D animated rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights. Friendly, appealing, child-safe aesthetic with maximum charm. Characters should look like they belong in a Pixar feature film.",$e=[{emoji:"🍫",name:"Chokolade"},{emoji:"🍽️",name:"Tallerken"},{emoji:"🍷",name:"Glas"},{emoji:"🍎",name:"Æble"},{emoji:"🥜",name:"Nødder"},{emoji:"🥪",name:"Sandwich"},{emoji:"🍕",name:"Pizza"},{emoji:"🥤",name:"Sodavand"},{emoji:"🍚",name:"Ris"},{emoji:"🍣",name:"Sushi"},{emoji:"🥢",name:"Spisepinde"},{emoji:"🍞",name:"Brød"},{emoji:"🥝",name:"Kiwi"},{emoji:"🍇",name:"Vindruer"},{emoji:"🍐",name:"Pære"},{emoji:"🍉",name:"Vandmelon"},{emoji:"🍙",name:"Risbolle"},{emoji:"🍲",name:"Gryde"},{emoji:"🥘",name:"Pande"},{emoji:"🫘",name:"Bønner"},{emoji:"🍔",name:"Burger"},{emoji:"🌶️",name:"Chili"},{emoji:"🧄",name:"Hvidløg"},{emoji:"🍳",name:"Stegepande"},{emoji:"🔥",name:"Ild"},{emoji:"😋",name:"Lækkert"},{emoji:"🍰",name:"Kage"},{emoji:"♨️",name:"Varmt"},{emoji:"🍪",name:"Småkage"}],qe={reference:"📷 AI'en ser kun maden på fotoet og laver et helt nyt ikon fra bunden.",motiv:"🖼️ AI'en genskaber hele kompositionen (mad, tallerkener, personer) i valgt stil.",portrait:"🍽️ AI'en laver en animeret figur af kokken der præsenterer/holder retten."},ye=["🪄 AI'en tegner dit ikon...","🎨 Vælger de bedste farver...","✨ Tilføjer de sidste detaljer...","🖌️ Næsten klar..."],Ce=[{key:"institution",emoji:"🏠",label:"",desc:"Fra jeres ikonbibliotek",productOnly:!0},{key:"standard",emoji:"📁",label:"Standard",desc:"Flangos 3D-ikoner",productOnly:!0},{key:"emoji",emoji:"😀",label:"Emoji",desc:"Vælg en emoji som ikon",productOnly:!0},{key:"shared",emoji:"🌐",label:"Fra andre",desc:"Delte ikoner fra andre institutioner",productOnly:!0},{key:"ai",emoji:"🪄",label:"AI Ikon",desc:"Lad AI'en tegne et ikon for dig",productOnly:!1},{key:"camera",emoji:"📸",label:"Kamera",desc:"Tag foto af maden med kameraet",productOnly:!1},{key:"upload",emoji:"📤",label:"Upload",desc:"Upload eget billede som ikon",productOnly:!1}];function Kt(Ae){const{mode:lt="product",institutionId:O,productId:P,productName:Te="",currentIcon:Me,editingIcon:x,adminProfile:ct,showCustomAlert:B,playSound:fe,defaultSource:dt,onResult:M}=Ae,k=lt==="product",F=!!x;function be(e){if(!e)return;e.classList.remove("pip-disabled");const i=e.querySelector("#pip-mode-hint");i&&(i.style.display="none")}function ut(e){if(!e)return;e.classList.add("pip-disabled");const i=e.querySelector("#pip-mode-hint");i&&(i.style.display="")}let r=F?"ai":dt||(k?"institution":"ai"),v="pixar",L="reference",w=null,D=null,q=null,K=null,R=null,c=null,S=null,C=!1,p="",H=null,y=null,Z=!1,Q=!1;const Fe=localStorage.getItem("flango_institution_name")||"Jeres",Re=Ce.find(e=>e.key==="institution");Re&&(Re.label=`${Fe}s ikoner`);const oe=Ce.filter(e=>["institution","standard","emoji","shared"].includes(e.key)),He=Ce.filter(e=>["ai","camera","upload"].includes(e.key)),mt=["upload","camera","ai"].includes(r);let E=F||mt?"create":k?"select":"create";const se=document.createElement("div");se.className="pip-overlay";const j=document.createElement("div");j.className="pip-fullscreen";const vt=F?"Redigér ikon med AI":k?"Produktikon":"Opret nyt ikon";j.innerHTML=`
        <div class="pip-header">
            <button type="button" class="pip-back-btn" id="pip-header-back" aria-label="Tilbage">← Tilbage</button>
            ${k&&!F?`
            <button type="button" class="pip-header-tab ${E==="select"?"active":""}" data-cat="select">📁 Vælg ikon</button>
            <button type="button" class="pip-header-tab ${E==="create"?"active":""}" data-cat="create">🪄 Opret ikon</button>
            `:`<h2>${vt}</h2>`}
        </div>

        ${F&&x?`
        <div class="pip-edit-preview">
            <img src="${x.icon_url}" alt="${T(x.name)}">
            <div class="pip-edit-name">${T(x.name)}</div>
        </div>`:""}

        <div class="pip-source-zone" id="pip-source-zone"></div>

        <div class="pip-content-zone" id="pip-content"></div>

        <div class="pip-footer">
            <button type="button" class="pip-manage-library-btn" style="margin-right:auto;padding:10px 20px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.1);color:#e2e8f0;cursor:pointer;font-size:14px;font-weight:600" title="Administrer Ikoner">📂 Administrer Ikoner</button>
            ${!k||F?`<input type="text" class="pip-name-input" placeholder="Ikon-navn" value="${T(x?.name||Te||"")}">`:'<div class="pip-footer-spacer"></div>'}
            <button type="button" class="pip-cancel-btn">Annuller</button>
            <button type="button" class="pip-save-btn" disabled>${k?"Vælg":"Gem ikon"}</button>
        </div>
    `,se.appendChild(j),document.body.appendChild(se);const _=j.querySelector("#pip-content"),Y=j.querySelector("#pip-source-zone"),W=j.querySelector(".pip-save-btn");let l=null;const $=()=>se.remove();j.querySelector(".pip-cancel-btn").addEventListener("click",$),j.querySelector("#pip-header-back")?.addEventListener("click",$),j.querySelector(".pip-manage-library-btn")?.addEventListener("click",()=>{const e={...Ae};$(),typeof window.__flangoOpenIconLibrary=="function"&&window.__flangoOpenIconLibrary(()=>{Kt(e)})});function yt(){j.querySelectorAll(".pip-header-tab").forEach(e=>{e.classList.toggle("active",e.dataset.cat===E)})}j.querySelectorAll(".pip-header-tab").forEach(e=>{e.addEventListener("click",()=>{E=e.dataset.cat,r=(E==="select"?oe:He)[0].key,p="",yt(),ee(),N(),f()})});function ee(){if(F){Y.style.display="none";return}const e=E==="select"?oe:He;Y.innerHTML=`
            <div class="pip-subsource-row">
                <div class="pip-source-cards">
                    ${e.map(i=>`
                        <button type="button" class="pip-source-card ${i.key===r?"active":""}" data-source="${i.key}">
                            <span class="pip-source-emoji">${i.emoji}</span>
                            <span class="pip-source-label">${i.label}</span>
                            <span class="pip-source-desc">${i.desc}</span>
                        </button>
                    `).join("")}
                </div>
                <div class="pip-preview-box">
                    <span class="pip-preview-placeholder">❓</span>
                    <div class="pip-preview-label">Intet valgt</div>
                    <button type="button" class="pip-preview-clear" style="display:none" title="Fjern valgt ikon">✕</button>
                </div>
            </div>
        `,l=Y.querySelector(".pip-preview-box"),l.querySelector(".pip-preview-clear"),S?l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>':Me?.url&&(S=`<img src="${Me.url}"><div class="pip-preview-label">Nuværende ikon</div>`,l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),l.querySelector(".pip-preview-clear")?.addEventListener("click",i=>{i.stopPropagation(),te()}),Y.querySelectorAll(".pip-source-card").forEach(i=>{i.addEventListener("click",()=>{r===i.dataset.source?(r=null,Y.querySelectorAll(".pip-source-card").forEach(s=>s.classList.remove("active"))):(r=i.dataset.source,Y.querySelectorAll(".pip-source-card").forEach(s=>s.classList.toggle("active",s.dataset.source===r))),N(),f()})})}async function ft(e){if(!H){H=[];try{(await rt(O)).forEach(n=>H.push({label:n.name,path:n.icon_url,source:Fe,imgSrc:n.icon_url,tags:n.tags||""}))}catch{}Ie.forEach(t=>H.push({label:t.label,path:t.path,source:"Standard",imgSrc:t.path})),$e.forEach(({emoji:t,name:n})=>H.push({label:n,path:null,source:"Emoji",emoji:t}));try{(await ot(O)).icon_use_shared_enabled&&(await pt(O)).forEach(a=>H.push({label:a.name,path:a.icon_url,source:"Delt",imgSrc:a.icon_url,tags:a.tags||""}))}catch{}}const i=p?H.filter(t=>t.label.toLowerCase().includes(p)||t.source.toLowerCase().includes(p)||(t.tags||"").toLowerCase().includes(p)):H;if(i.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:'<div class="pip-empty-state">Ingen ikoner fundet</div>';return}if(p){const t=document.createElement("div");t.style.cssText="font-size:13px;color:#64748b;margin-bottom:12px;",t.textContent=`${i.length} resultat${i.length===1?"":"er"}`,e.appendChild(t)}const s=document.createElement("div");s.className="pip-icon-grid",i.forEach(t=>{const n=document.createElement("div");n.className=`pip-icon-option ${c===t.path?"selected":""}`,t.emoji?(n.innerHTML=`<span style="font-size:40px">${t.emoji}</span><span>${t.source}</span>`,n.addEventListener("click",()=>{if(C&&t.path){re(t.path,t.id);return}y=t.emoji,c=null,S=`<span style="font-size:48px">${t.emoji}</span><div class="pip-preview-label">Emoji</div>`,l&&(l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),l?.querySelector(".pip-preview-clear")?.addEventListener("click",te),f()})):(n.dataset.path=t.path,n.innerHTML=`<img src="${t.imgSrc}" alt="${t.label}"><span>${t.label}<br><small style="color:#64748b">${t.source}</small></span>`,n.addEventListener("click",()=>{if(C){re(t.path,t.id);return}c=t.path,y=null,s.querySelectorAll(".pip-icon-option").forEach(a=>a.classList.toggle("selected",a.dataset.path===t.path)),z(t.imgSrc,t.label),f()})),s.appendChild(n)}),e.appendChild(s)}async function re(e,i){C=!1;try{const t=await(await fetch(e)).blob(),n=new File([t],"ref.webp",{type:t.type||"image/webp"}),a=await ve(n);E="create",r="ai",ee(),N(),setTimeout(()=>{Ue(a),D=i||null},50)}catch(s){console.error("[referencePickComplete]",s),C=!1}}function z(e,i){l&&(e?(S=`<img src="${e}">`+(i?`<div class="pip-preview-label">${i}</div>`:""),l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>',l.querySelector(".pip-preview-clear")?.addEventListener("click",te)):te(),l.classList.remove("generating"))}function te(){S=null,c=null,y=null,q=null,l&&(l.innerHTML='<span class="pip-preview-placeholder">❓</span><div class="pip-preview-label">Intet valgt</div>'),f()}function bt(){l&&(l.innerHTML='<span class="pip-preview-placeholder">🪄</span><div class="pip-preview-label">Genererer...</div>',l.classList.add("generating"))}function gt(){l&&(l.classList.remove("generating"),l.innerHTML='<span class="pip-preview-placeholder">⚠️</span><div class="pip-preview-label">Mislykkedes</div>')}function f(){let e=!1;r===null?e=!!(c||y):r==="standard"?e=!!c:r==="emoji"?e=!!y:r==="institution"||r==="shared"?e=!!c:r==="upload"?e=!!K:r==="camera"?e=!!R:r==="ai"&&(e=!!q),W.disabled=!e}W.addEventListener("click",async()=>{if(r===null){y?(M({type:"emoji",emoji:y}),$()):c&&(M({type:"icon",emoji:`${je}${c}`,url:c}),$());return}if(r==="standard")c&&M({type:"standard",emoji:`${je}${c}`,url:c}),$();else if(r==="emoji")y&&M({type:"emoji",emoji:y}),$();else if(r==="institution"||r==="shared")c&&M({type:"icon",emoji:`${je}${c}`,url:c}),$();else if(r==="upload"||r==="camera"){const e=r==="upload"?K:R;if(!e)return;W.disabled=!0,W.textContent="Gemmer...";try{const i=ct?.user_id;if(!i)throw new Error("Admin bruger ID ikke fundet");const s=await ve(e),t=P||crypto.randomUUID(),n=new File([s],`${t}.webp`,{type:"image/webp"}),a=await Bt(n,O,t,i);if(a.success)fe?.("success"),M({type:"upload",url:a.icon_signed_url||a.icon_url,storagePath:a.icon_storage_path,updatedAt:a.icon_updated_at}),$();else throw new Error(a.error||"Upload fejlede")}catch(i){console.error("[pip save]",i),B?.("Fejl",i.message),W.textContent=k?"Vælg":"Gem ikon",f()}}else r==="ai"&&q&&(M({type:"ai",url:q,metadata:{style:v,photoMode:L}}),$())});function N(){if(_.innerHTML="",C){const e=document.createElement("div");e.style.cssText="padding:10px 16px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:#c4b5fd;",e.innerHTML=`<span style="font-size:20px">🖼️</span> <span>Vælg et ikon som foto-reference til AI — klik på det ikon du vil bruge</span>
                <button type="button" style="margin-left:auto;background:none;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;padding:4px 12px;cursor:pointer;font-size:12px;font-weight:600;" id="pip-cancel-pick">Annuller</button>`,_.appendChild(e),e.querySelector("#pip-cancel-pick").addEventListener("click",()=>{C=!1,E="create",r="ai",ee(),N()})}if(E==="select"){const e=document.createElement("div");e.className="pip-search-row",e.innerHTML=`<input type="text" class="pip-search-input" id="pip-search" placeholder="🔍 Søg ${r?"i "+(oe.find(n=>n.key===r)?.label||""):"i alle ikoner"}..." value="${T(p)}" autocomplete="off"><button type="button" class="pip-search-clear" id="pip-search-clear" ${p?"":'style="display:none"'}>✕</button>`,_.appendChild(e);let i=null;const s=e.querySelector("#pip-search"),t=e.querySelector("#pip-search-clear");s.addEventListener("input",()=>{clearTimeout(i),t.style.display=s.value?"":"none",i=setTimeout(()=>{p=s.value.trim().toLowerCase(),ge()},250)}),t.addEventListener("click",()=>{p="",s.value="",t.style.display="none",s.focus(),ge()}),s.focus()}ge()}function ge(){const e=_.querySelector(".pip-content-section");e&&e.remove();const i=document.createElement("div");if(i.className="pip-content-section",E==="select"&&r===null)ft(i);else switch(r){case"standard":ht(i);break;case"emoji":kt(i);break;case"institution":St(i);break;case"shared":wt(i);break;case"upload":Lt(i);break;case"camera":Et(i);break;case"ai":jt(i);break}_.appendChild(i)}function ht(e){const i=document.createElement("div");i.className="pip-icon-grid";const s=p?Ie.filter(t=>t.label.toLowerCase().includes(p)):Ie;if(s.length===0){e.innerHTML=`<div class="pip-empty-state">Ingen standard-ikoner matcher "${T(p)}"</div>`;return}s.forEach(t=>{const n=document.createElement("div");n.className=`pip-icon-option ${c===t.path?"selected":""}`,n.dataset.path=t.path,n.innerHTML=`<img src="${t.path}" alt="${t.label}"><span>${t.label}</span>`,n.addEventListener("click",()=>{if(C){re(t.path,t.id);return}c=t.path,y=null,e.querySelectorAll(".pip-icon-option").forEach(a=>a.classList.toggle("selected",a.dataset.path===t.path)),z(t.path,t.label),f()}),i.appendChild(n)}),e.appendChild(i)}function kt(e){const i=p?$e.filter(n=>n.name.toLowerCase().includes(p)||n.emoji.includes(p)):$e;e.innerHTML=`
            <div style="margin-bottom:16px">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px">Vælg en emoji</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px">Klik på en emoji nedenfor, eller skriv din egen i feltet</div>
            </div>
            <input type="text" class="pip-name-input" id="pip-emoji-input" placeholder="Indtast emoji her..." value="${y||""}" style="width:100%;max-width:300px;font-size:24px;text-align:center;margin-bottom:16px">
            <div class="pip-icon-grid" id="pip-emoji-grid"></div>
        `,i.length===0&&(e.querySelector("#pip-emoji-grid").innerHTML=`<div class="pip-empty-state">Ingen emojis matcher "${T(p)}"</div>`);const s=e.querySelector("#pip-emoji-input"),t=e.querySelector("#pip-emoji-grid");i.forEach(({emoji:n,name:a})=>{const d=document.createElement("div");d.className="pip-icon-option",d.innerHTML=`<span style="font-size:36px">${n}</span><span>${a}</span>`,d.addEventListener("click",()=>{y=n,c=null,s.value=n,S=`<span style="font-size:48px">${n}</span><div class="pip-preview-label">${a}</div>`,l&&(l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),l?.querySelector(".pip-preview-clear")?.addEventListener("click",te),f()}),t.appendChild(d)}),s.addEventListener("input",()=>{y=s.value||null,c=null,y&&(S=`<span style="font-size:48px">${y}</span><div class="pip-preview-label">Emoji</div>`,l&&(l.innerHTML=S)),f()})}function St(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',ze(e,()=>rt(O),"Ingen egne ikoner endnu — upload eller generer via AI.")}function wt(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',xt(e)}async function xt(e){if(e||(e=_.querySelector(".pip-content-section")),!e)return;if(!(await ot(O)).icon_use_shared_enabled){e.innerHTML='<div class="pip-empty-state">Brug af delte ikoner er ikke aktiveret. Slå det til under Institutionsindstillinger.</div>';return}ze(e,()=>pt(),"Ingen delte ikoner tilgængelige endnu.")}async function ze(e,i,s){let t=await i();if(e.innerHTML="",p&&(console.log("[loadIconGrid] Searching for:",p,"in",t.length,"icons. Sample tags:",t.slice(0,3).map(a=>a.name+":"+(a.tags||"none"))),t=t.filter(a=>a.name.toLowerCase().includes(p)||(a.tags||"").toLowerCase().includes(p)),console.log("[loadIconGrid] After filter:",t.length,"matches")),t.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:`<div class="pip-empty-state">${s}</div>`;return}const n=document.createElement("div");n.className="pip-icon-grid",t.forEach(a=>{const d=document.createElement("div");d.className=`pip-icon-option ${c===a.icon_url?"selected":""}`,d.dataset.path=a.icon_url;const m=a.source==="uploaded"?"📤":"🪄";d.innerHTML=`<img src="${a.icon_url}" alt="${a.name}"><span>${m} ${a.name}</span>`,d.addEventListener("click",()=>{if(C){re(a.icon_url,a.id);return}c=a.icon_url,y=null,n.querySelectorAll(".pip-icon-option").forEach(G=>G.classList.toggle("selected",G.dataset.path===a.icon_url)),z(a.icon_url,a.name),f()}),n.appendChild(d)}),e.appendChild(n)}function Lt(e){e.innerHTML=`
            <div class="pip-dropzone" id="pip-upload-drop">
                <div class="pip-dropzone-icon">📤</div>
                <div class="pip-dropzone-title">Træk et billede hertil</div>
                <div class="pip-dropzone-desc">eller klik for at vælge fra din enhed<br><small>WebP, PNG, JPEG — konverteres automatisk</small></div>
                <input type="file" accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg" style="display:none">
            </div>
            <div class="pip-upload-preview" id="pip-upload-preview" style="display:none">
                <img id="pip-upload-img">
                <div style="margin-top:10px"><button type="button" class="pip-btn-secondary" id="pip-upload-remove">✕ Fjern billede</button></div>
            </div>
            <label class="pip-bg-removal">
                <input type="checkbox" id="pip-remove-bg">
                <div>
                    <div class="pip-bg-removal-label">Forsøg at fjerne baggrund</div>
                    <div class="pip-bg-removal-desc">Virker bedst på billeder med ensfarvet baggrund (fx hvid)</div>
                </div>
            </label>`;const i=e.querySelector("#pip-upload-drop"),s=e.querySelector("input[type=file]"),t=e.querySelector("#pip-upload-preview"),n=e.querySelector("#pip-upload-img"),a=e.querySelector("#pip-upload-remove");i.addEventListener("click",()=>s.click()),s.addEventListener("change",m=>{m.target.files[0]&&d(m.target.files[0]),m.target.value=""}),i.addEventListener("dragover",m=>{m.preventDefault(),i.classList.add("dragover")}),i.addEventListener("dragleave",()=>i.classList.remove("dragover")),i.addEventListener("drop",m=>{m.preventDefault(),i.classList.remove("dragover"),m.dataTransfer.files[0]&&d(m.dataTransfer.files[0])}),a.addEventListener("click",()=>{K=null,t.style.display="none",i.style.display="",z(null),f()});async function d(m){try{K=await ve(m),n.src=URL.createObjectURL(K),t.style.display="",i.style.display="none",z(n.src,"Uploadet billede"),f()}catch(G){console.error("[upload]",G)}}}function Et(e){e.innerHTML=`
            <div class="pip-camera-trigger" id="pip-cam-trigger">
                <div class="pip-dropzone-icon">📸</div>
                <div class="pip-dropzone-title">Klik for at tage billede</div>
                <div class="pip-dropzone-desc">Billedet konverteres automatisk til ikon-format</div>
            </div>
            <div class="pip-camera-preview" id="pip-cam-preview" style="display:none">
                <img id="pip-cam-img">
                <div class="pip-camera-actions">
                    <button type="button" class="pip-btn-primary" id="pip-cam-use">Brug som ikon</button>
                    <button type="button" class="pip-btn-ai-ref" id="pip-cam-ai">Brug som AI-reference</button>
                    <button type="button" class="pip-btn-secondary" id="pip-cam-retake">🔄 Tag nyt</button>
                </div>
            </div>`;const i=e.querySelector("#pip-cam-trigger"),s=e.querySelector("#pip-cam-preview"),t=e.querySelector("#pip-cam-img"),n=async()=>{try{const a=await st({showCustomAlert:B});a&&(R=a,t.src=URL.createObjectURL(a),s.style.display="",i.style.display="none",z(t.src,"Foto"),f())}catch(a){console.error("[camera]",a)}};i.addEventListener("click",n),e.querySelector("#pip-cam-retake").addEventListener("click",()=>{R=null,s.style.display="none",i.style.display="",z(null),f(),n()}),e.querySelector("#pip-cam-use").addEventListener("click",()=>{R&&(K=R,r="camera",f())}),e.querySelector("#pip-cam-ai").addEventListener("click",()=>{if(!R)return;const a=R;r="ai",sourceCards.forEach(d=>d.classList.toggle("active",d.dataset.source==="ai")),N(),setTimeout(()=>Ue(a),50)})}function jt(e){const i=T(Te||x?.name||"");e.innerHTML=`
            <!-- Step 1: Product name -->
            <div class="pip-ai-step" id="pip-ai-step1">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">1</span>
                    <span class="pip-step-label">Hvad skal ikonet forestille?</span>
                    <span style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">valgfrit hvis du bruger foto</span>
                </div>
                <div class="pip-step-hint">Skriv navnet på produktet — eller upload et foto i trin ③</div>
                <div style="margin-left:38px">
                    <input type="text" class="pip-name-input" id="pip-ai-name" placeholder="fx Pasta med kødsovs" maxlength="100" value="${i}" style="width:100%;max-width:500px">
                </div>
            </div>

            <!-- Step 2: Style -->
            <div class="pip-ai-step" id="pip-ai-step2">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">2</span>
                    <span class="pip-step-label">Vælg stil</span>
                </div>
                <div class="pip-step-hint">Bestemmer hvordan ikonet kommer til at se ud</div>
                <div class="pip-style-cards">
                    <button type="button" class="pip-style-card active" data-style="pixar">
                        <span class="pip-card-emoji">🎬</span>
                        <div class="pip-card-label">Pixar</div>
                        <div class="pip-card-desc">Blankt look med klare farver og glans</div>
                    </button>
                    <button type="button" class="pip-style-card" data-style="clay">
                        <span class="pip-card-emoji">🏺</span>
                        <div class="pip-card-label">Clay</div>
                        <div class="pip-card-desc">Blødt 3D med runde former og pastelfarver</div>
                    </button>
                    <button type="button" class="pip-style-card" data-style="custom">
                        <span class="pip-card-emoji">✍️</span>
                        <div class="pip-card-label">Fri prompt</div>
                        <div class="pip-card-desc">Du skriver selv hvad AI'en skal tegne</div>
                    </button>
                </div>
            </div>

            <!-- Custom prompt (only when "Fri prompt" selected) -->
            <div class="pip-custom-prompt-section" id="pip-custom-section" style="display:none">
                <textarea id="pip-custom-prompt" placeholder="Beskriv præcis hvad du vil have — fx 'A golden crispy croissant floating in space with sparkles'" maxlength="500"></textarea>
                <div class="pip-custom-prompt-hint">Prompten sendes direkte til AI — ingen automatisk stil tilføjes</div>
            </div>

            <!-- Step 3: Photo reference -->
            <div class="pip-ai-step" id="pip-ai-step3">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">3</span>
                    <span class="pip-step-label">Foto-reference</span>
                    <span style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">valgfrit</span>
                </div>
                <div class="pip-step-hint">Upload et foto af maden — så kan AI'en bruge det som inspiration</div>
                <div class="pip-photo-actions" id="pip-photo-actions">
                    <button type="button" class="pip-photo-btn" id="pip-photo-camera">
                        <span class="pip-btn-icon">📸</span> Tag foto
                    </button>
                    <button type="button" class="pip-photo-btn" id="pip-photo-pick"><span class="pip-btn-icon">📁</span> Vælg ikon</button>
                    <button type="button" class="pip-photo-btn" id="pip-photo-file">
                        <span class="pip-btn-icon">📁</span> Vælg fil
                        <input type="file" accept="image/*" style="display:none">
                    </button>
                </div>
                <div class="pip-photo-preview" id="pip-photo-preview" style="display:none">
                    <img id="pip-photo-img">
                    <div>
                        <div style="font-size:12px;font-weight:600;margin-bottom:4px">Foto valgt</div>
                        <button type="button" class="pip-photo-remove-btn" id="pip-photo-remove">✕ Fjern foto</button>
                    </div>
                </div>
            </div>

            <!-- Step 4: Photo mode (always visible, dimmed without photo) -->
            <div class="pip-ai-step pip-mode-section ${w?"":"pip-disabled"}" id="pip-mode-section">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">4</span>
                    <span class="pip-step-label">Foto-tilstand</span>
                    <span class="pip-mode-hint" id="pip-mode-hint" ${w?'style="display:none"':""} style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">upload foto i trin ③ først</span>
                </div>
                <div class="pip-step-hint">Bestemmer hvordan AI'en bruger dit foto</div>
                <div class="pip-mode-cards" style="margin-left:38px">
                    <button type="button" class="pip-mode-card active" data-mode="reference">
                        <span class="pip-card-emoji">📷</span>
                        <div class="pip-card-label">Reference</div>
                        <div class="pip-card-desc">Identificer maden og lav nyt ikon</div>
                    </button>
                    <button type="button" class="pip-mode-card" data-mode="motiv">
                        <span class="pip-card-emoji">🖼️</span>
                        <div class="pip-card-label">Motiv</div>
                        <div class="pip-card-desc">Genskab hele kompositionen</div>
                    </button>
                    ${Pe()?`<button type="button" class="pip-mode-card" data-mode="portrait">
                        <span class="pip-card-emoji">🍽️</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Kokken præsenterer maden</div>
                    </button>`:`<button type="button" class="pip-mode-card pip-mode-locked" data-mode="portrait" aria-disabled="true" title="Kan aktiveres via superadmin" style="opacity:.55;cursor:not-allowed">
                        <span class="pip-card-emoji">🔒</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Aktiveres via superadmin</div>
                    </button>`}
                </div>
                <div class="pip-mode-desc-text" id="pip-mode-desc">${qe.reference}</div>
            </div>

            <!-- Advanced prompts -->
            <details class="pip-advanced-details" id="pip-advanced">
                <summary>Avanceret — redigér prompts</summary>
                <div style="margin-top:8px">
                    <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Stil-prompt</label>
                    <textarea class="pip-prompt-area" id="pip-style-prompt"></textarea>
                </div>
                <div style="margin-top:12px">
                    <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Foto-tilstand prompt</label>
                    <textarea class="pip-prompt-area" id="pip-photo-prompt"></textarea>
                </div>
                <button type="button" class="pip-reset-prompt-btn" id="pip-reset-prompts">↺ Nulstil prompts</button>
            </details>

            <!-- Generate -->
            <button type="button" class="pip-generate-btn" id="pip-generate">🪄 Generér ikon</button>

            <!-- Loading -->
            <div class="pip-generate-loading" id="pip-loading" style="display:none">
                <div class="pip-loading-spinner">🪄</div>
                <div class="pip-loading-message" id="pip-loading-msg">${ye[0]}</div>
            </div>

            <!-- Error -->
            <div class="pip-generate-error" id="pip-error" style="display:none">
                <div class="pip-error-icon">⚠️</div>
                <div class="pip-error-message" id="pip-error-msg"></div>
                <button type="button" class="pip-btn-secondary" id="pip-error-retry">🔄 Prøv igen</button>
            </div>

            <!-- Result -->
            <div class="pip-ai-result" id="pip-result" style="display:none">
                <img id="pip-result-img">
                <div class="pip-result-label" id="pip-result-label"></div>
                <div class="pip-result-actions">
                    <button type="button" class="pip-btn-secondary" id="pip-retry">🔄 Prøv igen</button>
                </div>
            </div>
        `,It(e)}function It(e){const i=e.querySelector("#pip-ai-name"),s=e.querySelectorAll(".pip-style-card"),t=e.querySelector("#pip-custom-section"),n=e.querySelector("#pip-custom-prompt"),a=e.querySelector("#pip-ai-step1"),d=e.querySelector("#pip-photo-actions"),m=e.querySelector("#pip-photo-preview"),G=e.querySelector("#pip-photo-img"),Oe=e.querySelector("#pip-photo-remove"),Be=e.querySelector("#pip-photo-file"),De=Be?.querySelector("input"),Pt=e.querySelector("#pip-photo-camera"),J=e.querySelector("#pip-mode-section"),he=e.querySelectorAll(".pip-mode-card"),Ne=e.querySelector("#pip-mode-desc"),pe=e.querySelector("#pip-generate"),Ge=e.querySelector("#pip-loading"),Ve=e.querySelector("#pip-loading-msg"),ke=e.querySelector("#pip-result"),_t=e.querySelector("#pip-result-img"),$t=e.querySelector("#pip-result-label"),qt=e.querySelector("#pip-retry"),ie=e.querySelector("#pip-error"),Ke=e.querySelector("#pip-error-msg"),Ct=e.querySelector("#pip-error-retry"),le=e.querySelector("#pip-advanced"),ce=e.querySelector("#pip-style-prompt"),de=e.querySelector("#pip-photo-prompt"),At=e.querySelector("#pip-reset-prompts");s.forEach(o=>{o.addEventListener("click",()=>{v=o.dataset.style,s.forEach(I=>I.classList.toggle("active",I===o));const b=v==="custom";if(t.style.display=b?"block":"none",a.style.display=b?"none":"block",J){const I=b||!w;J.classList.toggle("pip-disabled",I);const X=J.querySelector("#pip-mode-hint");X&&(X.style.display=I?"":"none")}U()})}),Be?.addEventListener("click",()=>De?.click()),De?.addEventListener("change",o=>{o.target.files[0]&&Ye(o.target.files[0]),o.target.value=""}),e.querySelector("#pip-photo-pick")?.addEventListener("click",()=>{C=!0,E="select",r=oe[0].key,ee(),N()}),Pt?.addEventListener("click",async()=>{try{const o=await st({showCustomAlert:B});o&&Ye(o)}catch(o){console.error("[aiPhotoCamera]",o)}}),Oe?.addEventListener("click",Mt);async function Ye(o){try{D=null,w=await ve(o),Tt(w)}catch(b){console.error("[aiPhoto]",b)}}function Tt(o){G.src=URL.createObjectURL(o),m.style.display="flex",d.style.display="none",v!=="custom"&&be(J),U()}function Mt(){w=null,D=null,m.style.display="none",d.style.display="flex",ut(J),U()}he.forEach(o=>{o.addEventListener("click",()=>{if(o.dataset.mode==="portrait"&&!Pe()){B?.("Ikke tilgængelig","Mad Portræt kan aktiveres af superadmin.");return}L=o.dataset.mode,he.forEach(b=>b.classList.toggle("active",b===o)),Ne.textContent=qe[L]||"",U()})});function Ft(){return v==="custom"?"":L==="portrait"&&!!w?v==="pixar"?Vt:Gt:v==="pixar"?Nt:Dt}function Rt(){const o=i?.value?.trim()||"";return v==="custom"?"":w?L==="portrait"?`Transform into ${v==="clay"?"clay-animated":"Pixar/Dreamworks-style animated"} version. Person (cook/chef) proudly presenting food. Preserve features. Include food prominently.${o?` Dish: ${o}`:""}`:L==="motiv"?`Recreate composition from photo as 3D icon. Keep food arrangement, render in ${v==="pixar"?"glossy Pixar":"Flango clay"} style. If people appear, include as stylized characters.${o?` Product: ${o}`:""}`:`Use photo only to identify food. Create fresh ${v==="pixar"?"Pixar-style":"clay-style"} icon. Ignore background/angle. Include container only if needed.${o?` Product: ${o}`:""}`:`The food item is: ${o}
Include a bowl, plate, cup, or container only if the food needs one.`}function U(){le?.open&&(!Z&&ce&&(ce.value=Ft()),!Q&&de&&(de.value=Rt()))}le?.addEventListener("toggle",()=>{le.open&&(Z=!1,Q=!1,U())}),ce?.addEventListener("input",()=>{Z=!0}),de?.addEventListener("input",()=>{Q=!0}),At?.addEventListener("click",()=>{Z=!1,Q=!1,U()}),i?.addEventListener("input",U);let Se=!1,Je=null;async function we(){if(Se)return;const o=v==="custom",b=i?.value?.trim()||"",I=n?.value?.trim()||"",X=!!w;if(o&&!I){B?.("Manglende prompt","Skriv en prompt i tekstfeltet");return}if(!o&&!b&&!X){B?.("Manglende input","Skriv et produktnavn eller upload et foto");return}Se=!0,pe.style.display="none",ke.style.display="none",ie&&(ie.style.display="none"),Ge.style.display="block",bt(),q=null;let Xe=!1,xe=0;Ve.textContent=ye[0],Je=setInterval(()=>{xe=(xe+1)%ye.length,Ve.textContent=ye[xe]},3e3);try{const{data:{session:ue}}=await _e.auth.getSession(),ae=ue?.access_token||"",Ze=_e.supabaseUrl||_e.rest?.url?.replace("/rest/v1","")||"",ne=le?.open&&(Z||Q),Qe=ne?((ce?.value?.trim()||"")+`

`+(de?.value?.trim()||"")).trim():"",We={Authorization:`Bearer ${ae}`};let g;const et=h=>{D?h.append("reference_icon_id",D):h.append(k?"reference_image":"photo",w,"photo.webp")};if(X&&!o&&!ne)g=new FormData,k&&P?g.append("product_id",P):g.append("save_to_library_only","true"),g.append("product_name",b),et(g),g.append("style",v),g.append("photo_mode",L);else if(X)g=new FormData,k&&P?g.append("product_id",P):g.append("save_to_library_only","true"),g.append("product_name",b),et(g),g.append("prompt_mode","custom"),g.append("custom_prompt",ne?Qe:I);else{We["Content-Type"]="application/json";const h={product_name:b,style:o?"custom":v};k&&P?h.product_id=P:h.save_to_library_only=!0,(o||ne)&&(h.prompt_mode="custom",h.custom_prompt=ne?Qe:I||b),g=JSON.stringify(h)}const u=await(await fetch(`${Ze}/functions/v1/generate-product-icon`,{method:"POST",headers:We,body:g})).json();if(!u.success)throw new Error(u.error||"Generering fejlede");if(!u.image_base64)throw new Error("Ingen billede-data fra serveren");const Le=atob(u.image_base64),tt=new Uint8Array(Le.length);for(let h=0;h<Le.length;h++)tt[h]=Le.charCodeAt(h);const it=new Blob([tt],{type:`image/${u.format||"webp"}`}),at=await Ot(it);console.log(`[AI Generate] Raw ${(it.size/1024).toFixed(1)}KB → Compressed ${(at.size/1024).toFixed(1)}KB`);const Ht=u.fallback_name||b||"AI ikon",A=new FormData;A.append("file",new File([at],"ai-icon.webp",{type:"image/webp"})),A.append("institutionId",O),k&&P?A.append("productId",P):A.append("skipProduct","true"),A.append("libraryName",Ht),u.style&&A.append("aiStyle",String(u.style)),u.mode&&A.append("aiPhotoMode",String(u.mode)),u.prompt_mode&&A.append("aiPromptMode",String(u.prompt_mode));const Ee=await fetch(`${Ze}/functions/v1/upload-product-icon`,{method:"POST",headers:{Authorization:`Bearer ${ae}`},body:A}),V=await Ee.json().catch(()=>({}));if(!Ee.ok||!V?.success)throw new Error(V?.error||`Upload fejlede (${Ee.status})`);const nt=V.icon_signed_url||V.icon_url||null,zt=V.icon_storage_path||null,Ut=V.library_icon_url||null;q=nt||Ut,_t.src=q,ke.style.display="block";const me=[];if(u.style&&me.push(u.style==="clay"?"🏺 Clay":u.style==="pixar"?"🎬 Pixar":"✍️ Fri prompt"),u.mode){const h={"photo-reference":"📷 Reference","photo-motiv":"🖼️ Motiv","photo-avatar":"👤 Avatar","photo-portrait":"🍽️ Mad Portræt",text:"✏️ Tekst","custom-photo":"🎨 Fri prompt","custom-text":"🎨 Fri prompt"};me.push(h[u.mode]||u.mode)}$t.textContent=me.join(" · "),z(q,me.join(" · ")),f(),fe?.("success"),k&&P&&M({type:"ai",url:nt,storagePath:zt,updatedAt:V.icon_updated_at,metadata:{style:v,photoMode:L}})}catch(ue){console.error("[AI Generate]",ue),Xe=!0;const ae=ue?.message||"Generering fejlede";ie&&Ke?(Ke.textContent=ae,ie.style.display="flex"):B?.("AI Fejl",ae),gt(),fe?.("error")}finally{clearInterval(Je),Ge.style.display="none",!q&&!Xe&&(pe.style.display="block"),Se=!1}}pe?.addEventListener("click",we),qt?.addEventListener("click",()=>{ke.style.display="none",pe.style.display="block",we()}),Ct?.addEventListener("click",()=>{ie.style.display="none",we()}),F&&x&&(L=Pe()?"portrait":"reference",he.forEach(o=>o.classList.toggle("active",o.dataset.mode===L)),Ne.textContent=qe[L]||"",Oe.style.display="none",d.style.display="none",G.src=x.icon_url,m.style.display="flex",be(J),D=x.id||null,fetch(x.icon_url).then(o=>o.blob()).then(o=>{w=new File([o],"ref.webp",{type:"image/webp"}),U()}).catch(o=>console.error("[fetchEditIcon]",o)))}function Ue(e){w=e,D=null;const i=_.querySelector("#pip-photo-preview"),s=_.querySelector("#pip-photo-img"),t=_.querySelector("#pip-photo-actions"),n=_.querySelector("#pip-mode-section");s&&(s.src=URL.createObjectURL(e)),i&&(i.style.display="flex"),t&&(t.style.display="none"),n&&v!=="custom"&&be(n)}ee(),N()}export{Kt as openProductIconPicker};
