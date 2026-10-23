const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* Models tried in order. No API key is bundled: users add their own in Settings. */
const MODELS=["gemini-3.8-flash","gemini-flash-latest"];
const DIS=[
["Late blight","Tomato, Potato","Dark water-soaked patches on leaves, white mould underneath in humid weather.","Remove infected leaves; spray copper-based fungicide or mancozeb as per label.","Use resistant varieties, avoid overhead watering, rotate crops."],
["Early blight","Tomato, Potato","Brown spots with concentric rings, starting on older leaves.","Remove affected leaves; apply a protective fungicide such as chlorothalonil.","Mulch soil, space plants, rotate for 2–3 years."],
["Powdery mildew","Grapes, Chilli, Cucurbits","White powdery coating on leaf surface.","Spray sulphur or neem oil; improve airflow.","Avoid crowding; water at the base."],
["Rice blast","Rice","Diamond-shaped grey lesions with brown borders on leaves.","Apply tricyclazole as per label.","Balanced nitrogen, resistant varieties, clean seed."],
["Leaf rust","Wheat","Orange-brown pustules on leaves.","Apply a triazole fungicide early.","Resistant cultivars and timely sowing."],
["Cotton leaf curl virus","Cotton, Chilli","Upward curling, thickened veins, stunted growth. Spread by whiteflies.","Remove infected plants; control whiteflies with neem or yellow sticky traps.","Use tolerant varieties, remove weeds."],
["Bacterial wilt","Tomato, Banana","Sudden wilting while leaves stay green; brown vascular tissue.","No cure: uproot and destroy plants.","Rotate crops, use clean soil and tools."],
["Nitrogen deficiency","Most crops","Yellowing of older leaves first, slow growth.","Apply urea, compost or vermicompost.","Soil test before each season."],
["Downy mildew","Grapes, Maize","Yellow patches above, grey-purple fuzz underneath leaves in cool, wet weather.","Spray metalaxyl or copper fungicide as per label.","Prune for airflow, avoid wet foliage."],
["Bacterial leaf blight","Rice","Yellow to white streaks from leaf tips, wilting of seedlings.","Spray copper oxychloride; drain field.","Clean seed, balanced nitrogen, resistant varieties."],
["Whitefly","Tomato, Cotton, Chilli","Tiny white insects under leaves, sticky honeydew, yellowing.","Yellow sticky traps, neem oil 5 ml/L, spray imidacloprid only if severe.","Remove weeds, use reflective mulch."],
["Aphids","Most crops","Clusters of small insects on shoots, curled leaves, sticky residue.","Strong water jet, neem or soap spray; encourage ladybirds.","Avoid excess nitrogen, monitor weekly."],
["Anthracnose","Mango, Chilli, Banana","Sunken dark spots on fruit and leaves.","Copper or mancozeb spray as per label; remove infected fruit.","Prune canopy, harvest on time."],
["Fall armyworm","Maize","Ragged leaf holes and sawdust-like frass in the whorl.","Spray neem seed extract or Bt; spinosad if severe.","Scout early, intercrop, destroy egg masses."]];
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
const jget=(k,d)=>{try{const v=JSON.parse(store(k)||"null");return v==null?d:v}catch(e){return d}};

