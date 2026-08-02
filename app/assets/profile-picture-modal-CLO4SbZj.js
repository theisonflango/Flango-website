import{e as w,g as oe,d as J,h as le,j as ne,a as be,s as R,k as ge,A as me,l as re,m as he,r as xe,n as ke}from"./main-LnXoNOTI.js";function _e(e){const t=!!e?.profile_pictures_ai_enabled;return{masterOn:t,usable:t&&e?.ai_provider_openai!==!1}}async function Ue(e,t={}){const{onSaved:k,showCustomAlert:S}=t,u=window.__flangoGetInstitutionById?.(e.institution_id);if(!u)return;let b=u.profile_picture_types||["upload","camera","library"];const a=document.createElement("div");a.className="profile-pic-modal-overlay";const o=document.createElement("div");o.className="profile-pic-modal";const l=e.number?` (${e.number})`:"";o.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${w(e.name)}${l}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,a.appendChild(o),document.body.appendChild(a);const c=()=>{U(),a.remove()};o.querySelector(".profile-pic-modal-close").addEventListener("click",c),a.addEventListener("click",s=>{s.target===a&&c()});const f=o.querySelector("#pp-current-section");await we(f,e);const n=document.createElement("div");n.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",n.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const g=_e(u),$=[{label:"Upload/Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!g.usable}];for(const s of $){const m=document.createElement("span");m.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${s.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,m.textContent=`${s.optOut?"❌":"✅"} ${s.label}`,n.appendChild(m)}o.querySelector("#pp-current-section").after(n);const A=o.querySelector("#pp-type-grid"),K=[{key:"upload",icon:"📁",label:"Upload",optOutField:"profile_picture_opt_out_aula"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"}],T=o.querySelector("#pp-subview");let y=null;function U(){y&&(y.getTracks().forEach(s=>s.stop()),y=null)}let H=!1;const h=t.preSelectType||null,j=t.referenceImageUrl||null,M=(s,m)=>{const _=document.createElement("button");_.className="profile-pic-type-btn pp-type-disabled",_.title=m,_.innerHTML=`<span class="type-icon">${s.icon}</span>${s.label}<div class="pp-type-disabled-reason">${w(m)}</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;",A.appendChild(_)};for(const s of K){if(s.key!=="icons"&&s.key!=="ai_avatar"&&!b.includes(s.key))continue;if(s.requiresAi&&!g.usable){M(s,"Ikke aktiveret");continue}const m=s.optOutField&&e[s.optOutField],_=document.createElement("button");_.className="profile-pic-type-btn"+(m?" pp-type-disabled":""),m?(_.innerHTML=`<span class="type-icon">${s.icon}</span>${s.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(_.innerHTML=`<span class="type-icon">${s.icon}</span>${s.label}`,_.addEventListener("click",()=>{U(),A.querySelectorAll(".profile-pic-type-btn").forEach(P=>P.classList.remove("active")),_.classList.add("active"),s.key,s.key==="upload"?Le(T,e,u,c,k):s.key==="camera"?Se(T,e,u,c,k,P=>{y=P}):s.key==="library"?Ee(T,e,c,k):s.key==="icons"?Ae(T,e,c,k):s.key==="ai_avatar"&&$e(T,e,u,c,k,P=>{y=P})})),A.appendChild(_),!H&&h&&s.key===h&&!m&&(H=!0,setTimeout(()=>_.click(),100))}h==="ai_avatar"&&j&&(window.__ppAiReferenceUrl=j)}async function we(e,t){if(!(t.profile_picture_url&&!t.profile_picture_opt_out)){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const S={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${w(t.name)}</strong> har: ${S}
            </div>
        </div>`;const u=await oe(t),b=e.querySelector("#pp-current-img-wrap");if(u&&b){const a=document.createElement("img");a.src=u,a.alt="",a.className="profile-pic-current-img",b.replaceWith(a)}}function Le(e,t,k,S,u){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const b=e.querySelector("#pp-upload-dropzone"),a=e.querySelector("#pp-upload-input"),o=e.querySelector("#pp-upload-preview");b.addEventListener("click",()=>a.click()),a.addEventListener("change",async l=>{const c=l.target.files?.[0];if(c){b.style.display="none",o.style.display="block",o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const f=await J(c),n=URL.createObjectURL(f);o.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${n}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,o.querySelector("#pp-upload-save").addEventListener("click",async()=>{o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const g=await le(f,t.institution_id,t.id,"upload",t.name);URL.revokeObjectURL(n),g.success?(t.profile_picture_url=g.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",u&&u({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),S()):o.innerHTML=`<div style="color:#f87171;text-align:center;">${w(g.error||"Upload fejlede")}</div>`}),o.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(n),o.style.display="none",b.style.display="flex",a.value=""})}catch(f){o.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${w(f.message)}</div>`}}})}function Se(e,t,k,S,u,b){e.innerHTML=`
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
        </div>`;const a=e.querySelector("#pp-camera-video"),o=e.querySelector("#pp-capture-btn"),l=e.querySelector("#pp-camera-preview"),c=e.querySelector("#pp-camera-status"),f=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(n=>{b(n),a.srcObject=n,o.disabled=!1,c.style.display="none"}).catch(n=>{c.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${w(n.message)}</span>`,o.style.display="none"}),o.addEventListener("click",async()=>{const n=document.createElement("canvas"),g=Math.min(a.videoWidth,a.videoHeight);n.width=400,n.height=400;const $=n.getContext("2d"),A=Math.round(g/1.3),K=(a.videoWidth-A)/2,T=(a.videoHeight-A)/2;$.translate(400,0),$.scale(-1,1),$.drawImage(a,K,T,A,A,0,0,400,400),n.toBlob(async y=>{if(!y)return;f.style.display="none",o.parentElement.style.display="none",l.style.display="block";const U=await J(new File([y],"camera.jpg",{type:"image/jpeg"})),H=URL.createObjectURL(U);l.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${H}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,l.querySelector("#pp-camera-save").addEventListener("click",async()=>{l.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const h=await le(U,t.institution_id,t.id,"camera",t.name);URL.revokeObjectURL(H),h.success?(t.profile_picture_url=h.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",u&&u({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),S()):l.innerHTML=`<div style="color:#f87171;text-align:center;">${w(h.error||"Upload fejlede")}</div>`}),l.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(H),l.style.display="none",f.style.display="block",o.parentElement.style.display="flex"})},"image/jpeg",.9)})}function Ee(e,t,k,S){let u=null;const b=me.map((l,c)=>`
        <div class="profile-pic-library-item" data-avatar-index="${c}" data-avatar-url="${l}">
            <img src="${l}" alt="Avatar ${c+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${b}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const a=e.querySelector("#pp-library-save"),o=e.querySelectorAll(".profile-pic-library-item");o.forEach(l=>{l.addEventListener("click",()=>{o.forEach(c=>c.classList.remove("selected")),l.classList.add("selected"),u=l.dataset.avatarUrl,a.disabled=!1})}),a.addEventListener("click",async()=>{if(!u)return;a.disabled=!0,a.textContent="Gemmer...";const l=await ne(t.id,u,"library",{institutionId:t.institution_id,userName:t.name});if(l.success)t.profile_picture_url=u,t.profile_picture_type="library",S&&S({profile_picture_url:u,profile_picture_type:"library"}),k();else{a.textContent="Gem",a.disabled=!1;const c=document.createElement("div");c.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",c.textContent=l.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(c)}})}async function Ae(e,t,k,S){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const u=await be(t.institution_id);if(!u||u.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let b=null,a=null;const o=u.map((f,n)=>`
        <div class="profile-pic-library-item" data-icon-index="${n}" data-icon-url="${w(f.icon_url)}" data-icon-source="${w(f.source||"uploaded")}">
            <img src="${w(f.icon_url)}" alt="${w(f.name||"")}" loading="lazy">
            ${f.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${w(f.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${o}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const l=e.querySelector("#pp-icon-save"),c=e.querySelectorAll(".profile-pic-library-item");c.forEach(f=>{f.addEventListener("click",()=>{c.forEach(n=>n.classList.remove("selected")),f.classList.add("selected"),b=f.dataset.iconUrl,a=f.dataset.iconSource,l.disabled=!1})}),l.addEventListener("click",async()=>{if(!b)return;l.disabled=!0,l.textContent="Gemmer...";const f=a==="ai_generated"?"ai_avatar":"icon",n=await ne(t.id,b,f,{institutionId:t.institution_id,userName:t.name});if(n.success)t.profile_picture_url=b,t.profile_picture_type=f,S&&S({profile_picture_url:b,profile_picture_type:f}),k();else{l.textContent="Gem",l.disabled=!1;const g=document.createElement("div");g.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",g.textContent=n.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(g)}})}const ae="Icons/webp/Function/Flango-Kokkehue.webp",Q=[{key:"pixar",label:"🎬 Pixar"},{key:"clay",label:"🏺 Clay-figur"},{key:"cartoon",label:"✏️ Tegneserie"},{key:"realistic",label:"🎨 Illustration"}];async function qe(){try{const{data:{session:e}}=await R.auth.getSession();if(!e?.user?.id)return!1;const{data:t,error:k}=await R.from("users").select("advanced_ai_access").eq("user_id",e.user.id).maybeSingle();return k?(console.warn("[profile-picture-modal] advanced_ai_access fetch fejl:",k.message),!1):t?.advanced_ai_access===!0}catch(e){return console.warn("[profile-picture-modal] advanced_ai_access undtagelse:",e?.message||e),!1}}function $e(e,t,k,S,u,b){let a=Q[0],o=!1,l="",c=window.__ppAiReferenceBlob||null,f=window.__ppAiReferenceBlob?"library":null,n=!1,g=!1,$=!1,A=!1,K=null;const T=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
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
                            <button type="button" class="pp-ai-preset-btn" data-preset="${i.key}" style="padding:6px 12px;border:2px solid ${i.key===a.key?"#f59e0b":"rgba(255,255,255,0.1)"};background:${i.key===a.key?"rgba(245,158,11,0.1)":"transparent"};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${i.key===a.key?"#f59e0b":"#94a3b8"};transition:all 0.15s;">${i.label}</button>
                        `).join("")}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label id="pp-ai-hat-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;">
                        <input type="checkbox" id="pp-ai-hat-checkbox" style="width:16px;height:16px;accent-color:#f59e0b;">
                        <img src="${ae}" alt="" style="width:28px;height:28px;object-fit:contain;">
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
        </div>`;const y=e.querySelector("#pp-ai-preview"),U=e.querySelector("#pp-ai-options"),H=e.querySelector("#pp-ai-camera-section"),h=e.querySelector("#pp-ai-source-grid"),j=e.querySelector("#pp-ai-file-input"),M=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",de),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>j.click());const s=e.querySelectorAll(".pp-ai-preset-btn"),m=e.querySelector("#pp-ai-prompt-textarea");s.forEach(i=>{i.addEventListener("click",()=>{const p=Q.find(d=>d.key===i.dataset.preset);p&&(a=p,s.forEach(d=>{const v=d.dataset.preset===p.key;d.style.borderColor=v?"#f59e0b":"rgba(255,255,255,0.1)",d.style.background=v?"rgba(245,158,11,0.1)":"transparent",d.style.color=v?"#f59e0b":"#94a3b8"}))})});const _=e.querySelector("#pp-ai-advanced-section"),P=e.querySelector("#pp-ai-advanced-toggle"),X=e.querySelector("#pp-ai-adv-arrow"),Y=e.querySelector("#pp-ai-prompt-section"),se=e.querySelector("#pp-ai-reset-prompt"),B=e.querySelector("#pp-ai-load-prompt");async function Z(){if(!(!$||!m))try{const{data:{session:i}}=await R.auth.getSession(),p=i?.access_token;if(!p)return;B&&(B.disabled=!0,B.textContent="⏳ Henter…");const d=new FormData;d.append("preview_prompt","true"),d.append("target_user_id",t.id),d.append("user_id",t.id),d.append("ai_style",a.key),d.append("ai_provider","openai"),d.append("hat_enabled",n?"true":"false"),d.append("hero_enabled",g?"true":"false");const r=await(await fetch(`${re}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${p}`},body:d})).json();r?.success&&typeof r.prompt=="string"&&(m.value=r.prompt,l=r.prompt)}catch(i){console.warn("[profile-picture-modal] kunne ikke indlæse aktuel prompt:",i?.message||i)}finally{B&&(B.disabled=!1,B.textContent="👁 Indlæs aktuel prompt")}}qe().then(i=>{$=i,_&&i&&(_.style.display="")}),P?.addEventListener("click",()=>{$&&(o=!o,X&&(X.style.transform=o?"rotate(90deg)":""),Y&&(Y.style.display=o?"block":"none"),o&&m&&!m.value.trim()&&Z())}),B?.addEventListener("click",Z),m?.addEventListener("input",()=>{l=m.value}),se?.addEventListener("click",()=>{l="",m&&(m.value="")});const ee=e.querySelector("#pp-ai-hat-checkbox"),D=e.querySelector("#pp-ai-hat-toggle");ee?.addEventListener("change",()=>{n=ee.checked,D&&(D.style.borderColor=n?"#f59e0b":"rgba(255,255,255,0.1)",D.style.background=n?"rgba(245,158,11,0.08)":"transparent")});const z=e.querySelector("#pp-ai-hero-checkbox"),q=e.querySelector("#pp-ai-hero-toggle");function G(i){if(!q)return;q.style.opacity="0.55",q.style.cursor="not-allowed",z&&(z.disabled=!0,z.checked=!1);const p=q.querySelector("div:last-child > div:last-child");p&&(p.textContent=i||"Kun for legendariske ekspedienter")}function pe(){if(!q)return;q.style.opacity="",q.style.cursor="pointer",z&&(z.disabled=!1);const i=q.querySelector("div:last-child > div:last-child");i&&(i.textContent="Tilføjer superhelte-tema til avataren")}G("Tjekker hero-status …"),(async()=>{try{const{data:i,error:p}=await R.rpc("get_hero_status",{p_user_id:t.id});if(p){console.warn("[profile-picture-modal] get_hero_status fejl:",p.message),G("Kunne ikke verificere status — prøv igen");return}if(K=i||null,A=!!(i&&i.qualified),A)pe();else{const d=Number(i?.sales_count??0),v=Number(i?.sales_required??500),r=Number(i?.minutes_worked??0),E=Number(i?.minutes_required??1800),x=Math.floor(r/60),L=Math.floor(E/60);G(`🔒 Kræver "legendarisk ekspedient" — pt. ${d}/${v} salg eller ${x}/${L} timer`)}}catch(i){console.warn("[profile-picture-modal] hero-status undtagelse:",i?.message||i),G("Kunne ikke verificere status — prøv igen")}})(),z?.addEventListener("change",()=>{if(z.disabled){z.checked=!1;return}g=z.checked,q&&(q.style.borderColor=g?"#8b5cf6":"rgba(255,255,255,0.1)",q.style.background=g?"rgba(139,92,246,0.08)":"transparent")});function F(i,p,d){c=i,f=d||"library",H.style.display="none",h.style.display="none",M&&(M.style.display="none"),y.style.display="block",U.style.display="block";const v=URL.createObjectURL(i),r=()=>{URL.revokeObjectURL(v),c=null,y.style.display="none",U.style.display="none",h.style.display="flex",M&&(M.style.display="flex")};if(k.profile_pictures_ai_enabled!==!0){y.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${v}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">${w(p)}</div>
                    <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#f59e0b;text-align:center;">
                        AI-avatar er ikke aktiveret for denne institution.
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>`,y.querySelector("#pp-ai-change-ref").addEventListener("click",r);return}y.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${v}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${w(p)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate" style="background:linear-gradient(135deg,#10b981,#059669);width:100%;">Generér avatar</button>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,y.querySelector("#pp-ai-generate").addEventListener("click",()=>ce(i,v)),y.querySelector("#pp-ai-change-ref").addEventListener("click",r)}async function ce(i,p){y.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via Microsoft Azure (EU)... (15-90 sek)</div>
        </div>`;try{const{data:{session:d}}=await R.auth.getSession(),v=d?.access_token;if(!v)throw new Error("Ikke logget ind");if(g&&!A){y.innerHTML=`<div style="padding:14px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;">
                    Hero-stilen kræver enten admin-rolle eller status "legendarisk ekspedient" (500 salg eller 30 timer).
                </div>`;return}const r=new FormData;r.append("target_user_id",t.id),r.append("user_id",t.id),r.append("photo",new File([i],"photo.jpg",{type:"image/jpeg"})),r.append("reference_source",f||"library"),r.append("ai_style",a.key),r.append("ai_provider","openai"),r.append("hat_enabled",n?"true":"false"),r.append("hero_enabled",g?"true":"false");const E=(l||"").trim();if(E&&$&&r.append("custom_prompt",E),n)try{const ve=await(await fetch(ae)).blob();r.append("hat_image",new File([ve],"hat.png",{type:"image/png"}))}catch(C){console.warn("Could not load hat image:",C)}const L=await(await fetch(`${re}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${v}`},body:r})).json();if(!L.success)throw new Error(L.error||"Generering fejlede");if(!L.image_base64)throw new Error("Avatar mangler i svaret");const V=L.format==="png"?"image/png":"image/webp",I=atob(L.image_base64),te=new Uint8Array(I.length);for(let C=0;C<I.length;C++)te[C]=I.charCodeAt(C);const ue=new Blob([te],{type:V}),fe=await he(ue),O=`${t.institution_id}/${t.id}_${Date.now()}.webp`,{error:N}=await R.storage.from("profile-pictures").upload(O,fe,{contentType:"image/webp",cacheControl:"31536000"});if(N)throw new Error("Kunne ikke gemme avatar: "+(N.message||N));const{data:W,error:ie}=await xe("save_ai_avatar_metadata",()=>R.rpc("save_ai_avatar_metadata",{p_user_id:t.id,p_storage_path:O,p_ai_style:L.ai_style||a.key,p_ai_prompt:L.prompt||""}));if(ie||W&&W.success===!1){try{await R.storage.from("profile-pictures").remove([O])}catch{}throw new Error(ie?.message||W?.error||"Kunne ikke gemme avatar-metadata")}ke(t.id);const ye=await oe({id:t.id,profile_picture_url:O,profile_picture_type:"ai_avatar"});p&&URL.revokeObjectURL(p),y.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${ye||""}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,y.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=O,t.profile_picture_type="ai_avatar",u&&u({profile_picture_url:O,profile_picture_type:"ai_avatar"}),S()}),y.querySelector("#pp-ai-retry").addEventListener("click",()=>{y.style.display="none",U.style.display="none",h.style.display="flex"}),y.querySelector("#pp-ai-cancel").addEventListener("click",S)}catch(d){p&&URL.revokeObjectURL(p),y.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${w(d.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,y.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{y.style.display="none",U.style.display="none",h.style.display="flex"})}}function de(){h.style.display="none",M&&(M.style.display="none"),H.style.display="block";const i=e.querySelector("#pp-ai-camera-video"),p=e.querySelector("#pp-ai-capture-btn"),d=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(v=>{b(v),i.srcObject=v,p.disabled=!1,d.style.display="none"}).catch(v=>{d.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${w(v.message)}</span>`,p.style.display="none"}),p.onclick=()=>{const v=document.createElement("canvas"),r=Math.min(i.videoWidth,i.videoHeight);v.width=800,v.height=800;const E=v.getContext("2d"),x=Math.round(r/1.3),L=(i.videoWidth-x)/2,V=(i.videoHeight-x)/2;E.translate(800,0),E.scale(-1,1),E.drawImage(i,L,V,x,x,0,0,800,800),v.toBlob(I=>{I&&F(I,"Kamera-foto sendes til AI og slettes straks efter","camera")},"image/jpeg",.9)}}j.addEventListener("change",async()=>{const i=j.files?.[0];if(i){j.value="";try{const p=await J(i);F(p,"Uploadet billede sendes til AI og slettes straks efter","upload")}catch(p){y.style.display="block",y.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${w(p.message)}</div>`}}}),c?F(c,"Referencebillede fra bibliotek","library"):T&&fetch(T).then(i=>i.blob()).then(i=>{i&&(c=i,F(i,"Referencebillede fra bibliotek","library"))}).catch(i=>console.warn("[ai-avatar] Kunne ikke hente reference:",i)),ge(t.id,t).then(async i=>{if(!h)return;const p=new Map,d=i.filter(r=>r.storage_path&&!r.storage_path.startsWith("http")&&r.picture_type!=="library"&&r.picture_type!=="icon");if(d.length>0){const r=d.map(x=>x.storage_path),{data:E}=await R.storage.from("profile-pictures").createSignedUrls(r,3600);E&&E.forEach((x,L)=>{x.signedUrl&&p.set(d[L].id,x.signedUrl)})}const v=i.map((r,E)=>{const x=p.get(r.id)||r.storage_path;return`<div data-lib-index="${E}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${x}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.picture_type==="ai_avatar"?"AI":r.picture_type||""}</div>
            </div>`}).join("");v?h.innerHTML=v:h.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',h.querySelectorAll("[data-lib-index]").forEach(r=>{r.addEventListener("click",async()=>{const E=parseInt(r.dataset.libIndex),x=i[E];if(x){r.querySelector("img").style.borderColor="#f59e0b";try{const L=p.get(x.id)||x.storage_path,I=await(await fetch(L)).blob();h.style.display="none",F(I,"Eksisterende billede sendes til AI og slettes straks efter","library")}catch{r.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{r.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{Ue as openProfilePictureModal};
