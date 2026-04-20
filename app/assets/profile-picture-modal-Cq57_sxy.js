import{e as w,g as le,d as Y,h as ne,i as pe,a as be,j as ve,s as K,A as ge,k as me,l as he,r as xe,m as ke}from"./main-CCGPfOwX.js";function we(e){const t=!!e?.profile_pictures_ai_enabled,m=e?.ai_provider_openai!==!1,h=!!e?.ai_provider_flux;return{masterOn:t,openAI:m,flux:h,anyProvider:m||h,usable:t&&(m||h)}}async function Ie(e,t={}){const{onSaved:m,showCustomAlert:h}=t,d=window.__flangoGetInstitutionById?.(e.institution_id);if(!d)return;let g=d.profile_picture_types||["upload","camera","library"];const i=document.createElement("div");i.className="profile-pic-modal-overlay";const o=document.createElement("div");o.className="profile-pic-modal";const a=e.number?` (${e.number})`:"";o.innerHTML=`
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${w(e.name)}${a}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `,i.appendChild(o),document.body.appendChild(i);const l=()=>{L(),i.remove()};o.querySelector(".profile-pic-modal-close").addEventListener("click",l),i.addEventListener("click",p=>{p.target===i&&l()});const n=o.querySelector("#pp-current-section");await _e(n,e);const s=document.createElement("div");s.style.cssText="padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;",s.innerHTML='<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>';const x=we(d),I=[{label:"Upload/Aula",optOut:e.profile_picture_opt_out_aula},{label:"Kamera",optOut:e.profile_picture_opt_out_camera},{label:"AI-Avatar",optOut:e.profile_picture_opt_out_ai||!x.usable}];for(const p of I){const S=document.createElement("span");S.style.cssText=`padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${p.optOut?"background:rgba(239,68,68,0.15);color:#ef4444;":"background:rgba(34,197,94,0.15);color:#22c55e;"}`,S.textContent=`${p.optOut?"❌":"✅"} ${p.label}`,s.appendChild(S)}o.querySelector("#pp-current-section").after(s);const q=o.querySelector("#pp-type-grid"),b=[{key:"upload",icon:"📁",label:"Upload",optOutField:"profile_picture_opt_out_aula"},{key:"camera",icon:"📷",label:"Kamera",optOutField:"profile_picture_opt_out_camera"},{key:"library",icon:"🎨",label:"Bibliotek"},{key:"icons",icon:"🖼️",label:"Ikoner"},{key:"ai_avatar",icon:"🤖",label:"AI-Avatar",requiresAi:!0,optOutField:"profile_picture_opt_out_ai"}],$=o.querySelector("#pp-subview");let U=null;function L(){U&&(U.getTracks().forEach(p=>p.stop()),U=null)}let P=!1;const A=t.preSelectType||null,F=t.referenceImageUrl||null,E=(p,S)=>{const _=document.createElement("button");_.className="profile-pic-type-btn pp-type-disabled",_.title=S,_.innerHTML=`<span class="type-icon">${p.icon}</span>${p.label}<div class="pp-type-disabled-reason">${w(S)}</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;",q.appendChild(_)};for(const p of b){if(p.key!=="icons"&&p.key!=="ai_avatar"&&!g.includes(p.key))continue;if(p.requiresAi){if(!x.masterOn){E(p,"Ikke aktiveret");continue}if(!x.anyProvider){E(p,"Ingen AI-udbyder valgt");continue}}const S=p.optOutField&&e[p.optOutField],_=document.createElement("button");_.className="profile-pic-type-btn"+(S?" pp-type-disabled":""),S?(_.innerHTML=`<span class="type-icon">${p.icon}</span>${p.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`,_.style.cssText="opacity:0.4;pointer-events:none;position:relative;"):(_.innerHTML=`<span class="type-icon">${p.icon}</span>${p.label}`,_.addEventListener("click",()=>{L(),q.querySelectorAll(".profile-pic-type-btn").forEach(M=>M.classList.remove("active")),_.classList.add("active"),p.key,p.key==="upload"?Le($,e,d,l,m):p.key==="camera"?Ae($,e,d,l,m,M=>{U=M}):p.key==="library"?Te($,e,l,m):p.key==="icons"?Se($,e,l,m):p.key==="ai_avatar"&&qe($,e,d,l,m,M=>{U=M})})),q.appendChild(_),!P&&A&&p.key===A&&!S&&(P=!0,setTimeout(()=>_.click(),100))}A==="ai_avatar"&&F&&(window.__ppAiReferenceUrl=F)}async function _e(e,t){if(!(t.profile_picture_url&&!t.profile_picture_opt_out)){e.innerHTML=`
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;return}const h={upload:"Uploadet billede",camera:"Kamera-foto",library:"Avatar fra bibliotek",icon:"Ikon fra bibliotek",ai_avatar:"AI-Avatar"}[t.profile_picture_type]||"";e.innerHTML=`
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${w(t.name)}</strong> har: ${h}
            </div>
        </div>`;const d=await le(t),g=e.querySelector("#pp-current-img-wrap");if(d&&g){const i=document.createElement("img");i.src=d,i.alt="",i.className="profile-pic-current-img",g.replaceWith(i)}}function Le(e,t,m,h,d){e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;const g=e.querySelector("#pp-upload-dropzone"),i=e.querySelector("#pp-upload-input"),o=e.querySelector("#pp-upload-preview");g.addEventListener("click",()=>i.click()),i.addEventListener("change",async a=>{const l=a.target.files?.[0];if(l){g.style.display="none",o.style.display="block",o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>';try{const n=await Y(l),s=URL.createObjectURL(n);o.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${s}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`,o.querySelector("#pp-upload-save").addEventListener("click",async()=>{o.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const x=await ne(n,t.institution_id,t.id,"upload",t.name);URL.revokeObjectURL(s),x.success?(t.profile_picture_url=x.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="upload",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"upload"}),h()):o.innerHTML=`<div style="color:#f87171;text-align:center;">${w(x.error||"Upload fejlede")}</div>`}),o.querySelector("#pp-upload-retry").addEventListener("click",()=>{URL.revokeObjectURL(s),o.style.display="none",g.style.display="flex",i.value=""})}catch(n){o.innerHTML=`<div style="color:#f87171;text-align:center;">Fejl: ${w(n.message)}</div>`}}})}function Ae(e,t,m,h,d,g){e.innerHTML=`
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
        </div>`;const i=e.querySelector("#pp-camera-video"),o=e.querySelector("#pp-capture-btn"),a=e.querySelector("#pp-camera-preview"),l=e.querySelector("#pp-camera-status"),n=e.querySelector("#pp-camera-wrap");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(s=>{g(s),i.srcObject=s,o.disabled=!1,l.style.display="none"}).catch(s=>{l.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${w(s.message)}</span>`,o.style.display="none"}),o.addEventListener("click",async()=>{const s=document.createElement("canvas"),x=Math.min(i.videoWidth,i.videoHeight);s.width=400,s.height=400;const I=s.getContext("2d"),q=Math.round(x/1.3),b=(i.videoWidth-q)/2,$=(i.videoHeight-q)/2;I.translate(400,0),I.scale(-1,1),I.drawImage(i,b,$,q,q,0,0,400,400),s.toBlob(async U=>{if(!U)return;n.style.display="none",o.parentElement.style.display="none",a.style.display="block";const L=await Y(new File([U],"camera.jpg",{type:"image/jpeg"})),P=URL.createObjectURL(L);a.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${P}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`,a.querySelector("#pp-camera-save").addEventListener("click",async()=>{a.innerHTML='<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>';const A=await ne(L,t.institution_id,t.id,"camera",t.name);URL.revokeObjectURL(P),A.success?(t.profile_picture_url=A.storagePath||`${t.institution_id}/${t.id}.webp`,t.profile_picture_type="camera",d&&d({profile_picture_url:t.profile_picture_url,profile_picture_type:"camera"}),h()):a.innerHTML=`<div style="color:#f87171;text-align:center;">${w(A.error||"Upload fejlede")}</div>`}),a.querySelector("#pp-camera-retry").addEventListener("click",()=>{URL.revokeObjectURL(P),a.style.display="none",n.style.display="block",o.parentElement.style.display="flex"})},"image/jpeg",.9)})}function Te(e,t,m,h){let d=null;const g=ge.map((a,l)=>`
        <div class="profile-pic-library-item" data-avatar-index="${l}" data-avatar-url="${a}">
            <img src="${a}" alt="Avatar ${l+1}" loading="lazy">
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${g}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;const i=e.querySelector("#pp-library-save"),o=e.querySelectorAll(".profile-pic-library-item");o.forEach(a=>{a.addEventListener("click",()=>{o.forEach(l=>l.classList.remove("selected")),a.classList.add("selected"),d=a.dataset.avatarUrl,i.disabled=!1})}),i.addEventListener("click",async()=>{if(!d)return;i.disabled=!0,i.textContent="Gemmer...";const a=await pe(t.id,d,"library",{institutionId:t.institution_id,userName:t.name});if(a.success)t.profile_picture_url=d,t.profile_picture_type="library",h&&h({profile_picture_url:d,profile_picture_type:"library"}),m();else{i.textContent="Gem",i.disabled=!1;const l=document.createElement("div");l.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",l.textContent=a.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(l)}})}async function Se(e,t,m,h){e.innerHTML=`
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;const d=await be(t.institution_id);if(!d||d.length===0){e.innerHTML=`
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;return}let g=null,i=null;const o=d.map((n,s)=>`
        <div class="profile-pic-library-item" data-icon-index="${s}" data-icon-url="${w(n.icon_url)}" data-icon-source="${w(n.source||"uploaded")}">
            <img src="${w(n.icon_url)}" alt="${w(n.name||"")}" loading="lazy">
            ${n.name?`<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${w(n.name)}</div>`:""}
        </div>
    `).join("");e.innerHTML=`
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${o}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;const a=e.querySelector("#pp-icon-save"),l=e.querySelectorAll(".profile-pic-library-item");l.forEach(n=>{n.addEventListener("click",()=>{l.forEach(s=>s.classList.remove("selected")),n.classList.add("selected"),g=n.dataset.iconUrl,i=n.dataset.iconSource,a.disabled=!1})}),a.addEventListener("click",async()=>{if(!g)return;a.disabled=!0,a.textContent="Gemmer...";const n=i==="ai_generated"?"ai_avatar":"icon",s=await pe(t.id,g,n,{institutionId:t.institution_id,userName:t.name});if(s.success)t.profile_picture_url=g,t.profile_picture_type=n,h&&h({profile_picture_url:g,profile_picture_type:n}),m();else{a.textContent="Gem",a.disabled=!1;const x=document.createElement("div");x.style.cssText="color:#f87171;text-align:center;margin-top:8px;font-size:12px;",x.textContent=s.error||"Kunne ikke gemme",e.querySelector(".profile-pic-subview").appendChild(x)}})}const R="Plain warm beige background (#F5EDE0), smooth and uniform with no gradients or patterns.",$e="IMPORTANT: The person MUST be wearing a tall white classic chef's toque (traditional puffed chef hat, tall and cylindrical with pleats). The hat has a thin headband with a small orange fruit logo (an orange/tangerine). The chef hat must be prominent, clearly visible on top of the head, and take up significant space in the image. Do NOT skip the hat.",oe="Icons/webp/Function/Flango-Kokkehue.webp",Ee="The person is depicted as a superhero. They wear a vibrant superhero cape and suit with the Flango orange fruit logo on the chest. Heroic confident pose, dynamic lighting with subtle glow effects. The costume colors should complement the person's features. Keep the face highly recognizable.",z="CRITICAL: Preserve the exact age of the person — this is a child. Do NOT age them up or make them look older. Keep youthful proportions: rounder face, larger eyes relative to face, softer features. The result must look like a child, not a teenager or adult.",Q=[{key:"pixar",label:"🎬 Pixar",prompt:`Create a Pixar-style 3D animated portrait based on the person in the photo. Closely match their actual facial structure, face shape, nose, jawline, hair color, hair style, eye color, eye shape, eyebrows, and skin tone. The character should be clearly recognizable as the same person. ${z} Use soft studio lighting, subtle subsurface scattering on skin. Head-and-shoulders framing. ${R}`,fluxPrompt:`Transform into a Pixar-style 3D animated character. Match features closely. ${z} Soft studio lighting. ${R}`},{key:"clay",label:"🏺 Clay-figur",prompt:`Create a 3D clay-animated portrait based on the person in the photo. Closely match their actual facial structure, face shape, hair color, hair style, eye color, skin tone, and expression. Rounded puffy shapes, smooth matte clay texture with visible soft material quality. The figurine should be clearly recognizable as the same person. ${z} Head-and-shoulders framing. ${R}`,fluxPrompt:`Transform into a 3D clay figurine. Rounded puffy shapes, smooth matte clay texture. Match features closely. ${z} ${R}`},{key:"cartoon",label:"✏️ Tegneserie",prompt:`Create a cartoon-style portrait based on the person in the photo. Closely match their actual face shape, hair color, hair style, eye color, skin tone, and distinguishing features. Use clean outlines, vibrant but natural colors. The character should be clearly recognizable as the same person, not a generic cartoon. ${z} Head-and-shoulders framing. ${R}`,fluxPrompt:`Transform into a cartoon character. Clean outlines, vibrant colors. Match features closely, not a generic cartoon. ${z} ${R}`},{key:"realistic",label:"🎨 Illustration",prompt:`Create a semi-realistic digital illustration portrait based on the person in the photo. Closely match their actual facial proportions, face shape, hair color, hair style, eye color, skin tone, and expression. Soft painterly brush strokes, warm lighting, slightly stylized but highly recognizable. ${z} Head-and-shoulders framing. ${R}`,fluxPrompt:`Transform into a semi-realistic digital illustration. Soft painterly style, warm lighting. Match features closely. ${z} ${R}`}];function qe(e,t,m,h,d,g){let i=Q[0],o=!1,a=i.prompt,l=i.fluxPrompt||"",n="openai",s=window.__ppAiReferenceBlob||null,x=!1,I=!1;const q=window.__ppAiReferenceUrl||null;delete window.__ppAiReferenceBlob,delete window.__ppAiReferenceUrl,e.innerHTML=`
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
                        ${Q.map(r=>`
                            <button type="button" class="pp-ai-preset-btn" data-preset="${r.key}" style="padding:6px 12px;border:2px solid ${r.key===i.key?"#f59e0b":"rgba(255,255,255,0.1)"};background:${r.key===i.key?"rgba(245,158,11,0.1)":"transparent"};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${r.key===i.key?"#f59e0b":"#94a3b8"};transition:all 0.15s;">${r.label}</button>
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

                <div id="pp-ai-advanced-section">
                    <button type="button" id="pp-ai-advanced-toggle" style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:4px 0;">
                        <span id="pp-ai-adv-arrow" style="display:inline-block;transition:transform 0.2s;">▶</span> Avanceret — redigér prompt
                    </button>
                    <div id="pp-ai-prompt-section" style="display:none;margin-top:8px;">
                        <div style="display:flex;gap:4px;margin-bottom:6px;">
                            <button type="button" class="pp-ai-provider-tab" data-provider="openai" style="flex:1;padding:5px 8px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.1);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#10b981;">OpenAI</button>
                            <button type="button" class="pp-ai-provider-tab" data-provider="flux" style="flex:1;padding:5px 8px;border:1px solid rgba(255,255,255,0.1);background:transparent;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#94a3b8;">FLUX</button>
                        </div>
                        <textarea id="pp-ai-prompt-textarea" class="input--on-dark" style="width:100%;min-height:80px;padding:8px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;">${w(i.prompt)}</textarea>
                        <button type="button" id="pp-ai-reset-prompt" style="background:none;border:none;color:#1a8a6e;font-size:11px;cursor:pointer;padding:2px 0;margin-top:4px;">↺ Nulstil til preset</button>
                    </div>
                </div>
            </div>

            <input type="file" id="pp-ai-file-input" accept="image/*" style="display:none;">
        </div>`;const b=e.querySelector("#pp-ai-preview"),$=e.querySelector("#pp-ai-options"),U=e.querySelector("#pp-ai-camera-section"),L=e.querySelector("#pp-ai-source-grid"),P=e.querySelector("#pp-ai-file-input"),A=e.querySelector("#pp-ai-methods");e.querySelector("#pp-ai-method-camera")?.addEventListener("click",se),e.querySelector("#pp-ai-method-upload")?.addEventListener("click",()=>P.click());const F=e.querySelectorAll(".pp-ai-preset-btn"),E=e.querySelector("#pp-ai-prompt-textarea");F.forEach(r=>{r.addEventListener("click",()=>{const c=Q.find(f=>f.key===r.dataset.preset);c&&(i=c,a=c.prompt,l=c.fluxPrompt||"",V=!1,E&&(E.value=n==="flux"?l:a),F.forEach(f=>{const u=f.dataset.preset===c.key;f.style.borderColor=u?"#f59e0b":"rgba(255,255,255,0.1)",f.style.background=u?"rgba(245,158,11,0.1)":"transparent",f.style.color=u?"#f59e0b":"#94a3b8"}))})});const p=e.querySelector("#pp-ai-advanced-toggle"),S=e.querySelector("#pp-ai-adv-arrow"),_=e.querySelector("#pp-ai-prompt-section"),M=e.querySelector("#pp-ai-reset-prompt");p?.addEventListener("click",()=>{o=!o,S&&(S.style.transform=o?"rotate(90deg)":""),_&&(_.style.display=o?"block":"none")});let V=!1;E?.addEventListener("input",()=>{n==="flux"?l=E.value:a=E.value,V=!0}),M?.addEventListener("click",()=>{a=i.prompt,l=i.fluxPrompt||"",V=!1,E&&(E.value=n==="flux"?l:a)});const Z=e.querySelectorAll(".pp-ai-provider-tab");Z.forEach(r=>{r.addEventListener("click",()=>{n=r.dataset.provider,Z.forEach(c=>{const f=c.dataset.provider===n,u=c.dataset.provider==="flux"?"#6366f1":"#10b981";c.style.borderColor=f?`${u}66`:"rgba(255,255,255,0.1)",c.style.background=f?`${u}1a`:"transparent",c.style.color=f?u:"#94a3b8"}),E&&(E.value=n==="flux"?l:a)})});const ee=e.querySelector("#pp-ai-hat-checkbox"),D=e.querySelector("#pp-ai-hat-toggle");ee?.addEventListener("change",()=>{x=ee.checked,D&&(D.style.borderColor=x?"#f59e0b":"rgba(255,255,255,0.1)",D.style.background=x?"rgba(245,158,11,0.08)":"transparent")});const te=e.querySelector("#pp-ai-hero-checkbox"),N=e.querySelector("#pp-ai-hero-toggle");te?.addEventListener("change",()=>{I=te.checked,N&&(N.style.borderColor=I?"#8b5cf6":"rgba(255,255,255,0.1)",N.style.background=I?"rgba(139,92,246,0.08)":"transparent")});function G(r,c){s=r,U.style.display="none",L.style.display="none",A&&(A.style.display="none"),b.style.display="block",$.style.display="block";const f=URL.createObjectURL(r),u=m.ai_provider_openai!==!1,y=!!m.ai_provider_flux,k=[];u&&k.push('<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-openai" style="background:linear-gradient(135deg,#10b981,#059669);flex:1;">Generer (OpenAI)</button>'),y&&k.push('<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-flux" style="background:linear-gradient(135deg,#6366f1,#4f46e5);flex:1;">Generer (FLUX)</button>');const v=()=>{URL.revokeObjectURL(f),s=null,b.style.display="none",$.style.display="none",L.style.display="flex",A&&(A.style.display="flex")};if(k.length===0){b.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${f}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">${w(c)}</div>
                    <div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);font-size:12px;color:#f59e0b;text-align:center;">
                        Ingen AI-udbyder er aktiveret for denne institution. Kontakt admin for at aktivere OpenAI eller FLUX.
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>`,b.querySelector("#pp-ai-change-ref").addEventListener("click",v);return}b.innerHTML=`
            <div class="profile-pic-preview-container">
                <img src="${f}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${w(c)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <div style="display:flex;gap:8px;width:100%;">
                        ${k.join(`
                        `)}
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`,u&&b.querySelector("#pp-ai-generate-openai").addEventListener("click",()=>ie(r,f,"openai")),y&&b.querySelector("#pp-ai-generate-flux").addEventListener("click",()=>ie(r,f,"flux")),b.querySelector("#pp-ai-change-ref").addEventListener("click",v)}async function ie(r,c,f="openai"){const u=f==="flux"?"FLUX":"OpenAI",y=f==="flux"?"10-30 sek":"5-15 sek";b.innerHTML=`<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via ${u}... (${y})</div>
        </div>`;try{const{data:{session:k}}=await K.auth.getSession(),v=k?.access_token;if(!v)throw new Error("Ikke logget ind");let O=f==="flux"?l||i.fluxPrompt||"":a||"";x&&(O+=`
`+$e),I&&(O+=`
`+Ee);const T=new FormData;if(T.append("user_id",t.id),T.append("user_name",t.name||""),T.append("photo",new File([r],"photo.jpg",{type:"image/jpeg"})),O&&T.append("custom_prompt",O),T.append("ai_style",i.key),T.append("ai_provider",f),V&&T.append("prompt_edited","true"),x)try{const ye=await(await fetch(oe)).blob();T.append("hat_image",new File([ye],"hat.png",{type:"image/png"}))}catch(H){console.warn("Could not load hat image:",H)}const j=await(await fetch(`${me}/functions/v1/generate-profile-avatar`,{method:"POST",headers:{Authorization:`Bearer ${v}`},body:T})).json();if(!j.success)throw new Error(j.error||"Generering fejlede");if(!j.image_base64)throw new Error("Avatar mangler i svaret");const ce=j.format==="png"?"image/png":"image/webp",W=atob(j.image_base64),re=new Uint8Array(W.length);for(let H=0;H<W.length;H++)re[H]=W.charCodeAt(H);const de=new Blob([re],{type:ce}),fe=await he(de),B=`${t.institution_id}/${t.id}_${Date.now()}.webp`,{error:X}=await K.storage.from("profile-pictures").upload(B,fe,{contentType:"image/webp",cacheControl:"31536000"});if(X)throw new Error("Kunne ikke gemme avatar: "+(X.message||X));const{data:J,error:ae}=await xe("save_ai_avatar_metadata",()=>K.rpc("save_ai_avatar_metadata",{p_user_id:t.id,p_storage_path:B,p_ai_style:j.ai_style||i.key,p_ai_prompt:j.prompt||""}));if(ae||J&&J.success===!1){try{await K.storage.from("profile-pictures").remove([B])}catch{}throw new Error(ae?.message||J?.error||"Kunne ikke gemme avatar-metadata")}ke(t.id);const ue=await le({id:t.id,profile_picture_url:B,profile_picture_type:"ai_avatar"});c&&URL.revokeObjectURL(c),b.innerHTML=`
                <div class="profile-pic-preview-container">
                    <img src="${ue||""}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`,b.querySelector("#pp-ai-save").addEventListener("click",()=>{t.profile_picture_url=B,t.profile_picture_type="ai_avatar",d&&d({profile_picture_url:B,profile_picture_type:"ai_avatar"}),h()}),b.querySelector("#pp-ai-retry").addEventListener("click",()=>{b.style.display="none",$.style.display="none",L.style.display="flex"}),b.querySelector("#pp-ai-cancel").addEventListener("click",h)}catch(k){c&&URL.revokeObjectURL(c),b.innerHTML=`
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${w(k.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`,b.querySelector("#pp-ai-retry-err")?.addEventListener("click",()=>{b.style.display="none",$.style.display="none",L.style.display="flex"})}}function se(){L.style.display="none",A&&(A.style.display="none"),U.style.display="block";const r=e.querySelector("#pp-ai-camera-video"),c=e.querySelector("#pp-ai-capture-btn"),f=e.querySelector("#pp-ai-cam-status");navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:800},height:{ideal:800}}}).then(u=>{g(u),r.srcObject=u,c.disabled=!1,f.style.display="none"}).catch(u=>{f.innerHTML=`<span style="color:#f87171;">Kunne ikke starte kamera: ${w(u.message)}</span>`,c.style.display="none"}),c.onclick=()=>{const u=document.createElement("canvas"),y=Math.min(r.videoWidth,r.videoHeight);u.width=800,u.height=800;const k=u.getContext("2d"),v=Math.round(y/1.3),C=(r.videoWidth-v)/2,O=(r.videoHeight-v)/2;k.translate(800,0),k.scale(-1,1),k.drawImage(r,C,O,v,v,0,0,800,800),u.toBlob(T=>{T&&G(T,"Kamera-foto sendes til AI og slettes straks efter")},"image/jpeg",.9)}}P.addEventListener("change",async()=>{const r=P.files?.[0];if(r){P.value="";try{const c=await Y(r);G(c,"Uploadet billede sendes til AI og slettes straks efter")}catch(c){b.style.display="block",b.innerHTML=`<div style="color:#f87171;text-align:center;padding:12px;">${w(c.message)}</div>`}}}),s?G(s,"Referencebillede fra bibliotek"):q&&fetch(q).then(r=>r.blob()).then(r=>{r&&(s=r,G(r,"Referencebillede fra bibliotek"))}).catch(r=>console.warn("[ai-avatar] Kunne ikke hente reference:",r)),ve(t.id,t).then(async r=>{if(!L)return;const c=new Map,f=r.filter(y=>y.storage_path&&!y.storage_path.startsWith("http")&&y.picture_type!=="library"&&y.picture_type!=="icon");if(f.length>0){const y=f.map(v=>v.storage_path),{data:k}=await K.storage.from("profile-pictures").createSignedUrls(y,3600);k&&k.forEach((v,C)=>{v.signedUrl&&c.set(f[C].id,v.signedUrl)})}const u=r.map((y,k)=>{const v=c.get(y.id)||y.storage_path;return`<div data-lib-index="${k}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${v}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${y.picture_type==="ai_avatar"?"AI":y.picture_type||""}</div>
            </div>`}).join("");u?L.innerHTML=u:L.innerHTML='<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>',L.querySelectorAll("[data-lib-index]").forEach(y=>{y.addEventListener("click",async()=>{const k=parseInt(y.dataset.libIndex),v=r[k];if(v){y.querySelector("img").style.borderColor="#f59e0b";try{const C=c.get(v.id)||v.storage_path,T=await(await fetch(C)).blob();L.style.display="none",G(T,"Eksisterende billede sendes til AI og slettes straks efter")}catch{y.querySelector("img").style.borderColor="#f87171",setTimeout(()=>{y.querySelector("img").style.borderColor="transparent"},1500)}}})})})}export{Ie as openProfilePictureModal};