/* ---------- language ---------- */
let CUR=store("apc_lang");if(!LANGS[CUR])CUR="English";
const LANG=()=>CUR;
const t=k=>{const d=I18N[CUR]||{};return d[k]!==undefined?d[k]:I18N.English[k]};
const fmt=(s,o)=>s.replace(/\{(\w+)\}/g,(_,k)=>o[k]);
const cropName=c=>(t("crop")||{})[c]||c;
function fillSelect(sel,vals,label){const s=$(sel),v=s.value;s.innerHTML=vals.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join("");if(v&&vals.some(x=>x[0]===v))s.value=v}
function applyLang(){
 document.documentElement.lang={English:"en",Tamil:"ta",Hindi:"hi",Telugu:"te",Kannada:"kn",Malayalam:"ml",Marathi:"mr",Bengali:"bn"}[CUR];
 document.querySelectorAll("[data-i18n]").forEach(e=>e.textContent=t(e.dataset.i18n));
 document.querySelectorAll("[data-i18n-ph]").forEach(e=>e.placeholder=t(e.dataset.i18nPh));
 fillSelect("#crop",[["",t("crop_opt")]].concat(CROPS.map(c=>[c,cropName(c)])));
 fillSelect("#mc",CROPS.map(c=>[c,cropName(c)]));
 fillSelect("#fc",CROPS.slice(0,6).map(c=>[c,cropName(c)]));
 const l=$("#lang"),cur=l.value;l.innerHTML=Object.keys(LANGS).map(k=>`<option value="${k}">${LANGS[k]}</option>`).join("");l.value=CUR;
 $("#tips").innerHTML=t("tips").map(x=>`<li>${esc(x)}</li>`).join("");
 if(!img64)$("#drop").textContent=t("no_photo");
 $("#go").textContent=busyNow?t("busy"):t("go");
 hist();myc();feed();lib($("#q").value);
}

/* ---------- navigation ---------- */
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
 document.querySelectorAll("nav button,.tab").forEach(e=>e.classList.remove("on"));
 b.classList.add("on");$("#t-"+b.dataset.t).classList.add("on");scrollTo(0,0);
 if(b.scrollIntoView)b.scrollIntoView({inline:"center",block:"nearest"});
 if(b.dataset.t==="lib")translateLib();
});

