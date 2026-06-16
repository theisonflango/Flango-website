import{e as T,C as we,S as xe,f as et,p as de,i as Le,t as tt,a as it,b as at,s as Ee,c as Tt,u as Mt}from"./main-CSMZufqa.js";const Ft="A single centered food product icon in soft 3D clay style. Rounded puffy shapes, smooth matte clay texture, subtle soft shadows on the object only. Pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic like premium mobile app UI icons. Skeuomorphic but simplified - Apple-like simplicity with minimal detail. No text, no labels, no table, no background elements. The object floats on a perfectly transparent background. Clean crisp edges suitable for UI overlay.",zt="A single centered food product icon in Pixar-style 3D rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights, gentle ambient occlusion shadows on the object only. Friendly, appealing, child-safe aesthetic. Clean and simple - minimal detail, maximum charm. No text, no labels, no background elements. The object floats on a perfectly transparent background with clean crisp edges suitable for UI overlay.",Ht="3D clay-animated style rendering. Rounded puffy shapes, smooth matte clay texture, pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic. Characters should look like high-quality clay figurines with warm, expressive faces.",Rt="Pixar/Dreamworks-style 3D animated rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights. Friendly, appealing, child-safe aesthetic with maximum charm. Characters should look like they belong in a Pixar feature film.",je=[{emoji:"🍫",name:"Chokolade"},{emoji:"🍽️",name:"Tallerken"},{emoji:"🍷",name:"Glas"},{emoji:"🍎",name:"Æble"},{emoji:"🥜",name:"Nødder"},{emoji:"🥪",name:"Sandwich"},{emoji:"🍕",name:"Pizza"},{emoji:"🥤",name:"Sodavand"},{emoji:"🍚",name:"Ris"},{emoji:"🍣",name:"Sushi"},{emoji:"🥢",name:"Spisepinde"},{emoji:"🍞",name:"Brød"},{emoji:"🥝",name:"Kiwi"},{emoji:"🍇",name:"Vindruer"},{emoji:"🍐",name:"Pære"},{emoji:"🍉",name:"Vandmelon"},{emoji:"🍙",name:"Risbolle"},{emoji:"🍲",name:"Gryde"},{emoji:"🥘",name:"Pande"},{emoji:"🫘",name:"Bønner"},{emoji:"🍔",name:"Burger"},{emoji:"🌶️",name:"Chili"},{emoji:"🧄",name:"Hvidløg"},{emoji:"🍳",name:"Stegepande"},{emoji:"🔥",name:"Ild"},{emoji:"😋",name:"Lækkert"},{emoji:"🍰",name:"Kage"},{emoji:"♨️",name:"Varmt"},{emoji:"🍪",name:"Småkage"}],Ie={reference:"📷 AI'en ser kun maden på fotoet og laver et helt nyt ikon fra bunden.",motiv:"🖼️ AI'en genskaber hele kompositionen (mad, tallerkener, personer) i valgt stil.",portrait:"🍽️ AI'en laver en animeret figur af kokken der præsenterer/holder retten."},ue=["🪄 AI'en tegner dit ikon...","🎨 Vælger de bedste farver...","✨ Tilføjer de sidste detaljer...","🖌️ Næsten klar..."],Pe=[{key:"institution",emoji:"🏠",label:"",desc:"Fra jeres ikonbibliotek",productOnly:!0},{key:"standard",emoji:"📁",label:"Standard",desc:"Flangos 3D-ikoner",productOnly:!0},{key:"emoji",emoji:"😀",label:"Emoji",desc:"Vælg en emoji som ikon",productOnly:!0},{key:"shared",emoji:"🌐",label:"Fra andre",desc:"Delte ikoner fra andre institutioner",productOnly:!0},{key:"ai",emoji:"🪄",label:"AI Ikon",desc:"Lad AI'en tegne et ikon for dig",productOnly:!1},{key:"camera",emoji:"📸",label:"Kamera",desc:"Tag foto af maden med kameraet",productOnly:!1},{key:"upload",emoji:"📤",label:"Upload",desc:"Upload eget billede som ikon",productOnly:!1}];function Ut($e){const{mode:nt="product",institutionId:O,productId:I,productName:_e="",currentIcon:qe,editingIcon:P,adminProfile:ot,showCustomAlert:B,playSound:me,defaultSource:st,onResult:M}=$e,h=nt==="product",F=!!P;function ve(e){if(!e)return;e.classList.remove("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="none")}function rt(e){if(!e)return;e.classList.add("pip-disabled");const t=e.querySelector("#pip-mode-hint");t&&(t.style.display="")}let r=F?"ai":st||(h?"institution":"ai"),v="pixar",x="reference",k=null,q=null,G=null,z=null,l=null,S=null,A=!1,p="",H=null,y=null,X=!1,Z=!1;const Ae=localStorage.getItem("flango_institution_name")||"Jeres",Ce=Pe.find(e=>e.key==="institution");Ce&&(Ce.label=`${Ae}s ikoner`);const ae=Pe.filter(e=>["institution","standard","emoji","shared"].includes(e.key)),Te=Pe.filter(e=>["ai","camera","upload"].includes(e.key)),pt=["upload","camera","ai"].includes(r);let L=F||pt?"create":h?"select":"create";const ne=document.createElement("div");ne.className="pip-overlay";const E=document.createElement("div");E.className="pip-fullscreen";const lt=F?"Redigér ikon med AI":h?"Produktikon":"Opret nyt ikon";E.innerHTML=`
        <div class="pip-header">
            <button type="button" class="pip-back-btn" id="pip-header-back" aria-label="Tilbage">← Tilbage</button>
            ${h&&!F?`
            <button type="button" class="pip-header-tab ${L==="select"?"active":""}" data-cat="select">📁 Vælg ikon</button>
            <button type="button" class="pip-header-tab ${L==="create"?"active":""}" data-cat="create">🪄 Opret ikon</button>
            `:`<h2>${lt}</h2>`}
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
            ${!h||F?`<input type="text" class="pip-name-input" placeholder="Ikon-navn" value="${T(P?.name||_e||"")}">`:'<div class="pip-footer-spacer"></div>'}
            <button type="button" class="pip-cancel-btn">Annuller</button>
            <button type="button" class="pip-save-btn" disabled>${h?"Vælg":"Gem ikon"}</button>
        </div>
    `,ne.appendChild(E),document.body.appendChild(ne);const $=E.querySelector("#pip-content"),V=E.querySelector("#pip-source-zone"),Q=E.querySelector(".pip-save-btn");let c=null;const _=()=>ne.remove();E.querySelector(".pip-cancel-btn").addEventListener("click",_),E.querySelector("#pip-header-back")?.addEventListener("click",_),E.querySelector(".pip-manage-library-btn")?.addEventListener("click",()=>{const e={...$e};_(),typeof window.__flangoOpenIconLibrary=="function"&&window.__flangoOpenIconLibrary(()=>{Ut(e)})});function ct(){E.querySelectorAll(".pip-header-tab").forEach(e=>{e.classList.toggle("active",e.dataset.cat===L)})}E.querySelectorAll(".pip-header-tab").forEach(e=>{e.addEventListener("click",()=>{L=e.dataset.cat,r=(L==="select"?ae:Te)[0].key,p="",ct(),W(),D(),f()})});function W(){if(F){V.style.display="none";return}const e=L==="select"?ae:Te;V.innerHTML=`
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
        `,c=V.querySelector(".pip-preview-box"),c.querySelector(".pip-preview-clear"),S?c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>':qe?.url&&(S=`<img src="${qe.url}"><div class="pip-preview-label">Nuværende ikon</div>`,c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c.querySelector(".pip-preview-clear")?.addEventListener("click",t=>{t.stopPropagation(),ee()}),V.querySelectorAll(".pip-source-card").forEach(t=>{t.addEventListener("click",()=>{r===t.dataset.source?(r=null,V.querySelectorAll(".pip-source-card").forEach(s=>s.classList.remove("active"))):(r=t.dataset.source,V.querySelectorAll(".pip-source-card").forEach(s=>s.classList.toggle("active",s.dataset.source===r))),D(),f()})})}async function dt(e){if(!H){H=[];try{(await it(O)).forEach(a=>H.push({label:a.name,path:a.icon_url,source:Ae,imgSrc:a.icon_url,tags:a.tags||""}))}catch{}xe.forEach(i=>H.push({label:i.label,path:i.path,source:"Standard",imgSrc:i.path})),je.forEach(({emoji:i,name:a})=>H.push({label:a,path:null,source:"Emoji",emoji:i}));try{(await et(O)).icon_use_shared_enabled&&(await at(O)).forEach(n=>H.push({label:n.name,path:n.icon_url,source:"Delt",imgSrc:n.icon_url,tags:n.tags||""}))}catch{}}const t=p?H.filter(i=>i.label.toLowerCase().includes(p)||i.source.toLowerCase().includes(p)||(i.tags||"").toLowerCase().includes(p)):H;if(t.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:'<div class="pip-empty-state">Ingen ikoner fundet</div>';return}if(p){const i=document.createElement("div");i.style.cssText="font-size:13px;color:#64748b;margin-bottom:12px;",i.textContent=`${t.length} resultat${t.length===1?"":"er"}`,e.appendChild(i)}const s=document.createElement("div");s.className="pip-icon-grid",t.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${l===i.path?"selected":""}`,i.emoji?(a.innerHTML=`<span style="font-size:40px">${i.emoji}</span><span>${i.source}</span>`,a.addEventListener("click",()=>{if(A&&i.path){oe(i.path);return}y=i.emoji,l=null,S=`<span style="font-size:48px">${i.emoji}</span><div class="pip-preview-label">Emoji</div>`,c&&(c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c?.querySelector(".pip-preview-clear")?.addEventListener("click",ee),f()})):(a.dataset.path=i.path,a.innerHTML=`<img src="${i.imgSrc}" alt="${i.label}"><span>${i.label}<br><small style="color:#64748b">${i.source}</small></span>`,a.addEventListener("click",()=>{if(A){oe(i.path);return}l=i.path,y=null,s.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),R(i.imgSrc,i.label),f()})),s.appendChild(a)}),e.appendChild(s)}async function oe(e){A=!1;try{const s=await(await fetch(e)).blob(),i=new File([s],"ref.webp",{type:s.type||"image/webp"}),a=await de(i);L="create",r="ai",W(),D(),setTimeout(()=>Fe(a),50)}catch(t){console.error("[referencePickComplete]",t),A=!1}}function R(e,t){c&&(e?(S=`<img src="${e}">`+(t?`<div class="pip-preview-label">${t}</div>`:""),c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>',c.querySelector(".pip-preview-clear")?.addEventListener("click",ee)):ee(),c.classList.remove("generating"))}function ee(){S=null,l=null,y=null,q=null,c&&(c.innerHTML='<span class="pip-preview-placeholder">❓</span><div class="pip-preview-label">Intet valgt</div>'),f()}function ut(){c&&(c.innerHTML='<span class="pip-preview-placeholder">🪄</span><div class="pip-preview-label">Genererer...</div>',c.classList.add("generating"))}function f(){let e=!1;r===null?e=!!(l||y):r==="standard"?e=!!l:r==="emoji"?e=!!y:r==="institution"||r==="shared"?e=!!l:r==="upload"?e=!!G:r==="camera"?e=!!z:r==="ai"&&(e=!!q),Q.disabled=!e}Q.addEventListener("click",async()=>{if(r===null){y?(M({type:"emoji",emoji:y}),_()):l&&(M({type:"icon",emoji:`${we}${l}`,url:l}),_());return}if(r==="standard")l&&M({type:"standard",emoji:`${we}${l}`,url:l}),_();else if(r==="emoji")y&&M({type:"emoji",emoji:y}),_();else if(r==="institution"||r==="shared")l&&M({type:"icon",emoji:`${we}${l}`,url:l}),_();else if(r==="upload"||r==="camera"){const e=r==="upload"?G:z;if(!e)return;Q.disabled=!0,Q.textContent="Gemmer...";try{const t=ot?.user_id;if(!t)throw new Error("Admin bruger ID ikke fundet");const s=await de(e),i=I||crypto.randomUUID(),a=new File([s],`${i}.webp`,{type:"image/webp"}),n=await Mt(a,O,i,t);if(n.success)me?.("success"),M({type:"upload",url:n.icon_signed_url||n.icon_url,storagePath:n.icon_storage_path,updatedAt:n.icon_updated_at}),_();else throw new Error(n.error||"Upload fejlede")}catch(t){console.error("[pip save]",t),B?.("Fejl",t.message),Q.textContent=h?"Vælg":"Gem ikon",f()}}else r==="ai"&&q&&(M({type:"ai",url:q,metadata:{style:v,photoMode:x}}),_())});function D(){if($.innerHTML="",A){const e=document.createElement("div");e.style.cssText="padding:10px 16px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:#c4b5fd;",e.innerHTML=`<span style="font-size:20px">🖼️</span> <span>Vælg et ikon som foto-reference til AI — klik på det ikon du vil bruge</span>
                <button type="button" style="margin-left:auto;background:none;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;padding:4px 12px;cursor:pointer;font-size:12px;font-weight:600;" id="pip-cancel-pick">Annuller</button>`,$.appendChild(e),e.querySelector("#pip-cancel-pick").addEventListener("click",()=>{A=!1,L="create",r="ai",W(),D()})}if(L==="select"){const e=document.createElement("div");e.className="pip-search-row",e.innerHTML=`<input type="text" class="pip-search-input" id="pip-search" placeholder="🔍 Søg ${r?"i "+(ae.find(a=>a.key===r)?.label||""):"i alle ikoner"}..." value="${T(p)}" autocomplete="off"><button type="button" class="pip-search-clear" id="pip-search-clear" ${p?"":'style="display:none"'}>✕</button>`,$.appendChild(e);let t=null;const s=e.querySelector("#pip-search"),i=e.querySelector("#pip-search-clear");s.addEventListener("input",()=>{clearTimeout(t),i.style.display=s.value?"":"none",t=setTimeout(()=>{p=s.value.trim().toLowerCase(),ye()},250)}),i.addEventListener("click",()=>{p="",s.value="",i.style.display="none",s.focus(),ye()}),s.focus()}ye()}function ye(){const e=$.querySelector(".pip-content-section");e&&e.remove();const t=document.createElement("div");if(t.className="pip-content-section",L==="select"&&r===null)dt(t);else switch(r){case"standard":mt(t);break;case"emoji":vt(t);break;case"institution":yt(t);break;case"shared":ft(t);break;case"upload":gt(t);break;case"camera":ht(t);break;case"ai":kt(t);break}$.appendChild(t)}function mt(e){const t=document.createElement("div");t.className="pip-icon-grid";const s=p?xe.filter(i=>i.label.toLowerCase().includes(p)):xe;if(s.length===0){e.innerHTML=`<div class="pip-empty-state">Ingen standard-ikoner matcher "${T(p)}"</div>`;return}s.forEach(i=>{const a=document.createElement("div");a.className=`pip-icon-option ${l===i.path?"selected":""}`,a.dataset.path=i.path,a.innerHTML=`<img src="${i.path}" alt="${i.label}"><span>${i.label}</span>`,a.addEventListener("click",()=>{if(A){oe(i.path);return}l=i.path,y=null,e.querySelectorAll(".pip-icon-option").forEach(n=>n.classList.toggle("selected",n.dataset.path===i.path)),R(i.path,i.label),f()}),t.appendChild(a)}),e.appendChild(t)}function vt(e){const t=p?je.filter(a=>a.name.toLowerCase().includes(p)||a.emoji.includes(p)):je;e.innerHTML=`
            <div style="margin-bottom:16px">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px">Vælg en emoji</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px">Klik på en emoji nedenfor, eller skriv din egen i feltet</div>
            </div>
            <input type="text" class="pip-name-input" id="pip-emoji-input" placeholder="Indtast emoji her..." value="${y||""}" style="width:100%;max-width:300px;font-size:24px;text-align:center;margin-bottom:16px">
            <div class="pip-icon-grid" id="pip-emoji-grid"></div>
        `,t.length===0&&(e.querySelector("#pip-emoji-grid").innerHTML=`<div class="pip-empty-state">Ingen emojis matcher "${T(p)}"</div>`);const s=e.querySelector("#pip-emoji-input"),i=e.querySelector("#pip-emoji-grid");t.forEach(({emoji:a,name:n})=>{const d=document.createElement("div");d.className="pip-icon-option",d.innerHTML=`<span style="font-size:36px">${a}</span><span>${n}</span>`,d.addEventListener("click",()=>{y=a,l=null,s.value=a,S=`<span style="font-size:48px">${a}</span><div class="pip-preview-label">${n}</div>`,c&&(c.innerHTML=S+'<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>'),c?.querySelector(".pip-preview-clear")?.addEventListener("click",ee),f()}),i.appendChild(d)}),s.addEventListener("input",()=>{y=s.value||null,l=null,y&&(S=`<span style="font-size:48px">${y}</span><div class="pip-preview-label">Emoji</div>`,c&&(c.innerHTML=S)),f()})}function yt(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',Me(e,()=>it(O),"Ingen egne ikoner endnu — upload eller generer via AI.")}function ft(e){e.innerHTML='<div class="pip-empty-state">Indlæser...</div>',bt(e)}async function bt(e){if(e||(e=$.querySelector(".pip-content-section")),!e)return;if(!(await et(O)).icon_use_shared_enabled){e.innerHTML='<div class="pip-empty-state">Brug af delte ikoner er ikke aktiveret. Slå det til under Institutionsindstillinger.</div>';return}Me(e,()=>at(),"Ingen delte ikoner tilgængelige endnu.")}async function Me(e,t,s){let i=await t();if(e.innerHTML="",p&&(console.log("[loadIconGrid] Searching for:",p,"in",i.length,"icons. Sample tags:",i.slice(0,3).map(n=>n.name+":"+(n.tags||"none"))),i=i.filter(n=>n.name.toLowerCase().includes(p)||(n.tags||"").toLowerCase().includes(p)),console.log("[loadIconGrid] After filter:",i.length,"matches")),i.length===0){e.innerHTML=p?`<div class="pip-empty-state">Ingen ikoner matcher "${T(p)}"</div>`:`<div class="pip-empty-state">${s}</div>`;return}const a=document.createElement("div");a.className="pip-icon-grid",i.forEach(n=>{const d=document.createElement("div");d.className=`pip-icon-option ${l===n.icon_url?"selected":""}`,d.dataset.path=n.icon_url;const m=n.source==="uploaded"?"📤":"🪄";d.innerHTML=`<img src="${n.icon_url}" alt="${n.name}"><span>${m} ${n.name}</span>`,d.addEventListener("click",()=>{if(A){oe(n.icon_url);return}l=n.icon_url,y=null,a.querySelectorAll(".pip-icon-option").forEach(N=>N.classList.toggle("selected",N.dataset.path===n.icon_url)),R(n.icon_url,n.name),f()}),a.appendChild(d)}),e.appendChild(a)}function gt(e){e.innerHTML=`
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
            </label>`;const t=e.querySelector("#pip-upload-drop"),s=e.querySelector("input[type=file]"),i=e.querySelector("#pip-upload-preview"),a=e.querySelector("#pip-upload-img"),n=e.querySelector("#pip-upload-remove");t.addEventListener("click",()=>s.click()),s.addEventListener("change",m=>{m.target.files[0]&&d(m.target.files[0]),m.target.value=""}),t.addEventListener("dragover",m=>{m.preventDefault(),t.classList.add("dragover")}),t.addEventListener("dragleave",()=>t.classList.remove("dragover")),t.addEventListener("drop",m=>{m.preventDefault(),t.classList.remove("dragover"),m.dataTransfer.files[0]&&d(m.dataTransfer.files[0])}),n.addEventListener("click",()=>{G=null,i.style.display="none",t.style.display="",R(null),f()});async function d(m){try{G=await de(m),a.src=URL.createObjectURL(G),i.style.display="",t.style.display="none",R(a.src,"Uploadet billede"),f()}catch(N){console.error("[upload]",N)}}}function ht(e){e.innerHTML=`
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
            </div>`;const t=e.querySelector("#pip-cam-trigger"),s=e.querySelector("#pip-cam-preview"),i=e.querySelector("#pip-cam-img"),a=async()=>{try{const n=await tt({showCustomAlert:B});n&&(z=n,i.src=URL.createObjectURL(n),s.style.display="",t.style.display="none",R(i.src,"Foto"),f())}catch(n){console.error("[camera]",n)}};t.addEventListener("click",a),e.querySelector("#pip-cam-retake").addEventListener("click",()=>{z=null,s.style.display="none",t.style.display="",R(null),f(),a()}),e.querySelector("#pip-cam-use").addEventListener("click",()=>{z&&(G=z,r="camera",f())}),e.querySelector("#pip-cam-ai").addEventListener("click",()=>{if(!z)return;const n=z;r="ai",sourceCards.forEach(d=>d.classList.toggle("active",d.dataset.source==="ai")),D(),setTimeout(()=>Fe(n),50)})}function kt(e){const t=T(_e||P?.name||"");e.innerHTML=`
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
                    ${Le()?`<button type="button" class="pip-mode-card" data-mode="portrait">
                        <span class="pip-card-emoji">🍽️</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Kokken præsenterer maden</div>
                    </button>`:`<button type="button" class="pip-mode-card pip-mode-locked" data-mode="portrait" aria-disabled="true" title="Kan aktiveres via superadmin" style="opacity:.55;cursor:not-allowed">
                        <span class="pip-card-emoji">🔒</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Aktiveres via superadmin</div>
                    </button>`}
                </div>
                <div class="pip-mode-desc-text" id="pip-mode-desc">${Ie.reference}</div>
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
        `,St(e)}function St(e){const t=e.querySelector("#pip-ai-name"),s=e.querySelectorAll(".pip-style-card"),i=e.querySelector("#pip-custom-section"),a=e.querySelector("#pip-custom-prompt"),n=e.querySelector("#pip-ai-step1"),d=e.querySelector("#pip-photo-actions"),m=e.querySelector("#pip-photo-preview"),N=e.querySelector("#pip-photo-img"),ze=e.querySelector("#pip-photo-remove"),He=e.querySelector("#pip-photo-file"),Re=He?.querySelector("input"),wt=e.querySelector("#pip-photo-camera"),K=e.querySelector("#pip-mode-section"),fe=e.querySelectorAll(".pip-mode-card"),Ue=e.querySelector("#pip-mode-desc"),te=e.querySelector("#pip-generate"),Oe=e.querySelector("#pip-loading"),Be=e.querySelector("#pip-loading-msg"),be=e.querySelector("#pip-result"),xt=e.querySelector("#pip-result-img"),Lt=e.querySelector("#pip-result-label"),Et=e.querySelector("#pip-retry"),se=e.querySelector("#pip-advanced"),re=e.querySelector("#pip-style-prompt"),pe=e.querySelector("#pip-photo-prompt"),jt=e.querySelector("#pip-reset-prompts");s.forEach(o=>{o.addEventListener("click",()=>{v=o.dataset.style,s.forEach(j=>j.classList.toggle("active",j===o));const b=v==="custom";if(i.style.display=b?"block":"none",n.style.display=b?"none":"block",K){const j=b||!k;K.classList.toggle("pip-disabled",j);const Y=K.querySelector("#pip-mode-hint");Y&&(Y.style.display=j?"":"none")}U()})}),He?.addEventListener("click",()=>Re?.click()),Re?.addEventListener("change",o=>{o.target.files[0]&&De(o.target.files[0]),o.target.value=""}),e.querySelector("#pip-photo-pick")?.addEventListener("click",()=>{A=!0,L="select",r=ae[0].key,W(),D()}),wt?.addEventListener("click",async()=>{try{const o=await tt({showCustomAlert:B});o&&De(o)}catch(o){console.error("[aiPhotoCamera]",o)}}),ze?.addEventListener("click",Pt);async function De(o){try{k=await de(o),It(k)}catch(b){console.error("[aiPhoto]",b)}}function It(o){N.src=URL.createObjectURL(o),m.style.display="flex",d.style.display="none",v!=="custom"&&ve(K),U()}function Pt(){k=null,m.style.display="none",d.style.display="flex",rt(K),U()}fe.forEach(o=>{o.addEventListener("click",()=>{if(o.dataset.mode==="portrait"&&!Le()){B?.("Ikke tilgængelig","Mad Portræt kan aktiveres af superadmin.");return}x=o.dataset.mode,fe.forEach(b=>b.classList.toggle("active",b===o)),Ue.textContent=Ie[x]||"",U()})});function $t(){return v==="custom"?"":x==="portrait"&&!!k?v==="pixar"?Rt:Ht:v==="pixar"?zt:Ft}function _t(){const o=t?.value?.trim()||"";return v==="custom"?"":k?x==="portrait"?`Transform into ${v==="clay"?"clay-animated":"Pixar/Dreamworks-style animated"} version. Person (cook/chef) proudly presenting food. Preserve features. Include food prominently.${o?` Dish: ${o}`:""}`:x==="motiv"?`Recreate composition from photo as 3D icon. Keep food arrangement, render in ${v==="pixar"?"glossy Pixar":"Flango clay"} style. If people appear, include as stylized characters.${o?` Product: ${o}`:""}`:`Use photo only to identify food. Create fresh ${v==="pixar"?"Pixar-style":"clay-style"} icon. Ignore background/angle. Include container only if needed.${o?` Product: ${o}`:""}`:`The food item is: ${o}
Include a bowl, plate, cup, or container only if the food needs one.`}function U(){se?.open&&(!X&&re&&(re.value=$t()),!Z&&pe&&(pe.value=_t()))}se?.addEventListener("toggle",()=>{se.open&&(X=!1,Z=!1,U())}),re?.addEventListener("input",()=>{X=!0}),pe?.addEventListener("input",()=>{Z=!0}),jt?.addEventListener("click",()=>{X=!1,Z=!1,U()}),t?.addEventListener("input",U);let ge=!1,Ne=null;async function Ge(){if(ge)return;const o=v==="custom",b=t?.value?.trim()||"",j=a?.value?.trim()||"",Y=!!k;if(o&&!j){B?.("Manglende prompt","Skriv en prompt i tekstfeltet");return}if(!o&&!b&&!Y){B?.("Manglende input","Skriv et produktnavn eller upload et foto");return}ge=!0,te.style.display="none",be.style.display="none",Oe.style.display="block",ut(),q=null;let he=0;Be.textContent=ue[0],Ne=setInterval(()=>{he=(he+1)%ue.length,Be.textContent=ue[he]},3e3);try{const{data:{session:le}}=await Ee.auth.getSession(),Ve=le?.access_token||"",Ke=Ee.supabaseUrl||Ee.rest?.url?.replace("/rest/v1","")||"",ie=se?.open&&(X||Z),Ye=ie?((re?.value?.trim()||"")+`

`+(pe?.value?.trim()||"")).trim():"",Je={Authorization:`Bearer ${Ve}`};let g;if(Y&&!o&&!ie)g=new FormData,h&&I?g.append("product_id",I):g.append("save_to_library_only","true"),g.append("product_name",b),g.append(h?"reference_image":"photo",k,"photo.webp"),g.append("style",v),g.append("photo_mode",x);else if(Y)g=new FormData,h&&I?g.append("product_id",I):g.append("save_to_library_only","true"),g.append("product_name",b),g.append(h?"reference_image":"photo",k,"photo.webp"),g.append("prompt_mode","custom"),g.append("custom_prompt",ie?Ye:j);else{Je["Content-Type"]="application/json";const w={product_name:b,style:o?"custom":v};h&&I?w.product_id=I:w.save_to_library_only=!0,(o||ie)&&(w.prompt_mode="custom",w.custom_prompt=ie?Ye:j||b),g=JSON.stringify(w)}const u=await(await fetch(`${Ke}/functions/v1/generate-product-icon`,{method:"POST",headers:Je,body:g})).json();if(!u.success)throw new Error(u.error||"Generering fejlede");if(!u.image_base64)throw new Error("Ingen billede-data fra serveren");const ke=atob(u.image_base64),Xe=new Uint8Array(ke.length);for(let w=0;w<ke.length;w++)Xe[w]=ke.charCodeAt(w);const Ze=new Blob([Xe],{type:`image/${u.format||"webp"}`}),Qe=await Tt(Ze);console.log(`[AI Generate] Raw ${(Ze.size/1024).toFixed(1)}KB → Compressed ${(Qe.size/1024).toFixed(1)}KB`);const qt=u.fallback_name||b||"AI ikon",C=new FormData;C.append("file",new File([Qe],"ai-icon.webp",{type:"image/webp"})),C.append("institutionId",O),h&&I?C.append("productId",I):C.append("skipProduct","true"),C.append("libraryName",qt),u.style&&C.append("aiStyle",String(u.style)),u.mode&&C.append("aiPhotoMode",String(u.mode)),u.prompt_mode&&C.append("aiPromptMode",String(u.prompt_mode));const Se=await fetch(`${Ke}/functions/v1/upload-product-icon`,{method:"POST",headers:{Authorization:`Bearer ${Ve}`},body:C}),J=await Se.json().catch(()=>({}));if(!Se.ok||!J?.success)throw new Error(J?.error||`Upload fejlede (${Se.status})`);const We=J.icon_url||null,At=J.icon_storage_path||null,Ct=J.library_icon_url||null;q=We||Ct,xt.src=q,be.style.display="block";const ce=[];if(u.style&&ce.push(u.style==="clay"?"🏺 Clay":u.style==="pixar"?"🎬 Pixar":"✍️ Fri prompt"),u.mode){const w={"photo-reference":"📷 Reference","photo-motiv":"🖼️ Motiv","photo-avatar":"👤 Avatar","photo-portrait":"🍽️ Mad Portræt",text:"✏️ Tekst","custom-photo":"🎨 Fri prompt","custom-text":"🎨 Fri prompt"};ce.push(w[u.mode]||u.mode)}Lt.textContent=ce.join(" · "),R(q,ce.join(" · ")),f(),me?.("success"),h&&I&&M({type:"ai",url:We,storagePath:At,updatedAt:J.icon_updated_at,metadata:{style:v,photoMode:x}})}catch(le){console.error("[AI Generate]",le),B?.("AI Fejl",le.message||"Generering fejlede"),me?.("error"),te.style.display="block"}finally{clearInterval(Ne),Oe.style.display="none",q||(te.style.display="block"),ge=!1}}te?.addEventListener("click",Ge),Et?.addEventListener("click",()=>{be.style.display="none",te.style.display="block",Ge()}),F&&P&&(x=Le()?"portrait":"reference",fe.forEach(o=>o.classList.toggle("active",o.dataset.mode===x)),Ue.textContent=Ie[x]||"",ze.style.display="none",d.style.display="none",N.src=P.icon_url,m.style.display="flex",ve(K),fetch(P.icon_url).then(o=>o.blob()).then(o=>{k=new File([o],"ref.webp",{type:"image/webp"}),U()}).catch(o=>console.error("[fetchEditIcon]",o)))}function Fe(e){k=e;const t=$.querySelector("#pip-photo-preview"),s=$.querySelector("#pip-photo-img"),i=$.querySelector("#pip-photo-actions"),a=$.querySelector("#pip-mode-section");s&&(s.src=URL.createObjectURL(e)),t&&(t.style.display="flex"),i&&(i.style.display="none"),a&&v!=="custom"&&ve(a)}W(),D()}export{Ut as openProductIconPicker};
