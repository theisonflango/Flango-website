import{g as he,b as xe,d as ne,p as ee,u as pe,s as se,f as _e,e as ke,h as we,j as ce,A as Le,k as Se,l as Ae}from"./app-D9LGdyIM.js";import{r as Ee}from"./roster-59UAKCUg.js";import{e as h}from"./escape-html-deozJSzI.js";import{s as B}from"./session-store-DV--RFJp.js";import{f as $e}from"./calculator-mode-D87vY3Ri.js";import{a as oe}from"./backend-config-D_9xaUNr.js";import"./platform-C-lYQyTG.js";import"./staff-auth-DLjdrZ9g.js";import"./portal-api-DpQJ3s8D.js";import"./download-file-BhT8yV5H.js";import"./cafe-client-compatibility-BVO4gbN1.js";function qe(e){const t=e?.media||{},v=!!t.profile_pictures_ai_enabled;return{masterOn:v,usable:v&&t.ai_provider_openai!==!1}}async function We(e,t={}){const{onSaved:v,showCustomAlert:k}=t,d=window.__flangoGetInstitutionById?.(e.institution_id);if(!d)return;let g=d.media?.profile_picture_types||["upload","camera","library"];const o=e.id!=="__default__"&&await he(d),u=e.profile_picture_opt_out===!0,r=document.createElement("div");r.className="profile-pic-modal-overlay";const l=document.createElement("div");l.className="profile-pic-modal";const p=e.number?` (${e.number})`:"";l.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${h(e.name)}${p}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,r.appendChild(l),document.body.appendChild(r);const n=()=>{w(),r.remove()};l.querySelector(".profile-pic-modal-close").addEventListener("click",n),r.addEventListener("click",s=>{s.target===r&&n()});const m=l.querySelector("#pp-current-section");await de(m,e);const E=document.createElement("div");E.className="profile-pic-permissions",E.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",E.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const T=qe(d),K=[{label:"Manuel upload",optOut:e.profile_picture_opt_out_upload},{label:"Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!T.usable}];for(const s of K){const $=document.createElement("span");$.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${s.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,$.textContent=`${s.optOut?"❌":"✅"} ${s.label}`,E.appendChild($)}l.querySelector("#pp-current-section").after(E);const M=l.querySelector("#pp-type-grid"),b=[{key:"upload",icon:"📁",label:"Manuel upload",optOutField:"profile_picture_opt_out_upload"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"},...o?[{key:"flango_avatar",asset:"Icons/webp/Avatar/v2/characters/mango-001/rolig.webp",label:"Avatarbibliotek"}]:[]],S=l.querySelector("#pp-subview");let q=null;function w(){q&&(q.getTracks().forEach(s=>s.stop()),q=null)}let P=!1;const H=t.preSelectType||null,V=t.referenceImageUrl||null,I=(s,$)=>{const x=document.createElement("button");x.className="profile-pic-type-btn pp-type-disabled",x.title=$,x.innerHTML=`${Y(s)}${s.label}<div class="pp-type-disabled-reason">${h($)}</div>`,x.style.cssText="opacity:0.4;pointer-events:none;position:relative;",M.appendChild(x)},D=()=>{l.classList.remove("is-flango-avatar-library"),l.querySelector(".profile-pic-modal-header h3").textContent=`Profilbillede — ${e.name}${p}`};for(const s of b){if(u&&s.key!=="flango_avatar"||!["icons","ai_avatar","flango_avatar"].includes(s.key)&&!g.includes(s.key))continue;if(s.requiresAi&&!T.usable){I(s,"Ikke aktiveret");continue}const $=s.optOutField&&e[s.optOutField],x=document.createElement("button");x.className="profile-pic-type-btn"+($?" pp-type-disabled":""),$?(x.innerHTML=`${Y(s)}${s.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,x.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(x.innerHTML=`${Y(s)}${s.label}`,x.addEventListener("click",()=>{w(),M.querySelectorAll(".profile-pic-type-btn").forEach(j=>j.classList.remove("active")),x.classList.add("active"),s.key,D(),s.key==="upload"?Ue(S,e,d,n,v):s.key==="camera"?Me(S,e,d,n,v,j=>{q=j}):s.key==="library"?He(S,e,n,v):s.key==="icons"?Ie(S,e,n,v):s.key==="ai_avatar"?Re(S,e,d,n,v,j=>{q=j}):s.key==="flango_avatar"&&Te({modal:l,subview:S,user:e,numberStr:p,currentSection:m,onSaved:v,onBack:()=>{D(),x.classList.remove("active"),S.innerHTML=""}})})),M.appendChild(x),!P&&H&&s.key===H&&!$&&(P=!0,setTimeout(()=>x.click(),100))}M.children.length||(M.innerHTML='<div style="font-size:13px;color:#64748b;padding:8px 2px">Ingen billedtyper er slået til.</div>'),H==="ai_avatar"&&V&&(window.__ppAiReferenceUrl=V)}function Y(e){return e.asset?`<span class="type-icon type-icon-image"><img src="${h(e.asset)}" alt=""></span>`:`<span class="type-icon">${e.icon}</span>`}function Te({modal:e,subview:t,user:v,numberStr:k,currentSection:d,onSaved:g,onBack:o}){e.classList.add("is-flango-avatar-library"),e.querySelector(".profile-pic-modal-header h3").textContent=`Avatarbibliotek — ${v.name}${k}`,t.innerHTML=`
        <div class="profile-pic-flango-toolbar">
            <button type="button" class="profile-pic-flango-back">← Tilbage til billedtyper</button>
            <span>Du vælger avatar på vegne af <strong>${h(v.name)}</strong>.</span>
        </div>
        <div class="avatar-v2-root profile-pic-flango-root"></div>
    `,t.querySelector(".profile-pic-flango-back")?.addEventListener("click",o),ke({root:t.querySelector(".profile-pic-flango-root"),userId:v.id,api:we,managedUserName:v.name,allowRelease:!0,onAvatarChanged:async(r,l={})=>{if(!["claimed","released"].includes(l.reason))return;const p=r?.assignment?{profile_picture_url:r.assignment.image_path,profile_picture_type:"library",profile_picture_updated_at:new Date().toISOString()}:{profile_picture_url:null,profile_picture_type:null,profile_picture_updated_at:new Date().toISOString()};Object.assign(v,p),ce(v.id),await de(d,v),g?.(p)}}).open()}async function de(e,t){if(!(t.profile_picture_url&&(!t.profile_picture_opt_out||xe(t)))){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const k={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${h(t.name)}</strong> har: ${k}
            </div>
        </div>`;const d=await ne(t),g=e.querySelector("#pp-current-img-wrap");if(d&&g){const o=document.createElement("img");o.src=d,o.alt="",o.className="profile-pic-current-img",g.replaceWith(o)}}function Ue(e,t,v,k,d){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const g=e.querySelector("#pp-upload-dropzone"),o=e.querySelector("#pp-upload-input"),u=e.querySelector("#pp-upload-preview");g.addEventListener("click",()=>o.click()),o.addEventListener("change",async r=>{const l=r.target.files?.[0];if(l){g.style.display="none",u.style.display="block",u.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const p=await ee(l),n=URL.createObjectURL(p);u.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${n}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,u.querySelector("#pp-upload-save").addEventListener("click",async()=>{u.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const m=await pe(p,t.institution_id,t.id,"upload");URL.revokeObjectURL(n),m.success?(t.profile_picture_url=m.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),k()):u.innerHTML=`<div style="color:#f87171;text-align:center;">${h(m.error||"Upload fejlede")}</div>`}),u.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(n),u.style.display="none",g.style.display="flex",o.value=""})}catch(p){u.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${h(p.message)}</div>`}}})}function Me(e,t,v,k,d,g){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-camera-container" id="pp-camera-wrap">
                <video id="pp-camera-video" class="profile-pic-camera-video" autoplay playsinline muted></video>
            </div>
            <div class="profile-pic-camera-actions">
                <button class="profile-pic-capture-btn" id="pp-capture-btn" disabled></button>
            </div>
            <div id="pp-camera-preview" style="display:none;"></div>
            <div id="pp-camera-status" class="profile-pic-loading" style="text-align:center;margin-top:8px;">
                <span class="profile-pic-spinner"></span> Starter kamera...
            </div>
        </div>`;const o=e.querySelector("#pp-camera-video"),u=e.querySelector("#pp-capture-btn"),r=e.querySelector("#pp-camera-preview"),l=e.querySelector("#pp-camera-status"),p=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(n=>{g(n),o.srcObject=n,u.disabled=!1,l.style.display="none"}).catch(n=>{l.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${h(n.message)}</span>`,u.style.display="none"}),u.addEventListener("click",async()=>{const n=document.createElement("canvas"),m=Math.min(o.videoWidth,o.videoHeight);n.width=400,n.height=400;const E=n.getContext("2d"),T=Math.round(m/1.3),K=(o.videoWidth-T)/2,M=(o.videoHeight-T)/2;E.translate(400,0),E.scale(-1,1),E.drawImage(o,K,M,T,T,0,0,400,400),n.toBlob(async b=>{if(!b)return;p.style.display="none",u.parentElement.style.display="none",r.style.display="block";const S=await ee(new File([b],"camera.jpg",{type:"image/jpeg"})),q=URL.createObjectURL(S);r.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${q}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,r.querySelector("#pp-camera-save").addEventListener("click",async()=>{r.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const w=await pe(S,t.institution_id,t.id,"camera");URL.revokeObjectURL(q),w.success?(t.profile_picture_url=w.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),k()):r.innerHTML=`<div style="color:#f87171;text-align:center;">${h(w.error||"Upload fejlede")}</div>`}),r.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(q),r.style.display="none",p.style.display="block",u.parentElement.style.display="flex"})},"image/jpeg",.9)})}function He(e,t,v,k){let d=null;const g=Le.map((r,l)=>`
        <div class="profile-pic-library-item" data-avatar-index="${l}" data-avatar-url="${r}">
            <img src="${r}" alt="Avatar ${l+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${g}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const o=e.querySelector("#pp-library-save"),u=e.querySelectorAll(".profile-pic-library-item");u.forEach(r=>{r.addEventListener("click",()=>{u.forEach(l=>l.classList.remove("selected")),r.classList.add("selected"),d=r.dataset.avatarUrl,o.disabled=!1})}),o.addEventListener("click",async()=>{if(!d)return;o.disabled=!0,o.textContent="Gemmer...";const r=await se(t.id,d,"library",{institutionId:t.institution_id,user:t});if(r.success)t.profile_picture_url=d,t.profile_picture_type="library",k&&k({profile_picture_url:d,profile_picture_type:"library"}),v();else{o.textContent="Gem",o.disabled=!1;const l=document.createElement("div");l.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",l.textContent=r.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(l)}})}async function Ie(e,t,v,k){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const d=await $e(t.institution_id);if(!d||d.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let g=null,o=null;const u=d.map((p,n)=>`
        <div class="profile-pic-library-item" data-icon-index="${n}" data-icon-url="${h(p.icon_url)}" data-icon-source="${h(p.source||"uploaded")}">
            <img src="${h(p.icon_url)}" alt="${h(p.name||"")}" loading="lazy">
            ${p.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${h(p.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${u}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const r=e.querySelector("#pp-icon-save"),l=e.querySelectorAll(".profile-pic-library-item");l.forEach(p=>{p.addEventListener("click",()=>{l.forEach(n=>n.classList.remove("selected")),p.classList.add("selected"),g=p.dataset.iconUrl,o=p.dataset.iconSource,r.disabled=!1})}),r.addEventListener("click",async()=>{if(!g)return;r.disabled=!0,r.textContent="Gemmer...";const p=o==="ai_generated"?"ai_avatar":"icon",n=await se(t.id,g,p,{institutionId:t.institution_id,user:t});if(n.success)t.profile_picture_url=g,t.profile_picture_type=p,k&&k({profile_picture_url:g,profile_picture_type:p}),v();else{r.textContent="Gem",r.disabled=!1;const m=document.createElement("div");m.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",m.textContent=n.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(m)}})}const le="Icons/webp/Function/Flango-Kokkehue.webp",Z=[{key:"pixar",label:"🎬 Pixar"},{key:"clay",label:"🏺 Clay-figur"},{key:"cartoon",label:"✏️ Tegneserie"},{key:"realistic",label:"🎨 Illustration"}];function ze(){return Se()?.advanced_ai_access===!0}function Re(e,t,v,k,d,g){let o=Z[0],u=!1,r="",l=window.__ppAiReferenceBlob||null,p=window.__ppAiReferenceBlob?"library":null,n=!1,m=!1,E=!1,T=!1,K=null;const M=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;padding:10px;background:rgba(245,158,11,0.1);border-radius:8px;border:1px solid rgba(245,158,11,0.2);">
                Vælg et referencebillede. Billedet sendes til Microsoft Azure (EU) for at generere en avatar. <strong>Billedet slettes straks efter.</strong>
            </div>

            <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px;">Vælg referencebillede</div>
            <div id="pp-ai-methods" style="display:flex;gap:8px;margin-bottom:12px;">
                <button type="button" id="pp-ai-method-camera" style="flex:1;padding:10px 8px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;">
                    <div style="font-size:20px;margin-bottom:2px;">📷</div>
                    <div style="font-size:11px;font-weight:600;color:#e2e8f0;">Kamera</div>
                </button>
                <button type="button" id="pp-ai-method-upload" style="flex:1;padding:10px 8px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;">
                    <div style="font-size:20px;margin-bottom:2px;">📤</div>
                    <div style="font-size:11px;font-weight:600;color:#e2e8f0;">Upload</div>
                </button>
            </div>
            <div id="pp-ai-source-grid" style="display:flex;gap:10px;overflow-x:auto;padding:4px;">
                <div style="color:#94a3b8;font-size:11px;padding:16px;">Henter billeder...</div>
            </div>

            <div id="pp-ai-camera-section" style="display:none;">
                <div class="profile-pic-camera-container" id="pp-ai-camera-wrap">
                    <video id="pp-ai-camera-video" class="profile-pic-camera-video" autoplay playsinline muted></video>
                </div>
                <div class="profile-pic-camera-actions">
                    <button class="profile-pic-capture-btn" id="pp-ai-capture-btn" disabled></button>
                </div>
                <div id="pp-ai-cam-status" class="profile-pic-loading" style="text-align:center;margin-top:8px;">
                    <span class="profile-pic-spinner"></span> Starter kamera...
                </div>
            </div>

            <div id="pp-ai-preview" style="display:none;"></div>

            <div id="pp-ai-options" style="display:none;">
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:16px 0 12px;">
                <div style="margin-bottom:12px;">
                    <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px;">Vælg stil</div>
                    <div id="pp-ai-presets" style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${Z.map(i=>`
                            <button type="button" class="pp-ai-preset-btn" data-preset="${i.key}" style="padding:6px 12px;border:2px solid ${i.key===o.key?"#f59e0b":"rgba(255,255,255,0.1)"};background:${i.key===o.key?"rgba(245,158,11,0.1)":"transparent"};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${i.key===o.key?"#f59e0b":"#94a3b8"};transition:all 0.15s;">${i.label}</button>
                        `).join("")}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label id="pp-ai-hat-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;">
                        <input type="checkbox" id="pp-ai-hat-checkbox" style="width:16px;height:16px;accent-color:#f59e0b;">
                        <img src="${le}" alt="" style="width:28px;height:28px;object-fit:contain;">
                        <div>
                            <div style="font-size:12px;font-weight:600;color:#e2e8f0;">Ekspedient Stil</div>
                            <div style="font-size:10px;color:#94a3b8;">Tilføj Flango-kokkehue</div>
                        </div>
                    </label>
                    <label id="pp-ai-hero-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;margin-top:6px;">
                        <input type="checkbox" id="pp-ai-hero-checkbox" style="width:16px;height:16px;accent-color:#8b5cf6;">
                        <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:22px;">🦸</div>
                        <div>
                            <div style="font-size:12px;font-weight:600;color:#e2e8f0;">Super Hero</div>
                            <div style="font-size:10px;color:#a78bfa;">Kun for legendariske ekspedienter</div>
                        </div>
                    </label>
                </div>

                <div id="pp-ai-advanced-section" style="display:none;">
                    <button type="button" id="pp-ai-advanced-toggle" style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:4px 0;">
                        <span id="pp-ai-adv-arrow" style="display:inline-block;transition:transform 0.2s;">▶</span> Avanceret — skriv din egen prompt
                    </button>
                    <div id="pp-ai-prompt-section" style="display:none;margin-top:8px;">
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;line-height:1.4;">
                            Feltet viser den <strong>aktuelle prompt</strong> serveren bruger for den valgte stil
                            (preset + hat/hero + alders-troskab). Redigér frit — så sendes din tekst som
                            <strong>fuld custom prompt</strong> og overskriver preset/flags. "Indlæs aktuel prompt"
                            henter den valgte stils prompt på ny; "Ryd" tømmer feltet og bruger serverens preset+flags.
                        </div>
                        <textarea id="pp-ai-prompt-textarea" class="input--on-dark" placeholder="Indlæs aktuel prompt for at se og redigere den — eller skriv din egen" style="width:100%;min-height:120px;padding:8px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
                        <div style="margin-top:4px;display:flex;gap:14px;align-items:center;">
                            <button type="button" id="pp-ai-load-prompt" style="background:none;border:none;color:#1a8a6e;font-size:11px;cursor:pointer;padding:2px 0;">👁 Indlæs aktuel prompt</button>
                            <button type="button" id="pp-ai-reset-prompt" style="background:none;border:none;color:#1a8a6e;font-size:11px;cursor:pointer;padding:2px 0;">↺ Ryd og brug preset+flags</button>
                        </div>
                    </div>
                </div>
            </div>

            <input type="file" id="pp-ai-file-input" accept="image/*" style="display:none;">
        </div>`;const b=e.querySelector("#pp-ai-preview"),S=e.querySelector("#pp-ai-options"),q=e.querySelector("#pp-ai-camera-section"),w=e.querySelector("#pp-ai-source-grid"),P=e.querySelector("#pp-ai-file-input"),H=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",ye),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>P.click());const V=e.querySelectorAll(".pp-ai-preset-btn"),I=e.querySelector("#pp-ai-prompt-textarea");V.forEach(i=>{i.addEventListener("click",()=>{const c=Z.find(f=>f.key===i.dataset.preset);c&&(o=c,V.forEach(f=>{const y=f.dataset.preset===c.key;f.style.borderColor=y?"#f59e0b":"rgba(255,255,255,0.1)",f.style.background=y?"rgba(245,158,11,0.1)":"transparent",f.style.color=y?"#f59e0b":"#94a3b8"}))})});const D=e.querySelector("#pp-ai-advanced-section"),s=e.querySelector("#pp-ai-advanced-toggle"),$=e.querySelector("#pp-ai-adv-arrow"),x=e.querySelector("#pp-ai-prompt-section"),j=e.querySelector("#pp-ai-reset-prompt"),O=e.querySelector("#pp-ai-load-prompt");async function te(){if(!(!E||!I))try{const{data:{session:i}}=await B.auth.getSession(),c=i?.access_token;if(!c)return;O&&(O.disabled=!0,O.textContent="⏳ Henter…");const f=new FormData;f.append("preview_prompt","true"),f.append("target_user_id",t.id),f.append("user_id",t.id),f.append("ai_style",o.key),f.append("ai_provider","openai"),f.append("hat_enabled",n?"true":"false"),f.append("hero_enabled",m?"true":"false");const a=await(await fetch(`${oe}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${c}`},body:f})).json();a?.success&&typeof a.prompt=="string"&&(I.value=a.prompt,r=a.prompt)}catch(i){console.warn("[profile-picture-modal] kunne ikke indlæse aktuel prompt:",i?.message||i)}finally{O&&(O.disabled=!1,O.textContent="👁 Indlæs aktuel prompt")}}ze().then(i=>{E=i,D&&i&&(D.style.display="")}),s?.addEventListener("click",()=>{E&&(u=!u,$&&($.style.transform=u?"rotate(90deg)":""),x&&(x.style.display=u?"block":"none"),u&&I&&!I.value.trim()&&te())}),O?.addEventListener("click",te),I?.addEventListener("input",()=>{r=I.value}),j?.addEventListener("click",()=>{r="",I&&(I.value="")});const ie=e.querySelector("#pp-ai-hat-checkbox"),Q=e.querySelector("#pp-ai-hat-toggle");ie?.addEventListener("change",()=>{n=ie.checked,Q&&(Q.style.borderColor=n?"#f59e0b":"rgba(255,255,255,0.1)",Q.style.background=n?"rgba(245,158,11,0.08)":"transparent")});const z=e.querySelector("#pp-ai-hero-checkbox"),U=e.querySelector("#pp-ai-hero-toggle");function N(i){if(!U)return;U.style.opacity="0.55",U.style.cursor="not-allowed",z&&(z.disabled=!0,z.checked=!1);const c=U.querySelector("div:last-child > div:last-child");c&&(c.textContent=i||"Kun for legendariske ekspedienter")}function fe(){if(!U)return;U.style.opacity="",U.style.cursor="pointer",z&&(z.disabled=!1);const i=U.querySelector("div:last-child > div:last-child");i&&(i.textContent="Tilføjer superhelte-tema til avataren")}N("Tjekker hero-status …"),(async()=>{try{const{data:i,error:c}=await B.rpc("get_hero_status",{p_user_id:t.id});if(c){console.warn("[profile-picture-modal] get_hero_status fejl:",c.message),N("Kunne ikke verificere status — prøv igen");return}if(K=i||null,T=!!(i&&i.qualified),T)fe();else{const f=Number(i?.sales_count??0),y=Number(i?.sales_required??500),a=Number(i?.minutes_worked??0),A=Number(i?.minutes_required??1800),_=Math.floor(a/60),L=Math.floor(A/60);N(`🔒 Kræver "legendarisk ekspedient" — pt. ${f}/${y} salg eller ${_}/${L} timer`)}}catch(i){console.warn("[profile-picture-modal] hero-status undtagelse:",i?.message||i),N("Kunne ikke verificere status — prøv igen")}})(),z?.addEventListener("change",()=>{if(z.disabled){z.checked=!1;return}m=z.checked,U&&(U.style.borderColor=m?"#8b5cf6":"rgba(255,255,255,0.1)",U.style.background=m?"rgba(139,92,246,0.08)":"transparent")});function G(i,c,f){l=i,p=f||"library",q.style.display="none",w.style.display="none",H&&(H.style.display="none"),b.style.display="block",S.style.display="block";const y=URL.createObjectURL(i),a=()=>{URL.revokeObjectURL(y),l=null,b.style.display="none",S.style.display="none",w.style.display="flex",H&&(H.style.display="flex")};if(v.media?.profile_pictures_ai_enabled!==!0){b.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${y}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">${h(c)}</div>
                    <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#f59e0b;text-align:center;">
                        AI-avatar er ikke aktiveret for denne institution.
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>`,b.querySelector("#pp-ai-change-ref").addEventListener("click",a);return}b.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${y}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${h(c)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate" style="background:linear-gradient(135deg,#10b981,#059669);width:100%;">Generér avatar</button>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,b.querySelector("#pp-ai-generate").addEventListener("click",()=>ue(i,y)),b.querySelector("#pp-ai-change-ref").addEventListener("click",a)}async function ue(i,c){b.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via Microsoft Azure (EU)... (15-90 sek)</div>
        </div>`;try{const{data:{session:f}}=await B.auth.getSession(),y=f?.access_token;if(!y)throw new Error("Ikke logget ind");if(m&&!T){b.innerHTML=`<div style="padding:14px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;">
                    Hero-stilen kræver enten admin-rolle eller status "legendarisk ekspedient" (500 salg eller 30 timer).
                </div>`;return}const a=new FormData;a.append("target_user_id",t.id),a.append("user_id",t.id),a.append("photo",new File([i],"photo.jpg",{type:"image/jpeg"})),a.append("reference_source",p||"library"),a.append("ai_style",o.key),a.append("ai_provider","openai"),a.append("hat_enabled",n?"true":"false"),a.append("hero_enabled",m?"true":"false");const A=(r||"").trim();if(A&&E&&a.append("custom_prompt",A),n)try{const me=await(await fetch(le)).blob();a.append("hat_image",new File([me],"hat.png",{type:"image/png"}))}catch(C){console.warn("Could not load hat image:",C)}const L=await(await fetch(`${oe}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${y}`},body:a})).json();if(!L.success)throw new Error(L.error||"Generering fejlede");if(!L.image_base64)throw new Error("Avatar mangler i svaret");const W=L.format==="png"?"image/png":"image/webp",R=atob(L.image_base64),re=new Uint8Array(R.length);for(let C=0;C<R.length;C++)re[C]=R.charCodeAt(C);const ve=new Blob([re],{type:W}),be=await Ae(ve),F=`${t.institution_id}/${t.id}_${Date.now()}.webp`,{error:J}=await B.storage.from("profile-pictures").upload(F,be,{contentType:"image/webp",cacheControl:"31536000"});if(J)throw new Error("Kunne ikke gemme avatar: "+(J.message||J));const{data:X,error:ae}=await Ee("save_ai_avatar_metadata",()=>B.rpc("save_ai_avatar_metadata",{p_user_id:t.id,p_storage_path:F,p_ai_style:L.ai_style||o.key,p_ai_prompt:L.prompt||""}));if(ae||X&&X.success===!1){try{await B.storage.from("profile-pictures").remove([F])}catch{}throw new Error(ae?.message||X?.error||"Kunne ikke gemme avatar-metadata")}ce(t.id);const ge=await ne({id:t.id,profile_picture_url:F,profile_picture_type:"ai_avatar"});c&&URL.revokeObjectURL(c),b.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${ge||""}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,b.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=F,t.profile_picture_type="ai_avatar",d&&d({profile_picture_url:F,profile_picture_type:"ai_avatar"}),k()}),b.querySelector("#pp-ai-retry").addEventListener("click",()=>{b.style.display="none",S.style.display="none",w.style.display="flex"}),b.querySelector("#pp-ai-cancel").addEventListener("click",k)}catch(f){c&&URL.revokeObjectURL(c),b.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${h(f.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,b.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{b.style.display="none",S.style.display="none",w.style.display="flex"})}}function ye(){w.style.display="none",H&&(H.style.display="none"),q.style.display="block";const i=e.querySelector("#pp-ai-camera-video"),c=e.querySelector("#pp-ai-capture-btn"),f=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(y=>{g(y),i.srcObject=y,c.disabled=!1,f.style.display="none"}).catch(y=>{f.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${h(y.message)}</span>`,c.style.display="none"}),c.onclick=()=>{const y=document.createElement("canvas"),a=Math.min(i.videoWidth,i.videoHeight);y.width=800,y.height=800;const A=y.getContext("2d"),_=Math.round(a/1.3),L=(i.videoWidth-_)/2,W=(i.videoHeight-_)/2;A.translate(800,0),A.scale(-1,1),A.drawImage(i,L,W,_,_,0,0,800,800),y.toBlob(R=>{R&&G(R,"Kamera-foto sendes til AI og slettes straks efter","camera")},"image/jpeg",.9)}}P.addEventListener("change",async()=>{const i=P.files?.[0];if(i){P.value="";try{const c=await ee(i);G(c,"Uploadet billede sendes til AI og slettes straks efter","upload")}catch(c){b.style.display="block",b.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${h(c.message)}</div>`}}}),l?G(l,"Referencebillede fra bibliotek","library"):M&&fetch(M).then(i=>i.blob()).then(i=>{i&&(l=i,G(i,"Referencebillede fra bibliotek","library"))}).catch(i=>console.warn("[ai-avatar] Kunne ikke hente reference:",i)),_e(t.id,t).then(async i=>{if(!w)return;const c=new Map,f=i.filter(a=>a.storage_path&&!a.storage_path.startsWith("http")&&a.picture_type!=="library"&&a.picture_type!=="icon");if(f.length>0){const a=f.map(_=>_.storage_path),{data:A}=await B.storage.from("profile-pictures").createSignedUrls(a,3600);A&&A.forEach((_,L)=>{_.signedUrl&&c.set(f[L].id,_.signedUrl)})}const y=i.map((a,A)=>{const _=c.get(a.id)||a.storage_path;return`<div data-lib-index="${A}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${_}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.picture_type==="ai_avatar"?"AI":a.picture_type||""}</div>
            </div>`}).join("");y?w.innerHTML=y:w.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',w.querySelectorAll("[data-lib-index]").forEach(a=>{a.addEventListener("click",async()=>{const A=parseInt(a.dataset.libIndex),_=i[A];if(_){a.querySelector("img").style.borderColor="#f59e0b";try{const L=c.get(_.id)||_.storage_path,R=await(await fetch(L)).blob();w.style.display="none",G(R,"Eksisterende billede sendes til AI og slettes straks efter","library")}catch{a.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{a.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{We as openProfilePictureModal};