/* ---------- Gemini ---------- */
async function ai(content,max,json){
 const key=(store("apc_key")||"").trim();if(!key)throw new Error(t("e_nokey"));
 const parts=typeof content==="string"?[{text:content}]:content.map(x=>x.type==="image"?{inline_data:{mime_type:"image/jpeg",data:x.source.data}}:{text:x.text});
 const gc={maxOutputTokens:Math.max(max||0,4096)};if(json)gc.responseMimeType="application/json";
 const body=JSON.stringify({contents:[{parts}],generationConfig:gc});
 let r,d;
 async function attempt(list){
  for(let i=0;i<list.length;i++){
   try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${list[i]}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body})}
   catch(e){throw new Error(t("e_net"))}
   d=await r.json().catch(()=>({}));
   if(r.ok){store("apc_model",list[i]);return true}
   const m=d.error&&d.error.message||"";
   // retired/unknown model, rate limit or server error: try the next model
   const gone=r.status===404||(r.status===400&&/no longer available|not found|not supported|deprecated/i.test(m));
   if(!(gone||[429,500,503,504].includes(r.status)))return false;
   if(!gone)await new Promise(z=>setTimeout(z,r.status===429?300:1200));
  }
  return false}
 const saved=store("apc_model");
 let list=(saved?[saved]:[]).concat(MODELS).filter((x,i,a)=>a.indexOf(x)===i);
 if(!(await attempt(list))){
  // discover the Flash models this key can actually use, newest first
  let found=[];
  try{const lr=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",{headers:{"x-goog-api-key":key}});
   const ld=await lr.json();
   found=(ld.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")&&/flash/i.test(m.name)&&!/lite|image|tts|live|audio|thinking|exp/i.test(m.name)).map(m=>m.name.replace("models/","")).sort().reverse()}catch(e){}
  found=found.filter(x=>!list.includes(x));
  if(found.length)await attempt(found.slice(0,4));
 }
 if(!r.ok){const m=d.error&&d.error.message||"";
  throw new Error(r.status===400&&/key/i.test(m)||r.status===403&&/key|permission/i.test(m)?t("e_key"):r.status===429?t("e_429"):[500,503,504].includes(r.status)?t("e_busy"):m||t("e_fail")+" ("+r.status+").")}
 const txt=(d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts||[]).map(x=>x.text||"").join("");
 if(!txt)throw new Error(t("e_empty"));return txt}
const li=a=>"<ul>"+(Array.isArray(a)?a:a?[a]:[]).map(x=>`<li>${esc(x)}</li>`).join("")+"</ul>";
const langRule=()=>`Write the entire reply in ${LANG()} (use the native script of ${LANG()}, not transliteration).`;

/* ---------- Library ---------- */
let LIBT=null; // translated copy of DIS for current language
function libData(){return LIBT||DIS}
function lib(f){f=(f||"").toLowerCase();
 $("#lib").innerHTML=libData().filter(d=>d.join(" ").toLowerCase().includes(f)).map(d=>`<details class="card"><summary>${esc(d[0])} <span class="tag">${esc(d[1])}</span></summary><h3>${esc(t("symptoms"))}</h3>${esc(d[2])}<h3>${esc(t("treatment"))}</h3>${esc(d[3])}<h3>${esc(t("prevention"))}</h3>${esc(d[4])}</details>`).join("")||`<p class="mu">${esc(t("no_match"))}</p>`}
$("#q").oninput=e=>lib(e.target.value);
let libBusy=false;
async function translateLib(force){
 LIBT=null;const st=$("#libst");st.innerHTML="";
 if(CUR==="English"){lib($("#q").value);return}
 const ck="apc_lib_"+CUR,cached=jget(ck,null);
 if(cached&&cached.length===DIS.length&&!force){LIBT=cached;lib($("#q").value);return}
 lib($("#q").value);
 if(!(store("apc_key")||"").trim()||libBusy)return;
 libBusy=true;st.textContent=t("lib_tr");const lang=CUR;
 try{
  const raw=await ai(`Translate this JSON array of plant disease entries into ${lang}. Each entry is [name, crops, symptoms, treatment, prevention]. Translate every string (keep chemical/product names recognisable, use the native script of ${lang}). Return ONLY a JSON array with exactly the same structure and length.\n`+JSON.stringify(DIS),8000,true);
  const m=raw.match(/\[[\s\S]*\]/);const a=JSON.parse(m?m[0]:raw);
  if(!Array.isArray(a)||a.length!==DIS.length||a.some(x=>!Array.isArray(x)||x.length!==5))throw new Error("bad");
  store(ck,JSON.stringify(a));
  if(lang===CUR){LIBT=a;lib($("#q").value)}st.textContent="";
 }catch(e){st.innerHTML=`${esc(t("lib_tr_fail"))} <button class="btn sec" id="libretry" type="button" style="margin-top:6px">${esc(t("lib_retry"))}</button>`;const b=$("#libretry");if(b)b.onclick=()=>translateLib(true)}
 libBusy=false}

/* ---------- Settings ---------- */
$("#key").value=store("apc_key")||"";
$("#lang").onchange=()=>{CUR=$("#lang").value;store("apc_lang",CUR);$("#saved").textContent="";applyLang();translateLib()};
$("#save").onclick=()=>{store("apc_key",$("#key").value.trim());store("apc_lang",$("#lang").value);$("#saved").textContent=t("saved")};

/* ---------- Photo ---------- */
let img64=null,busyNow=false;
function pickFile(e){const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();
 r.onerror=()=>{$("#drop").textContent=t("bad_img")};
 r.onload=()=>{const im=new Image();
  im.onload=()=>{const m=1280,k=Math.min(1,m/Math.max(im.width,im.height));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));c.getContext("2d").drawImage(im,0,0,c.width,c.height);
   const u=c.toDataURL("image/jpeg",.85);img64=u.split(",")[1];$("#drop").innerHTML="";const p=new Image();p.src=u;p.alt="";$("#drop").appendChild(p);$("#go").disabled=false};
  im.onerror=()=>{img64=null;$("#go").disabled=true;$("#drop").textContent=t("bad_img")};im.src=r.result};
 r.readAsDataURL(f);e.target.value=""}
