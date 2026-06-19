import{e as T,C as Ee,S as je,f as at,p as me,i as Ie,t as nt,a as ot,b as st,s as Pe,c as zt,u as Ut}from"./main-CmJK4b0j.js";const Ot="A single centered food product icon in soft 3D clay style. Rounded puffy shapes, smooth matte clay texture, subtle soft shadows on the object only. Pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic like premium mobile app UI icons. Skeuomorphic but simplified - Apple-like simplicity with minimal detail. No text, no labels, no table, no background elements. The object floats on a perfectly transparent background. Clean crisp edges suitable for UI overlay.",Bt="A single centered food product icon in Pixar-style 3D rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights, gentle ambient occlusion shadows on the object only. Friendly, appealing, child-safe aesthetic. Clean and simple - minimal detail, maximum charm. No text, no labels, no background elements. The object floats on a perfectly transparent background with clean crisp edges suitable for UI overlay.",Dt="3D clay-animated style rendering. Rounded puffy shapes, smooth matte clay texture, pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic. Characters should look like high-quality clay figurines with warm, expressive faces.",Nt="Pixar/Dreamworks-style 3D animated rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights. Friendly, appealing, child-safe aesthetic with maximum charm. Characters should look like they belong in a Pixar feature film.",$e=[{emoji:"🍫",name:"Chokolade"},{emoji:"🍽️",name:"Tallerken"},{emoji:"🍷",name:"Glas"},{emoji:"🍎",name:"Æble"},{emoji:"🥜",name:"Nødder"},{emoji:"🥪",name:"Sandwich"},{emoji:"🍕",name:"Pizza"},{emoji:"🥤",name:"Sodavand"},{emoji:"🍚",name:"Ris"},{emoji:"🍣",name:"Sushi"},{emoji:"🥢",name:"Spisepinde"},{emoji:"🍞",name:"Brød"},{emoji:"🥝",name:"Kiwi"},{emoji:"🍇",name:"Vindruer"},{emoji:"🍐",name:"Pære"},{emoji:"🍉",name:"Vandmelon"},{emoji:"🍙",name:"Risbolle"},{emoji:"🍲",name:"Gryde"},{emoji:"🥘",name:"Pande"},{emoji:"🫘",name:"Bønner"},{emoji:"🍔",name:"Burger"},{emoji:"🌶️",name:"Chili"},{emoji:"🧄",name:"Hvidløg"},{emoji:"🍳",name:"Stegepande"},{emoji:"🔥",name:"Ild"},{emoji:"😋",name:"Lækkert"},{emoji:"🍰",name:"Kage"},{emoji:"♨️",name:"Varmt"},{emoji:"🍪",name:"Småkage"}],_e={reference:"📷 AI'en ser kun maden på fotoet og laver et helt nyt ikon fra bunden.",motiv:"🖼️ AI'en genskaber hele kompositionen (mad, tallerkener, personer) i valgt stil.",portrait:"🍽️ AI'en laver en animeret figur af kokken der præsenterer/holder retten."},ve=["🪄 AI'en tegner dit ikon...","🎨 Vælger de bedste farver...","✨ Tilføjer de sidste detaljer...","🖌️ Næsten klar..."],qe=[{key:"institution",emoji:"🏠",label:"",desc:"Fra jeres ikonbibliotek",productOnly:!0},{key:"standard",emoji:"📁",label:"Standard",desc:"Flangos 3D-ikoner",productOnly:!0},{key:"emoji",emoji:"😀",label:"Emoji",desc:"Vælg en emoji som ikon",productOnly:!0},{key:"shared",emoji:"🌐",label:"Fra andre",desc:"Delte ikoner fra andre institutioner",productOnly:!0},{key:"ai",emoji:"🪄",label:"AI Ikon",desc:"Lad AI'en tegne et ikon for dig",productOnly:!1},{key:"camera",emoji:"📸",label:"Kamera",desc:"Tag foto af maden med kameraet",productOnly:!1},{key:"upload",emoji:"📤",label:"Upload",desc:"Upload eget billede som ikon",productOnly:!1}];function Gt(Ce){const{mode:rt="product",institutionId:O,productId:I,productName:Ae="",currentIcon:Te,editingIcon:P,adminProfile:pt,showCustomAlert:B,playSound:ye,defaultSource:lt,onResult:M}=Ce,h=rt==="product",F=!!P;function fe(e){if(!e)return;e.classList.remove("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="none")}function ct(e){if(!e)return;e.classList.add("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="")}let r=F?"ai":lt||(h?"institution":"ai"),v="pixar",x="reference",k=null,q=null,G=null,H=null,c=null,S=null,C=!1,p="",R=null,y=null,X=!1,Z=!1;const Me=localStorage.getItem("flango_institution_name")||"Jeres",Fe=qe.find(e=>e.key==="institution");Fe&&(Fe.label=`${Me}s ikoner`);const ne=qe.filter(e=>["institution","standard","emoji","shared"].includes(e.key)),He=qe.filter(e=>["ai","camera","upload"].includes(e.key)),dt=["upload","camera","ai"].includes(r);let L=F||dt?"create":h?"select":"create";const oe=document.createElement("div");oe.className="pip-overlay";const E=document.createElement("div");E.className="pip-fullscreen";const ut=F?"Redigér ikon med AI":h?"Produktikon":"Opret nyt ikon";E.innerHTML=`
        <div class="pip-header">
            <button type="button" class="pip-back-btn" id="pip-header-back" aria-label="Tilbage">← Tilbage</button>
            ${h&&!F?`
            <button type="button" class="pip-header-tab ${L==="select"?"active":""}" data-cat="select">📁 Vælg ikon</button>
            <button type="button" class="pip-header-tab ${L==="create"?"active":""}" data-cat="create">🪄 Opret ikon</button>
            `:`<h2>${ut}</h2>`}
        </div>

        ${F&&P?`
        <div class="pip-edit-preview">
            <img src="${P.icon_url}" alt="${T(P.name)}">
            <div class="pip-edit-name">${T(P.name)}</div>
        </div>`:""}

        <div class="pip-source-zone" id="pip-source-zone"></div>

        <div class="pip-content-zone" id="pip-content"></div>

        <div class="pip-footer">
            <button type="button" class="pip-manage-library-btn" style="margin-right:auto;padding:10px 20px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.1);color:#e2e8f0;cursor:pointer;font-size:14px;font-weight:600" title="Administrer Ikoner">📂 Administrer Ikoner</button>
            ${!h||F?`<input type="text" class="pip-name-input" placeholder="Ikon-navn" value="${T(P?.name||Ae||"")}">`:'<div class="pip-footer-spacer"></div>'}
            <button type="button" class="pip-cancel-btn">Annuller</button>
            <button type="button" class="pip-save-btn" disabled>${h?"Vælg":"Gem ikon"}</button>
        </div>
    `,oe.appendChild(E),document.body.appendChild(oe);const $=E.querySelector("#pip-content"),V=E.querySelector("#pip-source-zone"),Q=E.querySelector(".pip-save-btn");let l=null;const _=()=>oe.remove();E.querySelector(".pip-cancel-btn").addEventListener("click",_),E.querySelector("#pip-header-back")?.addEventListener("click",_),E.querySelector(".pip-manage-library-btn")?.addEventListener("click",()=>{const e={...Ce};_(),typeof window.__flangoOpenIconLibrary=="function"&&window.__flangoOpenIconLibrary(()=>{Gt(e)})});function mt(){E.querySelectorAll(".pip-header-tab").forEach(e=>{e.classList.toggle("active",e.dataset.cat===L)})}E.querySelectorAll(".pip-header-tab").forEach(e=>{e.addEventListener("click",()=>{L=e.dataset.cat,r=(L==="select"?ne:He)[0].key,p="",mt(),W(),D(),f()})});function W(){if(F){V.style.display="none";return}const e=L==="select"?ne:He;V.innerHTML=`
            <div class="pip-subsource-row">
                <div class="pip-source-cards">
                    ${e.map(t=>`
                        <button type="button" class="pip-source-card ${t.key===r?"active":""}" data-source="${t.key}">
                            <span class="pip-source-emoji">${t.emoji}</span>
                            <span class="pip-source-label">${t.label}</span>
                            <span class="pip-source-desc">${t.desc}</span>
                        </button>
                    `).join("")}
                </div>
                <div class="pip-preview-box">
                    <span class="pip-preview-placeholder">❓</span>
                    <div class="pip-preview-label">Intet valgt</div>
                    <button type="button" class="pip-preview-clear" style="display:none" title="Fjern valgt ikon">✕</button>
                </div>
            </div>
        `,l=V.querySelector(".pip-preview-box"),l.querySelector(".pip-preview-clear"),S?l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>':Te?.url&&(S=`<img src="${Te.url}"><div class="pip-preview-label">Nuværende ikon</div>`,l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),l.querySelector(".pip-preview-clear")?.addEventListener("click",t=>{t.stopPropagation(),ee()}),V.querySelectorAll(".pip-source-card").forEach(t=>{t.addEventListener("click",()=>{r===t.dataset.source?(r=null,V.querySelectorAll(".pip-source-card").forEach(s=>s.classList.remove("active"))):(r=t.dataset.source,V.querySelectorAll(".pip-source-card").forEach(s=>s.classList.toggle("active",s.dataset.source===r))),D(),f()})})}async function vt(e){if(!R){R=[];try{(await ot(O)).forEach(a=>R.push({label:a.name,path:a.icon_url,source:Me,imgSrc:a.icon_url,tags:a.tags||""}))}catch{}je.forEach(i=>R.push({label:i.label,path:i.path,source:"Standard",imgSrc:i.path})),$e.forEach(({emoji:i,name:a})=>R.push({label:a,path:null,source:"Emoji",emoji:i}));try{(await at(O)).icon_use_shared_enabled&&(await st(O)).forEach(n=>R.push({label:n.name,path:n.icon_url,source:"Delt",imgSrc:n.icon_url,tags:n.tags||""}))}catch{}}const t=p?R.filter(i=>i.label.toLowerCase().includes(p)||i.source.toLowerCase().includes(p)||(i.tags||"").toLowerCase().includes(p)):R;if(t.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:'<div class="pip-empty-state">Ingen ikoner fundet</div>';return}if(p){const i=document.createElement("div");i.style.cssText="font-size:13px;color:#64748b;margin-bottom:12px;",i.textContent=`${t.length} resultat${t.length===1?"":"er"}`,e.appendChild(i)}const s=document.createElement("div");s.className="pip-icon-grid",t.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${c===i.path?"selected":""}`,i.emoji?(a.innerHTML=`<span style="font-size:40px">${i.emoji}</span><span>${i.source}</span>`,a.addEventListener("click",()=>{if(C&&i.path){se(i.path);return}y=i.emoji,c=null,S=`<span style="font-size:48px">${i.emoji}</span><div class="pip-preview-label">Emoji</div>`,l&&(l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),l?.querySelector(".pip-preview-clear")?.addEventListener("click",ee),f()})):(a.dataset.path=i.path,a.innerHTML=`<img src="${i.imgSrc}" alt="${i.label}"><span>${i.label}<br><small style="color:#64748b">${i.source}</small></span>`,a.addEventListener("click",()=>{if(C){se(i.path);return}c=i.path,y=null,s.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),z(i.imgSrc,i.label),f()})),s.appendChild(a)}),e.appendChild(s)}async function se(e){C=!1;try{const s=await(await fetch(e)).blob(),i=new File([s],"ref.webp",{type:s.type||"image/webp"}),a=await me(i);L="create",r="ai",W(),D(),setTimeout(()=>ze(a),50)}catch(t){console.error("[referencePickComplete]",t),C=!1}}function z(e,t){l&&(e?(S=`<img src="${e}">`+(t?`<div class="pip-preview-label">${t}</div>`:""),l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>',l.querySelector(".pip-preview-clear")?.addEventListener("click",ee)):ee(),l.classList.remove("generating"))}function ee(){S=null,c=null,y=null,q=null,l&&(l.innerHTML='<span class="pip-preview-placeholder">❓</span><div class="pip-preview-label">Intet valgt</div>'),f()}function yt(){l&&(l.innerHTML='<span class="pip-preview-placeholder">🪄</span><div class="pip-preview-label">Genererer...</div>',l.classList.add("generating"))}function ft(){l&&(l.classList.remove("generating"),l.innerHTML='<span class="pip-preview-placeholder">⚠️</span><div class="pip-preview-label">Mislykkedes</div>')}function f(){let e=!1;r===null?e=!!(c||y):r==="standard"?e=!!c:r==="emoji"?e=!!y:r==="institution"||r==="shared"?e=!!c:r==="upload"?e=!!G:r==="camera"?e=!!H:r==="ai"&&(e=!!q),Q.disabled=!e}Q.addEventListener("click",async()=>{if(r===null){y?(M({type:"emoji",emoji:y}),_()):c&&(M({type:"icon",emoji:`${Ee}${c}`,url:c}),_());return}if(r==="standard")c&&M({type:"standard",emoji:`${Ee}${c}`,url:c}),_();else if(r==="emoji")y&&M({type:"emoji",emoji:y}),_();else if(r==="institution"||r==="shared")c&&M({type:"icon",emoji:`${Ee}${c}`,url:c}),_();else if(r==="upload"||r==="camera"){const e=r==="upload"?G:H;if(!e)return;Q.disabled=!0,Q.textContent="Gemmer...";try{const t=pt?.user_id;if(!t)throw new Error("Admin bruger ID ikke fundet");const s=await me(e),i=I||crypto.randomUUID(),a=new File([s],`${i}.webp`,{type:"image/webp"}),n=await Ut(a,O,i,t);if(n.success)ye?.("success"),M({type:"upload",url:n.icon_signed_url||n.icon_url,storagePath:n.icon_storage_path,updatedAt:n.icon_updated_at}),_();else throw new Error(n.error||"Upload fejlede")}catch(t){console.error("[pip save]",t),B?.("Fejl",t.message),Q.textContent=h?"Vælg":"Gem ikon",f()}}else r==="ai"&&q&&(M({type:"ai",url:q,metadata:{style:v,photoMode:x}}),_())});function D(){if($.innerHTML="",C){const e=document.createElement("div");e.style.cssText="padding:10px 16px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:#c4b5fd;",e.innerHTML=`<span style="font-size:20px">🖼️</span> <span>Vælg et ikon som foto-reference til AI — klik på det ikon du vil bruge</span>
                <button type="button" style="margin-left:auto;background:none;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;padding:4px 12px;cursor:pointer;font-size:12px;font-weight:600;" id="pip-cancel-pick">Annuller</button>`,$.appendChild(e),e.querySelector("#pip-cancel-pick").addEventListener("click",()=>{C=!1,L="create",r="ai",W(),D()})}if(L==="select"){const e=document.createElement("div");e.className="pip-search-row",e.innerHTML=`<input type="text" class="pip-search-input" id="pip-search" placeholder="🔍 Søg ${r?"i "+(ne.find(a=>a.key===r)?.label||""):"i alle ikoner"}..." value="${T(p)}" autocomplete="off"><button type="button" class="pip-search-clear" id="pip-search-clear" ${p?"":'style="display:none"'}>✕</button>`,$.appendChild(e);let t=null;const s=e.querySelector("#pip-search"),i=e.querySelector("#pip-search-clear");s.addEventListener("input",()=>{clearTimeout(t),i.style.display=s.value?"":"none",t=setTimeout(()=>{p=s.value.trim().toLowerCase(),be()},250)}),i.addEventListener("click",()=>{p="",s.value="",i.style.display="none",s.focus(),be()}),s.focus()}be()}function be(){const e=$.querySelector(".pip-content-section");e&&e.remove();const t=document.createElement("div");if(t.className="pip-content-section",L==="select"&&r===null)vt(t);else switch(r){case"standard":bt(t);break;case"emoji":gt(t);break;case"institution":ht(t);break;case"shared":kt(t);break;case"upload":wt(t);break;case"camera":xt(t);break;case"ai":Lt(t);break}$.appendChild(t)}function bt(e){const t=document.createElement("div");t.className="pip-icon-grid";const s=p?je.filter(i=>i.label.toLowerCase().includes(p)):je;if(s.length===0){e.innerHTML=`<div class="pip-empty-state">Ingen standard-ikoner matcher "${T(p)}"</div>`;return}s.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${c===i.path?"selected":""}`,a.dataset.path=i.path,a.innerHTML=`<img src="${i.path}" alt="${i.label}"><span>${i.label}</span>`,a.addEventListener("click",()=>{if(C){se(i.path);return}c=i.path,y=null,e.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),z(i.path,i.label),f()}),t.appendChild(a)}),e.appendChild(t)}function gt(e){const t=p?$e.filter(a=>a.name.toLowerCase().includes(p)||a.emoji.includes(p)):$e;e.innerHTML=`
            <div style="margin-bottom:16px">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px">Vælg en emoji</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px">Klik på en emoji nedenfor, eller skriv din egen i feltet</div>
            </div>
            <input type="text" class="pip-name-input" id="pip-emoji-input" placeholder="Indtast emoji her..." value="${y||""}" style="width:100%;max-width:300px;font-size:24px;text-align:center;margin-bottom:16px">
            <div class="pip-icon-grid" id="pip-emoji-grid"></div>
        `,t.length===0&&(e.querySelector("#pip-emoji-grid").innerHTML=`<div class="pip-empty-state">Ingen emojis matcher "${T(p)}"</div>`);const s=e.querySelector("#pip-emoji-input"),i=e.querySelector("#pip-emoji-grid");t.forEach(({emoji:a,name:n})=>{const d=document.createElement("div");d.className="pip-icon-option",d.innerHTML=`<span style="font-size:36px">${a}</span><span>${n}</span>`,d.addEventListener("click",()=>{y=a,c=null,s.value=a,S=`<span style="font-size:48px">${a}</span><div class="pip-preview-label">${n}</div>`,l&&(l.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),l?.querySelector(".pip-preview-clear")?.addEventListener("click",ee),f()}),i.appendChild(d)}),s.addEventListener("input",()=>{y=s.value||null,c=null,y&&(S=`<span style="font-size:48px">${y}</span><div class="pip-preview-label">Emoji</div>`,l&&(l.innerHTML=S)),f()})}function ht(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',Re(e,()=>ot(O),"Ingen egne ikoner endnu — upload eller generer via AI.")}function kt(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',St(e)}async function St(e){if(e||(e=$.querySelector(".pip-content-section")),!e)return;if(!(await at(O)).icon_use_shared_enabled){e.innerHTML='<div class="pip-empty-state">Brug af delte ikoner er ikke aktiveret. Slå det til under Institutionsindstillinger.</div>';return}Re(e,()=>st(),"Ingen delte ikoner tilgængelige endnu.")}async function Re(e,t,s){let i=await t();if(e.innerHTML="",p&&(console.log("[loadIconGrid] Searching for:",p,"in",i.length,"icons. Sample tags:",i.slice(0,3).map(n=>n.name+":"+(n.tags||"none"))),i=i.filter(n=>n.name.toLowerCase().includes(p)||(n.tags||"").toLowerCase().includes(p)),console.log("[loadIconGrid] After filter:",i.length,"matches")),i.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:`<div class="pip-empty-state">${s}</div>`;return}const a=document.createElement("div");a.className="pip-icon-grid",i.forEach(n=>{const d=document.createElement("div");d.className=`pip-icon-option ${c===n.icon_url?"selected":""}`,d.dataset.path=n.icon_url;const m=n.source==="uploaded"?"📤":"🪄";d.innerHTML=`<img src="${n.icon_url}" alt="${n.name}"><span>${m} ${n.name}</span>`,d.addEventListener("click",()=>{if(C){se(n.icon_url);return}c=n.icon_url,y=null,a.querySelectorAll(".pip-icon-option").forEach(N=>N.classList.toggle("selected",N.dataset.path===n.icon_url)),z(n.icon_url,n.name),f()}),a.appendChild(d)}),e.appendChild(a)}function wt(e){e.innerHTML=`
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
            </label>`;const t=e.querySelector("#pip-upload-drop"),s=e.querySelector("input[type=file]"),i=e.querySelector("#pip-upload-preview"),a=e.querySelector("#pip-upload-img"),n=e.querySelector("#pip-upload-remove");t.addEventListener("click",()=>s.click()),s.addEventListener("change",m=>{m.target.files[0]&&d(m.target.files[0]),m.target.value=""}),t.addEventListener("dragover",m=>{m.preventDefault(),t.classList.add("dragover")}),t.addEventListener("dragleave",()=>t.classList.remove("dragover")),t.addEventListener("drop",m=>{m.preventDefault(),t.classList.remove("dragover"),m.dataTransfer.files[0]&&d(m.dataTransfer.files[0])}),n.addEventListener("click",()=>{G=null,i.style.display="none",t.style.display="",z(null),f()});async function d(m){try{G=await me(m),a.src=URL.createObjectURL(G),i.style.display="",t.style.display="none",z(a.src,"Uploadet billede"),f()}catch(N){console.error("[upload]",N)}}}function xt(e){e.innerHTML=`
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
            </div>`;const t=e.querySelector("#pip-cam-trigger"),s=e.querySelector("#pip-cam-preview"),i=e.querySelector("#pip-cam-img"),a=async()=>{try{const n=await nt({showCustomAlert:B});n&&(H=n,i.src=URL.createObjectURL(n),s.style.display="",t.style.display="none",z(i.src,"Foto"),f())}catch(n){console.error("[camera]",n)}};t.addEventListener("click",a),e.querySelector("#pip-cam-retake").addEventListener("click",()=>{H=null,s.style.display="none",t.style.display="",z(null),f(),a()}),e.querySelector("#pip-cam-use").addEventListener("click",()=>{H&&(G=H,r="camera",f())}),e.querySelector("#pip-cam-ai").addEventListener("click",()=>{if(!H)return;const n=H;r="ai",sourceCards.forEach(d=>d.classList.toggle("active",d.dataset.source==="ai")),D(),setTimeout(()=>ze(n),50)})}function Lt(e){const t=T(Ae||P?.name||"");e.innerHTML=`
            <!-- Step 1: Product name -->
            <div class="pip-ai-step" id="pip-ai-step1">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">1</span>
                    <span class="pip-step-label">Hvad skal ikonet forestille?</span>
                    <span style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">valgfrit hvis du bruger foto</span>
                </div>
                <div class="pip-step-hint">Skriv navnet på produktet — eller upload et foto i trin ③</div>
                <div style="margin-left:38px">
                    <input type="text" class="pip-name-input" id="pip-ai-name" placeholder="fx Pasta med kødsovs" maxlength="100" value="${t}" style="width:100%;max-width:500px">
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
                    ${h?'<button type="button" class="pip-photo-btn" id="pip-photo-pick"><span class="pip-btn-icon">📁</span> Vælg ikon</button>':""}
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
            <div class="pip-ai-step pip-mode-section ${k?"":"pip-disabled"}" id="pip-mode-section">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">4</span>
                    <span class="pip-step-label">Foto-tilstand</span>
                    <span class="pip-mode-hint" id="pip-mode-hint" ${k?'style="display:none"':""} style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">upload foto i trin ③ først</span>
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
                    ${Ie()?`<button type="button" class="pip-mode-card" data-mode="portrait">
                        <span class="pip-card-emoji">🍽️</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Kokken præsenterer maden</div>
                    </button>`:`<button type="button" class="pip-mode-card pip-mode-locked" data-mode="portrait" aria-disabled="true" title="Kan aktiveres via superadmin" style="opacity:.55;cursor:not-allowed">
                        <span class="pip-card-emoji">🔒</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Aktiveres via superadmin</div>
                    </button>`}
                </div>
                <div class="pip-mode-desc-text" id="pip-mode-desc">${_e.reference}</div>
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
                <div class="pip-loading-message" id="pip-loading-msg">${ve[0]}</div>
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
        `,Et(e)}function Et(e){const t=e.querySelector("#pip-ai-name"),s=e.querySelectorAll(".pip-style-card"),i=e.querySelector("#pip-custom-section"),a=e.querySelector("#pip-custom-prompt"),n=e.querySelector("#pip-ai-step1"),d=e.querySelector("#pip-photo-actions"),m=e.querySelector("#pip-photo-preview"),N=e.querySelector("#pip-photo-img"),Ue=e.querySelector("#pip-photo-remove"),Oe=e.querySelector("#pip-photo-file"),Be=Oe?.querySelector("input"),jt=e.querySelector("#pip-photo-camera"),K=e.querySelector("#pip-mode-section"),ge=e.querySelectorAll(".pip-mode-card"),De=e.querySelector("#pip-mode-desc"),re=e.querySelector("#pip-generate"),Ne=e.querySelector("#pip-loading"),Ge=e.querySelector("#pip-loading-msg"),he=e.querySelector("#pip-result"),It=e.querySelector("#pip-result-img"),Pt=e.querySelector("#pip-result-label"),$t=e.querySelector("#pip-retry"),te=e.querySelector("#pip-error"),Ve=e.querySelector("#pip-error-msg"),_t=e.querySelector("#pip-error-retry"),pe=e.querySelector("#pip-advanced"),le=e.querySelector("#pip-style-prompt"),ce=e.querySelector("#pip-photo-prompt"),qt=e.querySelector("#pip-reset-prompts");s.forEach(o=>{o.addEventListener("click",()=>{v=o.dataset.style,s.forEach(j=>j.classList.toggle("active",j===o));const b=v==="custom";if(i.style.display=b?"block":"none",n.style.display=b?"none":"block",K){const j=b||!k;K.classList.toggle("pip-disabled",j);const Y=K.querySelector("#pip-mode-hint");Y&&(Y.style.display=j?"":"none")}U()})}),Oe?.addEventListener("click",()=>Be?.click()),Be?.addEventListener("change",o=>{o.target.files[0]&&Ke(o.target.files[0]),o.target.value=""}),e.querySelector("#pip-photo-pick")?.addEventListener("click",()=>{C=!0,L="select",r=ne[0].key,W(),D()}),jt?.addEventListener("click",async()=>{try{const o=await nt({showCustomAlert:B});o&&Ke(o)}catch(o){console.error("[aiPhotoCamera]",o)}}),Ue?.addEventListener("click",At);async function Ke(o){try{k=await me(o),Ct(k)}catch(b){console.error("[aiPhoto]",b)}}function Ct(o){N.src=URL.createObjectURL(o),m.style.display="flex",d.style.display="none",v!=="custom"&&fe(K),U()}function At(){k=null,m.style.display="none",d.style.display="flex",ct(K),U()}ge.forEach(o=>{o.addEventListener("click",()=>{if(o.dataset.mode==="portrait"&&!Ie()){B?.("Ikke tilgængelig","Mad Portræt kan aktiveres af superadmin.");return}x=o.dataset.mode,ge.forEach(b=>b.classList.toggle("active",b===o)),De.textContent=_e[x]||"",U()})});function Tt(){return v==="custom"?"":x==="portrait"&&!!k?v==="pixar"?Nt:Dt:v==="pixar"?Bt:Ot}function Mt(){const o=t?.value?.trim()||"";return v==="custom"?"":k?x==="portrait"?`Transform into ${v==="clay"?"clay-animated":"Pixar/Dreamworks-style animated"} version. Person (cook/chef) proudly presenting food. Preserve features. Include food prominently.${o?` Dish: ${o}`:""}`:x==="motiv"?`Recreate composition from photo as 3D icon. Keep food arrangement, render in ${v==="pixar"?"glossy Pixar":"Flango clay"} style. If people appear, include as stylized characters.${o?` Product: ${o}`:""}`:`Use photo only to identify food. Create fresh ${v==="pixar"?"Pixar-style":"clay-style"} icon. Ignore background/angle. Include container only if needed.${o?` Product: ${o}`:""}`:`The food item is: ${o}
Include a bowl, plate, cup, or container only if the food needs one.`}function U(){pe?.open&&(!X&&le&&(le.value=Tt()),!Z&&ce&&(ce.value=Mt()))}pe?.addEventListener("toggle",()=>{pe.open&&(X=!1,Z=!1,U())}),le?.addEventListener("input",()=>{X=!0}),ce?.addEventListener("input",()=>{Z=!0}),qt?.addEventListener("click",()=>{X=!1,Z=!1,U()}),t?.addEventListener("input",U);let ke=!1,Ye=null;async function Se(){if(ke)return;const o=v==="custom",b=t?.value?.trim()||"",j=a?.value?.trim()||"",Y=!!k;if(o&&!j){B?.("Manglende prompt","Skriv en prompt i tekstfeltet");return}if(!o&&!b&&!Y){B?.("Manglende input","Skriv et produktnavn eller upload et foto");return}ke=!0,re.style.display="none",he.style.display="none",te&&(te.style.display="none"),Ne.style.display="block",yt(),q=null;let Je=!1,we=0;Ge.textContent=ve[0],Ye=setInterval(()=>{we=(we+1)%ve.length,Ge.textContent=ve[we]},3e3);try{const{data:{session:de}}=await Pe.auth.getSession(),ie=de?.access_token||"",Xe=Pe.supabaseUrl||Pe.rest?.url?.replace("/rest/v1","")||"",ae=pe?.open&&(X||Z),Ze=ae?((le?.value?.trim()||"")+`

`+(ce?.value?.trim()||"")).trim():"",Qe={Authorization:`Bearer ${ie}`};let g;if(Y&&!o&&!ae)g=new FormData,h&&I?g.append("product_id",I):g.append("save_to_library_only","true"),g.append("product_name",b),g.append(h?"reference_image":"photo",k,"photo.webp"),g.append("style",v),g.append("photo_mode",x);else if(Y)g=new FormData,h&&I?g.append("product_id",I):g.append("save_to_library_only","true"),g.append("product_name",b),g.append(h?"reference_image":"photo",k,"photo.webp"),g.append("prompt_mode","custom"),g.append("custom_prompt",ae?Ze:j);else{Qe["Content-Type"]="application/json";const w={product_name:b,style:o?"custom":v};h&&I?w.product_id=I:w.save_to_library_only=!0,(o||ae)&&(w.prompt_mode="custom",w.custom_prompt=ae?Ze:j||b),g=JSON.stringify(w)}const u=await(await fetch(`${Xe}/functions/v1/generate-product-icon`,{method:"POST",headers:Qe,body:g})).json();if(!u.success)throw new Error(u.error||"Generering fejlede");if(!u.image_base64)throw new Error("Ingen billede-data fra serveren");const xe=atob(u.image_base64),We=new Uint8Array(xe.length);for(let w=0;w<xe.length;w++)We[w]=xe.charCodeAt(w);const et=new Blob([We],{type:`image/${u.format||"webp"}`}),tt=await zt(et);console.log(`[AI Generate] Raw ${(et.size/1024).toFixed(1)}KB → Compressed ${(tt.size/1024).toFixed(1)}KB`);const Ft=u.fallback_name||b||"AI ikon",A=new FormData;A.append("file",new File([tt],"ai-icon.webp",{type:"image/webp"})),A.append("institutionId",O),h&&I?A.append("productId",I):A.append("skipProduct","true"),A.append("libraryName",Ft),u.style&&A.append("aiStyle",String(u.style)),u.mode&&A.append("aiPhotoMode",String(u.mode)),u.prompt_mode&&A.append("aiPromptMode",String(u.prompt_mode));const Le=await fetch(`${Xe}/functions/v1/upload-product-icon`,{method:"POST",headers:{Authorization:`Bearer ${ie}`},body:A}),J=await Le.json().catch(()=>({}));if(!Le.ok||!J?.success)throw new Error(J?.error||`Upload fejlede (${Le.status})`);const it=J.icon_url||null,Ht=J.icon_storage_path||null,Rt=J.library_icon_url||null;q=it||Rt,It.src=q,he.style.display="block";const ue=[];if(u.style&&ue.push(u.style==="clay"?"🏺 Clay":u.style==="pixar"?"🎬 Pixar":"✍️ Fri prompt"),u.mode){const w={"photo-reference":"📷 Reference","photo-motiv":"🖼️ Motiv","photo-avatar":"👤 Avatar","photo-portrait":"🍽️ Mad Portræt",text:"✏️ Tekst","custom-photo":"🎨 Fri prompt","custom-text":"🎨 Fri prompt"};ue.push(w[u.mode]||u.mode)}Pt.textContent=ue.join(" · "),z(q,ue.join(" · ")),f(),ye?.("success"),h&&I&&M({type:"ai",url:it,storagePath:Ht,updatedAt:J.icon_updated_at,metadata:{style:v,photoMode:x}})}catch(de){console.error("[AI Generate]",de),Je=!0;const ie=de?.message||"Generering fejlede";te&&Ve?(Ve.textContent=ie,te.style.display="flex"):B?.("AI Fejl",ie),ft(),ye?.("error")}finally{clearInterval(Ye),Ne.style.display="none",!q&&!Je&&(re.style.display="block"),ke=!1}}re?.addEventListener("click",Se),$t?.addEventListener("click",()=>{he.style.display="none",re.style.display="block",Se()}),_t?.addEventListener("click",()=>{te.style.display="none",Se()}),F&&P&&(x=Ie()?"portrait":"reference",ge.forEach(o=>o.classList.toggle("active",o.dataset.mode===x)),De.textContent=_e[x]||"",Ue.style.display="none",d.style.display="none",N.src=P.icon_url,m.style.display="flex",fe(K),fetch(P.icon_url).then(o=>o.blob()).then(o=>{k=new File([o],"ref.webp",{type:"image/webp"}),U()}).catch(o=>console.error("[fetchEditIcon]",o)))}function ze(e){k=e;const t=$.querySelector("#pip-photo-preview"),s=$.querySelector("#pip-photo-img"),i=$.querySelector("#pip-photo-actions"),a=$.querySelector("#pip-mode-section");s&&(s.src=URL.createObjectURL(e)),t&&(t.style.display="flex"),i&&(i.style.display="none"),a&&v!=="custom"&&fe(a)}W(),D()}export{Gt as openProductIconPicker};
