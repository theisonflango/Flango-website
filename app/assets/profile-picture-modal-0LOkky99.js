import{e as L,g as ae,d as J,h as oe,i as le,a as ve,s as j,j as be,A as ge,k as me,l as xe,r as he,m as ke}from"./main-C3ml5Hqc.js";function _e(e){const t=!!e?.profile_pictures_ai_enabled,g=e?.ai_provider_openai!==!1,h=!!e?.ai_provider_flux;return{masterOn:t,openAI:g,flux:h,anyProvider:g||h,usable:t&&(g||h)}}async function Ue(e,t={}){const{onSaved:g,showCustomAlert:h}=t,d=window.__flangoGetInstitutionById?.(e.institution_id);if(!d)return;let x=d.profile_picture_types||["upload","camera","library"];const r=document.createElement("div");r.className="profile-pic-modal-overlay";const o=document.createElement("div");o.className="profile-pic-modal";const l=e.number?` (${e.number})`:"";o.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${L(e.name)}${l}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,r.appendChild(o),document.body.appendChild(r);const n=()=>{M(),r.remove()};o.querySelector(".profile-pic-modal-close").addEventListener("click",n),r.addEventListener("click",a=>{a.target===r&&n()});const s=o.querySelector("#pp-current-section");await we(s,e);const p=document.createElement("div");p.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",p.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const _=_e(d),U=[{label:"Upload/Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!_.usable}];for(const a of U){const E=document.createElement("span");E.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${a.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,E.textContent=`${a.optOut?"❌":"✅"} ${a.label}`,p.appendChild(E)}o.querySelector("#pp-current-section").after(p);const T=o.querySelector("#pp-type-grid"),P=[{key:"upload",icon:"📁",label:"Upload",optOutField:"profile_picture_opt_out_aula"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"}],f=o.querySelector("#pp-subview");let A=null;function M(){A&&(A.getTracks().forEach(a=>a.stop()),A=null)}let w=!1;const q=t.preSelectType||null,H=t.referenceImageUrl||null,B=(a,E)=>{const S=document.createElement("button");S.className="profile-pic-type-btn pp-type-disabled",S.title=E,S.innerHTML=`<span class="type-icon">${a.icon}</span>${a.label}<div class="pp-type-disabled-reason">${L(E)}</div>`,S.style.cssText="opacity:0.4;pointer-events:none;position:relative;",T.appendChild(S)};for(const a of P){if(a.key!=="icons"&&a.key!=="ai_avatar"&&!x.includes(a.key))continue;if(a.requiresAi){if(!_.masterOn){B(a,"Ikke aktiveret");continue}if(!_.anyProvider){B(a,"Ingen AI-udbyder valgt");continue}}const E=a.optOutField&&e[a.optOutField],S=document.createElement("button");S.className="profile-pic-type-btn"+(E?" pp-type-disabled":""),E?(S.innerHTML=`<span class="type-icon">${a.icon}</span>${a.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,S.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(S.innerHTML=`<span class="type-icon">${a.icon}</span>${a.label}`,S.addEventListener("click",()=>{M(),T.querySelectorAll(".profile-pic-type-btn").forEach(R=>R.classList.remove("active")),S.classList.add("active"),a.key,a.key==="upload"?Le(f,e,d,n,g):a.key==="camera"?Se(f,e,d,n,g,R=>{A=R}):a.key==="library"?Ae(f,e,n,g):a.key==="icons"?Ee(f,e,n,g):a.key==="ai_avatar"&&$e(f,e,d,n,g,R=>{A=R})})),T.appendChild(S),!w&&q&&a.key===q&&!E&&(w=!0,setTimeout(()=>S.click(),100))}q==="ai_avatar"&&H&&(window.__ppAiReferenceUrl=H)}async function we(e,t){if(!(t.profile_picture_url&&!t.profile_picture_opt_out)){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const h={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${L(t.name)}</strong> har: ${h}
            </div>
        </div>`;const d=await ae(t),x=e.querySelector("#pp-current-img-wrap");if(d&&x){const r=document.createElement("img");r.src=d,r.alt="",r.className="profile-pic-current-img",x.replaceWith(r)}}function Le(e,t,g,h,d){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const x=e.querySelector("#pp-upload-dropzone"),r=e.querySelector("#pp-upload-input"),o=e.querySelector("#pp-upload-preview");x.addEventListener("click",()=>r.click()),r.addEventListener("change",async l=>{const n=l.target.files?.[0];if(n){x.style.display="none",o.style.display="block",o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const s=await J(n),p=URL.createObjectURL(s);o.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${p}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,o.querySelector("#pp-upload-save").addEventListener("click",async()=>{o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const _=await oe(s,t.institution_id,t.id,"upload",t.name);URL.revokeObjectURL(p),_.success?(t.profile_picture_url=_.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),h()):o.innerHTML=`<div style="color:#f87171;text-align:center;">${L(_.error||"Upload fejlede")}</div>`}),o.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(p),o.style.display="none",x.style.display="flex",r.value=""})}catch(s){o.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${L(s.message)}</div>`}}})}function Se(e,t,g,h,d,x){e.innerHTML=`
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
        </div>`;const r=e.querySelector("#pp-camera-video"),o=e.querySelector("#pp-capture-btn"),l=e.querySelector("#pp-camera-preview"),n=e.querySelector("#pp-camera-status"),s=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(p=>{x(p),r.srcObject=p,o.disabled=!1,n.style.display="none"}).catch(p=>{n.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${L(p.message)}</span>`,o.style.display="none"}),o.addEventListener("click",async()=>{const p=document.createElement("canvas"),_=Math.min(r.videoWidth,r.videoHeight);p.width=400,p.height=400;const U=p.getContext("2d"),T=Math.round(_/1.3),P=(r.videoWidth-T)/2,f=(r.videoHeight-T)/2;U.translate(400,0),U.scale(-1,1),U.drawImage(r,P,f,T,T,0,0,400,400),p.toBlob(async A=>{if(!A)return;s.style.display="none",o.parentElement.style.display="none",l.style.display="block";const M=await J(new File([A],"camera.jpg",{type:"image/jpeg"})),w=URL.createObjectURL(M);l.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${w}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,l.querySelector("#pp-camera-save").addEventListener("click",async()=>{l.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const q=await oe(M,t.institution_id,t.id,"camera",t.name);URL.revokeObjectURL(w),q.success?(t.profile_picture_url=q.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),h()):l.innerHTML=`<div style="color:#f87171;text-align:center;">${L(q.error||"Upload fejlede")}</div>`}),l.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(w),l.style.display="none",s.style.display="block",o.parentElement.style.display="flex"})},"image/jpeg",.9)})}function Ae(e,t,g,h){let d=null;const x=ge.map((l,n)=>`
        <div class="profile-pic-library-item" data-avatar-index="${n}" data-avatar-url="${l}">
            <img src="${l}" alt="Avatar ${n+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${x}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const r=e.querySelector("#pp-library-save"),o=e.querySelectorAll(".profile-pic-library-item");o.forEach(l=>{l.addEventListener("click",()=>{o.forEach(n=>n.classList.remove("selected")),l.classList.add("selected"),d=l.dataset.avatarUrl,r.disabled=!1})}),r.addEventListener("click",async()=>{if(!d)return;r.disabled=!0,r.textContent="Gemmer...";const l=await le(t.id,d,"library",{institutionId:t.institution_id,userName:t.name});if(l.success)t.profile_picture_url=d,t.profile_picture_type="library",h&&h({profile_picture_url:d,profile_picture_type:"library"}),g();else{r.textContent="Gem",r.disabled=!1;const n=document.createElement("div");n.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",n.textContent=l.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(n)}})}async function Ee(e,t,g,h){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const d=await ve(t.institution_id);if(!d||d.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let x=null,r=null;const o=d.map((s,p)=>`
        <div class="profile-pic-library-item" data-icon-index="${p}" data-icon-url="${L(s.icon_url)}" data-icon-source="${L(s.source||"uploaded")}">
            <img src="${L(s.icon_url)}" alt="${L(s.name||"")}" loading="lazy">
            ${s.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${L(s.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${o}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const l=e.querySelector("#pp-icon-save"),n=e.querySelectorAll(".profile-pic-library-item");n.forEach(s=>{s.addEventListener("click",()=>{n.forEach(p=>p.classList.remove("selected")),s.classList.add("selected"),x=s.dataset.iconUrl,r=s.dataset.iconSource,l.disabled=!1})}),l.addEventListener("click",async()=>{if(!x)return;l.disabled=!0,l.textContent="Gemmer...";const s=r==="ai_generated"?"ai_avatar":"icon",p=await le(t.id,x,s,{institutionId:t.institution_id,userName:t.name});if(p.success)t.profile_picture_url=x,t.profile_picture_type=s,h&&h({profile_picture_url:x,profile_picture_type:s}),g();else{l.textContent="Gem",l.disabled=!1;const _=document.createElement("div");_.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",_.textContent=p.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(_)}})}const re="Icons/webp/Function/Flango-Kokkehue.webp",Q=[{key:"pixar",label:"🎬 Pixar"},{key:"clay",label:"🏺 Clay-figur"},{key:"cartoon",label:"✏️ Tegneserie"},{key:"realistic",label:"🎨 Illustration"}];async function qe(){try{const{data:{session:e}}=await j.auth.getSession();if(!e?.user?.id)return!1;const{data:t,error:g}=await j.from("users").select("advanced_ai_access").eq("user_id",e.user.id).maybeSingle();return g?(console.warn("[profile-picture-modal] advanced_ai_access fetch fejl:",g.message),!1):t?.advanced_ai_access===!0}catch(e){return console.warn("[profile-picture-modal] advanced_ai_access undtagelse:",e?.message||e),!1}}function $e(e,t,g,h,d,x){let r=Q[0],o=!1,l="",n=window.__ppAiReferenceBlob||null,s=!1,p=!1,_=!1,U=!1,T=null;const P=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;padding:10px;background:rgba(245,158,11,0.1);border-radius:8px;border:1px solid rgba(245,158,11,0.2);">
                Vælg et referencebillede. Billedet sendes til OpenAI for at generere en avatar. <strong>Billedet slettes straks efter.</strong>
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
                            Hvis du skriver noget her, sendes det som <strong>fuld custom prompt</strong> og overskriver
                            preset, hat, hero og alders-instruktion. Lad feltet være tomt for at bruge serverens preset+flags.
                        </div>
                        <textarea id="pp-ai-prompt-textarea" class="input--on-dark" placeholder="Skriv din egen AI-prompt her — overrides alt andet" style="width:100%;min-height:80px;padding:8px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
                        <button type="button" id="pp-ai-reset-prompt" style="background:none;border:none;color:#1a8a6e;font-size:11px;cursor:pointer;padding:2px 0;margin-top:4px;">↺ Ryd og brug preset+flags</button>
                    </div>
                </div>
            </div>

            <input type="file" id="pp-ai-file-input" accept="image/*" style="display:none;">
        </div>`;const f=e.querySelector("#pp-ai-preview"),A=e.querySelector("#pp-ai-options"),M=e.querySelector("#pp-ai-camera-section"),w=e.querySelector("#pp-ai-source-grid"),q=e.querySelector("#pp-ai-file-input"),H=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",pe),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>q.click());const B=e.querySelectorAll(".pp-ai-preset-btn"),a=e.querySelector("#pp-ai-prompt-textarea");B.forEach(i=>{i.addEventListener("click",()=>{const c=Q.find(y=>y.key===i.dataset.preset);c&&(r=c,B.forEach(y=>{const v=y.dataset.preset===c.key;y.style.borderColor=v?"#f59e0b":"rgba(255,255,255,0.1)",y.style.background=v?"rgba(245,158,11,0.1)":"transparent",y.style.color=v?"#f59e0b":"#94a3b8"}))})});const E=e.querySelector("#pp-ai-advanced-section"),S=e.querySelector("#pp-ai-advanced-toggle"),R=e.querySelector("#pp-ai-adv-arrow"),Y=e.querySelector("#pp-ai-prompt-section"),ne=e.querySelector("#pp-ai-reset-prompt");qe().then(i=>{_=i,E&&i&&(E.style.display="")}),S?.addEventListener("click",()=>{_&&(o=!o,R&&(R.style.transform=o?"rotate(90deg)":""),Y&&(Y.style.display=o?"block":"none"))}),a?.addEventListener("input",()=>{l=a.value}),ne?.addEventListener("click",()=>{l="",a&&(a.value="")});const Z=e.querySelector("#pp-ai-hat-checkbox"),D=e.querySelector("#pp-ai-hat-toggle");Z?.addEventListener("change",()=>{s=Z.checked,D&&(D.style.borderColor=s?"#f59e0b":"rgba(255,255,255,0.1)",D.style.background=s?"rgba(245,158,11,0.08)":"transparent")});const I=e.querySelector("#pp-ai-hero-checkbox"),$=e.querySelector("#pp-ai-hero-toggle");function V(i){if(!$)return;$.style.opacity="0.55",$.style.cursor="not-allowed",I&&(I.disabled=!0,I.checked=!1);const c=$.querySelector("div:last-child > div:last-child");c&&(c.textContent=i||"Kun for legendariske ekspedienter")}function se(){if(!$)return;$.style.opacity="",$.style.cursor="pointer",I&&(I.disabled=!1);const i=$.querySelector("div:last-child > div:last-child");i&&(i.textContent="Tilføjer superhelte-tema til avataren")}V("Tjekker hero-status …"),(async()=>{try{const{data:i,error:c}=await j.rpc("get_hero_status",{p_user_id:t.id});if(c){console.warn("[profile-picture-modal] get_hero_status fejl:",c.message),V("Kunne ikke verificere status — prøv igen");return}if(T=i||null,U=!!(i&&i.qualified),U)se();else{const y=Number(i?.sales_count??0),v=Number(i?.sales_required??500),u=Number(i?.minutes_worked??0),m=Number(i?.minutes_required??1800),b=Math.floor(u/60),k=Math.floor(m/60);V(`🔒 Kræver "legendarisk ekspedient" — pt. ${y}/${v} salg eller ${b}/${k} timer`)}}catch(i){console.warn("[profile-picture-modal] hero-status undtagelse:",i?.message||i),V("Kunne ikke verificere status — prøv igen")}})(),I?.addEventListener("change",()=>{if(I.disabled){I.checked=!1;return}p=I.checked,$&&($.style.borderColor=p?"#8b5cf6":"rgba(255,255,255,0.1)",$.style.background=p?"rgba(139,92,246,0.08)":"transparent")});function F(i,c){n=i,M.style.display="none",w.style.display="none",H&&(H.style.display="none"),f.style.display="block",A.style.display="block";const y=URL.createObjectURL(i),v=g.ai_provider_openai!==!1,u=!!g.ai_provider_flux,m=[];v&&m.push('<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-openai" style="background:linear-gradient(135deg,#10b981,#059669);flex:1;">Generer (OpenAI)</button>'),u&&m.push('<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-flux" style="background:linear-gradient(135deg,#6366f1,#4f46e5);flex:1;">Generer (FLUX)</button>');const b=()=>{URL.revokeObjectURL(y),n=null,f.style.display="none",A.style.display="none",w.style.display="flex",H&&(H.style.display="flex")};if(m.length===0){f.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${y}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">${L(c)}</div>
                    <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#f59e0b;text-align:center;">
                        Ingen AI-udbyder er aktiveret for denne institution. Kontakt admin for at aktivere OpenAI eller FLUX.
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>`,f.querySelector("#pp-ai-change-ref").addEventListener("click",b);return}f.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${y}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${L(c)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <div style="display:flex;gap:8px;width:100%;">
                        ${m.join(`
                        `)}
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,v&&f.querySelector("#pp-ai-generate-openai").addEventListener("click",()=>ee(i,y,"openai")),u&&f.querySelector("#pp-ai-generate-flux").addEventListener("click",()=>ee(i,y,"flux")),f.querySelector("#pp-ai-change-ref").addEventListener("click",b)}async function ee(i,c,y="openai"){const v=y==="flux"?"FLUX":"OpenAI",u=y==="flux"?"10-30 sek":"5-15 sek";f.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via ${v}... (${u})</div>
        </div>`;try{const{data:{session:m}}=await j.auth.getSession(),b=m?.access_token;if(!b)throw new Error("Ikke logget ind");if(p&&!U){f.innerHTML=`<div style="padding:14px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;">
                    Hero-stilen kræver enten admin-rolle eller status "legendarisk ekspedient" (500 salg eller 30 timer).
                </div>`;return}const k=new FormData;k.append("target_user_id",t.id),k.append("user_id",t.id),k.append("photo",new File([i],"photo.jpg",{type:"image/jpeg"})),k.append("ai_style",r.key),k.append("ai_provider",y),k.append("hat_enabled",s?"true":"false"),k.append("hero_enabled",p?"true":"false");const K=(l||"").trim();if(K&&_&&k.append("custom_prompt",K),s)try{const ye=await(await fetch(re)).blob();k.append("hat_image",new File([ye],"hat.png",{type:"image/png"}))}catch(z){console.warn("Could not load hat image:",z)}const C=await(await fetch(`${me}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${b}`},body:k})).json();if(!C.success)throw new Error(C.error||"Generering fejlede");if(!C.image_base64)throw new Error("Avatar mangler i svaret");const ce=C.format==="png"?"image/png":"image/webp",N=atob(C.image_base64),te=new Uint8Array(N.length);for(let z=0;z<N.length;z++)te[z]=N.charCodeAt(z);const de=new Blob([te],{type:ce}),fe=await xe(de),O=`${t.institution_id}/${t.id}_${Date.now()}.webp`,{error:W}=await j.storage.from("profile-pictures").upload(O,fe,{contentType:"image/webp",cacheControl:"31536000"});if(W)throw new Error("Kunne ikke gemme avatar: "+(W.message||W));const{data:X,error:ie}=await he("save_ai_avatar_metadata",()=>j.rpc("save_ai_avatar_metadata",{p_user_id:t.id,p_storage_path:O,p_ai_style:C.ai_style||r.key,p_ai_prompt:C.prompt||""}));if(ie||X&&X.success===!1){try{await j.storage.from("profile-pictures").remove([O])}catch{}throw new Error(ie?.message||X?.error||"Kunne ikke gemme avatar-metadata")}ke(t.id);const ue=await ae({id:t.id,profile_picture_url:O,profile_picture_type:"ai_avatar"});c&&URL.revokeObjectURL(c),f.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${ue||""}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,f.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=O,t.profile_picture_type="ai_avatar",d&&d({profile_picture_url:O,profile_picture_type:"ai_avatar"}),h()}),f.querySelector("#pp-ai-retry").addEventListener("click",()=>{f.style.display="none",A.style.display="none",w.style.display="flex"}),f.querySelector("#pp-ai-cancel").addEventListener("click",h)}catch(m){c&&URL.revokeObjectURL(c),f.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${L(m.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,f.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{f.style.display="none",A.style.display="none",w.style.display="flex"})}}function pe(){w.style.display="none",H&&(H.style.display="none"),M.style.display="block";const i=e.querySelector("#pp-ai-camera-video"),c=e.querySelector("#pp-ai-capture-btn"),y=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(v=>{x(v),i.srcObject=v,c.disabled=!1,y.style.display="none"}).catch(v=>{y.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${L(v.message)}</span>`,c.style.display="none"}),c.onclick=()=>{const v=document.createElement("canvas"),u=Math.min(i.videoWidth,i.videoHeight);v.width=800,v.height=800;const m=v.getContext("2d"),b=Math.round(u/1.3),k=(i.videoWidth-b)/2,K=(i.videoHeight-b)/2;m.translate(800,0),m.scale(-1,1),m.drawImage(i,k,K,b,b,0,0,800,800),v.toBlob(G=>{G&&F(G,"Kamera-foto sendes til AI og slettes straks efter")},"image/jpeg",.9)}}q.addEventListener("change",async()=>{const i=q.files?.[0];if(i){q.value="";try{const c=await J(i);F(c,"Uploadet billede sendes til AI og slettes straks efter")}catch(c){f.style.display="block",f.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${L(c.message)}</div>`}}}),n?F(n,"Referencebillede fra bibliotek"):P&&fetch(P).then(i=>i.blob()).then(i=>{i&&(n=i,F(i,"Referencebillede fra bibliotek"))}).catch(i=>console.warn("[ai-avatar] Kunne ikke hente reference:",i)),be(t.id,t).then(async i=>{if(!w)return;const c=new Map,y=i.filter(u=>u.storage_path&&!u.storage_path.startsWith("http")&&u.picture_type!=="library"&&u.picture_type!=="icon");if(y.length>0){const u=y.map(b=>b.storage_path),{data:m}=await j.storage.from("profile-pictures").createSignedUrls(u,3600);m&&m.forEach((b,k)=>{b.signedUrl&&c.set(y[k].id,b.signedUrl)})}const v=i.map((u,m)=>{const b=c.get(u.id)||u.storage_path;return`<div data-lib-index="${m}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${b}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.picture_type==="ai_avatar"?"AI":u.picture_type||""}</div>
            </div>`}).join("");v?w.innerHTML=v:w.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',w.querySelectorAll("[data-lib-index]").forEach(u=>{u.addEventListener("click",async()=>{const m=parseInt(u.dataset.libIndex),b=i[m];if(b){u.querySelector("img").style.borderColor="#f59e0b";try{const k=c.get(b.id)||b.storage_path,G=await(await fetch(k)).blob();w.style.display="none",F(G,"Eksisterende billede sendes til AI og slettes straks efter")}catch{u.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{u.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{Ue as openProfilePictureModal};
