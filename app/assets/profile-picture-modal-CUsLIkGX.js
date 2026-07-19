import{e as k,g as ae,d as J,h as oe,j as le,a as ve,s as M,k as be,A as ge,l as ie,m as me,r as he,n as xe}from"./main-FBhIOGCP.js";function ke(e){const t=!!e?.profile_pictures_ai_enabled;return{masterOn:t,usable:t&&e?.ai_provider_openai!==!1}}async function Te(e,t={}){const{onSaved:m,showCustomAlert:L}=t,f=window.__flangoGetInstitutionById?.(e.institution_id);if(!f)return;let b=f.profile_picture_types||["upload","camera","library"];const r=document.createElement("div");r.className="profile-pic-modal-overlay";const l=document.createElement("div");l.className="profile-pic-modal";const n=e.number?` (${e.number})`:"";l.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${k(e.name)}${n}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,r.appendChild(l),document.body.appendChild(r);const u=()=>{R(),r.remove()};l.querySelector(".profile-pic-modal-close").addEventListener("click",u),r.addEventListener("click",a=>{a.target===r&&u()});const p=l.querySelector("#pp-current-section");await _e(p,e);const c=document.createElement("div");c.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",c.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const h=ke(f),U=[{label:"Upload/Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!h.usable}];for(const a of U){const A=document.createElement("span");A.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${a.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,A.textContent=`${a.optOut?"❌":"✅"} ${a.label}`,c.appendChild(A)}l.querySelector("#pp-current-section").after(c);const T=l.querySelector("#pp-type-grid"),O=[{key:"upload",icon:"📁",label:"Upload",optOutField:"profile_picture_opt_out_aula"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"}],y=l.querySelector("#pp-subview");let E=null;function R(){E&&(E.getTracks().forEach(a=>a.stop()),E=null)}let x=!1;const q=t.preSelectType||null,H=t.referenceImageUrl||null,F=(a,A)=>{const _=document.createElement("button");_.className="profile-pic-type-btn pp-type-disabled",_.title=A,_.innerHTML=`<span class="type-icon">${a.icon}</span>${a.label}<div class="pp-type-disabled-reason">${k(A)}</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;",T.appendChild(_)};for(const a of O){if(a.key!=="icons"&&a.key!=="ai_avatar"&&!b.includes(a.key))continue;if(a.requiresAi&&!h.usable){F(a,"Ikke aktiveret");continue}const A=a.optOutField&&e[a.optOutField],_=document.createElement("button");_.className="profile-pic-type-btn"+(A?" pp-type-disabled":""),A?(_.innerHTML=`<span class="type-icon">${a.icon}</span>${a.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(_.innerHTML=`<span class="type-icon">${a.icon}</span>${a.label}`,_.addEventListener("click",()=>{R(),T.querySelectorAll(".profile-pic-type-btn").forEach(I=>I.classList.remove("active")),_.classList.add("active"),a.key,a.key==="upload"?we(y,e,f,u,m):a.key==="camera"?Le(y,e,f,u,m,I=>{E=I}):a.key==="library"?Se(y,e,u,m):a.key==="icons"?Ee(y,e,u,m):a.key==="ai_avatar"&&qe(y,e,f,u,m,I=>{E=I})})),T.appendChild(_),!x&&q&&a.key===q&&!A&&(x=!0,setTimeout(()=>_.click(),100))}q==="ai_avatar"&&H&&(window.__ppAiReferenceUrl=H)}async function _e(e,t){if(!(t.profile_picture_url&&!t.profile_picture_opt_out)){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const L={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${k(t.name)}</strong> har: ${L}
            </div>
        </div>`;const f=await ae(t),b=e.querySelector("#pp-current-img-wrap");if(f&&b){const r=document.createElement("img");r.src=f,r.alt="",r.className="profile-pic-current-img",b.replaceWith(r)}}function we(e,t,m,L,f){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const b=e.querySelector("#pp-upload-dropzone"),r=e.querySelector("#pp-upload-input"),l=e.querySelector("#pp-upload-preview");b.addEventListener("click",()=>r.click()),r.addEventListener("change",async n=>{const u=n.target.files?.[0];if(u){b.style.display="none",l.style.display="block",l.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const p=await J(u),c=URL.createObjectURL(p);l.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${c}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,l.querySelector("#pp-upload-save").addEventListener("click",async()=>{l.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const h=await oe(p,t.institution_id,t.id,"upload",t.name);URL.revokeObjectURL(c),h.success?(t.profile_picture_url=h.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",f&&f({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),L()):l.innerHTML=`<div style="color:#f87171;text-align:center;">${k(h.error||"Upload fejlede")}</div>`}),l.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(c),l.style.display="none",b.style.display="flex",r.value=""})}catch(p){l.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${k(p.message)}</div>`}}})}function Le(e,t,m,L,f,b){e.innerHTML=`
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
        </div>`;const r=e.querySelector("#pp-camera-video"),l=e.querySelector("#pp-capture-btn"),n=e.querySelector("#pp-camera-preview"),u=e.querySelector("#pp-camera-status"),p=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(c=>{b(c),r.srcObject=c,l.disabled=!1,u.style.display="none"}).catch(c=>{u.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${k(c.message)}</span>`,l.style.display="none"}),l.addEventListener("click",async()=>{const c=document.createElement("canvas"),h=Math.min(r.videoWidth,r.videoHeight);c.width=400,c.height=400;const U=c.getContext("2d"),T=Math.round(h/1.3),O=(r.videoWidth-T)/2,y=(r.videoHeight-T)/2;U.translate(400,0),U.scale(-1,1),U.drawImage(r,O,y,T,T,0,0,400,400),c.toBlob(async E=>{if(!E)return;p.style.display="none",l.parentElement.style.display="none",n.style.display="block";const R=await J(new File([E],"camera.jpg",{type:"image/jpeg"})),x=URL.createObjectURL(R);n.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${x}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,n.querySelector("#pp-camera-save").addEventListener("click",async()=>{n.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const q=await oe(R,t.institution_id,t.id,"camera",t.name);URL.revokeObjectURL(x),q.success?(t.profile_picture_url=q.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",f&&f({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),L()):n.innerHTML=`<div style="color:#f87171;text-align:center;">${k(q.error||"Upload fejlede")}</div>`}),n.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(x),n.style.display="none",p.style.display="block",l.parentElement.style.display="flex"})},"image/jpeg",.9)})}function Se(e,t,m,L){let f=null;const b=ge.map((n,u)=>`
        <div class="profile-pic-library-item" data-avatar-index="${u}" data-avatar-url="${n}">
            <img src="${n}" alt="Avatar ${u+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${b}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const r=e.querySelector("#pp-library-save"),l=e.querySelectorAll(".profile-pic-library-item");l.forEach(n=>{n.addEventListener("click",()=>{l.forEach(u=>u.classList.remove("selected")),n.classList.add("selected"),f=n.dataset.avatarUrl,r.disabled=!1})}),r.addEventListener("click",async()=>{if(!f)return;r.disabled=!0,r.textContent="Gemmer...";const n=await le(t.id,f,"library",{institutionId:t.institution_id,userName:t.name});if(n.success)t.profile_picture_url=f,t.profile_picture_type="library",L&&L({profile_picture_url:f,profile_picture_type:"library"}),m();else{r.textContent="Gem",r.disabled=!1;const u=document.createElement("div");u.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",u.textContent=n.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(u)}})}async function Ee(e,t,m,L){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const f=await ve(t.institution_id);if(!f||f.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let b=null,r=null;const l=f.map((p,c)=>`
        <div class="profile-pic-library-item" data-icon-index="${c}" data-icon-url="${k(p.icon_url)}" data-icon-source="${k(p.source||"uploaded")}">
            <img src="${k(p.icon_url)}" alt="${k(p.name||"")}" loading="lazy">
            ${p.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${k(p.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${l}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const n=e.querySelector("#pp-icon-save"),u=e.querySelectorAll(".profile-pic-library-item");u.forEach(p=>{p.addEventListener("click",()=>{u.forEach(c=>c.classList.remove("selected")),p.classList.add("selected"),b=p.dataset.iconUrl,r=p.dataset.iconSource,n.disabled=!1})}),n.addEventListener("click",async()=>{if(!b)return;n.disabled=!0,n.textContent="Gemmer...";const p=r==="ai_generated"?"ai_avatar":"icon",c=await le(t.id,b,p,{institutionId:t.institution_id,userName:t.name});if(c.success)t.profile_picture_url=b,t.profile_picture_type=p,L&&L({profile_picture_url:b,profile_picture_type:p}),m();else{n.textContent="Gem",n.disabled=!1;const h=document.createElement("div");h.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",h.textContent=c.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(h)}})}const re="Icons/webp/Function/Flango-Kokkehue.webp",Q=[{key:"pixar",label:"🎬 Pixar"},{key:"clay",label:"🏺 Clay-figur"},{key:"cartoon",label:"✏️ Tegneserie"},{key:"realistic",label:"🎨 Illustration"}];async function Ae(){try{const{data:{session:e}}=await M.auth.getSession();if(!e?.user?.id)return!1;const{data:t,error:m}=await M.from("users").select("advanced_ai_access").eq("user_id",e.user.id).maybeSingle();return m?(console.warn("[profile-picture-modal] advanced_ai_access fetch fejl:",m.message),!1):t?.advanced_ai_access===!0}catch(e){return console.warn("[profile-picture-modal] advanced_ai_access undtagelse:",e?.message||e),!1}}function qe(e,t,m,L,f,b){let r=Q[0],l=!1,n="",u=window.__ppAiReferenceBlob||null,p=!1,c=!1,h=!1,U=!1,T=null;const O=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
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
                        ${Q.map(i=>`
                            <button type="button" class="pp-ai-preset-btn" data-preset="${i.key}" style="padding:6px 12px;border:2px solid ${i.key===r.key?"#f59e0b":"rgba(255,255,255,0.1)"};background:${i.key===r.key?"rgba(245,158,11,0.1)":"transparent"};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${i.key===r.key?"#f59e0b":"#94a3b8"};transition:all 0.15s;">${i.label}</button>
                        `).join("")}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label id="pp-ai-hat-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;">
                        <input type="checkbox" id="pp-ai-hat-checkbox" style="width:16px;height:16px;accent-color:#f59e0b;">
                        <img src="${re}" alt="" style="width:28px;height:28px;object-fit:contain;">
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
        </div>`;const y=e.querySelector("#pp-ai-preview"),E=e.querySelector("#pp-ai-options"),R=e.querySelector("#pp-ai-camera-section"),x=e.querySelector("#pp-ai-source-grid"),q=e.querySelector("#pp-ai-file-input"),H=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",ce),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>q.click());const F=e.querySelectorAll(".pp-ai-preset-btn"),a=e.querySelector("#pp-ai-prompt-textarea");F.forEach(i=>{i.addEventListener("click",()=>{const d=Q.find(s=>s.key===i.dataset.preset);d&&(r=d,F.forEach(s=>{const v=s.dataset.preset===d.key;s.style.borderColor=v?"#f59e0b":"rgba(255,255,255,0.1)",s.style.background=v?"rgba(245,158,11,0.1)":"transparent",s.style.color=v?"#f59e0b":"#94a3b8"}))})});const A=e.querySelector("#pp-ai-advanced-section"),_=e.querySelector("#pp-ai-advanced-toggle"),I=e.querySelector("#pp-ai-adv-arrow"),X=e.querySelector("#pp-ai-prompt-section"),ne=e.querySelector("#pp-ai-reset-prompt"),P=e.querySelector("#pp-ai-load-prompt");async function Y(){if(!(!h||!a))try{const{data:{session:i}}=await M.auth.getSession(),d=i?.access_token;if(!d)return;P&&(P.disabled=!0,P.textContent="⏳ Henter…");const s=new FormData;s.append("preview_prompt","true"),s.append("target_user_id",t.id),s.append("user_id",t.id),s.append("ai_style",r.key),s.append("ai_provider","openai"),s.append("hat_enabled",p?"true":"false"),s.append("hero_enabled",c?"true":"false");const o=await(await fetch(`${ie}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${d}`},body:s})).json();o?.success&&typeof o.prompt=="string"&&(a.value=o.prompt,n=o.prompt)}catch(i){console.warn("[profile-picture-modal] kunne ikke indlæse aktuel prompt:",i?.message||i)}finally{P&&(P.disabled=!1,P.textContent="👁 Indlæs aktuel prompt")}}Ae().then(i=>{h=i,A&&i&&(A.style.display="")}),_?.addEventListener("click",()=>{h&&(l=!l,I&&(I.style.transform=l?"rotate(90deg)":""),X&&(X.style.display=l?"block":"none"),l&&a&&!a.value.trim()&&Y())}),P?.addEventListener("click",Y),a?.addEventListener("input",()=>{n=a.value}),ne?.addEventListener("click",()=>{n="",a&&(a.value="")});const Z=e.querySelector("#pp-ai-hat-checkbox"),D=e.querySelector("#pp-ai-hat-toggle");Z?.addEventListener("change",()=>{p=Z.checked,D&&(D.style.borderColor=p?"#f59e0b":"rgba(255,255,255,0.1)",D.style.background=p?"rgba(245,158,11,0.08)":"transparent")});const z=e.querySelector("#pp-ai-hero-checkbox"),$=e.querySelector("#pp-ai-hero-toggle");function G(i){if(!$)return;$.style.opacity="0.55",$.style.cursor="not-allowed",z&&(z.disabled=!0,z.checked=!1);const d=$.querySelector("div:last-child > div:last-child");d&&(d.textContent=i||"Kun for legendariske ekspedienter")}function se(){if(!$)return;$.style.opacity="",$.style.cursor="pointer",z&&(z.disabled=!1);const i=$.querySelector("div:last-child > div:last-child");i&&(i.textContent="Tilføjer superhelte-tema til avataren")}G("Tjekker hero-status …"),(async()=>{try{const{data:i,error:d}=await M.rpc("get_hero_status",{p_user_id:t.id});if(d){console.warn("[profile-picture-modal] get_hero_status fejl:",d.message),G("Kunne ikke verificere status — prøv igen");return}if(T=i||null,U=!!(i&&i.qualified),U)se();else{const s=Number(i?.sales_count??0),v=Number(i?.sales_required??500),o=Number(i?.minutes_worked??0),S=Number(i?.minutes_required??1800),g=Math.floor(o/60),w=Math.floor(S/60);G(`🔒 Kræver "legendarisk ekspedient" — pt. ${s}/${v} salg eller ${g}/${w} timer`)}}catch(i){console.warn("[profile-picture-modal] hero-status undtagelse:",i?.message||i),G("Kunne ikke verificere status — prøv igen")}})(),z?.addEventListener("change",()=>{if(z.disabled){z.checked=!1;return}c=z.checked,$&&($.style.borderColor=c?"#8b5cf6":"rgba(255,255,255,0.1)",$.style.background=c?"rgba(139,92,246,0.08)":"transparent")});function K(i,d){u=i,R.style.display="none",x.style.display="none",H&&(H.style.display="none"),y.style.display="block",E.style.display="block";const s=URL.createObjectURL(i),v=()=>{URL.revokeObjectURL(s),u=null,y.style.display="none",E.style.display="none",x.style.display="flex",H&&(H.style.display="flex")};if(m.profile_pictures_ai_enabled!==!0){y.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${s}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">${k(d)}</div>
                    <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#f59e0b;text-align:center;">
                        AI-avatar er ikke aktiveret for denne institution.
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>`,y.querySelector("#pp-ai-change-ref").addEventListener("click",v);return}y.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${s}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${k(d)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate" style="background:linear-gradient(135deg,#10b981,#059669);width:100%;">Generér avatar</button>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,y.querySelector("#pp-ai-generate").addEventListener("click",()=>pe(i,s)),y.querySelector("#pp-ai-change-ref").addEventListener("click",v)}async function pe(i,d){y.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via Microsoft Azure (EU)... (15-90 sek)</div>
        </div>`;try{const{data:{session:s}}=await M.auth.getSession(),v=s?.access_token;if(!v)throw new Error("Ikke logget ind");if(c&&!U){y.innerHTML=`<div style="padding:14px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;">
                    Hero-stilen kræver enten admin-rolle eller status "legendarisk ekspedient" (500 salg eller 30 timer).
                </div>`;return}const o=new FormData;o.append("target_user_id",t.id),o.append("user_id",t.id),o.append("photo",new File([i],"photo.jpg",{type:"image/jpeg"})),o.append("ai_style",r.key),o.append("ai_provider","openai"),o.append("hat_enabled",p?"true":"false"),o.append("hero_enabled",c?"true":"false");const S=(n||"").trim();if(S&&h&&o.append("custom_prompt",S),p)try{const ye=await(await fetch(re)).blob();o.append("hat_image",new File([ye],"hat.png",{type:"image/png"}))}catch(j){console.warn("Could not load hat image:",j)}const w=await(await fetch(`${ie}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${v}`},body:o})).json();if(!w.success)throw new Error(w.error||"Generering fejlede");if(!w.image_base64)throw new Error("Avatar mangler i svaret");const V=w.format==="png"?"image/png":"image/webp",C=atob(w.image_base64),ee=new Uint8Array(C.length);for(let j=0;j<C.length;j++)ee[j]=C.charCodeAt(j);const de=new Blob([ee],{type:V}),ue=await me(de),B=`${t.institution_id}/${t.id}_${Date.now()}.webp`,{error:N}=await M.storage.from("profile-pictures").upload(B,ue,{contentType:"image/webp",cacheControl:"31536000"});if(N)throw new Error("Kunne ikke gemme avatar: "+(N.message||N));const{data:W,error:te}=await he("save_ai_avatar_metadata",()=>M.rpc("save_ai_avatar_metadata",{p_user_id:t.id,p_storage_path:B,p_ai_style:w.ai_style||r.key,p_ai_prompt:w.prompt||""}));if(te||W&&W.success===!1){try{await M.storage.from("profile-pictures").remove([B])}catch{}throw new Error(te?.message||W?.error||"Kunne ikke gemme avatar-metadata")}xe(t.id);const fe=await ae({id:t.id,profile_picture_url:B,profile_picture_type:"ai_avatar"});d&&URL.revokeObjectURL(d),y.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${fe||""}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,y.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=B,t.profile_picture_type="ai_avatar",f&&f({profile_picture_url:B,profile_picture_type:"ai_avatar"}),L()}),y.querySelector("#pp-ai-retry").addEventListener("click",()=>{y.style.display="none",E.style.display="none",x.style.display="flex"}),y.querySelector("#pp-ai-cancel").addEventListener("click",L)}catch(s){d&&URL.revokeObjectURL(d),y.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${k(s.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,y.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{y.style.display="none",E.style.display="none",x.style.display="flex"})}}function ce(){x.style.display="none",H&&(H.style.display="none"),R.style.display="block";const i=e.querySelector("#pp-ai-camera-video"),d=e.querySelector("#pp-ai-capture-btn"),s=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(v=>{b(v),i.srcObject=v,d.disabled=!1,s.style.display="none"}).catch(v=>{s.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${k(v.message)}</span>`,d.style.display="none"}),d.onclick=()=>{const v=document.createElement("canvas"),o=Math.min(i.videoWidth,i.videoHeight);v.width=800,v.height=800;const S=v.getContext("2d"),g=Math.round(o/1.3),w=(i.videoWidth-g)/2,V=(i.videoHeight-g)/2;S.translate(800,0),S.scale(-1,1),S.drawImage(i,w,V,g,g,0,0,800,800),v.toBlob(C=>{C&&K(C,"Kamera-foto sendes til AI og slettes straks efter")},"image/jpeg",.9)}}q.addEventListener("change",async()=>{const i=q.files?.[0];if(i){q.value="";try{const d=await J(i);K(d,"Uploadet billede sendes til AI og slettes straks efter")}catch(d){y.style.display="block",y.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${k(d.message)}</div>`}}}),u?K(u,"Referencebillede fra bibliotek"):O&&fetch(O).then(i=>i.blob()).then(i=>{i&&(u=i,K(i,"Referencebillede fra bibliotek"))}).catch(i=>console.warn("[ai-avatar] Kunne ikke hente reference:",i)),be(t.id,t).then(async i=>{if(!x)return;const d=new Map,s=i.filter(o=>o.storage_path&&!o.storage_path.startsWith("http")&&o.picture_type!=="library"&&o.picture_type!=="icon");if(s.length>0){const o=s.map(g=>g.storage_path),{data:S}=await M.storage.from("profile-pictures").createSignedUrls(o,3600);S&&S.forEach((g,w)=>{g.signedUrl&&d.set(s[w].id,g.signedUrl)})}const v=i.map((o,S)=>{const g=d.get(o.id)||o.storage_path;return`<div data-lib-index="${S}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${g}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${o.picture_type==="ai_avatar"?"AI":o.picture_type||""}</div>
            </div>`}).join("");v?x.innerHTML=v:x.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',x.querySelectorAll("[data-lib-index]").forEach(o=>{o.addEventListener("click",async()=>{const S=parseInt(o.dataset.libIndex),g=i[S];if(g){o.querySelector("img").style.borderColor="#f59e0b";try{const w=d.get(g.id)||g.storage_path,C=await(await fetch(w)).blob();x.style.display="none",K(C,"Eksisterende billede sendes til AI og slettes straks efter")}catch{o.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{o.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{Te as openProfilePictureModal};
