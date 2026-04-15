import{S as be,f as Ne,p as le,t as Be,a as Ve,b as Ke,u as xt}from"./main-DjjFb6_6.js";import{e as C,C as he,s as ke}from"./kitchen-sound-Cik9k9Mq.js";const Lt="A single centered food product icon in soft 3D clay style. Rounded puffy shapes, smooth matte clay texture, subtle soft shadows on the object only. Pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic like premium mobile app UI icons. Skeuomorphic but simplified - Apple-like simplicity with minimal detail. No text, no labels, no table, no background elements. The object floats on a perfectly transparent background. Clean crisp edges suitable for UI overlay.",Et="A single centered food product icon in Pixar-style 3D rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights, gentle ambient occlusion shadows on the object only. Friendly, appealing, child-safe aesthetic. Clean and simple - minimal detail, maximum charm. No text, no labels, no background elements. The object floats on a perfectly transparent background with clean crisp edges suitable for UI overlay.",jt="3D clay-animated style rendering. Rounded puffy shapes, smooth matte clay texture, pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic. Characters should look like high-quality clay figurines with warm, expressive faces.",It="Pixar/Dreamworks-style 3D animated rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights. Friendly, appealing, child-safe aesthetic with maximum charm. Characters should look like they belong in a Pixar feature film.",Se=[{emoji:"🍫",name:"Chokolade"},{emoji:"🍽️",name:"Tallerken"},{emoji:"🍷",name:"Glas"},{emoji:"🍎",name:"Æble"},{emoji:"🥜",name:"Nødder"},{emoji:"🥪",name:"Sandwich"},{emoji:"🍕",name:"Pizza"},{emoji:"🥤",name:"Sodavand"},{emoji:"🍚",name:"Ris"},{emoji:"🍣",name:"Sushi"},{emoji:"🥢",name:"Spisepinde"},{emoji:"🍞",name:"Brød"},{emoji:"🥝",name:"Kiwi"},{emoji:"🍇",name:"Vindruer"},{emoji:"🍐",name:"Pære"},{emoji:"🍉",name:"Vandmelon"},{emoji:"🍙",name:"Risbolle"},{emoji:"🍲",name:"Gryde"},{emoji:"🥘",name:"Pande"},{emoji:"🫘",name:"Bønner"},{emoji:"🍔",name:"Burger"},{emoji:"🌶️",name:"Chili"},{emoji:"🧄",name:"Hvidløg"},{emoji:"🍳",name:"Stegepande"},{emoji:"🔥",name:"Ild"},{emoji:"😋",name:"Lækkert"},{emoji:"🍰",name:"Kage"},{emoji:"♨️",name:"Varmt"},{emoji:"🍪",name:"Småkage"}],we={reference:"📷 AI'en ser kun maden på fotoet og laver et helt nyt ikon fra bunden.",motiv:"🖼️ AI'en genskaber hele kompositionen (mad, tallerkener, personer) i valgt stil.",portrait:"🍽️ AI'en laver en animeret figur af kokken der præsenterer/holder retten."},ce=["🪄 AI'en tegner dit ikon...","🎨 Vælger de bedste farver...","✨ Tilføjer de sidste detaljer...","🖌️ Næsten klar..."],xe=[{key:"institution",emoji:"🏠",label:"",desc:"Fra jeres ikonbibliotek",productOnly:!0},{key:"standard",emoji:"📁",label:"Standard",desc:"Flangos 3D-ikoner",productOnly:!0},{key:"emoji",emoji:"😀",label:"Emoji",desc:"Vælg en emoji som ikon",productOnly:!0},{key:"shared",emoji:"🌐",label:"Fra andre",desc:"Delte ikoner fra andre institutioner",productOnly:!0},{key:"ai",emoji:"🪄",label:"AI Ikon",desc:"Lad AI'en tegne et ikon for dig",productOnly:!1},{key:"camera",emoji:"📸",label:"Kamera",desc:"Tag foto af maden med kameraet",productOnly:!1},{key:"upload",emoji:"📤",label:"Upload",desc:"Upload eget billede som ikon",productOnly:!1}];function _t(Le){const{mode:Ye="product",institutionId:E,productId:T,productName:Ee="",currentIcon:je,editingIcon:j,adminProfile:Ie,showCustomAlert:G,playSound:de,defaultSource:Je,onResult:A}=Le,h=Ye==="product",M=!!j;function ue(e){if(!e)return;e.classList.remove("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="none")}function Xe(e){if(!e)return;e.classList.add("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="")}let r=M?"ai":Je||(h?"institution":"ai"),v="pixar",P="reference",k=null,$=null,N=null,F=null,l=null,S=null,q=!1,p="",H=null,y=null,Y=!1,J=!1;const _e=localStorage.getItem("flango_institution_name")||"Jeres",Pe=xe.find(e=>e.key==="institution");Pe&&(Pe.label=`${_e}s ikoner`);const ie=xe.filter(e=>["institution","standard","emoji","shared"].includes(e.key)),$e=xe.filter(e=>["ai","camera","upload"].includes(e.key)),Ze=["upload","camera","ai"].includes(r);let w=M||Ze?"create":h?"select":"create";const ae=document.createElement("div");ae.className="pip-overlay";const x=document.createElement("div");x.className="pip-fullscreen";const Qe=M?"Redigér ikon med AI":h?"Produktikon":"Opret nyt ikon";x.innerHTML=`
        <div class="pip-header">
            <button type="button" class="pip-back-btn" id="pip-header-back" aria-label="Tilbage">← Tilbage</button>
            ${h&&!M?`
            <button type="button" class="pip-header-tab ${w==="select"?"active":""}" data-cat="select">📁 Vælg ikon</button>
            <button type="button" class="pip-header-tab ${w==="create"?"active":""}" data-cat="create">🪄 Opret ikon</button>
            `:`<h2>${Qe}</h2>`}
        </div>

        ${M&&j?`
        <div class="pip-edit-preview">
            <img src="${j.icon_url}" alt="${C(j.name)}">
            <div class="pip-edit-name">${C(j.name)}</div>
        </div>`:""}

        <div class="pip-source-zone" id="pip-source-zone"></div>

        <div class="pip-content-zone" id="pip-content"></div>

        <div class="pip-footer">
            <button type="button" class="pip-manage-library-btn" style="margin-right:auto;padding:10px 20px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.1);color:#e2e8f0;cursor:pointer;font-size:14px;font-weight:600" title="Administrer Ikoner">📂 Administrer Ikoner</button>
            ${!h||M?`<input type="text" class="pip-name-input" placeholder="Ikon-navn" value="${C(j?.name||Ee||"")}">`:'<div class="pip-footer-spacer"></div>'}
            <button type="button" class="pip-cancel-btn">Annuller</button>
            <button type="button" class="pip-save-btn" disabled>${h?"Vælg":"Gem ikon"}</button>
        </div>
    `,ae.appendChild(x),document.body.appendChild(ae);const I=x.querySelector("#pip-content"),B=x.querySelector("#pip-source-zone"),X=x.querySelector(".pip-save-btn");let c=null;const _=()=>ae.remove();x.querySelector(".pip-cancel-btn").addEventListener("click",_),x.querySelector("#pip-header-back")?.addEventListener("click",_),x.querySelector(".pip-manage-library-btn")?.addEventListener("click",()=>{const e={...Le};_(),typeof window.__flangoOpenIconLibrary=="function"&&window.__flangoOpenIconLibrary(()=>{_t(e)})});function We(){x.querySelectorAll(".pip-header-tab").forEach(e=>{e.classList.toggle("active",e.dataset.cat===w)})}x.querySelectorAll(".pip-header-tab").forEach(e=>{e.addEventListener("click",()=>{w=e.dataset.cat,r=(w==="select"?ie:$e)[0].key,p="",We(),Z(),U(),f()})});function Z(){if(M){B.style.display="none";return}const e=w==="select"?ie:$e;B.innerHTML=`
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
        `,c=B.querySelector(".pip-preview-box"),c.querySelector(".pip-preview-clear"),S?c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>':je?.url&&(S=`<img src="${je.url}"><div class="pip-preview-label">Nuværende ikon</div>`,c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c.querySelector(".pip-preview-clear")?.addEventListener("click",t=>{t.stopPropagation(),Q()}),B.querySelectorAll(".pip-source-card").forEach(t=>{t.addEventListener("click",()=>{r===t.dataset.source?(r=null,B.querySelectorAll(".pip-source-card").forEach(s=>s.classList.remove("active"))):(r=t.dataset.source,B.querySelectorAll(".pip-source-card").forEach(s=>s.classList.toggle("active",s.dataset.source===r))),U(),f()})})}async function et(e){if(!H){H=[];try{(await Ve(E)).forEach(a=>H.push({label:a.name,path:a.icon_url,source:_e,imgSrc:a.icon_url,tags:a.tags||""}))}catch{}be.forEach(i=>H.push({label:i.label,path:i.path,source:"Standard",imgSrc:i.path})),Se.forEach(({emoji:i,name:a})=>H.push({label:a,path:null,source:"Emoji",emoji:i}));try{(await Ne(E)).icon_use_shared_enabled&&(await Ke(E)).forEach(n=>H.push({label:n.name,path:n.icon_url,source:"Delt",imgSrc:n.icon_url,tags:n.tags||""}))}catch{}}const t=p?H.filter(i=>i.label.toLowerCase().includes(p)||i.source.toLowerCase().includes(p)||(i.tags||"").toLowerCase().includes(p)):H;if(t.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${C(p)}"</div>`:'<div class="pip-empty-state">Ingen ikoner fundet</div>';return}if(p){const i=document.createElement("div");i.style.cssText="font-size:13px;color:#64748b;margin-bottom:12px;",i.textContent=`${t.length} resultat${t.length===1?"":"er"}`,e.appendChild(i)}const s=document.createElement("div");s.className="pip-icon-grid",t.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${l===i.path?"selected":""}`,i.emoji?(a.innerHTML=`<span style="font-size:40px">${i.emoji}</span><span>${i.source}</span>`,a.addEventListener("click",()=>{if(q&&i.path){ne(i.path);return}y=i.emoji,l=null,S=`<span style="font-size:48px">${i.emoji}</span><div class="pip-preview-label">Emoji</div>`,c&&(c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c?.querySelector(".pip-preview-clear")?.addEventListener("click",Q),f()})):(a.dataset.path=i.path,a.innerHTML=`<img src="${i.imgSrc}" alt="${i.label}"><span>${i.label}<br><small style="color:#64748b">${i.source}</small></span>`,a.addEventListener("click",()=>{if(q){ne(i.path);return}l=i.path,y=null,s.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),R(i.imgSrc,i.label),f()})),s.appendChild(a)}),e.appendChild(s)}async function ne(e){q=!1;try{const s=await(await fetch(e)).blob(),i=new File([s],"ref.webp",{type:s.type||"image/webp"}),a=await le(i);w="create",r="ai",Z(),U(),setTimeout(()=>Ce(a),50)}catch(t){console.error("[referencePickComplete]",t),q=!1}}function R(e,t){c&&(e?(S=`<img src="${e}">`+(t?`<div class="pip-preview-label">${t}</div>`:""),c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>',c.querySelector(".pip-preview-clear")?.addEventListener("click",Q)):Q(),c.classList.remove("generating"))}function Q(){S=null,l=null,y=null,$=null,c&&(c.innerHTML='<span class="pip-preview-placeholder">❓</span><div class="pip-preview-label">Intet valgt</div>'),f()}function tt(){c&&(c.innerHTML='<span class="pip-preview-placeholder">🪄</span><div class="pip-preview-label">Genererer...</div>',c.classList.add("generating"))}function f(){let e=!1;r===null?e=!!(l||y):r==="standard"?e=!!l:r==="emoji"?e=!!y:r==="institution"||r==="shared"?e=!!l:r==="upload"?e=!!N:r==="camera"?e=!!F:r==="ai"&&(e=!!$),X.disabled=!e}X.addEventListener("click",async()=>{if(r===null){y?(A({type:"emoji",emoji:y}),_()):l&&(A({type:"icon",emoji:`${he}${l}`,url:l}),_());return}if(r==="standard")l&&A({type:"standard",emoji:`${he}${l}`,url:l}),_();else if(r==="emoji")y&&A({type:"emoji",emoji:y}),_();else if(r==="institution"||r==="shared")l&&A({type:"icon",emoji:`${he}${l}`,url:l}),_();else if(r==="upload"||r==="camera"){const e=r==="upload"?N:F;if(!e)return;X.disabled=!0,X.textContent="Gemmer...";try{const t=Ie?.user_id;if(!t)throw new Error("Admin bruger ID ikke fundet");const s=await le(e),i=T||crypto.randomUUID(),a=new File([s],`${i}.webp`,{type:"image/webp"}),n=await xt(a,E,i,t);if(n.success)de?.("success"),A({type:"upload",url:n.icon_signed_url||n.icon_url,storagePath:n.icon_storage_path,updatedAt:n.icon_updated_at}),_();else throw new Error(n.error||"Upload fejlede")}catch(t){console.error("[pip save]",t),G?.("Fejl",t.message),X.textContent=h?"Vælg":"Gem ikon",f()}}else r==="ai"&&$&&(A({type:"ai",url:$,metadata:{style:v,photoMode:P}}),_())});function U(){if(I.innerHTML="",q){const e=document.createElement("div");e.style.cssText="padding:10px 16px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:#c4b5fd;",e.innerHTML=`<span style="font-size:20px">🖼️</span> <span>Vælg et ikon som foto-reference til AI — klik på det ikon du vil bruge</span>
                <button type="button" style="margin-left:auto;background:none;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;padding:4px 12px;cursor:pointer;font-size:12px;font-weight:600;" id="pip-cancel-pick">Annuller</button>`,I.appendChild(e),e.querySelector("#pip-cancel-pick").addEventListener("click",()=>{q=!1,w="create",r="ai",Z(),U()})}if(w==="select"){const e=document.createElement("div");e.className="pip-search-row",e.innerHTML=`<input type="text" class="pip-search-input" id="pip-search" placeholder="🔍 Søg ${r?"i "+(ie.find(a=>a.key===r)?.label||""):"i alle ikoner"}..." value="${C(p)}" autocomplete="off"><button type="button" class="pip-search-clear" id="pip-search-clear" ${p?"":'style="display:none"'}>✕</button>`,I.appendChild(e);let t=null;const s=e.querySelector("#pip-search"),i=e.querySelector("#pip-search-clear");s.addEventListener("input",()=>{clearTimeout(t),i.style.display=s.value?"":"none",t=setTimeout(()=>{p=s.value.trim().toLowerCase(),me()},250)}),i.addEventListener("click",()=>{p="",s.value="",i.style.display="none",s.focus(),me()}),s.focus()}me()}function me(){const e=I.querySelector(".pip-content-section");e&&e.remove();const t=document.createElement("div");if(t.className="pip-content-section",w==="select"&&r===null)et(t);else switch(r){case"standard":it(t);break;case"emoji":at(t);break;case"institution":nt(t);break;case"shared":ot(t);break;case"upload":rt(t);break;case"camera":pt(t);break;case"ai":lt(t);break}I.appendChild(t)}function it(e){const t=document.createElement("div");t.className="pip-icon-grid";const s=p?be.filter(i=>i.label.toLowerCase().includes(p)):be;if(s.length===0){e.innerHTML=`<div class="pip-empty-state">Ingen standard-ikoner matcher "${C(p)}"</div>`;return}s.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${l===i.path?"selected":""}`,a.dataset.path=i.path,a.innerHTML=`<img src="${i.path}" alt="${i.label}"><span>${i.label}</span>`,a.addEventListener("click",()=>{if(q){ne(i.path);return}l=i.path,y=null,e.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),R(i.path,i.label),f()}),t.appendChild(a)}),e.appendChild(t)}function at(e){const t=p?Se.filter(a=>a.name.toLowerCase().includes(p)||a.emoji.includes(p)):Se;e.innerHTML=`
            <div style="margin-bottom:16px">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px">Vælg en emoji</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px">Klik på en emoji nedenfor, eller skriv din egen i feltet</div>
            </div>
            <input type="text" class="pip-name-input" id="pip-emoji-input" placeholder="Indtast emoji her..." value="${y||""}" style="width:100%;max-width:300px;font-size:24px;text-align:center;margin-bottom:16px">
            <div class="pip-icon-grid" id="pip-emoji-grid"></div>
        `,t.length===0&&(e.querySelector("#pip-emoji-grid").innerHTML=`<div class="pip-empty-state">Ingen emojis matcher "${C(p)}"</div>`);const s=e.querySelector("#pip-emoji-input"),i=e.querySelector("#pip-emoji-grid");t.forEach(({emoji:a,name:n})=>{const d=document.createElement("div");d.className="pip-icon-option",d.innerHTML=`<span style="font-size:36px">${a}</span><span>${n}</span>`,d.addEventListener("click",()=>{y=a,l=null,s.value=a,S=`<span style="font-size:48px">${a}</span><div class="pip-preview-label">${n}</div>`,c&&(c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c?.querySelector(".pip-preview-clear")?.addEventListener("click",Q),f()}),i.appendChild(d)}),s.addEventListener("input",()=>{y=s.value||null,l=null,y&&(S=`<span style="font-size:48px">${y}</span><div class="pip-preview-label">Emoji</div>`,c&&(c.innerHTML=S)),f()})}function nt(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',qe(e,()=>Ve(E),"Ingen egne ikoner endnu — upload eller generer via AI.")}function ot(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',st(e)}async function st(e){if(e||(e=I.querySelector(".pip-content-section")),!e)return;if(!(await Ne(E)).icon_use_shared_enabled){e.innerHTML='<div class="pip-empty-state">Brug af delte ikoner er ikke aktiveret. Slå det til under Institutionsindstillinger.</div>';return}qe(e,()=>Ke(E),"Ingen delte ikoner tilgængelige endnu.")}async function qe(e,t,s){let i=await t();if(e.innerHTML="",p&&(console.log("[loadIconGrid] Searching for:",p,"in",i.length,"icons. Sample tags:",i.slice(0,3).map(n=>n.name+":"+(n.tags||"none"))),i=i.filter(n=>n.name.toLowerCase().includes(p)||(n.tags||"").toLowerCase().includes(p)),console.log("[loadIconGrid] After filter:",i.length,"matches")),i.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${C(p)}"</div>`:`<div class="pip-empty-state">${s}</div>`;return}const a=document.createElement("div");a.className="pip-icon-grid",i.forEach(n=>{const d=document.createElement("div");d.className=`pip-icon-option ${l===n.icon_url?"selected":""}`,d.dataset.path=n.icon_url;const m=n.source==="uploaded"?"📤":"🪄";d.innerHTML=`<img src="${n.icon_url}" alt="${n.name}"><span>${m} ${n.name}</span>`,d.addEventListener("click",()=>{if(q){ne(n.icon_url);return}l=n.icon_url,y=null,a.querySelectorAll(".pip-icon-option").forEach(D=>D.classList.toggle("selected",D.dataset.path===n.icon_url)),R(n.icon_url,n.name),f()}),a.appendChild(d)}),e.appendChild(a)}function rt(e){e.innerHTML=`
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
            </label>`;const t=e.querySelector("#pip-upload-drop"),s=e.querySelector("input[type=file]"),i=e.querySelector("#pip-upload-preview"),a=e.querySelector("#pip-upload-img"),n=e.querySelector("#pip-upload-remove");t.addEventListener("click",()=>s.click()),s.addEventListener("change",m=>{m.target.files[0]&&d(m.target.files[0]),m.target.value=""}),t.addEventListener("dragover",m=>{m.preventDefault(),t.classList.add("dragover")}),t.addEventListener("dragleave",()=>t.classList.remove("dragover")),t.addEventListener("drop",m=>{m.preventDefault(),t.classList.remove("dragover"),m.dataTransfer.files[0]&&d(m.dataTransfer.files[0])}),n.addEventListener("click",()=>{N=null,i.style.display="none",t.style.display="",R(null),f()});async function d(m){try{N=await le(m),a.src=URL.createObjectURL(N),i.style.display="",t.style.display="none",R(a.src,"Uploadet billede"),f()}catch(D){console.error("[upload]",D)}}}function pt(e){e.innerHTML=`
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
            </div>`;const t=e.querySelector("#pip-cam-trigger"),s=e.querySelector("#pip-cam-preview"),i=e.querySelector("#pip-cam-img"),a=async()=>{try{const n=await Be({showCustomAlert:G});n&&(F=n,i.src=URL.createObjectURL(n),s.style.display="",t.style.display="none",R(i.src,"Foto"),f())}catch(n){console.error("[camera]",n)}};t.addEventListener("click",a),e.querySelector("#pip-cam-retake").addEventListener("click",()=>{F=null,s.style.display="none",t.style.display="",R(null),f(),a()}),e.querySelector("#pip-cam-use").addEventListener("click",()=>{F&&(N=F,r="camera",f())}),e.querySelector("#pip-cam-ai").addEventListener("click",()=>{if(!F)return;const n=F;r="ai",sourceCards.forEach(d=>d.classList.toggle("active",d.dataset.source==="ai")),U(),setTimeout(()=>Ce(n),50)})}function lt(e){const t=C(Ee||j?.name||"");e.innerHTML=`
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
                <div class="pip-mode-desc-text" id="pip-mode-desc">${we.reference}</div>
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
                <div class="pip-loading-message" id="pip-loading-msg">${ce[0]}</div>
            </div>

            <!-- Result -->
            <div class="pip-ai-result" id="pip-result" style="display:none">
                <img id="pip-result-img">
                <div class="pip-result-label" id="pip-result-label"></div>
                <div class="pip-result-actions">
                    <button type="button" class="pip-btn-secondary" id="pip-retry">🔄 Prøv igen</button>
                </div>
            </div>
        `,ct(e)}function ct(e){const t=e.querySelector("#pip-ai-name"),s=e.querySelectorAll(".pip-style-card"),i=e.querySelector("#pip-custom-section"),a=e.querySelector("#pip-custom-prompt"),n=e.querySelector("#pip-ai-step1"),d=e.querySelector("#pip-photo-actions"),m=e.querySelector("#pip-photo-preview"),D=e.querySelector("#pip-photo-img"),Te=e.querySelector("#pip-photo-remove"),Ae=e.querySelector("#pip-photo-file"),Me=Ae?.querySelector("input"),dt=e.querySelector("#pip-photo-camera"),V=e.querySelector("#pip-mode-section"),ve=e.querySelectorAll(".pip-mode-card"),Fe=e.querySelector("#pip-mode-desc"),W=e.querySelector("#pip-generate"),He=e.querySelector("#pip-loading"),Re=e.querySelector("#pip-loading-msg"),ye=e.querySelector("#pip-result"),ut=e.querySelector("#pip-result-img"),mt=e.querySelector("#pip-result-label"),vt=e.querySelector("#pip-retry"),oe=e.querySelector("#pip-advanced"),se=e.querySelector("#pip-style-prompt"),re=e.querySelector("#pip-photo-prompt"),yt=e.querySelector("#pip-reset-prompts");s.forEach(o=>{o.addEventListener("click",()=>{v=o.dataset.style,s.forEach(L=>L.classList.toggle("active",L===o));const g=v==="custom";if(i.style.display=g?"block":"none",n.style.display=g?"none":"block",V){const L=g||!k;V.classList.toggle("pip-disabled",L);const K=V.querySelector("#pip-mode-hint");K&&(K.style.display=L?"":"none")}z()})}),Ae?.addEventListener("click",()=>Me?.click()),Me?.addEventListener("change",o=>{o.target.files[0]&&ze(o.target.files[0]),o.target.value=""}),e.querySelector("#pip-photo-pick")?.addEventListener("click",()=>{q=!0,w="select",r=ie[0].key,Z(),U()}),dt?.addEventListener("click",async()=>{try{const o=await Be({showCustomAlert:G});o&&ze(o)}catch(o){console.error("[aiPhotoCamera]",o)}}),Te?.addEventListener("click",gt);async function ze(o){try{k=await le(o),ft(k)}catch(g){console.error("[aiPhoto]",g)}}function ft(o){D.src=URL.createObjectURL(o),m.style.display="flex",d.style.display="none",v!=="custom"&&ue(V),z()}function gt(){k=null,m.style.display="none",d.style.display="flex",Xe(V),z()}ve.forEach(o=>{o.addEventListener("click",()=>{P=o.dataset.mode,ve.forEach(g=>g.classList.toggle("active",g===o)),Fe.textContent=we[P]||"",z()})});function bt(){return v==="custom"?"":P==="portrait"&&!!k?v==="pixar"?It:jt:v==="pixar"?Et:Lt}function ht(){const o=t?.value?.trim()||"";return v==="custom"?"":k?P==="portrait"?`Transform into ${v==="clay"?"clay-animated":"Pixar/Dreamworks-style animated"} version. Person (cook/chef) proudly presenting food. Preserve features. Include food prominently.${o?` Dish: ${o}`:""}`:P==="motiv"?`Recreate composition from photo as 3D icon. Keep food arrangement, render in ${v==="pixar"?"glossy Pixar":"Flango clay"} style. If people appear, include as stylized characters.${o?` Product: ${o}`:""}`:`Use photo only to identify food. Create fresh ${v==="pixar"?"Pixar-style":"clay-style"} icon. Ignore background/angle. Include container only if needed.${o?` Product: ${o}`:""}`:`The food item is: ${o}
Include a bowl, plate, cup, or container only if the food needs one.`}function z(){oe?.open&&(!Y&&se&&(se.value=bt()),!J&&re&&(re.value=ht()))}oe?.addEventListener("toggle",()=>{oe.open&&(Y=!1,J=!1,z())}),se?.addEventListener("input",()=>{Y=!0}),re?.addEventListener("input",()=>{J=!0}),yt?.addEventListener("click",()=>{Y=!1,J=!1,z()}),t?.addEventListener("input",z);let fe=!1,Oe=null;async function Ue(){if(fe)return;const o=v==="custom",g=t?.value?.trim()||"",L=a?.value?.trim()||"",K=!!k;if(o&&!L){G?.("Manglende prompt","Skriv en prompt i tekstfeltet");return}if(!o&&!g&&!K){G?.("Manglende input","Skriv et produktnavn eller upload et foto");return}fe=!0,W.style.display="none",ye.style.display="none",He.style.display="block",tt(),$=null;let ge=0;Re.textContent=ce[0],Oe=setInterval(()=>{ge=(ge+1)%ce.length,Re.textContent=ce[ge]},3e3);try{const ee=Ie?.user_id;if(!ee)throw new Error("Admin bruger ID ikke fundet");const{data:{session:kt}}=await ke.auth.getSession(),St=kt?.access_token||"",wt=ke.supabaseUrl||ke.rest?.url?.replace("/rest/v1","")||"",te=oe?.open&&(Y||J),De=te?((se?.value?.trim()||"")+`

`+(re?.value?.trim()||"")).trim():"",Ge={Authorization:`Bearer ${St}`,"x-admin-user-id":ee};let u;if(K&&!o&&!te)u=new FormData,h&&T?u.append("product_id",T):(u.append("institution_id",E),u.append("save_to_library_only","true")),u.append("product_name",g),u.append(h?"reference_image":"photo",k,"photo.webp"),u.append("style",v),u.append("photo_mode",P);else if(K)u=new FormData,h&&T?u.append("product_id",T):(u.append("institution_id",E),u.append("save_to_library_only","true")),u.append("product_name",g),u.append(h?"reference_image":"photo",k,"photo.webp"),u.append("prompt_mode","custom"),u.append("custom_prompt",te?De:L);else{Ge["Content-Type"]="application/json";const O={product_name:g,style:o?"custom":v};h&&T?O.product_id=T:(O.institution_id=E,O.save_to_library_only=!0),(o||te)&&(O.prompt_mode="custom",O.custom_prompt=te?De:L||g),u=JSON.stringify(O)}const b=await(await fetch(`${wt}/functions/v1/generate-product-icon`,{method:"POST",headers:Ge,body:u})).json();if(!b.success)throw new Error(b.error||"Generering fejlede");$=b.library_icon_url||b.icon_signed_url||b.icon_url,ut.src=$,ye.style.display="block";const pe=[];if(b.style&&pe.push(b.style==="clay"?"🏺 Clay":b.style==="pixar"?"🎬 Pixar":"✍️ Fri prompt"),b.mode){const O={"photo-reference":"📷 Reference","photo-motiv":"🖼️ Motiv","photo-avatar":"👤 Avatar","photo-portrait":"🍽️ Mad Portræt",text:"✏️ Tekst","custom-photo":"🎨 Fri prompt","custom-text":"🎨 Fri prompt"};pe.push(O[b.mode]||b.mode)}mt.textContent=pe.join(" · "),R($,pe.join(" · ")),f(),de?.("success"),h&&T&&A({type:"ai",url:b.icon_signed_url||b.icon_url,storagePath:b.icon_storage_path,updatedAt:b.icon_updated_at,metadata:{style:v,photoMode:P}})}catch(ee){console.error("[AI Generate]",ee),G?.("AI Fejl",ee.message||"Generering fejlede"),de?.("error"),W.style.display="block"}finally{clearInterval(Oe),He.style.display="none",$||(W.style.display="block"),fe=!1}}W?.addEventListener("click",Ue),vt?.addEventListener("click",()=>{ye.style.display="none",W.style.display="block",Ue()}),M&&j&&(P="portrait",ve.forEach(o=>o.classList.toggle("active",o.dataset.mode==="portrait")),Fe.textContent=we.portrait,Te.style.display="none",d.style.display="none",D.src=j.icon_url,m.style.display="flex",ue(V),fetch(j.icon_url).then(o=>o.blob()).then(o=>{k=new File([o],"ref.webp",{type:"image/webp"}),z()}).catch(o=>console.error("[fetchEditIcon]",o)))}function Ce(e){k=e;const t=I.querySelector("#pip-photo-preview"),s=I.querySelector("#pip-photo-img"),i=I.querySelector("#pip-photo-actions"),a=I.querySelector("#pip-mode-section");s&&(s.src=URL.createObjectURL(e)),t&&(t.style.display="flex"),i&&(i.style.display="none"),a&&v!=="custom"&&ue(a)}Z(),U()}export{_t as openProductIconPicker};