$("#file").onchange=pickFile;$("#cam").onchange=pickFile;
$("#pick").onclick=()=>$("#file").click();$("#snap").onclick=()=>$("#cam").click();$("#drop").onclick=()=>$("#file").click();

let H=jget("apc_h",[]);
function hist(){$("#hist").innerHTML=H.length?H.map(h=>`<div style="padding:6px 0;border-bottom:1px solid var(--bd)"><b>${esc(h.n)}</b> <span class="mu">· ${esc(h.c?cropName(h.c):t("unknown_crop"))} · ${esc(h.d)}</span></div>`).join(""):esc(t("nothing"))}
let lastDiag=null;
function showDiag(r){
 const bad=!r.healthy&&r.type!=="unclear",tp=String(r.type||"").toLowerCase(),conf=Math.max(0,Math.min(100,+r.confidence||0));
 $("#out").innerHTML=`<div class="card"><span class="tag ${bad?"bad":""}">${esc(I18N[CUR]["t_"+tp]?t("t_"+tp):r.type)}</span><h2 style="margin-top:8px">${esc(r.problem)}</h2><div class="mu">${esc(r.crop||"")}</div><div class="bar" style="margin:8px 0 2px"><i style="width:${conf}%"></i></div><div class="mu">${esc(t("confidence"))} ${conf}%</div><h3>${esc(t("symptoms"))}</h3>${esc(r.symptoms)}<h3>${esc(t("cause"))}</h3>${esc(r.causes)}<h3>${esc(t("organic"))}</h3>${li(r.organic)}<h3>${esc(t("chemical"))}</h3>${li(r.chemical)}<h3>${esc(t("prevention"))}</h3>${li(r.prevention)}</div>`}
$("#go").onclick=async()=>{
 const o=$("#out"),b=$("#go"),crop=$("#crop").value;
 if(!img64){o.innerHTML=`<div class="card err">${esc(t("need_photo"))}</div>`;return}
 busyNow=true;b.disabled=true;b.textContent=t("busy");
 o.innerHTML=`<div class="card mu">${esc(t("busy_msg"))}</div>`;
 try{
  const raw=await ai([{type:"image",source:{type:"base64",media_type:"image/jpeg",data:img64}},{type:"text",text:`You are an expert plant pathologist. Examine this plant photo${crop?` (crop: ${crop})`:""}. Reply ONLY with JSON, no markdown: {"healthy":boolean,"crop":string,"problem":string,"type":"disease|pest|deficiency|stress|healthy|unclear","confidence":number 0-100,"symptoms":string,"causes":string,"organic":[string],"chemical":[string],"prevention":[string]}. The "type" value must stay one of the English keywords. If not a plant or unclear, set type "unclear" and explain in symptoms. Max 3 items per list. Write ALL other string values (crop, problem, symptoms, causes and list items) in ${LANG()} using its native script. Chemical items must say to follow local label rules.`}],1500,true);
  const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error(t("e_unclear"));
  let r;try{r=JSON.parse(m[0])}catch(e){throw new Error(t("e_unclear"))}
  showDiag(r);
  H.unshift({n:r.problem||"—",c:crop,d:new Date().toLocaleDateString()});H=H.slice(0,8);store("apc_h",JSON.stringify(H));hist();
 }catch(e){o.innerHTML=`<div class="card err">${esc(t("diag_fail"))} ${esc(e.message)}</div>`}
 busyNow=false;b.disabled=false;b.textContent=t("go")};

/* ---------- Ask ---------- */
$("#ask").onclick=async()=>{
 const q=$("#qs").value.trim(),a=$("#ans");if(!q)return;a.classList.remove("err");a.textContent=t("thinking");
 try{a.textContent=await ai(`You are AI PLANT CARE, a friendly agronomist. Answer in under 180 words with practical steps in simple language. Suggest organic options first and remind to follow pesticide labels. ${langRule()} Question: ${q}`,800)}
 catch(e){a.textContent=t("ask_fail")+" "+e.message;a.classList.add("err")}};

