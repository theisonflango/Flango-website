import{e as x,g as te,d as Q,h as ie,j as re,a as fe,s as j,k as ue,A as ye,l as ve,m as be,r as ge,n as me}from"./main-mWUEk7Ab.js";function he(e){const t=!!e?.profile_pictures_ai_enabled;return{masterOn:t,usable:t&&e?.ai_provider_openai!==!1}}async function qe(e,t={}){const{onSaved:m,showCustomAlert:L}=t,f=window.__flangoGetInstitutionById?.(e.institution_id);if(!f)return;let b=f.profile_picture_types||["upload","camera","library"];const r=document.createElement("div");r.className="profile-pic-modal-overlay";const a=document.createElement("div");a.className="profile-pic-modal";const l=e.number?` (${e.number})`:"";a.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${x(e.name)}${l}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,r.appendChild(a),document.body.appendChild(r);const s=()=>{z(),r.remove()};a.querySelector(".profile-pic-modal-close").addEventListener("click",s),r.addEventListener("click",o=>{o.target===r&&s()});const p=a.querySelector("#pp-current-section");await xe(p,e);const c=document.createElement("div");c.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",c.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const k=he(f),U=[{label:"Upload/Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!k.usable}];for(const o of U){const A=document.createElement("span");A.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${o.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,A.textContent=`${o.optOut?"❌":"✅"} ${o.label}`,c.appendChild(A)}a.querySelector("#pp-current-section").after(c);const $=a.querySelector("#pp-type-grid"),P=[{key:"upload",icon:"📁",label:"Upload",optOutField:"profile_picture_opt_out_aula"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"}],u=a.querySelector("#pp-subview");let E=null;function z(){E&&(E.getTracks().forEach(o=>o.stop()),E=null)}let h=!1;const q=t.preSelectType||null,H=t.referenceImageUrl||null,K=(o,A)=>{const _=document.createElement("button");_.className="profile-pic-type-btn pp-type-disabled",_.title=A,_.innerHTML=`<span class="type-icon">${o.icon}</span>${o.label}<div class="pp-type-disabled-reason">${x(A)}</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;",$.appendChild(_)};for(const o of P){if(o.key!=="icons"&&o.key!=="ai_avatar"&&!b.includes(o.key))continue;if(o.requiresAi&&!k.usable){K(o,"Ikke aktiveret");continue}const A=o.optOutField&&e[o.optOutField],_=document.createElement("button");_.className="profile-pic-type-btn"+(A?" pp-type-disabled":""),A?(_.innerHTML=`<span class="type-icon">${o.icon}</span>${o.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(_.innerHTML=`<span class="type-icon">${o.icon}</span>${o.label}`,_.addEventListener("click",()=>{z(),$.querySelectorAll(".profile-pic-type-btn").forEach(R=>R.classList.remove("active")),_.classList.add("active"),o.key,o.key==="upload"?ke(u,e,f,s,m):o.key==="camera"?_e(u,e,f,s,m,R=>{E=R}):o.key==="library"?we(u,e,s,m):o.key==="icons"?Le(u,e,s,m):o.key==="ai_avatar"&&Ee(u,e,f,s,m,R=>{E=R})})),$.appendChild(_),!h&&q&&o.key===q&&!A&&(h=!0,setTimeout(()=>_.click(),100))}q==="ai_avatar"&&H&&(window.__ppAiReferenceUrl=H)}async function xe(e,t){if(!(t.profile_picture_url&&!t.profile_picture_opt_out)){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const L={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${x(t.name)}</strong> har: ${L}
            </div>
        </div>`;const f=await te(t),b=e.querySelector("#pp-current-img-wrap");if(f&&b){const r=document.createElement("img");r.src=f,r.alt="",r.className="profile-pic-current-img",b.replaceWith(r)}}function ke(e,t,m,L,f){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const b=e.querySelector("#pp-upload-dropzone"),r=e.querySelector("#pp-upload-input"),a=e.querySelector("#pp-upload-preview");b.addEventListener("click",()=>r.click()),r.addEventListener("change",async l=>{const s=l.target.files?.[0];if(s){b.style.display="none",a.style.display="block",a.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const p=await Q(s),c=URL.createObjectURL(p);a.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${c}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,a.querySelector("#pp-upload-save").addEventListener("click",async()=>{a.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const k=await ie(p,t.institution_id,t.id,"upload",t.name);URL.revokeObjectURL(c),k.success?(t.profile_picture_url=k.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",f&&f({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),L()):a.innerHTML=`<div style="color:#f87171;text-align:center;">${x(k.error||"Upload fejlede")}</div>`}),a.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(c),a.style.display="none",b.style.display="flex",r.value=""})}catch(p){a.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${x(p.message)}</div>`}}})}function _e(e,t,m,L,f,b){e.innerHTML=`
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
        </div>`;const r=e.querySelector("#pp-camera-video"),a=e.querySelector("#pp-capture-btn"),l=e.querySelector("#pp-camera-preview"),s=e.querySelector("#pp-camera-status"),p=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(c=>{b(c),r.srcObject=c,a.disabled=!1,s.style.display="none"}).catch(c=>{s.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${x(c.message)}</span>`,a.style.display="none"}),a.addEventListener("click",async()=>{const c=document.createElement("canvas"),k=Math.min(r.videoWidth,r.videoHeight);c.width=400,c.height=400;const U=c.getContext("2d"),$=Math.round(k/1.3),P=(r.videoWidth-$)/2,u=(r.videoHeight-$)/2;U.translate(400,0),U.scale(-1,1),U.drawImage(r,P,u,$,$,0,0,400,400),c.toBlob(async E=>{if(!E)return;p.style.display="none",a.parentElement.style.display="none",l.style.display="block";const z=await Q(new File([E],"camera.jpg",{type:"image/jpeg"})),h=URL.createObjectURL(z);l.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${h}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,l.querySelector("#pp-camera-save").addEventListener("click",async()=>{l.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const q=await ie(z,t.institution_id,t.id,"camera",t.name);URL.revokeObjectURL(h),q.success?(t.profile_picture_url=q.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",f&&f({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),L()):l.innerHTML=`<div style="color:#f87171;text-align:center;">${x(q.error||"Upload fejlede")}</div>`}),l.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(h),l.style.display="none",p.style.display="block",a.parentElement.style.display="flex"})},"image/jpeg",.9)})}function we(e,t,m,L){let f=null;const b=ye.map((l,s)=>`
        <div class="profile-pic-library-item" data-avatar-index="${s}" data-avatar-url="${l}">
            <img src="${l}" alt="Avatar ${s+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${b}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const r=e.querySelector("#pp-library-save"),a=e.querySelectorAll(".profile-pic-library-item");a.forEach(l=>{l.addEventListener("click",()=>{a.forEach(s=>s.classList.remove("selected")),l.classList.add("selected"),f=l.dataset.avatarUrl,r.disabled=!1})}),r.addEventListener("click",async()=>{if(!f)return;r.disabled=!0,r.textContent="Gemmer...";const l=await re(t.id,f,"library",{institutionId:t.institution_id,userName:t.name});if(l.success)t.profile_picture_url=f,t.profile_picture_type="library",L&&L({profile_picture_url:f,profile_picture_type:"library"}),m();else{r.textContent="Gem",r.disabled=!1;const s=document.createElement("div");s.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",s.textContent=l.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(s)}})}async function Le(e,t,m,L){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const f=await fe(t.institution_id);if(!f||f.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let b=null,r=null;const a=f.map((p,c)=>`
        <div class="profile-pic-library-item" data-icon-index="${c}" data-icon-url="${x(p.icon_url)}" data-icon-source="${x(p.source||"uploaded")}">
            <img src="${x(p.icon_url)}" alt="${x(p.name||"")}" loading="lazy">
            ${p.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${x(p.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${a}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const l=e.querySelector("#pp-icon-save"),s=e.querySelectorAll(".profile-pic-library-item");s.forEach(p=>{p.addEventListener("click",()=>{s.forEach(c=>c.classList.remove("selected")),p.classList.add("selected"),b=p.dataset.iconUrl,r=p.dataset.iconSource,l.disabled=!1})}),l.addEventListener("click",async()=>{if(!b)return;l.disabled=!0,l.textContent="Gemmer...";const p=r==="ai_generated"?"ai_avatar":"icon",c=await re(t.id,b,p,{institutionId:t.institution_id,userName:t.name});if(c.success)t.profile_picture_url=b,t.profile_picture_type=p,L&&L({profile_picture_url:b,profile_picture_type:p}),m();else{l.textContent="Gem",l.disabled=!1;const k=document.createElement("div");k.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",k.textContent=c.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(k)}})}const ee="Icons/webp/Function/Flango-Kokkehue.webp",W=[{key:"pixar",label:"🎬 Pixar"},{key:"clay",label:"🏺 Clay-figur"},{key:"cartoon",label:"✏️ Tegneserie"},{key:"realistic",label:"🎨 Illustration"}];async function Se(){try{const{data:{session:e}}=await j.auth.getSession();if(!e?.user?.id)return!1;const{data:t,error:m}=await j.from("users").select("advanced_ai_access").eq("user_id",e.user.id).maybeSingle();return m?(console.warn("[profile-picture-modal] advanced_ai_access fetch fejl:",m.message),!1):t?.advanced_ai_access===!0}catch(e){return console.warn("[profile-picture-modal] advanced_ai_access undtagelse:",e?.message||e),!1}}function Ee(e,t,m,L,f,b){let r=W[0],a=!1,l="",s=window.__ppAiReferenceBlob||null,p=!1,c=!1,k=!1,U=!1,$=null;const P=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
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
                        ${W.map(i=>`
                            <button type="button" class="pp-ai-preset-btn" data-preset="${i.key}" style="padding:6px 12px;border:2px solid ${i.key===r.key?"#f59e0b":"rgba(255,255,255,0.1)"};background:${i.key===r.key?"rgba(245,158,11,0.1)":"transparent"};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${i.key===r.key?"#f59e0b":"#94a3b8"};transition:all 0.15s;">${i.label}</button>
                        `).join("")}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label id="pp-ai-hat-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;">
                        <input type="checkbox" id="pp-ai-hat-checkbox" style="width:16px;height:16px;accent-color:#f59e0b;">
                        <img src="${ee}" alt="" style="width:28px;height:28px;object-fit:contain;">
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
                            Hvis du skriver noget her, sendes det som <strong>fuld custom prompt</strong> og overskriver
                            preset, hat, hero og alders-instruktion. Lad feltet være tomt for at bruge serverens preset+flags.
                        </div>
                        <textarea id="pp-ai-prompt-textarea" class="input--on-dark" placeholder="Skriv din egen AI-prompt her — overrides alt andet" style="width:100%;min-height:80px;padding:8px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
                        <button type="button" id="pp-ai-reset-prompt" style="background:none;border:none;color:#1a8a6e;font-size:11px;cursor:pointer;padding:2px 0;margin-top:4px;">↺ Ryd og brug preset+flags</button>
                    </div>
                </div>
            </div>

            <input type="file" id="pp-ai-file-input" accept="image/*" style="display:none;">
        </div>`;const u=e.querySelector("#pp-ai-preview"),E=e.querySelector("#pp-ai-options"),z=e.querySelector("#pp-ai-camera-section"),h=e.querySelector("#pp-ai-source-grid"),q=e.querySelector("#pp-ai-file-input"),H=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",ne),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>q.click());const K=e.querySelectorAll(".pp-ai-preset-btn"),o=e.querySelector("#pp-ai-prompt-textarea");K.forEach(i=>{i.addEventListener("click",()=>{const d=W.find(y=>y.key===i.dataset.preset);d&&(r=d,K.forEach(y=>{const v=y.dataset.preset===d.key;y.style.borderColor=v?"#f59e0b":"rgba(255,255,255,0.1)",y.style.background=v?"rgba(245,158,11,0.1)":"transparent",y.style.color=v?"#f59e0b":"#94a3b8"}))})});const A=e.querySelector("#pp-ai-advanced-section"),_=e.querySelector("#pp-ai-advanced-toggle"),R=e.querySelector("#pp-ai-adv-arrow"),J=e.querySelector("#pp-ai-prompt-section"),ae=e.querySelector("#pp-ai-reset-prompt");Se().then(i=>{k=i,A&&i&&(A.style.display="")}),_?.addEventListener("click",()=>{k&&(a=!a,R&&(R.style.transform=a?"rotate(90deg)":""),J&&(J.style.display=a?"block":"none"))}),o?.addEventListener("input",()=>{l=o.value}),ae?.addEventListener("click",()=>{l="",o&&(o.value="")});const X=e.querySelector("#pp-ai-hat-checkbox"),V=e.querySelector("#pp-ai-hat-toggle");X?.addEventListener("change",()=>{p=X.checked,V&&(V.style.borderColor=p?"#f59e0b":"rgba(255,255,255,0.1)",V.style.background=p?"rgba(245,158,11,0.08)":"transparent")});const M=e.querySelector("#pp-ai-hero-checkbox"),T=e.querySelector("#pp-ai-hero-toggle");function F(i){if(!T)return;T.style.opacity="0.55",T.style.cursor="not-allowed",M&&(M.disabled=!0,M.checked=!1);const d=T.querySelector("div:last-child > div:last-child");d&&(d.textContent=i||"Kun for legendariske ekspedienter")}function oe(){if(!T)return;T.style.opacity="",T.style.cursor="pointer",M&&(M.disabled=!1);const i=T.querySelector("div:last-child > div:last-child");i&&(i.textContent="Tilføjer superhelte-tema til avataren")}F("Tjekker hero-status …"),(async()=>{try{const{data:i,error:d}=await j.rpc("get_hero_status",{p_user_id:t.id});if(d){console.warn("[profile-picture-modal] get_hero_status fejl:",d.message),F("Kunne ikke verificere status — prøv igen");return}if($=i||null,U=!!(i&&i.qualified),U)oe();else{const y=Number(i?.sales_count??0),v=Number(i?.sales_required??500),n=Number(i?.minutes_worked??0),S=Number(i?.minutes_required??1800),g=Math.floor(n/60),w=Math.floor(S/60);F(`🔒 Kræver "legendarisk ekspedient" — pt. ${y}/${v} salg eller ${g}/${w} timer`)}}catch(i){console.warn("[profile-picture-modal] hero-status undtagelse:",i?.message||i),F("Kunne ikke verificere status — prøv igen")}})(),M?.addEventListener("change",()=>{if(M.disabled){M.checked=!1;return}c=M.checked,T&&(T.style.borderColor=c?"#8b5cf6":"rgba(255,255,255,0.1)",T.style.background=c?"rgba(139,92,246,0.08)":"transparent")});function B(i,d){s=i,z.style.display="none",h.style.display="none",H&&(H.style.display="none"),u.style.display="block",E.style.display="block";const y=URL.createObjectURL(i),v=()=>{URL.revokeObjectURL(y),s=null,u.style.display="none",E.style.display="none",h.style.display="flex",H&&(H.style.display="flex")};if(m.profile_pictures_ai_enabled!==!0){u.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${y}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">${x(d)}</div>
                    <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#f59e0b;text-align:center;">
                        AI-avatar er ikke aktiveret for denne institution.
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>`,u.querySelector("#pp-ai-change-ref").addEventListener("click",v);return}u.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${y}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${x(d)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate" style="background:linear-gradient(135deg,#10b981,#059669);width:100%;">Generér avatar</button>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,u.querySelector("#pp-ai-generate").addEventListener("click",()=>le(i,y)),u.querySelector("#pp-ai-change-ref").addEventListener("click",v)}async function le(i,d){u.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via Microsoft Azure (EU)... (5-15 sek)</div>
        </div>`;try{const{data:{session:y}}=await j.auth.getSession(),v=y?.access_token;if(!v)throw new Error("Ikke logget ind");if(c&&!U){u.innerHTML=`<div style="padding:14px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;">
                    Hero-stilen kræver enten admin-rolle eller status "legendarisk ekspedient" (500 salg eller 30 timer).
                </div>`;return}const n=new FormData;n.append("target_user_id",t.id),n.append("user_id",t.id),n.append("photo",new File([i],"photo.jpg",{type:"image/jpeg"})),n.append("ai_style",r.key),n.append("ai_provider","openai"),n.append("hat_enabled",p?"true":"false"),n.append("hero_enabled",c?"true":"false");const S=(l||"").trim();if(S&&k&&n.append("custom_prompt",S),p)try{const de=await(await fetch(ee)).blob();n.append("hat_image",new File([de],"hat.png",{type:"image/png"}))}catch(C){console.warn("Could not load hat image:",C)}const w=await(await fetch(`${ve}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${v}`},body:n})).json();if(!w.success)throw new Error(w.error||"Generering fejlede");if(!w.image_base64)throw new Error("Avatar mangler i svaret");const G=w.format==="png"?"image/png":"image/webp",I=atob(w.image_base64),Y=new Uint8Array(I.length);for(let C=0;C<I.length;C++)Y[C]=I.charCodeAt(C);const se=new Blob([Y],{type:G}),pe=await be(se),O=`${t.institution_id}/${t.id}_${Date.now()}.webp`,{error:D}=await j.storage.from("profile-pictures").upload(O,pe,{contentType:"image/webp",cacheControl:"31536000"});if(D)throw new Error("Kunne ikke gemme avatar: "+(D.message||D));const{data:N,error:Z}=await ge("save_ai_avatar_metadata",()=>j.rpc("save_ai_avatar_metadata",{p_user_id:t.id,p_storage_path:O,p_ai_style:w.ai_style||r.key,p_ai_prompt:w.prompt||""}));if(Z||N&&N.success===!1){try{await j.storage.from("profile-pictures").remove([O])}catch{}throw new Error(Z?.message||N?.error||"Kunne ikke gemme avatar-metadata")}me(t.id);const ce=await te({id:t.id,profile_picture_url:O,profile_picture_type:"ai_avatar"});d&&URL.revokeObjectURL(d),u.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${ce||""}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,u.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=O,t.profile_picture_type="ai_avatar",f&&f({profile_picture_url:O,profile_picture_type:"ai_avatar"}),L()}),u.querySelector("#pp-ai-retry").addEventListener("click",()=>{u.style.display="none",E.style.display="none",h.style.display="flex"}),u.querySelector("#pp-ai-cancel").addEventListener("click",L)}catch(y){d&&URL.revokeObjectURL(d),u.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${x(y.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,u.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{u.style.display="none",E.style.display="none",h.style.display="flex"})}}function ne(){h.style.display="none",H&&(H.style.display="none"),z.style.display="block";const i=e.querySelector("#pp-ai-camera-video"),d=e.querySelector("#pp-ai-capture-btn"),y=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(v=>{b(v),i.srcObject=v,d.disabled=!1,y.style.display="none"}).catch(v=>{y.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${x(v.message)}</span>`,d.style.display="none"}),d.onclick=()=>{const v=document.createElement("canvas"),n=Math.min(i.videoWidth,i.videoHeight);v.width=800,v.height=800;const S=v.getContext("2d"),g=Math.round(n/1.3),w=(i.videoWidth-g)/2,G=(i.videoHeight-g)/2;S.translate(800,0),S.scale(-1,1),S.drawImage(i,w,G,g,g,0,0,800,800),v.toBlob(I=>{I&&B(I,"Kamera-foto sendes til AI og slettes straks efter")},"image/jpeg",.9)}}q.addEventListener("change",async()=>{const i=q.files?.[0];if(i){q.value="";try{const d=await Q(i);B(d,"Uploadet billede sendes til AI og slettes straks efter")}catch(d){u.style.display="block",u.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${x(d.message)}</div>`}}}),s?B(s,"Referencebillede fra bibliotek"):P&&fetch(P).then(i=>i.blob()).then(i=>{i&&(s=i,B(i,"Referencebillede fra bibliotek"))}).catch(i=>console.warn("[ai-avatar] Kunne ikke hente reference:",i)),ue(t.id,t).then(async i=>{if(!h)return;const d=new Map,y=i.filter(n=>n.storage_path&&!n.storage_path.startsWith("http")&&n.picture_type!=="library"&&n.picture_type!=="icon");if(y.length>0){const n=y.map(g=>g.storage_path),{data:S}=await j.storage.from("profile-pictures").createSignedUrls(n,3600);S&&S.forEach((g,w)=>{g.signedUrl&&d.set(y[w].id,g.signedUrl)})}const v=i.map((n,S)=>{const g=d.get(n.id)||n.storage_path;return`<div data-lib-index="${S}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${g}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.picture_type==="ai_avatar"?"AI":n.picture_type||""}</div>
            </div>`}).join("");v?h.innerHTML=v:h.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',h.querySelectorAll("[data-lib-index]").forEach(n=>{n.addEventListener("click",async()=>{const S=parseInt(n.dataset.libIndex),g=i[S];if(g){n.querySelector("img").style.borderColor="#f59e0b";try{const w=d.get(g.id)||g.storage_path,I=await(await fetch(w)).blob();h.style.display="none",B(I,"Eksisterende billede sendes til AI og slettes straks efter")}catch{n.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{n.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{qe as openProfilePictureModal};
