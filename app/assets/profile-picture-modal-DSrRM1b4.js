import{g as he,b as le,p as Z,u as ne,s as se,f as xe,c as _e,d as ke,e as pe,A as we,h as Le,r as Se}from"./app-nj0B4XHu.js";import{e as h}from"./escape-html-WL6tn7Cj.js";import{s as R}from"./config-and-supabase-DxdgO8Yh.js";import{f as Ae}from"./calculator-mode-D3tQtv1P.js";import{a as ae}from"./cafe-client-compatibility-51oua5GV.js";import"./platform-BDnOHEoZ.js";import"./session-store-DLvMKKKS.js";import"./download-file-BhdWP-P5.js";function Ee(e){const t=!!e?.profile_pictures_ai_enabled;return{masterOn:t,usable:t&&e?.ai_provider_openai!==!1}}async function Ke(e,t={}){const{onSaved:b,showCustomAlert:k}=t,c=window.__flangoGetInstitutionById?.(e.institution_id);if(!c)return;let g=c.profile_picture_types||["upload","camera","library"];const o=e.id!=="__default__"&&await he(c),n=document.createElement("div");n.className="profile-pic-modal-overlay";const r=document.createElement("div");r.className="profile-pic-modal";const y=e.number?` (${e.number})`:"";r.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${h(e.name)}${y}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,n.appendChild(r),document.body.appendChild(n);const l=()=>{M(),n.remove()};r.querySelector(".profile-pic-modal-close").addEventListener("click",l),n.addEventListener("click",s=>{s.target===n&&l()});const d=r.querySelector("#pp-current-section");await ce(d,e);const m=document.createElement("div");m.className="profile-pic-permissions",m.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",m.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const q=Ee(c),U=[{label:"Manuel upload",optOut:e.profile_picture_opt_out_upload},{label:"Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!q.usable}];for(const s of U){const E=document.createElement("span");E.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${s.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,E.textContent=`${s.optOut?"❌":"✅"} ${s.label}`,m.appendChild(E)}r.querySelector("#pp-current-section").after(m);const O=r.querySelector("#pp-type-grid"),F=[{key:"upload",icon:"📁",label:"Manuel upload",optOutField:"profile_picture_opt_out_upload"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"},...o?[{key:"flango_avatar",asset:"Icons/webp/Avatar/v2/characters/mango-001/rolig.webp",label:"Avatarbibliotek"}]:[]],f=r.querySelector("#pp-subview");let A=null;function M(){A&&(A.getTracks().forEach(s=>s.stop()),A=null)}let w=!1;const z=t.preSelectType||null,H=t.referenceImageUrl||null,D=(s,E)=>{const x=document.createElement("button");x.className="profile-pic-type-btn pp-type-disabled",x.title=E,x.innerHTML=`${X(s)}${s.label}<div class="pp-type-disabled-reason">${h(E)}</div>`,x.style.cssText="opacity:0.4;pointer-events:none;position:relative;",O.appendChild(x)},$=()=>{r.classList.remove("is-flango-avatar-library"),r.querySelector(".profile-pic-modal-header h3").textContent=`Profilbillede — ${e.name}${y}`};for(const s of F){if(!["icons","ai_avatar","flango_avatar"].includes(s.key)&&!g.includes(s.key))continue;if(s.requiresAi&&!q.usable){D(s,"Ikke aktiveret");continue}const E=s.optOutField&&e[s.optOutField],x=document.createElement("button");x.className="profile-pic-type-btn"+(E?" pp-type-disabled":""),E?(x.innerHTML=`${X(s)}${s.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,x.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(x.innerHTML=`${X(s)}${s.label}`,x.addEventListener("click",()=>{M(),O.querySelectorAll(".profile-pic-type-btn").forEach(C=>C.classList.remove("active")),x.classList.add("active"),s.key,$(),s.key==="upload"?$e(f,e,c,l,b):s.key==="camera"?Te(f,e,c,l,b,C=>{A=C}):s.key==="library"?Ue(f,e,l,b):s.key==="icons"?Me(f,e,l,b):s.key==="ai_avatar"?Ie(f,e,c,l,b,C=>{A=C}):s.key==="flango_avatar"&&qe({modal:r,subview:f,user:e,numberStr:y,currentSection:d,onSaved:b,onBack:()=>{$(),x.classList.remove("active"),f.innerHTML=""}})})),O.appendChild(x),!w&&z&&s.key===z&&!E&&(w=!0,setTimeout(()=>x.click(),100))}z==="ai_avatar"&&H&&(window.__ppAiReferenceUrl=H)}function X(e){return e.asset?`<span class="type-icon type-icon-image"><img src="${h(e.asset)}" alt=""></span>`:`<span class="type-icon">${e.icon}</span>`}function qe({modal:e,subview:t,user:b,numberStr:k,currentSection:c,onSaved:g,onBack:o}){e.classList.add("is-flango-avatar-library"),e.querySelector(".profile-pic-modal-header h3").textContent=`Avatarbibliotek — ${b.name}${k}`,t.innerHTML=`
        <div class="profile-pic-flango-toolbar">
            <button type="button" class="profile-pic-flango-back">← Tilbage til billedtyper</button>
            <span>Du vælger avatar på vegne af <strong>${h(b.name)}</strong>.</span>
        </div>
        <div class="avatar-v2-root profile-pic-flango-root"></div>
    `,t.querySelector(".profile-pic-flango-back")?.addEventListener("click",o),_e({root:t.querySelector(".profile-pic-flango-root"),userId:b.id,api:ke,managedUserName:b.name,allowRelease:!0,onAvatarChanged:async(r,y={})=>{if(!["claimed","released"].includes(y.reason))return;const l=r?.assignment?{profile_picture_url:r.assignment.image_path,profile_picture_type:"library",profile_picture_updated_at:new Date().toISOString()}:{profile_picture_url:null,profile_picture_type:null,profile_picture_updated_at:new Date().toISOString()};Object.assign(b,l),pe(b.id),await ce(c,b),g?.(l)}}).open()}async function ce(e,t){if(!(t.profile_picture_url&&!t.profile_picture_opt_out)){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const k={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${h(t.name)}</strong> har: ${k}
            </div>
        </div>`;const c=await le(t),g=e.querySelector("#pp-current-img-wrap");if(c&&g){const o=document.createElement("img");o.src=c,o.alt="",o.className="profile-pic-current-img",g.replaceWith(o)}}function $e(e,t,b,k,c){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const g=e.querySelector("#pp-upload-dropzone"),o=e.querySelector("#pp-upload-input"),n=e.querySelector("#pp-upload-preview");g.addEventListener("click",()=>o.click()),o.addEventListener("change",async r=>{const y=r.target.files?.[0];if(y){g.style.display="none",n.style.display="block",n.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const l=await Z(y),d=URL.createObjectURL(l);n.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${d}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,n.querySelector("#pp-upload-save").addEventListener("click",async()=>{n.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const m=await ne(l,t.institution_id,t.id,"upload",t.name);URL.revokeObjectURL(d),m.success?(t.profile_picture_url=m.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",c&&c({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),k()):n.innerHTML=`<div style="color:#f87171;text-align:center;">${h(m.error||"Upload fejlede")}</div>`}),n.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(d),n.style.display="none",g.style.display="flex",o.value=""})}catch(l){n.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${h(l.message)}</div>`}}})}function Te(e,t,b,k,c,g){e.innerHTML=`
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
        </div>`;const o=e.querySelector("#pp-camera-video"),n=e.querySelector("#pp-capture-btn"),r=e.querySelector("#pp-camera-preview"),y=e.querySelector("#pp-camera-status"),l=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(d=>{g(d),o.srcObject=d,n.disabled=!1,y.style.display="none"}).catch(d=>{y.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${h(d.message)}</span>`,n.style.display="none"}),n.addEventListener("click",async()=>{const d=document.createElement("canvas"),m=Math.min(o.videoWidth,o.videoHeight);d.width=400,d.height=400;const q=d.getContext("2d"),U=Math.round(m/1.3),O=(o.videoWidth-U)/2,F=(o.videoHeight-U)/2;q.translate(400,0),q.scale(-1,1),q.drawImage(o,O,F,U,U,0,0,400,400),d.toBlob(async f=>{if(!f)return;l.style.display="none",n.parentElement.style.display="none",r.style.display="block";const A=await Z(new File([f],"camera.jpg",{type:"image/jpeg"})),M=URL.createObjectURL(A);r.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${M}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,r.querySelector("#pp-camera-save").addEventListener("click",async()=>{r.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const w=await ne(A,t.institution_id,t.id,"camera",t.name);URL.revokeObjectURL(M),w.success?(t.profile_picture_url=w.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",c&&c({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),k()):r.innerHTML=`<div style="color:#f87171;text-align:center;">${h(w.error||"Upload fejlede")}</div>`}),r.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(M),r.style.display="none",l.style.display="block",n.parentElement.style.display="flex"})},"image/jpeg",.9)})}function Ue(e,t,b,k){let c=null;const g=we.map((r,y)=>`
        <div class="profile-pic-library-item" data-avatar-index="${y}" data-avatar-url="${r}">
            <img src="${r}" alt="Avatar ${y+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${g}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const o=e.querySelector("#pp-library-save"),n=e.querySelectorAll(".profile-pic-library-item");n.forEach(r=>{r.addEventListener("click",()=>{n.forEach(y=>y.classList.remove("selected")),r.classList.add("selected"),c=r.dataset.avatarUrl,o.disabled=!1})}),o.addEventListener("click",async()=>{if(!c)return;o.disabled=!0,o.textContent="Gemmer...";const r=await se(t.id,c,"library",{institutionId:t.institution_id,userName:t.name});if(r.success)t.profile_picture_url=c,t.profile_picture_type="library",k&&k({profile_picture_url:c,profile_picture_type:"library"}),b();else{o.textContent="Gem",o.disabled=!1;const y=document.createElement("div");y.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",y.textContent=r.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(y)}})}async function Me(e,t,b,k){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const c=await Ae(t.institution_id);if(!c||c.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let g=null,o=null;const n=c.map((l,d)=>`
        <div class="profile-pic-library-item" data-icon-index="${d}" data-icon-url="${h(l.icon_url)}" data-icon-source="${h(l.source||"uploaded")}">
            <img src="${h(l.icon_url)}" alt="${h(l.name||"")}" loading="lazy">
            ${l.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${h(l.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${n}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const r=e.querySelector("#pp-icon-save"),y=e.querySelectorAll(".profile-pic-library-item");y.forEach(l=>{l.addEventListener("click",()=>{y.forEach(d=>d.classList.remove("selected")),l.classList.add("selected"),g=l.dataset.iconUrl,o=l.dataset.iconSource,r.disabled=!1})}),r.addEventListener("click",async()=>{if(!g)return;r.disabled=!0,r.textContent="Gemmer...";const l=o==="ai_generated"?"ai_avatar":"icon",d=await se(t.id,g,l,{institutionId:t.institution_id,userName:t.name});if(d.success)t.profile_picture_url=g,t.profile_picture_type=l,k&&k({profile_picture_url:g,profile_picture_type:l}),b();else{r.textContent="Gem",r.disabled=!1;const m=document.createElement("div");m.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",m.textContent=d.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(m)}})}const oe="Icons/webp/Function/Flango-Kokkehue.webp",Y=[{key:"pixar",label:"🎬 Pixar"},{key:"clay",label:"🏺 Clay-figur"},{key:"cartoon",label:"✏️ Tegneserie"},{key:"realistic",label:"🎨 Illustration"}];async function He(){try{const{data:{session:e}}=await R.auth.getSession();if(!e?.user?.id)return!1;const{data:t,error:b}=await R.from("users").select("advanced_ai_access").eq("user_id",e.user.id).maybeSingle();return b?(console.warn("[profile-picture-modal] advanced_ai_access fetch fejl:",b.message),!1):t?.advanced_ai_access===!0}catch(e){return console.warn("[profile-picture-modal] advanced_ai_access undtagelse:",e?.message||e),!1}}function Ie(e,t,b,k,c,g){let o=Y[0],n=!1,r="",y=window.__ppAiReferenceBlob||null,l=window.__ppAiReferenceBlob?"library":null,d=!1,m=!1,q=!1,U=!1,O=null;const F=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
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
                        ${Y.map(i=>`
                            <button type="button" class="pp-ai-preset-btn" data-preset="${i.key}" style="padding:6px 12px;border:2px solid ${i.key===o.key?"#f59e0b":"rgba(255,255,255,0.1)"};background:${i.key===o.key?"rgba(245,158,11,0.1)":"transparent"};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${i.key===o.key?"#f59e0b":"#94a3b8"};transition:all 0.15s;">${i.label}</button>
                        `).join("")}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label id="pp-ai-hat-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;">
                        <input type="checkbox" id="pp-ai-hat-checkbox" style="width:16px;height:16px;accent-color:#f59e0b;">
                        <img src="${oe}" alt="" style="width:28px;height:28px;object-fit:contain;">
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
        </div>`;const f=e.querySelector("#pp-ai-preview"),A=e.querySelector("#pp-ai-options"),M=e.querySelector("#pp-ai-camera-section"),w=e.querySelector("#pp-ai-source-grid"),z=e.querySelector("#pp-ai-file-input"),H=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",ye),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>z.click());const D=e.querySelectorAll(".pp-ai-preset-btn"),$=e.querySelector("#pp-ai-prompt-textarea");D.forEach(i=>{i.addEventListener("click",()=>{const p=Y.find(u=>u.key===i.dataset.preset);p&&(o=p,D.forEach(u=>{const v=u.dataset.preset===p.key;u.style.borderColor=v?"#f59e0b":"rgba(255,255,255,0.1)",u.style.background=v?"rgba(245,158,11,0.1)":"transparent",u.style.color=v?"#f59e0b":"#94a3b8"}))})});const s=e.querySelector("#pp-ai-advanced-section"),E=e.querySelector("#pp-ai-advanced-toggle"),x=e.querySelector("#pp-ai-adv-arrow"),C=e.querySelector("#pp-ai-prompt-section"),de=e.querySelector("#pp-ai-reset-prompt"),B=e.querySelector("#pp-ai-load-prompt");async function ee(){if(!(!q||!$))try{const{data:{session:i}}=await R.auth.getSession(),p=i?.access_token;if(!p)return;B&&(B.disabled=!0,B.textContent="⏳ Henter…");const u=new FormData;u.append("preview_prompt","true"),u.append("target_user_id",t.id),u.append("user_id",t.id),u.append("ai_style",o.key),u.append("ai_provider","openai"),u.append("hat_enabled",d?"true":"false"),u.append("hero_enabled",m?"true":"false");const a=await(await fetch(`${ae}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${p}`},body:u})).json();a?.success&&typeof a.prompt=="string"&&($.value=a.prompt,r=a.prompt)}catch(i){console.warn("[profile-picture-modal] kunne ikke indlæse aktuel prompt:",i?.message||i)}finally{B&&(B.disabled=!1,B.textContent="👁 Indlæs aktuel prompt")}}He().then(i=>{q=i,s&&i&&(s.style.display="")}),E?.addEventListener("click",()=>{q&&(n=!n,x&&(x.style.transform=n?"rotate(90deg)":""),C&&(C.style.display=n?"block":"none"),n&&$&&!$.value.trim()&&ee())}),B?.addEventListener("click",ee),$?.addEventListener("input",()=>{r=$.value}),de?.addEventListener("click",()=>{r="",$&&($.value="")});const te=e.querySelector("#pp-ai-hat-checkbox"),W=e.querySelector("#pp-ai-hat-toggle");te?.addEventListener("change",()=>{d=te.checked,W&&(W.style.borderColor=d?"#f59e0b":"rgba(255,255,255,0.1)",W.style.background=d?"rgba(245,158,11,0.08)":"transparent")});const I=e.querySelector("#pp-ai-hero-checkbox"),T=e.querySelector("#pp-ai-hero-toggle");function G(i){if(!T)return;T.style.opacity="0.55",T.style.cursor="not-allowed",I&&(I.disabled=!0,I.checked=!1);const p=T.querySelector("div:last-child > div:last-child");p&&(p.textContent=i||"Kun for legendariske ekspedienter")}function fe(){if(!T)return;T.style.opacity="",T.style.cursor="pointer",I&&(I.disabled=!1);const i=T.querySelector("div:last-child > div:last-child");i&&(i.textContent="Tilføjer superhelte-tema til avataren")}G("Tjekker hero-status …"),(async()=>{try{const{data:i,error:p}=await R.rpc("get_hero_status",{p_user_id:t.id});if(p){console.warn("[profile-picture-modal] get_hero_status fejl:",p.message),G("Kunne ikke verificere status — prøv igen");return}if(O=i||null,U=!!(i&&i.qualified),U)fe();else{const u=Number(i?.sales_count??0),v=Number(i?.sales_required??500),a=Number(i?.minutes_worked??0),S=Number(i?.minutes_required??1800),_=Math.floor(a/60),L=Math.floor(S/60);G(`🔒 Kræver "legendarisk ekspedient" — pt. ${u}/${v} salg eller ${_}/${L} timer`)}}catch(i){console.warn("[profile-picture-modal] hero-status undtagelse:",i?.message||i),G("Kunne ikke verificere status — prøv igen")}})(),I?.addEventListener("change",()=>{if(I.disabled){I.checked=!1;return}m=I.checked,T&&(T.style.borderColor=m?"#8b5cf6":"rgba(255,255,255,0.1)",T.style.background=m?"rgba(139,92,246,0.08)":"transparent")});function V(i,p,u){y=i,l=u||"library",M.style.display="none",w.style.display="none",H&&(H.style.display="none"),f.style.display="block",A.style.display="block";const v=URL.createObjectURL(i),a=()=>{URL.revokeObjectURL(v),y=null,f.style.display="none",A.style.display="none",w.style.display="flex",H&&(H.style.display="flex")};if(b.profile_pictures_ai_enabled!==!0){f.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${v}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">${h(p)}</div>
                    <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#f59e0b;text-align:center;">
                        AI-avatar er ikke aktiveret for denne institution.
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>`,f.querySelector("#pp-ai-change-ref").addEventListener("click",a);return}f.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${v}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${h(p)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate" style="background:linear-gradient(135deg,#10b981,#059669);width:100%;">Generér avatar</button>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,f.querySelector("#pp-ai-generate").addEventListener("click",()=>ue(i,v)),f.querySelector("#pp-ai-change-ref").addEventListener("click",a)}async function ue(i,p){f.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via Microsoft Azure (EU)... (15-90 sek)</div>
        </div>`;try{const{data:{session:u}}=await R.auth.getSession(),v=u?.access_token;if(!v)throw new Error("Ikke logget ind");if(m&&!U){f.innerHTML=`<div style="padding:14px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;">
                    Hero-stilen kræver enten admin-rolle eller status "legendarisk ekspedient" (500 salg eller 30 timer).
                </div>`;return}const a=new FormData;a.append("target_user_id",t.id),a.append("user_id",t.id),a.append("photo",new File([i],"photo.jpg",{type:"image/jpeg"})),a.append("reference_source",l||"library"),a.append("ai_style",o.key),a.append("ai_provider","openai"),a.append("hat_enabled",d?"true":"false"),a.append("hero_enabled",m?"true":"false");const S=(r||"").trim();if(S&&q&&a.append("custom_prompt",S),d)try{const me=await(await fetch(oe)).blob();a.append("hat_image",new File([me],"hat.png",{type:"image/png"}))}catch(P){console.warn("Could not load hat image:",P)}const L=await(await fetch(`${ae}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${v}`},body:a})).json();if(!L.success)throw new Error(L.error||"Generering fejlede");if(!L.image_base64)throw new Error("Avatar mangler i svaret");const N=L.format==="png"?"image/png":"image/webp",j=atob(L.image_base64),ie=new Uint8Array(j.length);for(let P=0;P<j.length;P++)ie[P]=j.charCodeAt(P);const ve=new Blob([ie],{type:N}),be=await Le(ve),K=`${t.institution_id}/${t.id}_${Date.now()}.webp`,{error:Q}=await R.storage.from("profile-pictures").upload(K,be,{contentType:"image/webp",cacheControl:"31536000"});if(Q)throw new Error("Kunne ikke gemme avatar: "+(Q.message||Q));const{data:J,error:re}=await Se("save_ai_avatar_metadata",()=>R.rpc("save_ai_avatar_metadata",{p_user_id:t.id,p_storage_path:K,p_ai_style:L.ai_style||o.key,p_ai_prompt:L.prompt||""}));if(re||J&&J.success===!1){try{await R.storage.from("profile-pictures").remove([K])}catch{}throw new Error(re?.message||J?.error||"Kunne ikke gemme avatar-metadata")}pe(t.id);const ge=await le({id:t.id,profile_picture_url:K,profile_picture_type:"ai_avatar"});p&&URL.revokeObjectURL(p),f.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${ge||""}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,f.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=K,t.profile_picture_type="ai_avatar",c&&c({profile_picture_url:K,profile_picture_type:"ai_avatar"}),k()}),f.querySelector("#pp-ai-retry").addEventListener("click",()=>{f.style.display="none",A.style.display="none",w.style.display="flex"}),f.querySelector("#pp-ai-cancel").addEventListener("click",k)}catch(u){p&&URL.revokeObjectURL(p),f.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${h(u.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,f.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{f.style.display="none",A.style.display="none",w.style.display="flex"})}}function ye(){w.style.display="none",H&&(H.style.display="none"),M.style.display="block";const i=e.querySelector("#pp-ai-camera-video"),p=e.querySelector("#pp-ai-capture-btn"),u=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(v=>{g(v),i.srcObject=v,p.disabled=!1,u.style.display="none"}).catch(v=>{u.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${h(v.message)}</span>`,p.style.display="none"}),p.onclick=()=>{const v=document.createElement("canvas"),a=Math.min(i.videoWidth,i.videoHeight);v.width=800,v.height=800;const S=v.getContext("2d"),_=Math.round(a/1.3),L=(i.videoWidth-_)/2,N=(i.videoHeight-_)/2;S.translate(800,0),S.scale(-1,1),S.drawImage(i,L,N,_,_,0,0,800,800),v.toBlob(j=>{j&&V(j,"Kamera-foto sendes til AI og slettes straks efter","camera")},"image/jpeg",.9)}}z.addEventListener("change",async()=>{const i=z.files?.[0];if(i){z.value="";try{const p=await Z(i);V(p,"Uploadet billede sendes til AI og slettes straks efter","upload")}catch(p){f.style.display="block",f.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${h(p.message)}</div>`}}}),y?V(y,"Referencebillede fra bibliotek","library"):F&&fetch(F).then(i=>i.blob()).then(i=>{i&&(y=i,V(i,"Referencebillede fra bibliotek","library"))}).catch(i=>console.warn("[ai-avatar] Kunne ikke hente reference:",i)),xe(t.id,t).then(async i=>{if(!w)return;const p=new Map,u=i.filter(a=>a.storage_path&&!a.storage_path.startsWith("http")&&a.picture_type!=="library"&&a.picture_type!=="icon");if(u.length>0){const a=u.map(_=>_.storage_path),{data:S}=await R.storage.from("profile-pictures").createSignedUrls(a,3600);S&&S.forEach((_,L)=>{_.signedUrl&&p.set(u[L].id,_.signedUrl)})}const v=i.map((a,S)=>{const _=p.get(a.id)||a.storage_path;return`<div data-lib-index="${S}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${_}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.picture_type==="ai_avatar"?"AI":a.picture_type||""}</div>
            </div>`}).join("");v?w.innerHTML=v:w.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',w.querySelectorAll("[data-lib-index]").forEach(a=>{a.addEventListener("click",async()=>{const S=parseInt(a.dataset.libIndex),_=i[S];if(_){a.querySelector("img").style.borderColor="#f59e0b";try{const L=p.get(_.id)||_.storage_path,j=await(await fetch(L)).blob();w.style.display="none",V(j,"Eksisterende billede sendes til AI og slettes straks efter","library")}catch{a.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{a.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{Ke as openProfilePictureModal};