/* ---------- My crops ---------- */
const STAGES=[[20,"s1","s1a"],[60,"s2","s2a"],[100,"s3","s3a"],[9999,"s4","s4a"]];
let MY=jget("apc_my",[]);
$("#md").valueAsDate=new Date();
const daysSince=d=>{const x=new Date(d);return isNaN(x)?0:Math.max(0,Math.floor((Date.now()-x)/864e5))};
function myc(){$("#mylist").innerHTML=MY.map((c,i)=>{const d=daysSince(c.d),s=STAGES.find(x=>d<=x[0]);
 return `<div class="card"><b>${esc(cropName(c.n))}</b> <span class="tag">${esc(t("day"))} ${d}</span><h3>${esc(t(s[1]))}</h3>${esc(t(s[2]))}<div class="row" style="margin:10px 0 0"><button class="btn sec" type="button" data-plan="${i}">${esc(t("ai_plan"))}</button><button class="btn sec" type="button" data-del="${i}">${esc(t("remove"))}</button></div><div class="msg" id="pl${i}"></div></div>`}).join("")||`<p class="mu">${esc(t("no_crops"))}</p>`}
$("#madd").onclick=()=>{MY.push({n:$("#mc").value,d:$("#md").value||new Date().toISOString().slice(0,10)});store("apc_my",JSON.stringify(MY));myc()};
$("#mylist").onclick=async e=>{const b=e.target.closest("button");if(!b)return;
 if(b.dataset.del!==undefined){MY.splice(+b.dataset.del,1);store("apc_my",JSON.stringify(MY));myc();return}
 if(b.dataset.plan!==undefined){const i=+b.dataset.plan,c=MY[i],el=$("#pl"+i),d=daysSince(c.d);el.classList.remove("err");el.textContent=t("thinking");
  try{el.textContent=await ai(`Give a short care plan for the next 2 weeks for ${c.n} that is ${d} days after sowing: watering, fertiliser, pest and disease watch. Max 120 words. ${langRule()}`,800)}
  catch(x){el.textContent=t("plan_fail")+" "+x.message;el.classList.add("err")}}};

