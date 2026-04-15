import{g as oe,c as K,d as ee,s as te,a as le,e as ne,A as pe,i as se}from"./main-CUi4xrCa.js";import{e as w,s as Y,S as ce}from"./kitchen-sound-ypT-jTxO.js";async function we(e,t={}){const{onSaved:_,showCustomAlert:L}=t,d=window.__flangoGetInstitutionById?.(e.institution_id);if(!d)return;let v=d.profile_picture_types||["upload","camera","library"];const i=document.createElement("div");i.className="profile-pic-modal-overlay";const o=document.createElement("div");o.className="profile-pic-modal";const a=e.number?` (${e.number})`:"";o.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${w(e.name)}${a}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,i.appendChild(o),document.body.appendChild(i);const l=()=>{I(),i.remove()};o.querySelector(".profile-pic-modal-close").addEventListener("click",l),i.addEventListener("click",s=>{s.target===i&&l()});const n=o.querySelector("#pp-current-section");await de(n,e);const p=document.createElement("div");p.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",p.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const h=[{label:"Upload/Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!d.profile_pictures_ai_enabled}];for(const s of h){const x=document.createElement("span");x.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${s.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,x.textContent=`${s.optOut?"❌":"✅"} ${s.label}`,p.appendChild(x)}o.querySelector("#pp-current-section").after(p);const A=o.querySelector("#pp-type-grid"),U=[{key:"upload",icon:"📁",label:"Upload",optOutField:"profile_picture_opt_out_aula"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"}],u=o.querySelector("#pp-subview");let $=null;function I(){$&&($.getTracks().forEach(s=>s.stop()),$=null)}let k=!1;const E=t.preSelectType||null,T=t.referenceImageUrl||null;for(const s of U){if(s.key!=="icons"&&s.key!=="ai_avatar"&&!v.includes(s.key))continue;if(s.requiresAi&&!d.profile_pictures_ai_enabled){const S=document.createElement("button");S.className="profile-pic-type-btn pp-type-disabled",S.innerHTML=`<span class="type-icon">${s.icon}</span>${s.label}<div class="pp-type-disabled-reason">Ikke aktiveret</div>`,S.style.cssText="opacity:0.4;pointer-events:none;position:relative;",A.appendChild(S);continue}const x=s.optOutField&&e[s.optOutField],q=document.createElement("button");q.className="profile-pic-type-btn"+(x?" pp-type-disabled":""),x?(q.innerHTML=`<span class="type-icon">${s.icon}</span>${s.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,q.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(q.innerHTML=`<span class="type-icon">${s.icon}</span>${s.label}`,q.addEventListener("click",()=>{I(),A.querySelectorAll(".profile-pic-type-btn").forEach(S=>S.classList.remove("active")),q.classList.add("active"),s.key,s.key==="upload"?fe(u,e,d,l,_):s.key==="camera"?ue(u,e,d,l,_,S=>{$=S}):s.key==="library"?ye(u,e,l,_):s.key==="icons"?be(u,e,l,_):s.key==="ai_avatar"&&me(u,e,d,l,_,S=>{$=S})})),A.appendChild(q),!k&&E&&s.key===E&&!x&&(k=!0,setTimeout(()=>q.click(),100))}E==="ai_avatar"&&T&&(window.__ppAiReferenceUrl=T)}async function de(e,t){if(!(t.profile_picture_url&&!t.profile_picture_opt_out)){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const L={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${w(t.name)}</strong> har: ${L}
            </div>
        </div>`;const d=await oe(t),v=e.querySelector("#pp-current-img-wrap");if(d&&v){const i=document.createElement("img");i.src=d,i.alt="",i.className="profile-pic-current-img",v.replaceWith(i)}}function fe(e,t,_,L,d){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const v=e.querySelector("#pp-upload-dropzone"),i=e.querySelector("#pp-upload-input"),o=e.querySelector("#pp-upload-preview");v.addEventListener("click",()=>i.click()),i.addEventListener("change",async a=>{const l=a.target.files?.[0];if(l){v.style.display="none",o.style.display="block",o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const n=await K(l),p=URL.createObjectURL(n);o.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${p}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,o.querySelector("#pp-upload-save").addEventListener("click",async()=>{o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const h=await ee(n,t.institution_id,t.id,"upload",t.name);URL.revokeObjectURL(p),h.success?(t.profile_picture_url=h.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),L()):o.innerHTML=`<div style="color:#f87171;text-align:center;">${w(h.error||"Upload fejlede")}</div>`}),o.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(p),o.style.display="none",v.style.display="flex",i.value=""})}catch(n){o.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${w(n.message)}</div>`}}})}function ue(e,t,_,L,d,v){e.innerHTML=`
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
        </div>`;const i=e.querySelector("#pp-camera-video"),o=e.querySelector("#pp-capture-btn"),a=e.querySelector("#pp-camera-preview"),l=e.querySelector("#pp-camera-status"),n=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(p=>{v(p),i.srcObject=p,o.disabled=!1,l.style.display="none"}).catch(p=>{l.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${w(p.message)}</span>`,o.style.display="none"}),o.addEventListener("click",async()=>{const p=document.createElement("canvas"),h=Math.min(i.videoWidth,i.videoHeight);p.width=400,p.height=400;const A=p.getContext("2d"),U=Math.round(h/1.3),u=(i.videoWidth-U)/2,$=(i.videoHeight-U)/2;A.translate(400,0),A.scale(-1,1),A.drawImage(i,u,$,U,U,0,0,400,400),p.toBlob(async I=>{if(!I)return;n.style.display="none",o.parentElement.style.display="none",a.style.display="block";const k=await K(new File([I],"camera.jpg",{type:"image/jpeg"})),E=URL.createObjectURL(k);a.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${E}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,a.querySelector("#pp-camera-save").addEventListener("click",async()=>{a.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const T=await ee(k,t.institution_id,t.id,"camera",t.name);URL.revokeObjectURL(E),T.success?(t.profile_picture_url=T.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),L()):a.innerHTML=`<div style="color:#f87171;text-align:center;">${w(T.error||"Upload fejlede")}</div>`}),a.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(E),a.style.display="none",n.style.display="block",o.parentElement.style.display="flex"})},"image/jpeg",.9)})}function ye(e,t,_,L){let d=null;const v=pe.map((a,l)=>`
        <div class="profile-pic-library-item" data-avatar-index="${l}" data-avatar-url="${a}">
            <img src="${a}" alt="Avatar ${l+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${v}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const i=e.querySelector("#pp-library-save"),o=e.querySelectorAll(".profile-pic-library-item");o.forEach(a=>{a.addEventListener("click",()=>{o.forEach(l=>l.classList.remove("selected")),a.classList.add("selected"),d=a.dataset.avatarUrl,i.disabled=!1})}),i.addEventListener("click",async()=>{if(!d)return;i.disabled=!0,i.textContent="Gemmer...";const a=await te(t.id,d,"library",{institutionId:t.institution_id,userName:t.name});if(a.success)t.profile_picture_url=d,t.profile_picture_type="library",L&&L({profile_picture_url:d,profile_picture_type:"library"}),_();else{i.textContent="Gem",i.disabled=!1;const l=document.createElement("div");l.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",l.textContent=a.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(l)}})}async function be(e,t,_,L){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const d=await le(t.institution_id);if(!d||d.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let v=null,i=null;const o=d.map((n,p)=>`
        <div class="profile-pic-library-item" data-icon-index="${p}" data-icon-url="${w(n.icon_url)}" data-icon-source="${w(n.source||"uploaded")}">
            <img src="${w(n.icon_url)}" alt="${w(n.name||"")}" loading="lazy">
            ${n.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${w(n.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${o}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const a=e.querySelector("#pp-icon-save"),l=e.querySelectorAll(".profile-pic-library-item");l.forEach(n=>{n.addEventListener("click",()=>{l.forEach(p=>p.classList.remove("selected")),n.classList.add("selected"),v=n.dataset.iconUrl,i=n.dataset.iconSource,a.disabled=!1})}),a.addEventListener("click",async()=>{if(!v)return;a.disabled=!0,a.textContent="Gemmer...";const n=i==="ai_generated"?"ai_avatar":"icon",p=await te(t.id,v,n,{institutionId:t.institution_id,userName:t.name});if(p.success)t.profile_picture_url=v,t.profile_picture_type=n,L&&L({profile_picture_url:v,profile_picture_type:n}),_();else{a.textContent="Gem",a.disabled=!1;const h=document.createElement("div");h.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",h.textContent=p.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(h)}})}const z="Plain warm beige background (#F5EDE0), smooth and uniform with no gradients or patterns.",ve="IMPORTANT: The person MUST be wearing a tall white classic chef's toque (traditional puffed chef hat, tall and cylindrical with pleats). The hat has a thin headband with a small orange fruit logo (an orange/tangerine). The chef hat must be prominent, clearly visible on top of the head, and take up significant space in the image. Do NOT skip the hat.",Z="Icons/webp/Function/Flango-Kokkehue.webp",ge="The person is depicted as a superhero. They wear a vibrant superhero cape and suit with the Flango orange fruit logo on the chest. Heroic confident pose, dynamic lighting with subtle glow effects. The costume colors should complement the person's features. Keep the face highly recognizable.",M="CRITICAL: Preserve the exact age of the person — this is a child. Do NOT age them up or make them look older. Keep youthful proportions: rounder face, larger eyes relative to face, softer features. The result must look like a child, not a teenager or adult.",V=[{key:"pixar",label:"🎬 Pixar",prompt:`Create a Pixar-style 3D animated portrait based on the person in the photo. Closely match their actual facial structure, face shape, nose, jawline, hair color, hair style, eye color, eye shape, eyebrows, and skin tone. The character should be clearly recognizable as the same person. ${M} Use soft studio lighting, subtle subsurface scattering on skin. Head-and-shoulders framing. ${z}`,fluxPrompt:`Transform into a Pixar-style 3D animated character. Match features closely. ${M} Soft studio lighting. ${z}`},{key:"clay",label:"🏺 Clay-figur",prompt:`Create a 3D clay-animated portrait based on the person in the photo. Closely match their actual facial structure, face shape, hair color, hair style, eye color, skin tone, and expression. Rounded puffy shapes, smooth matte clay texture with visible soft material quality. The figurine should be clearly recognizable as the same person. ${M} Head-and-shoulders framing. ${z}`,fluxPrompt:`Transform into a 3D clay figurine. Rounded puffy shapes, smooth matte clay texture. Match features closely. ${M} ${z}`},{key:"cartoon",label:"✏️ Tegneserie",prompt:`Create a cartoon-style portrait based on the person in the photo. Closely match their actual face shape, hair color, hair style, eye color, skin tone, and distinguishing features. Use clean outlines, vibrant but natural colors. The character should be clearly recognizable as the same person, not a generic cartoon. ${M} Head-and-shoulders framing. ${z}`,fluxPrompt:`Transform into a cartoon character. Clean outlines, vibrant colors. Match features closely, not a generic cartoon. ${M} ${z}`},{key:"realistic",label:"🎨 Illustration",prompt:`Create a semi-realistic digital illustration portrait based on the person in the photo. Closely match their actual facial proportions, face shape, hair color, hair style, eye color, skin tone, and expression. Soft painterly brush strokes, warm lighting, slightly stylized but highly recognizable. ${M} Head-and-shoulders framing. ${z}`,fluxPrompt:`Transform into a semi-realistic digital illustration. Soft painterly style, warm lighting. Match features closely. ${M} ${z}`}];function me(e,t,_,L,d,v){let i=V[0],o=!1,a=i.prompt,l=i.fluxPrompt||"",n="openai",p=window.__ppAiReferenceBlob||null,h=!1,A=!1;const U=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
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
                        ${V.map(r=>`
                            <button type="button" class="pp-ai-preset-btn" data-preset="${r.key}" style="padding:6px 12px;border:2px solid ${r.key===i.key?"#f59e0b":"rgba(255,255,255,0.1)"};background:${r.key===i.key?"rgba(245,158,11,0.1)":"transparent"};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${r.key===i.key?"#f59e0b":"#94a3b8"};transition:all 0.15s;">${r.label}</button>
                        `).join("")}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label id="pp-ai-hat-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;">
                        <input type="checkbox" id="pp-ai-hat-checkbox" style="width:16px;height:16px;accent-color:#f59e0b;">
                        <img src="${Z}" alt="" style="width:28px;height:28px;object-fit:contain;">
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

                <div id="pp-ai-advanced-section">
                    <button type="button" id="pp-ai-advanced-toggle" style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:4px 0;">
                        <span id="pp-ai-adv-arrow" style="display:inline-block;transition:transform 0.2s;">▶</span> Avanceret — redigér prompt
                    </button>
                    <div id="pp-ai-prompt-section" style="display:none;margin-top:8px;">
                        <div style="display:flex;gap:4px;margin-bottom:6px;">
                            <button type="button" class="pp-ai-provider-tab" data-provider="openai" style="flex:1;padding:5px 8px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.1);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#10b981;">OpenAI</button>
                            <button type="button" class="pp-ai-provider-tab" data-provider="flux" style="flex:1;padding:5px 8px;border:1px solid rgba(255,255,255,0.1);background:transparent;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#94a3b8;">FLUX</button>
                        </div>
                        <textarea id="pp-ai-prompt-textarea" style="width:100%;min-height:80px;padding:8px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;background:rgba(255,255,255,0.04);color:inherit;">${w(i.prompt)}</textarea>
                        <button type="button" id="pp-ai-reset-prompt" style="background:none;border:none;color:#1a8a6e;font-size:11px;cursor:pointer;padding:2px 0;margin-top:4px;">↺ Nulstil til preset</button>
                    </div>
                </div>
            </div>

            <input type="file" id="pp-ai-file-input" accept="image/*" style="display:none;">
        </div>`;const u=e.querySelector("#pp-ai-preview"),$=e.querySelector("#pp-ai-options"),I=e.querySelector("#pp-ai-camera-section"),k=e.querySelector("#pp-ai-source-grid"),E=e.querySelector("#pp-ai-file-input"),T=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",re),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>E.click());const s=e.querySelectorAll(".pp-ai-preset-btn"),x=e.querySelector("#pp-ai-prompt-textarea");s.forEach(r=>{r.addEventListener("click",()=>{const c=V.find(f=>f.key===r.dataset.preset);c&&(i=c,a=c.prompt,l=c.fluxPrompt||"",j=!1,x&&(x.value=n==="flux"?l:a),s.forEach(f=>{const y=f.dataset.preset===c.key;f.style.borderColor=y?"#f59e0b":"rgba(255,255,255,0.1)",f.style.background=y?"rgba(245,158,11,0.1)":"transparent",f.style.color=y?"#f59e0b":"#94a3b8"}))})});const q=e.querySelector("#pp-ai-advanced-toggle"),S=e.querySelector("#pp-ai-adv-arrow"),D=e.querySelector("#pp-ai-prompt-section"),ie=e.querySelector("#pp-ai-reset-prompt");q?.addEventListener("click",()=>{o=!o,S&&(S.style.transform=o?"rotate(90deg)":""),D&&(D.style.display=o?"block":"none")});let j=!1;x?.addEventListener("input",()=>{n==="flux"?l=x.value:a=x.value,j=!0}),ie?.addEventListener("click",()=>{a=i.prompt,l=i.fluxPrompt||"",j=!1,x&&(x.value=n==="flux"?l:a)});const N=e.querySelectorAll(".pp-ai-provider-tab");N.forEach(r=>{r.addEventListener("click",()=>{n=r.dataset.provider,N.forEach(c=>{const f=c.dataset.provider===n,y=c.dataset.provider==="flux"?"#6366f1":"#10b981";c.style.borderColor=f?`${y}66`:"rgba(255,255,255,0.1)",c.style.background=f?`${y}1a`:"transparent",c.style.color=f?y:"#94a3b8"}),x&&(x.value=n==="flux"?l:a)})});const W=e.querySelector("#pp-ai-hat-checkbox"),B=e.querySelector("#pp-ai-hat-toggle");W?.addEventListener("change",()=>{h=W.checked,B&&(B.style.borderColor=h?"#f59e0b":"rgba(255,255,255,0.1)",B.style.background=h?"rgba(245,158,11,0.08)":"transparent")});const X=e.querySelector("#pp-ai-hero-checkbox"),F=e.querySelector("#pp-ai-hero-toggle");X?.addEventListener("change",()=>{A=X.checked,F&&(F.style.borderColor=A?"#8b5cf6":"rgba(255,255,255,0.1)",F.style.background=A?"rgba(139,92,246,0.08)":"transparent")});function C(r,c){p=r,I.style.display="none",k.style.display="none",T&&(T.style.display="none"),u.style.display="block",$.style.display="block";const f=URL.createObjectURL(r),y=_.ai_provider_openai!==!1,b=!!_.ai_provider_flux,g=[];y&&g.push('<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-openai" style="background:linear-gradient(135deg,#10b981,#059669);flex:1;">Generer (OpenAI)</button>'),b&&g.push('<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-flux" style="background:linear-gradient(135deg,#6366f1,#4f46e5);flex:1;">Generer (FLUX)</button>'),u.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${f}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${w(c)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <div style="display:flex;gap:8px;width:100%;">
                        ${g.join(`
                        `)}
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,y&&u.querySelector("#pp-ai-generate-openai").addEventListener("click",()=>J(r,f,"openai")),b&&u.querySelector("#pp-ai-generate-flux").addEventListener("click",()=>J(r,f,"flux")),u.querySelector("#pp-ai-change-ref").addEventListener("click",()=>{URL.revokeObjectURL(f),p=null,u.style.display="none",$.style.display="none",k.style.display="flex",T&&(T.style.display="flex")})}async function J(r,c,f="openai"){const y=f==="flux"?"FLUX":"OpenAI",b=f==="flux"?"10-30 sek":"5-15 sek";u.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via ${y}... (${b})</div>
        </div>`;try{const{data:{session:g}}=await Y.auth.getSession(),m=g?.access_token;if(!m)throw new Error("Ikke logget ind");const R=g?.user?.id;let P=f==="flux"?l||i.fluxPrompt||"":a||"";h&&(P+=`
`+ve),A&&(P+=`
`+ge);const H=new FormData;if(H.append("user_id",t.id),H.append("user_name",t.name||""),H.append("photo",new File([r],"photo.jpg",{type:"image/jpeg"})),P&&H.append("custom_prompt",P),H.append("ai_style",i.key),H.append("ai_provider",f),j&&H.append("prompt_edited","true"),h)try{const ae=await(await fetch(Z)).blob();H.append("hat_image",new File([ae],"hat.png",{type:"image/png"}))}catch(Q){console.warn("Could not load hat image:",Q)}const O=await(await fetch(`${ce}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${m}`,"x-admin-user-id":R},body:H})).json();if(c&&URL.revokeObjectURL(c),!O.success)throw new Error(O.error||"Generering fejlede");u.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${O.url}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,u.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=O.storage_path,t.profile_picture_type="ai_avatar",se(t.id),d&&d({profile_picture_url:O.storage_path,profile_picture_type:"ai_avatar"}),L()}),u.querySelector("#pp-ai-retry").addEventListener("click",()=>{u.style.display="none",$.style.display="none",k.style.display="flex"}),u.querySelector("#pp-ai-cancel").addEventListener("click",L)}catch(g){c&&URL.revokeObjectURL(c),u.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${w(g.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,u.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{u.style.display="none",$.style.display="none",k.style.display="flex"})}}function re(){k.style.display="none",T&&(T.style.display="none"),I.style.display="block";const r=e.querySelector("#pp-ai-camera-video"),c=e.querySelector("#pp-ai-capture-btn"),f=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(y=>{v(y),r.srcObject=y,c.disabled=!1,f.style.display="none"}).catch(y=>{f.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${w(y.message)}</span>`,c.style.display="none"}),c.onclick=()=>{const y=document.createElement("canvas"),b=Math.min(r.videoWidth,r.videoHeight);y.width=800,y.height=800;const g=y.getContext("2d"),m=Math.round(b/1.3),R=(r.videoWidth-m)/2,G=(r.videoHeight-m)/2;g.translate(800,0),g.scale(-1,1),g.drawImage(r,R,G,m,m,0,0,800,800),y.toBlob(P=>{P&&C(P,"Kamera-foto sendes til AI og slettes straks efter")},"image/jpeg",.9)}}E.addEventListener("change",async()=>{const r=E.files?.[0];if(r){E.value="";try{const c=await K(r);C(c,"Uploadet billede sendes til AI og slettes straks efter")}catch(c){u.style.display="block",u.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${w(c.message)}</div>`}}}),p?C(p,"Referencebillede fra bibliotek"):U&&fetch(U).then(r=>r.blob()).then(r=>{r&&(p=r,C(r,"Referencebillede fra bibliotek"))}).catch(r=>console.warn("[ai-avatar] Kunne ikke hente reference:",r)),ne(t.id,t).then(async r=>{if(!k)return;const c=new Map,f=r.filter(b=>b.storage_path&&!b.storage_path.startsWith("http")&&b.picture_type!=="library"&&b.picture_type!=="icon");if(f.length>0){const b=f.map(m=>m.storage_path),{data:g}=await Y.storage.from("profile-pictures").createSignedUrls(b,3600);g&&g.forEach((m,R)=>{m.signedUrl&&c.set(f[R].id,m.signedUrl)})}const y=r.map((b,g)=>{const m=c.get(b.id)||b.storage_path;return`<div data-lib-index="${g}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${m}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.picture_type==="ai_avatar"?"AI":b.picture_type||""}</div>
            </div>`}).join("");y?k.innerHTML=y:k.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',k.querySelectorAll("[data-lib-index]").forEach(b=>{b.addEventListener("click",async()=>{const g=parseInt(b.dataset.libIndex),m=r[g];if(m){b.querySelector("img").style.borderColor="#f59e0b";try{const R=c.get(m.id)||m.storage_path,P=await(await fetch(R)).blob();k.style.display="none",C(P,"Eksisterende billede sendes til AI og slettes straks efter")}catch{b.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{b.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{we as openProfilePictureModal};
