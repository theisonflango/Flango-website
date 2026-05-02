import{e as T,C as we,S as xe,f as We,p as de,t as et,a as tt,b as it,s as Le,c as At,u as Tt}from"./main-CTo3EXIw.js";const Mt="A single centered food product icon in soft 3D clay style. Rounded puffy shapes, smooth matte clay texture, subtle soft shadows on the object only. Pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic like premium mobile app UI icons. Skeuomorphic but simplified - Apple-like simplicity with minimal detail. No text, no labels, no table, no background elements. The object floats on a perfectly transparent background. Clean crisp edges suitable for UI overlay.",Ft="A single centered food product icon in Pixar-style 3D rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights, gentle ambient occlusion shadows on the object only. Friendly, appealing, child-safe aesthetic. Clean and simple - minimal detail, maximum charm. No text, no labels, no background elements. The object floats on a perfectly transparent background with clean crisp edges suitable for UI overlay.",zt="3D clay-animated style rendering. Rounded puffy shapes, smooth matte clay texture, pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic. Characters should look like high-quality clay figurines with warm, expressive faces.",Ht="Pixar/Dreamworks-style 3D animated rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights. Friendly, appealing, child-safe aesthetic with maximum charm. Characters should look like they belong in a Pixar feature film.",Ee=[{emoji:"🍫",name:"Chokolade"},{emoji:"🍽️",name:"Tallerken"},{emoji:"🍷",name:"Glas"},{emoji:"🍎",name:"Æble"},{emoji:"🥜",name:"Nødder"},{emoji:"🥪",name:"Sandwich"},{emoji:"🍕",name:"Pizza"},{emoji:"🥤",name:"Sodavand"},{emoji:"🍚",name:"Ris"},{emoji:"🍣",name:"Sushi"},{emoji:"🥢",name:"Spisepinde"},{emoji:"🍞",name:"Brød"},{emoji:"🥝",name:"Kiwi"},{emoji:"🍇",name:"Vindruer"},{emoji:"🍐",name:"Pære"},{emoji:"🍉",name:"Vandmelon"},{emoji:"🍙",name:"Risbolle"},{emoji:"🍲",name:"Gryde"},{emoji:"🥘",name:"Pande"},{emoji:"🫘",name:"Bønner"},{emoji:"🍔",name:"Burger"},{emoji:"🌶️",name:"Chili"},{emoji:"🧄",name:"Hvidløg"},{emoji:"🍳",name:"Stegepande"},{emoji:"🔥",name:"Ild"},{emoji:"😋",name:"Lækkert"},{emoji:"🍰",name:"Kage"},{emoji:"♨️",name:"Varmt"},{emoji:"🍪",name:"Småkage"}],je={reference:"📷 AI'en ser kun maden på fotoet og laver et helt nyt ikon fra bunden.",motiv:"🖼️ AI'en genskaber hele kompositionen (mad, tallerkener, personer) i valgt stil.",portrait:"🍽️ AI'en laver en animeret figur af kokken der præsenterer/holder retten."},ue=["🪄 AI'en tegner dit ikon...","🎨 Vælger de bedste farver...","✨ Tilføjer de sidste detaljer...","🖌️ Næsten klar..."],Ie=[{key:"institution",emoji:"🏠",label:"",desc:"Fra jeres ikonbibliotek",productOnly:!0},{key:"standard",emoji:"📁",label:"Standard",desc:"Flangos 3D-ikoner",productOnly:!0},{key:"emoji",emoji:"😀",label:"Emoji",desc:"Vælg en emoji som ikon",productOnly:!0},{key:"shared",emoji:"🌐",label:"Fra andre",desc:"Delte ikoner fra andre institutioner",productOnly:!0},{key:"ai",emoji:"🪄",label:"AI Ikon",desc:"Lad AI'en tegne et ikon for dig",productOnly:!1},{key:"camera",emoji:"📸",label:"Kamera",desc:"Tag foto af maden med kameraet",productOnly:!1},{key:"upload",emoji:"📤",label:"Upload",desc:"Upload eget billede som ikon",productOnly:!1}];function Rt(Pe){const{mode:at="product",institutionId:M,productId:j,productName:_e="",currentIcon:$e,editingIcon:I,adminProfile:nt,showCustomAlert:N,playSound:me,defaultSource:ot,onResult:F}=Pe,h=at==="product",z=!!I;function ve(e){if(!e)return;e.classList.remove("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="none")}function st(e){if(!e)return;e.classList.add("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="")}let r=z?"ai":ot||(h?"institution":"ai"),v="pixar",$="reference",k=null,q=null,G=null,H=null,l=null,S=null,C=!1,p="",R=null,y=null,X=!1,Z=!1;const qe=localStorage.getItem("flango_institution_name")||"Jeres",Ce=Ie.find(e=>e.key==="institution");Ce&&(Ce.label=`${qe}s ikoner`);const ae=Ie.filter(e=>["institution","standard","emoji","shared"].includes(e.key)),Ae=Ie.filter(e=>["ai","camera","upload"].includes(e.key)),rt=["upload","camera","ai"].includes(r);let x=z||rt?"create":h?"select":"create";const ne=document.createElement("div");ne.className="pip-overlay";const L=document.createElement("div");L.className="pip-fullscreen";const pt=z?"Redigér ikon med AI":h?"Produktikon":"Opret nyt ikon";L.innerHTML=`
        <div class="pip-header">
            <button type="button" class="pip-back-btn" id="pip-header-back" aria-label="Tilbage">← Tilbage</button>
            ${h&&!z?`
            <button type="button" class="pip-header-tab ${x==="select"?"active":""}" data-cat="select">📁 Vælg ikon</button>
            <button type="button" class="pip-header-tab ${x==="create"?"active":""}" data-cat="create">🪄 Opret ikon</button>
            `:`<h2>${pt}</h2>`}
        </div>

        ${z&&I?`
        <div class="pip-edit-preview">
            <img src="${I.icon_url}" alt="${T(I.name)}">
            <div class="pip-edit-name">${T(I.name)}</div>
        </div>`:""}

        <div class="pip-source-zone" id="pip-source-zone"></div>

        <div class="pip-content-zone" id="pip-content"></div>

        <div class="pip-footer">
            <button type="button" class="pip-manage-library-btn" style="margin-right:auto;padding:10px 20px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.1);color:#e2e8f0;cursor:pointer;font-size:14px;font-weight:600" title="Administrer Ikoner">📂 Administrer Ikoner</button>
            ${!h||z?`<input type="text" class="pip-name-input" placeholder="Ikon-navn" value="${T(I?.name||_e||"")}">`:'<div class="pip-footer-spacer"></div>'}
            <button type="button" class="pip-cancel-btn">Annuller</button>
            <button type="button" class="pip-save-btn" disabled>${h?"Vælg":"Gem ikon"}</button>
        </div>
    `,ne.appendChild(L),document.body.appendChild(ne);const P=L.querySelector("#pip-content"),V=L.querySelector("#pip-source-zone"),Q=L.querySelector(".pip-save-btn");let c=null;const _=()=>ne.remove();L.querySelector(".pip-cancel-btn").addEventListener("click",_),L.querySelector("#pip-header-back")?.addEventListener("click",_),L.querySelector(".pip-manage-library-btn")?.addEventListener("click",()=>{const e={...Pe};_(),typeof window.__flangoOpenIconLibrary=="function"&&window.__flangoOpenIconLibrary(()=>{Rt(e)})});function lt(){L.querySelectorAll(".pip-header-tab").forEach(e=>{e.classList.toggle("active",e.dataset.cat===x)})}L.querySelectorAll(".pip-header-tab").forEach(e=>{e.addEventListener("click",()=>{x=e.dataset.cat,r=(x==="select"?ae:Ae)[0].key,p="",lt(),W(),B(),f()})});function W(){if(z){V.style.display="none";return}const e=x==="select"?ae:Ae;V.innerHTML=`
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
        `,c=V.querySelector(".pip-preview-box"),c.querySelector(".pip-preview-clear"),S?c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>':$e?.url&&(S=`<img src="${$e.url}"><div class="pip-preview-label">Nuværende ikon</div>`,c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c.querySelector(".pip-preview-clear")?.addEventListener("click",t=>{t.stopPropagation(),ee()}),V.querySelectorAll(".pip-source-card").forEach(t=>{t.addEventListener("click",()=>{r===t.dataset.source?(r=null,V.querySelectorAll(".pip-source-card").forEach(s=>s.classList.remove("active"))):(r=t.dataset.source,V.querySelectorAll(".pip-source-card").forEach(s=>s.classList.toggle("active",s.dataset.source===r))),B(),f()})})}async function ct(e){if(!R){R=[];try{(await tt(M)).forEach(a=>R.push({label:a.name,path:a.icon_url,source:qe,imgSrc:a.icon_url,tags:a.tags||""}))}catch{}xe.forEach(i=>R.push({label:i.label,path:i.path,source:"Standard",imgSrc:i.path})),Ee.forEach(({emoji:i,name:a})=>R.push({label:a,path:null,source:"Emoji",emoji:i}));try{(await We(M)).icon_use_shared_enabled&&(await it(M)).forEach(n=>R.push({label:n.name,path:n.icon_url,source:"Delt",imgSrc:n.icon_url,tags:n.tags||""}))}catch{}}const t=p?R.filter(i=>i.label.toLowerCase().includes(p)||i.source.toLowerCase().includes(p)||(i.tags||"").toLowerCase().includes(p)):R;if(t.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:'<div class="pip-empty-state">Ingen ikoner fundet</div>';return}if(p){const i=document.createElement("div");i.style.cssText="font-size:13px;color:#64748b;margin-bottom:12px;",i.textContent=`${t.length} resultat${t.length===1?"":"er"}`,e.appendChild(i)}const s=document.createElement("div");s.className="pip-icon-grid",t.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${l===i.path?"selected":""}`,i.emoji?(a.innerHTML=`<span style="font-size:40px">${i.emoji}</span><span>${i.source}</span>`,a.addEventListener("click",()=>{if(C&&i.path){oe(i.path);return}y=i.emoji,l=null,S=`<span style="font-size:48px">${i.emoji}</span><div class="pip-preview-label">Emoji</div>`,c&&(c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c?.querySelector(".pip-preview-clear")?.addEventListener("click",ee),f()})):(a.dataset.path=i.path,a.innerHTML=`<img src="${i.imgSrc}" alt="${i.label}"><span>${i.label}<br><small style="color:#64748b">${i.source}</small></span>`,a.addEventListener("click",()=>{if(C){oe(i.path);return}l=i.path,y=null,s.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),U(i.imgSrc,i.label),f()})),s.appendChild(a)}),e.appendChild(s)}async function oe(e){C=!1;try{const s=await(await fetch(e)).blob(),i=new File([s],"ref.webp",{type:s.type||"image/webp"}),a=await de(i);x="create",r="ai",W(),B(),setTimeout(()=>Me(a),50)}catch(t){console.error("[referencePickComplete]",t),C=!1}}function U(e,t){c&&(e?(S=`<img src="${e}">`+(t?`<div class="pip-preview-label">${t}</div>`:""),c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>',c.querySelector(".pip-preview-clear")?.addEventListener("click",ee)):ee(),c.classList.remove("generating"))}function ee(){S=null,l=null,y=null,q=null,c&&(c.innerHTML='<span class="pip-preview-placeholder">❓</span><div class="pip-preview-label">Intet valgt</div>'),f()}function dt(){c&&(c.innerHTML='<span class="pip-preview-placeholder">🪄</span><div class="pip-preview-label">Genererer...</div>',c.classList.add("generating"))}function f(){let e=!1;r===null?e=!!(l||y):r==="standard"?e=!!l:r==="emoji"?e=!!y:r==="institution"||r==="shared"?e=!!l:r==="upload"?e=!!G:r==="camera"?e=!!H:r==="ai"&&(e=!!q),Q.disabled=!e}Q.addEventListener("click",async()=>{if(r===null){y?(F({type:"emoji",emoji:y}),_()):l&&(F({type:"icon",emoji:`${we}${l}`,url:l}),_());return}if(r==="standard")l&&F({type:"standard",emoji:`${we}${l}`,url:l}),_();else if(r==="emoji")y&&F({type:"emoji",emoji:y}),_();else if(r==="institution"||r==="shared")l&&F({type:"icon",emoji:`${we}${l}`,url:l}),_();else if(r==="upload"||r==="camera"){const e=r==="upload"?G:H;if(!e)return;Q.disabled=!0,Q.textContent="Gemmer...";try{const t=nt?.user_id;if(!t)throw new Error("Admin bruger ID ikke fundet");const s=await de(e),i=j||crypto.randomUUID(),a=new File([s],`${i}.webp`,{type:"image/webp"}),n=await Tt(a,M,i,t);if(n.success)me?.("success"),F({type:"upload",url:n.icon_signed_url||n.icon_url,storagePath:n.icon_storage_path,updatedAt:n.icon_updated_at}),_();else throw new Error(n.error||"Upload fejlede")}catch(t){console.error("[pip save]",t),N?.("Fejl",t.message),Q.textContent=h?"Vælg":"Gem ikon",f()}}else r==="ai"&&q&&(F({type:"ai",url:q,metadata:{style:v,photoMode:$}}),_())});function B(){if(P.innerHTML="",C){const e=document.createElement("div");e.style.cssText="padding:10px 16px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:#c4b5fd;",e.innerHTML=`<span style="font-size:20px">🖼️</span> <span>Vælg et ikon som foto-reference til AI — klik på det ikon du vil bruge</span>
                <button type="button" style="margin-left:auto;background:none;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;padding:4px 12px;cursor:pointer;font-size:12px;font-weight:600;" id="pip-cancel-pick">Annuller</button>`,P.appendChild(e),e.querySelector("#pip-cancel-pick").addEventListener("click",()=>{C=!1,x="create",r="ai",W(),B()})}if(x==="select"){const e=document.createElement("div");e.className="pip-search-row",e.innerHTML=`<input type="text" class="pip-search-input" id="pip-search" placeholder="🔍 Søg ${r?"i "+(ae.find(a=>a.key===r)?.label||""):"i alle ikoner"}..." value="${T(p)}" autocomplete="off"><button type="button" class="pip-search-clear" id="pip-search-clear" ${p?"":'style="display:none"'}>✕</button>`,P.appendChild(e);let t=null;const s=e.querySelector("#pip-search"),i=e.querySelector("#pip-search-clear");s.addEventListener("input",()=>{clearTimeout(t),i.style.display=s.value?"":"none",t=setTimeout(()=>{p=s.value.trim().toLowerCase(),ye()},250)}),i.addEventListener("click",()=>{p="",s.value="",i.style.display="none",s.focus(),ye()}),s.focus()}ye()}function ye(){const e=P.querySelector(".pip-content-section");e&&e.remove();const t=document.createElement("div");if(t.className="pip-content-section",x==="select"&&r===null)ct(t);else switch(r){case"standard":ut(t);break;case"emoji":mt(t);break;case"institution":vt(t);break;case"shared":yt(t);break;case"upload":bt(t);break;case"camera":gt(t);break;case"ai":ht(t);break}P.appendChild(t)}function ut(e){const t=document.createElement("div");t.className="pip-icon-grid";const s=p?xe.filter(i=>i.label.toLowerCase().includes(p)):xe;if(s.length===0){e.innerHTML=`<div class="pip-empty-state">Ingen standard-ikoner matcher "${T(p)}"</div>`;return}s.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${l===i.path?"selected":""}`,a.dataset.path=i.path,a.innerHTML=`<img src="${i.path}" alt="${i.label}"><span>${i.label}</span>`,a.addEventListener("click",()=>{if(C){oe(i.path);return}l=i.path,y=null,e.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),U(i.path,i.label),f()}),t.appendChild(a)}),e.appendChild(t)}function mt(e){const t=p?Ee.filter(a=>a.name.toLowerCase().includes(p)||a.emoji.includes(p)):Ee;e.innerHTML=`
            <div style="margin-bottom:16px">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px">Vælg en emoji</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px">Klik på en emoji nedenfor, eller skriv din egen i feltet</div>
            </div>
            <input type="text" class="pip-name-input" id="pip-emoji-input" placeholder="Indtast emoji her..." value="${y||""}" style="width:100%;max-width:300px;font-size:24px;text-align:center;margin-bottom:16px">
            <div class="pip-icon-grid" id="pip-emoji-grid"></div>
        `,t.length===0&&(e.querySelector("#pip-emoji-grid").innerHTML=`<div class="pip-empty-state">Ingen emojis matcher "${T(p)}"</div>`);const s=e.querySelector("#pip-emoji-input"),i=e.querySelector("#pip-emoji-grid");t.forEach(({emoji:a,name:n})=>{const d=document.createElement("div");d.className="pip-icon-option",d.innerHTML=`<span style="font-size:36px">${a}</span><span>${n}</span>`,d.addEventListener("click",()=>{y=a,l=null,s.value=a,S=`<span style="font-size:48px">${a}</span><div class="pip-preview-label">${n}</div>`,c&&(c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c?.querySelector(".pip-preview-clear")?.addEventListener("click",ee),f()}),i.appendChild(d)}),s.addEventListener("input",()=>{y=s.value||null,l=null,y&&(S=`<span style="font-size:48px">${y}</span><div class="pip-preview-label">Emoji</div>`,c&&(c.innerHTML=S)),f()})}function vt(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',Te(e,()=>tt(M),"Ingen egne ikoner endnu — upload eller generer via AI.")}function yt(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',ft(e)}async function ft(e){if(e||(e=P.querySelector(".pip-content-section")),!e)return;if(!(await We(M)).icon_use_shared_enabled){e.innerHTML='<div class="pip-empty-state">Brug af delte ikoner er ikke aktiveret. Slå det til under Institutionsindstillinger.</div>';return}Te(e,()=>it(M),"Ingen delte ikoner tilgængelige endnu.")}async function Te(e,t,s){let i=await t();if(e.innerHTML="",p&&(console.log("[loadIconGrid] Searching for:",p,"in",i.length,"icons. Sample tags:",i.slice(0,3).map(n=>n.name+":"+(n.tags||"none"))),i=i.filter(n=>n.name.toLowerCase().includes(p)||(n.tags||"").toLowerCase().includes(p)),console.log("[loadIconGrid] After filter:",i.length,"matches")),i.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:`<div class="pip-empty-state">${s}</div>`;return}const a=document.createElement("div");a.className="pip-icon-grid",i.forEach(n=>{const d=document.createElement("div");d.className=`pip-icon-option ${l===n.icon_url?"selected":""}`,d.dataset.path=n.icon_url;const m=n.source==="uploaded"?"📤":"🪄";d.innerHTML=`<img src="${n.icon_url}" alt="${n.name}"><span>${m} ${n.name}</span>`,d.addEventListener("click",()=>{if(C){oe(n.icon_url);return}l=n.icon_url,y=null,a.querySelectorAll(".pip-icon-option").forEach(D=>D.classList.toggle("selected",D.dataset.path===n.icon_url)),U(n.icon_url,n.name),f()}),a.appendChild(d)}),e.appendChild(a)}function bt(e){e.innerHTML=`
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
            </label>`;const t=e.querySelector("#pip-upload-drop"),s=e.querySelector("input[type=file]"),i=e.querySelector("#pip-upload-preview"),a=e.querySelector("#pip-upload-img"),n=e.querySelector("#pip-upload-remove");t.addEventListener("click",()=>s.click()),s.addEventListener("change",m=>{m.target.files[0]&&d(m.target.files[0]),m.target.value=""}),t.addEventListener("dragover",m=>{m.preventDefault(),t.classList.add("dragover")}),t.addEventListener("dragleave",()=>t.classList.remove("dragover")),t.addEventListener("drop",m=>{m.preventDefault(),t.classList.remove("dragover"),m.dataTransfer.files[0]&&d(m.dataTransfer.files[0])}),n.addEventListener("click",()=>{G=null,i.style.display="none",t.style.display="",U(null),f()});async function d(m){try{G=await de(m),a.src=URL.createObjectURL(G),i.style.display="",t.style.display="none",U(a.src,"Uploadet billede"),f()}catch(D){console.error("[upload]",D)}}}function gt(e){e.innerHTML=`
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
            </div>`;const t=e.querySelector("#pip-cam-trigger"),s=e.querySelector("#pip-cam-preview"),i=e.querySelector("#pip-cam-img"),a=async()=>{try{const n=await et({showCustomAlert:N});n&&(H=n,i.src=URL.createObjectURL(n),s.style.display="",t.style.display="none",U(i.src,"Foto"),f())}catch(n){console.error("[camera]",n)}};t.addEventListener("click",a),e.querySelector("#pip-cam-retake").addEventListener("click",()=>{H=null,s.style.display="none",t.style.display="",U(null),f(),a()}),e.querySelector("#pip-cam-use").addEventListener("click",()=>{H&&(G=H,r="camera",f())}),e.querySelector("#pip-cam-ai").addEventListener("click",()=>{if(!H)return;const n=H;r="ai",sourceCards.forEach(d=>d.classList.toggle("active",d.dataset.source==="ai")),B(),setTimeout(()=>Me(n),50)})}function ht(e){const t=T(_e||I?.name||"");e.innerHTML=`
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
                    <button type="button" class="pip-mode-card" data-mode="portrait">
                        <span class="pip-card-emoji">🍽️</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Kokken præsenterer maden</div>
                    </button>
                </div>
                <div class="pip-mode-desc-text" id="pip-mode-desc">${je.reference}</div>
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
                <div class="pip-loading-message" id="pip-loading-msg">${ue[0]}</div>
            </div>

            <!-- Result -->
            <div class="pip-ai-result" id="pip-result" style="display:none">
                <img id="pip-result-img">
                <div class="pip-result-label" id="pip-result-label"></div>
                <div class="pip-result-actions">
                    <button type="button" class="pip-btn-secondary" id="pip-retry">🔄 Prøv igen</button>
                </div>
            </div>
        `,kt(e)}function kt(e){const t=e.querySelector("#pip-ai-name"),s=e.querySelectorAll(".pip-style-card"),i=e.querySelector("#pip-custom-section"),a=e.querySelector("#pip-custom-prompt"),n=e.querySelector("#pip-ai-step1"),d=e.querySelector("#pip-photo-actions"),m=e.querySelector("#pip-photo-preview"),D=e.querySelector("#pip-photo-img"),Fe=e.querySelector("#pip-photo-remove"),ze=e.querySelector("#pip-photo-file"),He=ze?.querySelector("input"),St=e.querySelector("#pip-photo-camera"),K=e.querySelector("#pip-mode-section"),fe=e.querySelectorAll(".pip-mode-card"),Re=e.querySelector("#pip-mode-desc"),te=e.querySelector("#pip-generate"),Ue=e.querySelector("#pip-loading"),Oe=e.querySelector("#pip-loading-msg"),be=e.querySelector("#pip-result"),wt=e.querySelector("#pip-result-img"),xt=e.querySelector("#pip-result-label"),Lt=e.querySelector("#pip-retry"),se=e.querySelector("#pip-advanced"),re=e.querySelector("#pip-style-prompt"),pe=e.querySelector("#pip-photo-prompt"),Et=e.querySelector("#pip-reset-prompts");s.forEach(o=>{o.addEventListener("click",()=>{v=o.dataset.style,s.forEach(E=>E.classList.toggle("active",E===o));const b=v==="custom";if(i.style.display=b?"block":"none",n.style.display=b?"none":"block",K){const E=b||!k;K.classList.toggle("pip-disabled",E);const Y=K.querySelector("#pip-mode-hint");Y&&(Y.style.display=E?"":"none")}O()})}),ze?.addEventListener("click",()=>He?.click()),He?.addEventListener("change",o=>{o.target.files[0]&&Be(o.target.files[0]),o.target.value=""}),e.querySelector("#pip-photo-pick")?.addEventListener("click",()=>{C=!0,x="select",r=ae[0].key,W(),B()}),St?.addEventListener("click",async()=>{try{const o=await et({showCustomAlert:N});o&&Be(o)}catch(o){console.error("[aiPhotoCamera]",o)}}),Fe?.addEventListener("click",It);async function Be(o){try{k=await de(o),jt(k)}catch(b){console.error("[aiPhoto]",b)}}function jt(o){D.src=URL.createObjectURL(o),m.style.display="flex",d.style.display="none",v!=="custom"&&ve(K),O()}function It(){k=null,m.style.display="none",d.style.display="flex",st(K),O()}fe.forEach(o=>{o.addEventListener("click",()=>{$=o.dataset.mode,fe.forEach(b=>b.classList.toggle("active",b===o)),Re.textContent=je[$]||"",O()})});function Pt(){return v==="custom"?"":$==="portrait"&&!!k?v==="pixar"?Ht:zt:v==="pixar"?Ft:Mt}function _t(){const o=t?.value?.trim()||"";return v==="custom"?"":k?$==="portrait"?`Transform into ${v==="clay"?"clay-animated":"Pixar/Dreamworks-style animated"} version. Person (cook/chef) proudly presenting food. Preserve features. Include food prominently.${o?` Dish: ${o}`:""}`:$==="motiv"?`Recreate composition from photo as 3D icon. Keep food arrangement, render in ${v==="pixar"?"glossy Pixar":"Flango clay"} style. If people appear, include as stylized characters.${o?` Product: ${o}`:""}`:`Use photo only to identify food. Create fresh ${v==="pixar"?"Pixar-style":"clay-style"} icon. Ignore background/angle. Include container only if needed.${o?` Product: ${o}`:""}`:`The food item is: ${o}
Include a bowl, plate, cup, or container only if the food needs one.`}function O(){se?.open&&(!X&&re&&(re.value=Pt()),!Z&&pe&&(pe.value=_t()))}se?.addEventListener("toggle",()=>{se.open&&(X=!1,Z=!1,O())}),re?.addEventListener("input",()=>{X=!0}),pe?.addEventListener("input",()=>{Z=!0}),Et?.addEventListener("click",()=>{X=!1,Z=!1,O()}),t?.addEventListener("input",O);let ge=!1,De=null;async function Ne(){if(ge)return;const o=v==="custom",b=t?.value?.trim()||"",E=a?.value?.trim()||"",Y=!!k;if(o&&!E){N?.("Manglende prompt","Skriv en prompt i tekstfeltet");return}if(!o&&!b&&!Y){N?.("Manglende input","Skriv et produktnavn eller upload et foto");return}ge=!0,te.style.display="none",be.style.display="none",Ue.style.display="block",dt(),q=null;let he=0;Oe.textContent=ue[0],De=setInterval(()=>{he=(he+1)%ue.length,Oe.textContent=ue[he]},3e3);try{const{data:{session:le}}=await Le.auth.getSession(),Ge=le?.access_token||"",Ve=Le.supabaseUrl||Le.rest?.url?.replace("/rest/v1","")||"",ie=se?.open&&(X||Z),Ke=ie?((re?.value?.trim()||"")+`

`+(pe?.value?.trim()||"")).trim():"",Ye={Authorization:`Bearer ${Ge}`};let g;if(Y&&!o&&!ie)g=new FormData,h&&j?g.append("product_id",j):g.append("save_to_library_only","true"),g.append("product_name",b),g.append(h?"reference_image":"photo",k,"photo.webp"),g.append("style",v),g.append("photo_mode",$);else if(Y)g=new FormData,h&&j?g.append("product_id",j):g.append("save_to_library_only","true"),g.append("product_name",b),g.append(h?"reference_image":"photo",k,"photo.webp"),g.append("prompt_mode","custom"),g.append("custom_prompt",ie?Ke:E);else{Ye["Content-Type"]="application/json";const w={product_name:b,style:o?"custom":v};h&&j?w.product_id=j:w.save_to_library_only=!0,(o||ie)&&(w.prompt_mode="custom",w.custom_prompt=ie?Ke:E||b),g=JSON.stringify(w)}const u=await(await fetch(`${Ve}/functions/v1/generate-product-icon`,{method:"POST",headers:Ye,body:g})).json();if(!u.success)throw new Error(u.error||"Generering fejlede");if(!u.image_base64)throw new Error("Ingen billede-data fra serveren");const ke=atob(u.image_base64),Je=new Uint8Array(ke.length);for(let w=0;w<ke.length;w++)Je[w]=ke.charCodeAt(w);const Xe=new Blob([Je],{type:`image/${u.format||"webp"}`}),Ze=await At(Xe);console.log(`[AI Generate] Raw ${(Xe.size/1024).toFixed(1)}KB → Compressed ${(Ze.size/1024).toFixed(1)}KB`);const $t=u.fallback_name||b||"AI ikon",A=new FormData;A.append("file",new File([Ze],"ai-icon.webp",{type:"image/webp"})),A.append("institutionId",M),h&&j?A.append("productId",j):A.append("skipProduct","true"),A.append("libraryName",$t),u.style&&A.append("aiStyle",String(u.style)),u.mode&&A.append("aiPhotoMode",String(u.mode)),u.prompt_mode&&A.append("aiPromptMode",String(u.prompt_mode));const Se=await fetch(`${Ve}/functions/v1/upload-product-icon`,{method:"POST",headers:{Authorization:`Bearer ${Ge}`},body:A}),J=await Se.json().catch(()=>({}));if(!Se.ok||!J?.success)throw new Error(J?.error||`Upload fejlede (${Se.status})`);const Qe=J.icon_url||null,qt=J.icon_storage_path||null,Ct=J.library_icon_url||null;q=Qe||Ct,wt.src=q,be.style.display="block";const ce=[];if(u.style&&ce.push(u.style==="clay"?"🏺 Clay":u.style==="pixar"?"🎬 Pixar":"✍️ Fri prompt"),u.mode){const w={"photo-reference":"📷 Reference","photo-motiv":"🖼️ Motiv","photo-avatar":"👤 Avatar","photo-portrait":"🍽️ Mad Portræt",text:"✏️ Tekst","custom-photo":"🎨 Fri prompt","custom-text":"🎨 Fri prompt"};ce.push(w[u.mode]||u.mode)}xt.textContent=ce.join(" · "),U(q,ce.join(" · ")),f(),me?.("success"),h&&j&&F({type:"ai",url:Qe,storagePath:qt,updatedAt:J.icon_updated_at,metadata:{style:v,photoMode:$}})}catch(le){console.error("[AI Generate]",le),N?.("AI Fejl",le.message||"Generering fejlede"),me?.("error"),te.style.display="block"}finally{clearInterval(De),Ue.style.display="none",q||(te.style.display="block"),ge=!1}}te?.addEventListener("click",Ne),Lt?.addEventListener("click",()=>{be.style.display="none",te.style.display="block",Ne()}),z&&I&&($="portrait",fe.forEach(o=>o.classList.toggle("active",o.dataset.mode==="portrait")),Re.textContent=je.portrait,Fe.style.display="none",d.style.display="none",D.src=I.icon_url,m.style.display="flex",ve(K),fetch(I.icon_url).then(o=>o.blob()).then(o=>{k=new File([o],"ref.webp",{type:"image/webp"}),O()}).catch(o=>console.error("[fetchEditIcon]",o)))}function Me(e){k=e;const t=P.querySelector("#pip-photo-preview"),s=P.querySelector("#pip-photo-img"),i=P.querySelector("#pip-photo-actions"),a=P.querySelector("#pip-mode-section");s&&(s.src=URL.createObjectURL(e)),t&&(t.style.display="flex"),i&&(i.style.display="none"),a&&v!=="custom"&&ve(a)}W(),B()}export{Rt as openProductIconPicker};