/* ---------- Weather ---------- */
const WCODE=c=>c===0?"c0":c===1?"c1":c===2?"c2":c===3?"c3":c===45||c===48?"c45":c>=51&&c<=57?"c51":c>=61&&c<=67?(c>=65?"c65":"c61"):c>=71&&c<=77?"c71":c>=80&&c<=82?"c80":c>=95?"c95":c>=85&&c<=86?"c71":null;
const wc=c=>{const k=WCODE(c);return k?t(k):"—"};
$("#wgo").onclick=()=>{const o=$("#wout");o.classList.remove("err");o.textContent=t("wx_find");
 if(!navigator.geolocation){o.textContent=t("wx_nogeo");return}
 navigator.geolocation.getCurrentPosition(async p=>{try{
  o.textContent=t("wx_load");
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`;
  const resp=await fetch(u);if(!resp.ok)throw 0;const w=await resp.json(),c=w.current,d=w.daily;let adv=[];
  if(c.wind_speed_10m>15)adv.push(t("a_wind"));if(d.precipitation_probability_max[0]>50)adv.push(t("a_rain"));
  if(c.relative_humidity_2m>80&&c.temperature_2m>14&&c.temperature_2m<27)adv.push(t("a_fungal"));
  if(c.temperature_2m>32)adv.push(t("a_hot"));if(!adv.length)adv.push(t("a_good"));
  const loc=new Date().toLocaleDateString(document.documentElement.lang,{weekday:"short",day:"numeric",month:"short"});
  o.innerHTML=`<b>${esc(t("now"))}:</b> ${c.temperature_2m}°C, ${esc(wc(c.weather_code))}, ${esc(t("humidity"))} ${c.relative_humidity_2m}%, ${esc(t("wind"))} ${c.wind_speed_10m} km/h<br><br>`+d.time.map((x,i)=>{let dt=x;try{dt=new Date(x+"T12:00:00").toLocaleDateString(document.documentElement.lang,{weekday:"short",day:"numeric",month:"short"})}catch(e){}return `<b>${esc(dt)}</b>: ${d.temperature_2m_min[i]}–${d.temperature_2m_max[i]}°C, ${esc(wc(d.weather_code[i]))}, ${esc(t("rain"))} ${d.precipitation_probability_max[i]}%`}).join("<br>")+`<h3>${esc(t("farm_adv"))}</h3>`+adv.map(esc).join("<br>")}
  catch(e){o.textContent=t("wx_fail");o.classList.add("err")}},()=>{o.textContent=t("wx_denied");o.classList.add("err")},{timeout:15000})};

/* ---------- Community ---------- */
let CP=jget("apc_cp",[]);
function feed(){$("#cfeed").innerHTML=CP.map((p,i)=>`<div class="card"><b>${esc(p.q)}</b><div class="mu">${esc(p.d)}</div><div class="msg">${p.a?esc(p.a):""}</div><div class="row" style="margin:8px 0 0">${p.a?"":`<button class="btn sec" type="button" data-ans="${i}">${esc(t("get_ans"))}</button>`}<button class="btn sec" type="button" data-cdel="${i}">${esc(t("del"))}</button></div></div>`).join("")||`<p class="mu">${esc(t("no_posts"))}</p>`}
$("#cpost").onclick=()=>{const q=$("#cq").value.trim();if(!q)return;CP.unshift({q,d:new Date().toLocaleString(),a:""});$("#cq").value="";store("apc_cp",JSON.stringify(CP));feed()};
$("#cq").onkeydown=e=>{if(e.key==="Enter")$("#cpost").click()};
$("#cfeed").onclick=async e=>{const b=e.target.closest("button");if(!b)return;
 if(b.dataset.cdel!==undefined){CP.splice(+b.dataset.cdel,1);store("apc_cp",JSON.stringify(CP));feed();return}
 if(b.dataset.ans!==undefined){const p=CP[+b.dataset.ans];b.textContent=t("thinking");b.disabled=true;
  try{p.a=await ai(`You are an agronomist answering a farmer's community question. Under 150 words, practical, organic options first. ${langRule()} Question: ${p.q}`,800);store("apc_cp",JSON.stringify(CP))}
  catch(x){p.a=t("ask_fail")+" "+x.message}feed()}};

/* ---------- Tools ---------- */
const NPK={Tomato:[48,24,24],Potato:[50,25,40],Rice:[50,25,25],Wheat:[50,25,12],Maize:[48,24,16],Cotton:[40,20,20]};
$("#fgo").onclick=()=>{const a=parseFloat($("#fa").value);if(!(a>0)){$("#fout").textContent=t("need_area");return}
 const [n,p,k]=NPK[$("#fc").value],N=n*a,P=p*a,K=k*a,dap=P/.46,urea=Math.max(0,(N-dap*.18)/.46),mop=K/.6,f=x=>x.toFixed(1);
 $("#fout").innerHTML=`<b>${esc(fmt(t("f_need"),{a}))}</b> N ${f(N)} kg, P₂O₅ ${f(P)} kg, K₂O ${f(K)} kg<br><b>DAP:</b> ${f(dap)} kg<br><b>Urea:</b> ${f(urea)} kg<br><b>MOP:</b> ${f(mop)} kg<br><span class="mu">${esc(t("f_note"))}</span>`};
$("#sgo").onclick=()=>{const d=parseFloat($("#sd").value),tk=parseFloat($("#st").value);$("#sout").textContent=d>0&&tk>0?fmt(t("s_res"),{x:(d*tk).toFixed(1),t:tk}):t("need_dose")};

applyLang();translateLib();
