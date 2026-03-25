/**
 * admin2.js - Admin Panel Part 2
 * Ranks, Subscriptions, Ads, Emojis, Radio, Features, Plans, Payments, Earnings, etc.
 */

/* ── HELPERS shared ─────────────────────────────────────── */
function a2Esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function a2gv(id){return document.getElementById(id)?.value??'';}
function a2sv(id,v){const el=document.getElementById(id);if(el)el.value=v??'';}
function a2isOn(id){return document.getElementById(id)?.classList.contains('on');}
function a2setOn(id,v){const el=document.getElementById(id);if(el){v?el.classList.add('on'):el.classList.remove('on');}}
const tok=()=>localStorage.getItem('chat_token');

async function a2api(url,body,method='POST'){
  try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+(tok()||'')},body:body?JSON.stringify(body):undefined});return r.json();}
  catch(e){return{error:e.message};}
}
async function a2fetch(url){
  try{const r=await fetch(url,{headers:{'Authorization':'Bearer '+(tok()||'')}});return r.json();}
  catch(e){return{error:e.message};}
}
async function a2form(url,form){
  try{const r=await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+(tok()||'')},body:form});return r.json();}
  catch(e){return{error:e.message};}
}
function a2toast(msg,type='ok'){if(window.toast)window.toast(msg,type);}
function a2Del(url,cb){
  fetch(url,{method:'DELETE',headers:{'Authorization':'Bearer '+(tok()||'')}}).then(r=>r.json()).then(d=>{
    if(d.ok){a2toast('✅ تم الحذف');if(cb)cb();}else a2toast(d.error,'err');
  });
}
function a2fmtDT(ts){if(!ts)return'-';return new Date(ts>1e10?ts:ts*1000).toLocaleString('ar-EG');}
function a2fmtDate(ts){if(!ts)return'-';return new Date(ts>1e10?ts:ts*1000).toLocaleDateString('ar-EG');}

/* ══════════════════════════════════════════
   RANKS
══════════════════════════════════════════ */
function injectRanksHtml(){
  const c=document.getElementById('ranks-content');
  if(!c||c.dataset.injected) return;
  c.dataset.injected='1';
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">🏆 الرتب والمستويات</div></div>
    <div style="margin-bottom:14px;">
      <div class="inner-tabs">
        <button class="inner-tab active" onclick="switchRankTab('basic',this)">أساسي</button>
        <button class="inner-tab" onclick="switchRankTab('perms',this)">الصلاحيات</button>
        <button class="inner-tab" onclick="switchRankTab('style',this)">المظهر</button>
      </div>
      <div id="rk-tab-basic">
        <div class="fr">
          <div class="fg"><label>اسم الرتبة</label><input id="rk-title" placeholder="نجم، أسطورة..."/></div>
          <div class="fg"><label>الإيموجي</label><input id="rk-icon" value="⭐"/></div>
          <div class="fg"><label>أو رفع أيقونة</label><input type="file" id="rk-icon-file" accept="image/*" style="font-size:11px"/></div>
          <div class="fg"><label>أقل نقاط للوصول</label><input id="rk-pts" type="number" value="0" min="0"/></div>
          <div class="fg"><label>لون الرتبة</label><input type="color" id="rk-color" value="#a78bfa"/></div>
          <div class="fg"><label>لون الخلفية</label><input type="color" id="rk-bg-color" value="#1a1a2e"/></div>
          <div class="fg"><label>لون التوهج</label><input type="color" id="rk-glow-color" value="#a78bfa"/></div>
          <div class="fg"><label>الترتيب</label><input id="rk-order" type="number" value="0" min="0"/></div>
        </div>
        <div class="tog-row"><div class="tog-info"><div class="tog-label">تفعيل التوهج حول الاسم</div></div><div class="tog" id="t-rk-glow" onclick="this.classList.toggle('on')"></div></div>
      </div>
      <div id="rk-tab-perms" style="display:none">
        <div class="fr" style="grid-template-columns:1fr 1fr 1fr;">
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">إرسال نقاط</div></div><div class="tog" id="t-rk-send" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">تضمين يوتيوب</div></div><div class="tog" id="t-rk-yt" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">البث الصوتي</div></div><div class="tog" id="t-rk-voice" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">لون اسم مخصص</div></div><div class="tog" id="t-rk-colored-name" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">تدرج لوني للاسم</div></div><div class="tog" id="t-rk-gradient-name" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">توهج الاسم</div></div><div class="tog" id="t-rk-glow-name" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">صوت خلفية الملف الشخصي</div></div><div class="tog" id="t-rk-profile-sound" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">خلفية ملف شخصي</div></div><div class="tog" id="t-rk-profile-bg" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">فقاعة رسائل مخصصة</div></div><div class="tog" id="t-rk-chat-bubble" onclick="this.classList.toggle('on')"></div></div></div>
          <div><div class="tog-row"><div class="tog-info"><div class="tog-label">إرسال نقاط بدون خصم</div></div><div class="tog" id="t-rk-no-cost" onclick="this.classList.toggle('on')"></div></div></div>
        </div>
        <div class="fr">
          <div class="fg"><label>خصم على إرسال النقاط (%)</label><input id="rk-discount" type="number" value="0" min="0" max="100"/></div>
          <div class="fg"><label>فترة تغيير الاسم (ساعة)</label><input id="rk-name-hours" type="number" value="168" min="1"/></div>
          <div class="fg"><label>أقصى حجم صورة (MB)</label><input id="rk-img-mb" type="number" value="5" min="1"/></div>
          <div class="fg"><label>أقصى حجم ملف (MB)</label><input id="rk-file-mb" type="number" value="20" min="1"/></div>
        </div>
      </div>
      <div id="rk-tab-style" style="display:none">
        <p style="font-size:11px;color:var(--txm);margin-bottom:10px">خصص مظهر بادج الرتبة لأعضاء هذه الرتبة.</p>
        <div class="fr">
          <div class="fg"><label>رابط صورة البادج</label><input id="rk-badge-url" placeholder="https://.../badge.png"/></div>
          <div class="fg"><label>أو رفع صورة بادج</label><input type="file" id="rk-badge-file" accept="image/*" style="font-size:11px"/></div>
        </div>
      </div>
      <button class="btn btn-ok" style="margin-top:10px" onclick="addRank()">➕ إضافة الرتبة</button>
    </div>
    <div style="border-top:1px solid var(--bd);padding-top:14px;margin-top:4px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
        <span>📋 الرتب الحالية</span>
        <button class="btn btn-s btn-sm" onclick="loadRanks()">🔄</button>
      </div>
      <div id="ranks-list-adm"></div>
    </div>`;
}

function switchRankTab(tab,btn){
  ['basic','perms','style'].forEach(t=>document.getElementById('rk-tab-'+t).style.display=t===tab?'block':'none');
  document.querySelectorAll('#ranks-content .inner-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
}

window.loadRanks=async function(){
  injectRanksHtml();
  const ranks=await a2fetch('/api/admin/ranks');
  if(!ranks||ranks.error) return;
  const list=document.getElementById('ranks-list-adm');
  if(!list) return;
  list.innerHTML=ranks.map(rk=>`
    <div class="rank-card">
      <div class="rk-glow-dot" style="background:${rk.color||'#94a3b8'};${rk.glow_enabled?`box-shadow:0 0 8px ${rk.glow_color||rk.color}`:''}"></div>
      <span style="font-size:18px">${rk.badge_url?`<img src="${rk.badge_url}" style="width:22px;height:22px;border-radius:4px;vertical-align:middle;">`:(rk.icon||'⭐')}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:${rk.color}">${a2Esc(rk.title)}</div>
        <div style="font-size:10px;color:var(--txm)">${(rk.min_points||0).toLocaleString('ar-EG')} نقطة${rk.can_send_points?'·إرسال نقاط':''}${rk.can_embed_yt?'·يوتيوب':''}${rk.can_voice?'·صوت':''}${rk.can_colored_name?'·لون اسم':''}${rk.glow_enabled?'·توهج':''}</div>
      </div>
      <button class="btn btn-dn btn-sm" onclick="delRank(${rk.id})">🗑️</button>
    </div>`).join('');
};

async function addRank(){
  const title=a2gv('rk-title').trim();
  if(!title){a2toast('أدخل اسم الرتبة','err');return;}
  const r=await a2api('/api/admin/ranks',{
    title,icon:a2gv('rk-icon')||'⭐',min_points:parseInt(a2gv('rk-pts'))||0,
    color:a2gv('rk-color')||'#a78bfa',bg_color:a2gv('rk-bg-color'),glow_color:a2gv('rk-glow-color'),
    glow_enabled:a2isOn('t-rk-glow')?1:0,
    can_send_points:a2isOn('t-rk-send')?1:0,can_embed_yt:a2isOn('t-rk-yt')?1:0,
    can_voice:a2isOn('t-rk-voice')?1:0,can_colored_name:a2isOn('t-rk-colored-name')?1:0,
    can_gradient_name:a2isOn('t-rk-gradient-name')?1:0,can_glow_name:a2isOn('t-rk-glow-name')?1:0,
    can_profile_sound:a2isOn('t-rk-profile-sound')?1:0,can_profile_bg:a2isOn('t-rk-profile-bg')?1:0,
    can_chat_bubble:a2isOn('t-rk-chat-bubble')?1:0,send_no_cost:a2isOn('t-rk-no-cost')?1:0,
    send_discount:parseFloat(a2gv('rk-discount'))||0,name_change_hours:parseInt(a2gv('rk-name-hours'))||168,
    max_image_mb:parseInt(a2gv('rk-img-mb'))||5,max_file_mb:parseInt(a2gv('rk-file-mb'))||20,
    order_n:parseInt(a2gv('rk-order'))||0,
  });
  r.ok?(a2toast('✅ تمت إضافة الرتبة!'),window.loadRanks()):a2toast(r.error,'err');
}

async function delRank(id){
  if(!confirm('حذف الرتبة؟'))return;
  a2Del('/api/admin/ranks/'+id,window.loadRanks);
}

/* ══════════════════════════════════════════
   SUBSCRIPTIONS
══════════════════════════════════════════ */
window.loadSubs=async function(){
  const c=document.getElementById('subs-content');if(!c)return;
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">💎 تحديث اشتراك ونقاط</div></div>
    <div class="fr">
      <div class="fg"><label>ID أو اسم المستخدم</label><input id="sub-uid" placeholder="رقم ID أو الاسم"/></div>
      <div class="fg"><label>نوع الاشتراك</label><select id="sub-type"><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option><option value="vip">VIP</option><option value="unlimited">لا نهائي</option></select></div>
      <div class="fg"><label>عدد الأيام</label><input id="sub-days" type="number" placeholder="30" min="0"/></div>
      <div class="fg"><label>نقاط تضاف</label><input id="sub-pts" type="number" placeholder="1000" min="0"/></div>
      <div class="fg"><label>السبب</label><input id="sub-reason" placeholder="هدية، مسابقة..."/></div>
    </div>
    <button class="btn btn-ok" onclick="updateSub()">✅ تحديث</button>`;
};

async function updateSub(){
  const uid=a2gv('sub-uid'),type=a2gv('sub-type'),days=parseInt(a2gv('sub-days'))||0,pts=parseInt(a2gv('sub-pts'))||0,reason=a2gv('sub-reason')||'منحة أدمن';
  if(!uid){a2toast('أدخل ID أو الاسم','err');return;}
  if(type!=='free'){const r=await a2api('/api/admin/users/subscription',{userId:parseInt(uid)||uid,type,days});if(!r.ok){a2toast(r.error,'err');return;}}
  if(pts>0){const r=await a2api('/api/admin/users/points',{userId:parseInt(uid)||uid,amount:pts,reason});if(!r.ok){a2toast(r.error,'err');return;}}
  a2toast('✅ تم التحديث!');
}

/* ══════════════════════════════════════════
   DEFAULT AVATARS
══════════════════════════════════════════ */
window.loadDefAvatars=async function(){
  const c=document.getElementById('defav-content');if(!c)return;
  const data=await a2fetch('/api/admin/default-avatars');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">🖼️ رفع صورة افتراضية</div></div>
    <div class="fr"><div class="fg"><label>التصنيف</label><input id="dav-cat" value="عام"/></div><div class="fg"><label>الجنس</label><select id="dav-gender"><option value="any">الجميع</option><option value="male">ذكر</option><option value="female">أنثى</option></select></div><div class="fg"><label>الصورة</label><input type="file" id="dav-file" accept="image/*" style="font-size:11px"/></div></div>
    <button class="btn btn-ok" onclick="uploadDefAvatar()">⬆️ رفع</button>
    <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px" id="defav-grid">
      ${(data||[]).map(av=>`<div style="text-align:center"><img src="${av.url}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px;border:2px solid var(--bd)"/><div style="font-size:10px;color:var(--txm)">${a2Esc(av.category)}</div><button class="btn btn-dn" style="padding:2px 6px;font-size:10px;margin-top:3px;width:100%" onclick="delDefAvatar(${av.id})">🗑️</button></div>`).join('')}
    </div>`;
};

async function uploadDefAvatar(){
  const file=document.getElementById('dav-file')?.files[0];
  if(!file){a2toast('اختر ملفاً','err');return;}
  const form=new FormData();form.append('file',file);form.append('category',a2gv('dav-cat'));form.append('gender',a2gv('dav-gender'));
  const r=await a2form('/api/admin/default-avatars',form);
  r.ok?(a2toast('✅ تم الرفع'),window.loadDefAvatars()):a2toast(r.error,'err');
}

async function delDefAvatar(id){a2Del('/api/admin/default-avatars/'+id,window.loadDefAvatars);}

/* ══════════════════════════════════════════
   PROFILE THEMES
══════════════════════════════════════════ */
window.loadProfileThemes=async function(){
  const c=document.getElementById('pthemes-content');if(!c)return;
  const data=await a2fetch('/api/admin/profile-themes');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">🎭 أشكال الملف الشخصي</div></div>
    <div class="fr"><div class="fg"><label>اسم الشكل (Code)</label><input id="pt-name" placeholder="vip-gold..."/></div><div class="fg"><label>الاسم المعروض</label><input id="pt-label" placeholder="ذهبي VIP"/></div><div class="fg"><label>أقل اشتراك</label><select id="pt-sub"><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option><option value="vip">VIP</option></select></div></div>
    <div class="fg"><label>CSS مخصص للشكل</label><textarea class="code-ed" id="pt-css" style="min-height:80px" placeholder="/* CSS خاص بهذا الشكل */"></textarea></div>
    <button class="btn btn-ok" onclick="addProfileTheme()">➕ إضافة شكل</button>
    <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
      ${(data||[]).map(t=>`<div style="background:var(--bg);border:1px solid var(--bd);border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;margin-bottom:5px">🎭</div><div style="font-size:12px;font-weight:700">${a2Esc(t.label)}</div><div style="font-size:10px;color:var(--txm)">${a2Esc(t.min_sub)}</div></div>`).join('')}
    </div>`;
};

async function addProfileTheme(){
  const r=await a2api('/api/admin/profile-themes',{name:a2gv('pt-name').trim(),label:a2gv('pt-label').trim(),css:a2gv('pt-css'),min_sub:a2gv('pt-sub')});
  r.ok?(a2toast('✅ تمت الإضافة'),window.loadProfileThemes()):a2toast(r.error,'err');
}

/* ══════════════════════════════════════════
   BOTS
══════════════════════════════════════════ */
window.loadBots=async function(){
  const c=document.getElementById('bots-content');if(!c)return;
  const data=await a2fetch('/api/admin/bots');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">🤖 إنشاء بوت جديد</div></div>
    <div class="fr"><div class="fg"><label>اسم البوت</label><input id="bot-name" placeholder="BotName"/></div><div class="fg"><label>Username للبوت</label><input id="bot-username" placeholder="@mybot"/></div><div class="fg"><label>الغرف (all أو room_ids)</label><input id="bot-rooms" value="all"/></div></div>
    <button class="btn btn-ok" onclick="createBot()">➕ إنشاء بوت</button>
    <div style="margin-top:14px" id="bots-list">
      ${(data||[]).map(b=>`<div class="item-card"><div class="ic-icon">🤖</div><div class="ic-info"><div class="ic-name">${a2Esc(b.name)} (@${a2Esc(b.username)})</div><div class="ic-sub" style="font-family:monospace;font-size:10px">Token: ${a2Esc(b.token?.substring(0,20))}...</div></div><div class="ic-actions"><div class="tog ${b.is_active?'on':''}" onclick="toggleBot(${b.id},this)"></div><button class="btn btn-dn btn-sm" onclick="delBot(${b.id})">🗑️</button></div></div>`).join('')}
    </div>`;
};

async function createBot(){
  const name=a2gv('bot-name').trim(),username=a2gv('bot-username').replace('@','').trim();
  if(!name||!username){a2toast('أدخل الاسم والـ username','err');return;}
  const r=await a2api('/api/admin/bots',{name,username,rooms:a2gv('bot-rooms')||'all'});
  if(r.ok){a2toast('✅ تم إنشاء البوت! Token: '+r.token);window.loadBots();}else a2toast(r.error,'err');
}
async function toggleBot(id,el){el.classList.toggle('on');await a2api('/api/admin/bots/'+id,{active:el.classList.contains('on')?1:0},'PUT');}
async function delBot(id){a2Del('/api/admin/bots/'+id,window.loadBots);}

/* ══════════════════════════════════════════
   ANNOUNCEMENTS
══════════════════════════════════════════ */
window.loadAnn=function(){
  const c=document.getElementById('ann-content');if(!c||c.dataset.i)return;c.dataset.i='1';
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">📢 شريط الإعلانات المتحرك</div></div>
    <div class="tog-row"><div class="tog-info"><div class="tog-label">تفعيل شريط الإعلانات</div></div><div class="tog" id="t-ann-active" onclick="this.classList.toggle('on')"></div></div>
    <div class="fr" style="margin-top:12px">
      <div class="fg" style="grid-column:1/-1"><label>نص الإعلان</label><textarea id="ann-text" placeholder="أهلاً بكم في موقعنا! نسعد بوجودكم..."></textarea></div>
      <div class="fg"><label>لون خلفية الشريط</label><input type="color" id="ann-bg" value="#1e0a3c"/></div>
      <div class="fg"><label>لون النص</label><input type="color" id="ann-color" value="#e2e8f0"/></div>
      <div class="fg"><label>سرعة الحركة (ثانية)</label><input id="ann-speed" type="number" value="20" min="5" max="120"/></div>
    </div>
    <button class="btn btn-ok" onclick="saveAnn()">💾 حفظ وتطبيق</button>`;
  // Load current values
  fetch('/api/config',{headers:{'Authorization':'Bearer '+(tok()||'')}}).then(r=>r.json()).then(cfg=>{
    a2sv('ann-text',cfg.announcementText||'');
    a2sv('ann-bg',cfg.annBg||'#1e0a3c');
    a2sv('ann-color',cfg.annColor||'#e2e8f0');
    a2sv('ann-speed',cfg.annSpeed||20);
    a2setOn('t-ann-active',cfg.announcementActive==='1');
  });
};

async function saveAnn(){
  const r=await a2api('/api/admin/config',{announcementActive:a2isOn('t-ann-active')?'1':'0',announcementText:a2gv('ann-text'),annBg:a2gv('ann-bg'),annColor:a2gv('ann-color'),annSpeed:a2gv('ann-speed')});
  r.ok?a2toast('✅ تم حفظ الإعلان!'):a2toast(r.error,'err');
}

/* ══════════════════════════════════════════
   BROADCAST
══════════════════════════════════════════ */
window.loadBroadcast=function(){
  const c=document.getElementById('broadcast-content');if(!c||c.dataset.i)return;c.dataset.i='1';
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">📨 إرسال إشعار جماعي</div></div>
    <div class="fr">
      <div class="fg"><label>عنوان الإشعار</label><input id="bc-title" placeholder="إعلان هام..."/></div>
      <div class="fg"><label>المستهدفون</label><select id="bc-target"><option value="all">الجميع</option><option value="online">المتصلون الآن</option><option value="members">الأعضاء المسجلون</option><option value="vip">أصحاب الاشتراكات</option></select></div>
    </div>
    <div class="fg"><label>محتوى الإشعار</label><textarea id="bc-content" placeholder="نص الإشعار..."></textarea></div>
    <button class="btn btn-ok" onclick="sendBroadcast()">📨 إرسال الآن</button>
    <div id="bc-result" style="margin-top:10px;font-size:12px;color:var(--ok)"></div>`;
};

async function sendBroadcast(){
  const title=a2gv('bc-title'),content=a2gv('bc-content'),target=a2gv('bc-target');
  if(!content){a2toast('أدخل محتوى الإشعار','err');return;}
  const r=await a2api('/api/admin/broadcast',{title,content,target});
  if(r.ok){a2toast(`✅ تم الإرسال لـ ${r.sent} مستخدم!`);document.getElementById('bc-result').textContent=`تم الإرسال لـ ${r.sent} مستخدم`;}
  else a2toast(r.error,'err');
}

/* ══════════════════════════════════════════
   ADS
══════════════════════════════════════════ */
window.loadAds=async function(){
  const c=document.getElementById('ads-content');if(!c)return;
  const ads=await a2fetch('/api/admin/ads');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">💰 إضافة إعلان جديد</div></div>
    <p style="font-size:11px;color:var(--txm);margin-bottom:10px">أضف كود أي شبكة إعلانية (Google AdSense, الخ). يمكنك إضافة لا نهاية من الإعلانات في كل مكان.</p>
    <div class="fr">
      <div class="fg"><label>اسم الإعلان</label><input id="ad-name" placeholder="إعلان جوجل 1..."/></div>
      <div class="fg"><label>الموضع</label><select id="ad-pos"><option value="top">أعلى الصفحة</option><option value="bottom">أسفل الصفحة</option><option value="sidebar">الشريط الجانبي</option><option value="chat">داخل الشات</option></select></div>
      <div class="fg"><label>الترتيب (أصغر=أول)</label><input id="ad-order" type="number" value="0" min="0"/></div>
    </div>
    <div class="fg"><label>كود HTML للإعلان</label><textarea class="code-ed" id="ad-html" style="min-height:90px" placeholder="&#x3C;!-- كود الإعلان هنا -->&#xa;&#x3C;ins class='adsbygoogle'...></ins>"></textarea></div>
    <button class="btn btn-ok" style="margin-top:8px" onclick="addAd()">➕ إضافة الإعلان</button>
    <div style="margin-top:16px;border-top:1px solid var(--bd);padding-top:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">📋 الإعلانات الحالية (${(ads||[]).length})</div>
      <div id="ads-list-adm">
        ${(ads||[]).map(ad=>`
          <div class="ad-slot">
            <div class="ad-slot-hd">
              <span>💰 ${a2Esc(ad.name)} <small style="color:var(--txm)">[${ad.position}] #${ad.id}</small></span>
              <div style="display:flex;gap:6px;align-items:center">
                <div class="tog ${ad.active?'on':''}" onclick="toggleAd(${ad.id},this)" title="تفعيل/إيقاف"></div>
                <button class="btn btn-dn btn-sm" onclick="delAd(${ad.id})">🗑️</button>
              </div>
            </div>
            <div style="font-size:10px;color:var(--txm);font-family:monospace;background:var(--bg);padding:6px 8px;border-radius:6px;overflow:hidden;max-height:45px">${a2Esc((ad.html||'').substring(0,180))}</div>
          </div>`).join('')}
      </div>
    </div>`;
};

async function addAd(){
  const name=a2gv('ad-name'),html=a2gv('ad-html');
  if(!name||!html){a2toast('أدخل الاسم والكود','err');return;}
  const r=await a2api('/api/admin/ads',{name,position:a2gv('ad-pos'),html,order_n:parseInt(a2gv('ad-order'))||0});
  r.ok?(a2toast('✅ تمت الإضافة!'),window.loadAds()):a2toast(r.error,'err');
}

async function toggleAd(id,el){
  el.classList.toggle('on');
  await a2api('/api/admin/ads/'+id,{active:el.classList.contains('on')?1:0,name:'',position:'',html:'',order_n:0},'PUT');
}
async function delAd(id){a2Del('/api/admin/ads/'+id,window.loadAds);}

/* ══════════════════════════════════════════
   WALL ADMIN
══════════════════════════════════════════ */
window.loadWallAdmin=async function(){
  const c=document.getElementById('wall-content');if(!c)return;
  const posts=await a2fetch('/api/admin/wall-posts');
  c.innerHTML=`<div class="sc-hd"><div class="sc-hd-left">🧱 منشورات الحائط</div><button class="btn btn-s btn-sm" onclick="window.loadWallAdmin()">🔄</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الكاتب</th><th>المحتوى</th><th>الإعجابات</th><th>التعليقات</th><th>التاريخ</th><th>حذف</th></tr></thead>
    <tbody>${(posts||[]).map(p=>`<tr><td><strong>${a2Esc(p.author)}</strong></td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a2Esc((p.content||'').substring(0,60))}</td><td>${p.likes_count||0}</td><td>${p.comments_count||0}</td><td>${a2fmtDate(p.created_at)}</td><td><button class="btn btn-dn btn-sm" onclick="delWallPost(${p.id})">🗑️</button></td></tr>`).join('')}</tbody></table></div>`;
};

async function delWallPost(id){
  const r=await a2fetch(`/api/admin/wall/${id}`);
  const d=await fetch('/api/admin/wall-posts/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+(tok()||'')}}).then(r=>r.json());
  d.ok?(a2toast('✅ تم الحذف'),window.loadWallAdmin()):a2toast(d.error,'err');
}

/* ══════════════════════════════════════════
   REPORTS
══════════════════════════════════════════ */
window.loadReports=async function(){
  const c=document.getElementById('reports-content');if(!c)return;
  const data=await a2fetch('/api/admin/reports');
  c.innerHTML=`<div class="sc-hd"><div class="sc-hd-left">⚠️ البلاغات المعلقة</div><button class="btn btn-s btn-sm" onclick="window.loadReports()">🔄</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المُبلِّغ</th><th>المُبلَّغ عنه</th><th>السبب</th><th>التفاصيل</th><th>التاريخ</th><th>حل</th></tr></thead>
    <tbody>${(data||[]).map(r=>`<tr><td>${a2Esc(r.reporter_name||r.reporter_id)}</td><td>${a2Esc(r.reported_id||'-')}</td><td>${a2Esc(r.reason)}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a2Esc(r.details)}</td><td>${a2fmtDate(r.created_at)}</td><td><button class="btn btn-ok btn-sm" onclick="resolveReport(${r.id})">✅ حل</button></td></tr>`).join('')}</tbody></table></div>`;
};

async function resolveReport(id){
  await a2api('/api/admin/reports/'+id+'/resolve',{});
  a2toast('✅ تم الحل');window.loadReports();
}

/* ══════════════════════════════════════════
   PAGES
══════════════════════════════════════════ */
window.loadPages=async function(){
  const c=document.getElementById('pages-content');if(!c)return;
  const data=await a2fetch('/api/admin/pages');
  c.innerHTML=`<div class="sc-hd"><div class="sc-hd-left">📄 الصفحات والسياسات</div></div>
    ${(data||[]).map(p=>`<div style="margin-bottom:14px;padding:14px;background:var(--bg);border:1px solid var(--bd);border-radius:8px">
      <div style="font-weight:700;margin-bottom:8px">${a2Esc(p.title)} <small style="color:var(--txm)">/${p.slug}</small></div>
      <textarea class="code-ed" id="page-${p.slug}" style="min-height:100px">${a2Esc(p.content)}</textarea>
      <button class="btn btn-ok btn-sm" style="margin-top:7px" onclick="savePage('${p.slug}','${a2Esc(p.title)}')">💾 حفظ</button>
    </div>`).join('')}`;
};

async function savePage(slug,title){
  const content=document.getElementById('page-'+slug)?.value||'';
  const r=await a2api('/api/admin/pages/'+slug,{title,content},'PUT');
  r.ok?a2toast('✅ تم حفظ الصفحة'):a2toast(r.error,'err');
}

/* ══════════════════════════════════════════
   EMOJIS
══════════════════════════════════════════ */
window.loadEmojis=async function(){
  const c=document.getElementById('emojis-content');if(!c)return;
  const data=await a2fetch('/api/admin/emojis');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">😊 رفع إيموجي مخصص/متحرك</div></div>
    <div class="fr">
      <div class="fg"><label>اسم الإيموجي (يستخدم بـ :اسم:)</label><input id="em-name" placeholder="heart, vip_star..."/></div>
      <div class="fg"><label>الفئة</label><input id="em-cat" value="عام"/></div>
      <div class="fg"><label>أقل اشتراك</label><select id="em-sub"><option value="free">مجاني</option><option value="silver">فضي</option><option value="gold">ذهبي</option><option value="vip">VIP</option></select></div>
      <div class="fg"><label>ملف (GIF أو PNG)</label><input type="file" id="em-file" accept="image/*" style="font-size:11px"/></div>
    </div>
    <div class="tog-row"><div class="tog-info"><div class="tog-label">إيموجي متحرك (GIF)</div></div><div class="tog on" id="t-em-anim" onclick="this.classList.toggle('on')"></div></div>
    <button class="btn btn-ok" style="margin-top:10px" onclick="uploadEmoji()">⬆️ رفع الإيموجي</button>
    <div style="margin-top:16px;border-top:1px solid var(--bd);padding-top:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">📋 الإيموجي المخصص (${(data||[]).length})</div>
      <div class="emoji-admin-grid">
        ${(data||[]).map(em=>`<div class="emoji-admin-card"><img src="${em.url}" title="${em.name}"/><div class="em-name">:${a2Esc(em.name)}:</div><div style="font-size:10px;color:var(--pl)">${a2Esc(em.category)}</div><button class="em-del" onclick="delEmoji(${em.id})">🗑️</button></div>`).join('')}
      </div>
    </div>`;
};

async function uploadEmoji(){
  const file=document.getElementById('em-file')?.files[0];
  if(!file){a2toast('اختر ملفاً','err');return;}
  const name=a2gv('em-name').trim();
  if(!name){a2toast('أدخل اسم الإيموجي','err');return;}
  const form=new FormData();form.append('file',file);form.append('name',name);form.append('category',a2gv('em-cat')||'عام');form.append('animated',a2isOn('t-em-anim')?'1':'0');form.append('min_sub',a2gv('em-sub')||'free');
  const r=await a2form('/api/admin/emojis',form);
  r.ok?(a2toast('✅ تم رفع الإيموجي!'),window.loadEmojis()):a2toast(r.error,'err');
}

async function delEmoji(id){a2Del('/api/admin/emojis/'+id,window.loadEmojis);}

/* ══════════════════════════════════════════
   SOUNDS
══════════════════════════════════════════ */
window.loadSounds=async function(){
  const c=document.getElementById('sounds-content');if(!c)return;
  const data=await a2fetch('/api/admin/sounds');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">🔊 إدارة الأصوات</div></div>
    <p style="font-size:11px;color:var(--txm);margin-bottom:10px">أضف روابط MP3 أو ارفع ملفات صوتية.</p>
    <div class="fr">
      <div class="fg"><label>اسم الصوت</label><input id="snd-name" placeholder="صوت رسالة، منشن..."/></div>
      <div class="fg"><label>النوع</label><select id="snd-type"><option value="message">رسالة جديدة</option><option value="mention">منشن</option><option value="notification">إشعار</option><option value="join">دخول غرفة</option><option value="emoji">إيموجي</option></select></div>
      <div class="fg"><label>رابط URL</label><input id="snd-url" placeholder="https://.../sound.mp3"/></div>
      <div class="fg"><label>أو رفع ملف MP3</label><input type="file" id="snd-file" accept="audio/*" style="font-size:11px"/></div>
    </div>
    <div style="display:flex;gap:7px">
      <button class="btn btn-ok" onclick="addSound()">➕ إضافة</button>
      <button class="btn btn-s" onclick="testSound()">🔊 اختبار</button>
    </div>
    <div style="margin-top:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">📋 الأصوات</div>
      ${(data||[]).map(s=>`<div class="item-card"><div class="ic-icon">🔊</div><div class="ic-info"><div class="ic-name">${a2Esc(s.name)}</div><div class="ic-sub">${a2Esc(s.type)} · <a href="${s.url}" target="_blank" style="color:var(--pl);font-size:10px">▶ تشغيل</a></div></div><button class="btn btn-dn btn-sm" onclick="delSound(${s.id})">🗑️</button></div>`).join('')}
    </div>
    <div style="margin-top:16px;border-top:1px solid var(--bd);padding-top:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">🔗 روابط الأصوات الافتراضية</div>
      <div class="fr">
        <div class="fg"><label>صوت الرسالة الجديدة</label><input id="c-msgSoundUrl" placeholder="https://..."/></div>
        <div class="fg"><label>صوت المنشن</label><input id="c-mentionSoundUrl" placeholder="https://..."/></div>
        <div class="fg"><label>صوت الإشعار</label><input id="c-emojiSoundUrl" placeholder="https://..."/></div>
        <div class="fg"><label>صوت الدخول للغرفة</label><input id="c-joinSoundUrl" placeholder="https://..."/></div>
      </div>
      <button class="btn btn-ok" onclick="saveSoundLinks()">💾 حفظ الروابط</button>
    </div>`;
  // Load current sound URLs
  fetch('/api/config').then(r=>r.json()).then(cfg=>{
    a2sv('c-msgSoundUrl',cfg.msgSoundUrl||'');a2sv('c-mentionSoundUrl',cfg.mentionSoundUrl||'');
    a2sv('c-emojiSoundUrl',cfg.emojiSoundUrl||'');a2sv('c-joinSoundUrl',cfg.joinSoundUrl||'');
  });
};

async function addSound(){
  const name=a2gv('snd-name');if(!name){a2toast('أدخل الاسم','err');return;}
  const form=new FormData();form.append('name',name);form.append('type',a2gv('snd-type'));form.append('category','عام');
  const file=document.getElementById('snd-file')?.files[0];
  if(file) form.append('file',file);
  else form.append('url',a2gv('snd-url'));
  const r=await a2form('/api/admin/sounds',form);
  r.ok?(a2toast('✅ تمت الإضافة'),window.loadSounds()):a2toast(r.error,'err');
}
function testSound(){const url=a2gv('snd-url');if(url){new Audio(url).play().catch(()=>a2toast('تعذر التشغيل','err'));}else a2toast('أدخل رابط صوت','err');}
async function delSound(id){a2Del('/api/admin/sounds/'+id,window.loadSounds);}
async function saveSoundLinks(){
  const r=await a2api('/api/admin/config',{msgSoundUrl:a2gv('c-msgSoundUrl'),mentionSoundUrl:a2gv('c-mentionSoundUrl'),emojiSoundUrl:a2gv('c-emojiSoundUrl'),joinSoundUrl:a2gv('c-joinSoundUrl')});
  r.ok?a2toast('✅ تم حفظ الأصوات'):a2toast(r.error,'err');
}

/* ══════════════════════════════════════════
   RADIO
══════════════════════════════════════════ */
window.loadRadio=async function(){
  const c=document.getElementById('radio-content');if(!c)return;
  const data=await a2fetch('/api/admin/radio');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">📻 الراديو</div></div>
    <div class="tog-row" style="margin-bottom:12px"><div class="tog-info"><div class="tog-label">تفعيل الراديو في الموقع</div></div><div class="tog" id="t-radio-active" onclick="this.classList.toggle('on');saveRadioActive()"></div></div>
    <div class="fr">
      <div class="fg"><label>اسم المحطة</label><input id="rd-name" placeholder="إذاعة القرآن الكريم..."/></div>
      <div class="fg"><label>رابط البث (Stream URL)</label><input id="rd-url" placeholder="https://.../stream.mp3"/></div>
      <div class="fg"><label>الأيقونة</label><input id="rd-icon" value="📻"/></div>
      <div class="fg"><label>التصنيف</label><input id="rd-cat" value="عام"/></div>
      <div class="fg"><label>الترتيب</label><input id="rd-order" type="number" value="0"/></div>
    </div>
    <button class="btn btn-ok" onclick="addRadio()">➕ إضافة المحطة</button>
    <div style="margin-top:14px" id="radio-list-adm">
      ${(data||[]).map(s=>`<div class="item-card"><div class="ic-icon">${s.icon_url?`<img src="${s.icon_url}"/>`:(s.icon||'📻')}</div><div class="ic-info"><div class="ic-name">${a2Esc(s.name)}</div><div class="ic-sub" style="overflow:hidden;text-overflow:ellipsis">${a2Esc(s.url)}</div></div><div class="ic-actions"><div class="tog ${s.active?'on':''}" onclick="toggleRadio(${s.id},this)"></div><button class="btn btn-dn btn-sm" onclick="delRadio(${s.id})">🗑️</button></div></div>`).join('')}
    </div>`;
  fetch('/api/config').then(r=>r.json()).then(cfg=>a2setOn('t-radio-active',cfg.radioActive==='1'));
};

async function saveRadioActive(){const r=await a2api('/api/admin/config',{radioActive:a2isOn('t-radio-active')?'1':'0'});r.ok?a2toast('✅ تم'):a2toast(r.error,'err');}
async function addRadio(){const name=a2gv('rd-name'),url=a2gv('rd-url');if(!name||!url){a2toast('أدخل الاسم والرابط','err');return;}const r=await a2api('/api/admin/radio',{name,url,icon:a2gv('rd-icon')||'📻',category:a2gv('rd-cat')||'عام',order_n:parseInt(a2gv('rd-order'))||0});r.ok?(a2toast('✅ تمت الإضافة'),window.loadRadio()):a2toast(r.error,'err');}
async function toggleRadio(id,el){el.classList.toggle('on');const st=await a2fetch('/api/admin/radio');const s=st.find(x=>x.id===id);if(s)await a2api('/api/admin/radio/'+id,{...s,active:el.classList.contains('on')?1:0},'PUT');}
async function delRadio(id){a2Del('/api/admin/radio/'+id,window.loadRadio);}

/* ══════════════════════════════════════════
   GAMES
══════════════════════════════════════════ */
window.loadGames=async function(){
  const c=document.getElementById('games-content');if(!c)return;
  const data=await a2fetch('/api/admin/games');
  c.innerHTML=`<div class="sc-hd"><div class="sc-hd-left">🎮 الألعاب</div></div>
    <p style="font-size:11px;color:var(--txm);margin-bottom:12px">تفعيل وإيقاف الألعاب داخل الشات.</p>
    ${(data||[]).map(g=>`<div class="item-card"><div class="ic-icon">${g.icon}</div><div class="ic-info"><div class="ic-name">${a2Esc(g.name)}</div><div class="ic-sub">${a2Esc(g.description||'')}</div></div><div class="tog ${g.active?'on':''}" onclick="toggleGame(${g.id},this)"></div></div>`).join('')}`;
};
async function toggleGame(id,el){el.classList.toggle('on');await a2api('/api/admin/games/'+id,{active:el.classList.contains('on')?1:0},'PUT');a2toast('✅ تم');}

/* ══════════════════════════════════════════
   FEATURES INJECT
══════════════════════════════════════════ */
window.loadFeatures=async function(){
  const c=document.getElementById('features-content');if(!c)return;
  const data=await a2fetch('/api/admin/features');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">🧩 إضافة ميزة بالكود</div></div>
    <p style="font-size:11px;color:var(--txm);margin-bottom:10px">اكتب أي كود JS أو CSS أو HTML وسيضاف للموقع مباشرة.</p>
    <div class="fr">
      <div class="fg"><label>اسم الميزة</label><input id="ft-name" placeholder="زر مشاركة، تصويت..."/></div>
      <div class="fg"><label>نوع الكود</label><select id="ft-type"><option value="js">JavaScript</option><option value="css">CSS</option><option value="html">HTML</option></select></div>
      <div class="fg"><label>موضع التنفيذ</label><select id="ft-pos"><option value="body-bottom">أسفل الصفحة</option><option value="head">الـ Head</option><option value="body-top">أعلى الصفحة</option><option value="sidebar">الشريط الجانبي</option><option value="chat-top">أعلى الشات</option><option value="chat-bottom">أسفل الشات</option></select></div>
      <div class="fg"><label>الترتيب</label><input id="ft-order" type="number" value="0"/></div>
    </div>
    <div class="fg"><label>الكود</label><textarea class="code-ed" id="ft-code" style="min-height:160px" placeholder="// مثال: إضافة زر&#10;document.querySelector('#input-bar').insertAdjacentHTML('afterbegin','&lt;button onclick=\'share()\'&gt;شارك&lt;/button&gt;');"></textarea></div>
    <button class="btn btn-ok" style="margin-top:9px" onclick="addFeature()">🚀 إضافة الميزة</button>
    <div style="margin-top:16px;border-top:1px solid var(--bd);padding-top:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">📦 الميزات المضافة</div>
      <div id="features-list-adm">
        ${(data||[]).map(f=>`<div class="item-card"><div class="ic-info"><div class="ic-name">${a2Esc(f.name)}</div><div class="ic-sub">${f.type} · ${f.position}</div></div><div class="tog ${f.active?'on':''}" onclick="toggleFeature(${f.id},this)"></div><button class="btn btn-dn btn-sm" onclick="delFeature(${f.id})">🗑️</button></div>`).join('')}
      </div>
    </div>`;
};

async function addFeature(){
  const name=a2gv('ft-name').trim(),code=a2gv('ft-code').trim();
  if(!name||!code){a2toast('أدخل الاسم والكود','err');return;}
  const r=await a2api('/api/admin/features',{name,type:a2gv('ft-type'),position:a2gv('ft-pos'),code,order_n:parseInt(a2gv('ft-order'))||0});
  r.ok?(a2toast('🚀 تمت إضافة الميزة!'),window.loadFeatures()):a2toast(r.error,'err');
}
async function toggleFeature(id,el){el.classList.toggle('on');await a2api('/api/admin/features/'+id,{active:el.classList.contains('on')?1:0},'PUT');a2toast('✅ تم');}
async function delFeature(id){a2Del('/api/admin/features/'+id,window.loadFeatures);}

/* ══════════════════════════════════════════
   LANGUAGES
══════════════════════════════════════════ */
window.loadLangs=async function(){
  const c=document.getElementById('langs-content');if(!c)return;
  const data=await a2fetch('/api/admin/languages');
  c.innerHTML=`<div class="sc-hd"><div class="sc-hd-left">🌐 اللغات</div></div>
    <div class="fr"><div class="fg"><label>كود اللغة</label><input id="lang-code" placeholder="ar, en, fr..."/></div><div class="fg"><label>اسم اللغة</label><input id="lang-name" placeholder="العربية..."/></div><div class="fg"><label>الاتجاه</label><select id="lang-dir"><option value="rtl">RTL (عربي)</option><option value="ltr">LTR (إنجليزي)</option></select></div></div>
    <button class="btn btn-ok" onclick="addLang()">➕ إضافة لغة</button>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      ${(data||[]).map(l=>`<div style="background:var(--bg);border:1px solid var(--bd);border-radius:8px;padding:9px 14px;text-align:center"><div style="font-size:20px">🌐</div><div style="font-size:12px;font-weight:700">${a2Esc(l.name)}</div><div style="font-size:10px;color:var(--txm)">${l.code} · ${l.direction}${l.is_default?' · <span style="color:var(--ok)">افتراضية</span>':''}</div></div>`).join('')}
    </div>`;
};
async function addLang(){const r=await a2api('/api/admin/languages',{code:a2gv('lang-code'),name:a2gv('lang-name'),direction:a2gv('lang-dir')});r.ok?(a2toast('✅ تمت الإضافة'),window.loadLangs()):a2toast(r.error,'err');}

/* ══════════════════════════════════════════
   PLANS
══════════════════════════════════════════ */
window.loadPlans=async function(){
  const c=document.getElementById('plans-content');if(!c)return;
  const data=await a2fetch('/api/admin/plans');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">📦 باقات الاشتراك</div></div>
    <div class="fr">
      <div class="fg"><label>اسم الباقة</label><input id="pl-name" placeholder="ذهبي، VIP..."/></div>
      <div class="fg"><label>السعر</label><input id="pl-price" type="number" placeholder="49" min="0"/></div>
      <div class="fg"><label>المدة (أيام)</label><input id="pl-days" type="number" placeholder="30" min="1"/></div>
      <div class="fg"><label>النقاط المشمولة</label><input id="pl-pts" type="number" placeholder="5000" min="0"/></div>
      <div class="fg"><label>اللون</label><input type="color" id="pl-color" value="#7c3aed"/></div>
      <div class="fg"><label>الأيقونة</label><input id="pl-icon" value="💎"/></div>
      <div class="fg"><label>الوصف</label><input id="pl-desc" placeholder="مميزات الباقة..."/></div>
    </div>
    <div class="tog-row"><div class="tog-info"><div class="tog-label">باقة مميزة (تظهر أولاً)</div></div><div class="tog" id="t-pl-featured" onclick="this.classList.toggle('on')"></div></div>
    <button class="btn btn-ok" style="margin-top:10px" onclick="addPlan()">➕ إضافة الباقة</button>
    <div style="margin-top:14px" id="plans-list-adm">
      ${(data||[]).map(p=>`<div class="item-card" style="border-color:${p.color||'var(--bd)'}33"><div class="ic-icon" style="color:${p.color}">${p.icon||'💎'}</div><div class="ic-info"><div class="ic-name" style="color:${p.color}">${a2Esc(p.name)}</div><div class="ic-sub">${p.price} ج.م · ${p.duration} يوم · ${(p.points||0).toLocaleString()} نقطة${p.is_featured?' · ⭐ مميزة':''}</div></div><button class="btn btn-dn btn-sm" onclick="delPlan(${p.id})">🗑️</button></div>`).join('')}
    </div>`;
};

async function addPlan(){
  const name=a2gv('pl-name');if(!name){a2toast('أدخل اسم الباقة','err');return;}
  const r=await a2api('/api/admin/plans',{name,price:parseFloat(a2gv('pl-price'))||0,duration:parseInt(a2gv('pl-days'))||30,points:parseInt(a2gv('pl-pts'))||0,color:a2gv('pl-color'),icon:a2gv('pl-icon')||'💎',description:a2gv('pl-desc'),is_featured:a2isOn('t-pl-featured')?1:0});
  r.ok?(a2toast('✅ تمت الإضافة!'),window.loadPlans()):a2toast(r.error,'err');
}
async function delPlan(id){a2Del('/api/admin/plans/'+id,window.loadPlans);}

/* ══════════════════════════════════════════
   PAYMENTS
══════════════════════════════════════════ */
window.loadPayments=async function(){
  const c=document.getElementById('payments-content');if(!c)return;
  const data=await a2fetch('/api/admin/payments');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">💳 سجل المدفوعات</div></div>
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">➕ إضافة دفعة يدوية</div>
      <div class="fr">
        <div class="fg"><label>ID المستخدم</label><input id="pay-uid" placeholder="رقم ID"/></div>
        <div class="fg"><label>المبلغ</label><input id="pay-amount" type="number" placeholder="49" min="0"/></div>
        <div class="fg"><label>طريقة الدفع</label><select id="pay-method"><option value="vodafone_cash">فودافون كاش</option><option value="instapay">إنستاباي</option><option value="manual">يدوي</option><option value="card">كارت</option></select></div>
        <div class="fg"><label>رقم المرجع</label><input id="pay-ref" placeholder="رقم العملية..."/></div>
        <div class="fg"><label>ملاحظات</label><input id="pay-notes" placeholder="ملاحظات..."/></div>
      </div>
      <button class="btn btn-ok" onclick="addPayment()">✅ تسجيل الدفعة</button>
    </div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المستخدم</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>التاريخ</th></tr></thead>
    <tbody>${(data||[]).map(p=>`<tr><td>${a2Esc(p.username||('#'+p.user_id))}</td><td style="color:var(--ok)">${p.amount} ج.م</td><td>${a2Esc(p.method)}</td><td style="font-size:10px">${a2Esc(p.reference||'-')}</td><td>${a2fmtDate(p.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
};

async function addPayment(){
  const uid=a2gv('pay-uid'),amount=parseFloat(a2gv('pay-amount'));
  if(!uid||!amount){a2toast('أدخل البيانات','err');return;}
  const r=await a2api('/api/admin/payments',{user_id:parseInt(uid)||uid,amount,method:a2gv('pay-method'),reference:a2gv('pay-ref'),notes:a2gv('pay-notes')});
  r.ok?(a2toast('✅ تم تسجيل الدفعة!'),window.loadPayments()):a2toast(r.error,'err');
}

/* ══════════════════════════════════════════
   EARNINGS
══════════════════════════════════════════ */
window.loadEarnings=async function(){
  const c=document.getElementById('earnings-content');if(!c)return;
  const data=await a2fetch('/api/admin/earnings');
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">📈 الأرباح والسحب</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:var(--bg);border:1px solid var(--bd);border-radius:10px;padding:16px;text-align:center"><div style="font-size:10px;color:var(--txm)">إجمالي الأرباح</div><div style="font-size:24px;font-weight:700;color:var(--ok)">${(data?.total||0).toFixed(2)} ج.م</div></div>
      <div style="background:var(--bg);border:1px solid var(--bd);border-radius:10px;padding:16px;text-align:center"><div style="font-size:10px;color:var(--txm)">أرباح الشهر</div><div style="font-size:24px;font-weight:700;color:var(--pl)">${(data?.monthly||0).toFixed(2)} ج.م</div></div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">💸 تسجيل سحب</div>
      <div class="fr">
        <div class="fg"><label>المبلغ</label><input id="wd-amount" type="number" placeholder="100" min="1"/></div>
        <div class="fg"><label>طريقة الاستلام</label><select id="wd-method"><option value="vodafone_cash">فودافون كاش</option><option value="instapay">إنستاباي</option><option value="bank">بنك</option></select></div>
        <div class="fg"><label>رقم الحساب/المحفظة</label><input id="wd-account" placeholder="01xxxxxxxxx"/></div>
        <div class="fg"><label>ملاحظات</label><input id="wd-notes" placeholder="..."/></div>
      </div>
      <button class="btn btn-ok" onclick="addWithdrawal()">💸 تسجيل السحب</button>
    </div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المصدر</th><th>المبلغ</th><th>التاريخ</th></tr></thead><tbody>${(data?.list||[]).map(e=>`<tr><td>${a2Esc(e.source)}</td><td style="color:var(--ok)">${e.amount} ج.م</td><td>${a2fmtDate(e.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
};

async function addWithdrawal(){
  const amount=parseFloat(a2gv('wd-amount'));if(!amount){a2toast('أدخل المبلغ','err');return;}
  const r=await a2api('/api/admin/withdrawals',{amount,method:a2gv('wd-method'),account:a2gv('wd-account'),notes:a2gv('wd-notes')});
  r.ok?(a2toast('✅ تم تسجيل السحب!'),window.loadEarnings()):a2toast(r.error,'err');
}

/* ══════════════════════════════════════════
   ACTIVITY LOG
══════════════════════════════════════════ */
window.loadActivity=async function(){
  const c=document.getElementById('activity-content');if(!c)return;
  const data=await a2fetch('/api/admin/activity?limit=100');
  c.innerHTML=`<div class="sc-hd"><div class="sc-hd-left">📋 سجل النشاط</div><button class="btn btn-s btn-sm" onclick="window.loadActivity()">🔄</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th><th>IP</th><th>الوقت</th></tr></thead>
    <tbody>${(Array.isArray(data)?data:[]).map(l=>`<tr><td>${a2Esc(l.username||('#'+l.user_id))}</td><td><code style="background:var(--bg);padding:2px 5px;border-radius:4px;font-size:10px">${a2Esc(l.action)}</code></td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px">${a2Esc(l.details)}</td><td style="font-size:10px;color:var(--txm)">${a2Esc(l.ip)}</td><td style="font-size:10px">${a2fmtDT(l.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
};

/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
window.loadSettings=function(){
  const c=document.getElementById('settings-content');if(!c||c.dataset.i)return;c.dataset.i='1';
  c.innerHTML=`
    <div class="sc-hd"><div class="sc-hd-left">⚙️ إعدادات عامة</div></div>
    <div class="fr">
      <div class="fg"><label>كلمة مرور جديدة للأدمن</label><input type="password" id="st-newpass" placeholder="اتركه فارغاً إذا لا تريد التغيير"/></div>
      <div class="fg"><label>تأكيد كلمة المرور</label><input type="password" id="st-newpass2" placeholder="تأكيد..."/></div>
    </div>
    <button class="btn btn-ok" onclick="changeAdminPass()">🔐 تغيير كلمة المرور</button>
    <div style="margin-top:18px;border-top:1px solid var(--bd);padding-top:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">🛠️ أدوات النظام</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="btn btn-s" onclick="exportConfig()">📤 تصدير الإعدادات JSON</button>
        <button class="btn btn-s" onclick="importConfig()">📥 استيراد إعدادات</button>
        <button class="btn btn-dn" onclick="if(confirm('إعادة الضبط الكاملة؟ سيتم مسح كل الإعدادات!'))resetConfig()">🔄 إعادة الضبط</button>
      </div>
    </div>
    <div style="margin-top:18px;border-top:1px solid var(--bd);padding-top:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">ℹ️ معلومات النظام</div>
      <div id="sysinfo" style="font-size:11px;line-height:2;color:var(--txm)">⏳ جاري التحميل...</div>
    </div>`;
  loadSysInfo();
};

async function loadSysInfo(){
  const s=await a2fetch('/api/admin/stats');
  const el=document.getElementById('sysinfo');
  if(!el||!s) return;
  el.innerHTML=`<div>🗄️ قاعدة البيانات: SQLite - WA Mode</div><div>⚡ Socket.IO v4 Real-time</div><div>🔒 JWT + bcrypt Authentication</div><div>📊 إجمالي المستخدمين: ${s.totalUsers||0}</div><div>💬 إجمالي الرسائل: ${s.totalMsgs||0}</div><div>🕐 وقت التحميل: ${new Date().toLocaleString('ar-EG')}</div>`;
}

async function changeAdminPass(){
  const p1=a2gv('st-newpass'),p2=a2gv('st-newpass2');
  if(!p1){a2toast('أدخل كلمة المرور الجديدة','err');return;}
  if(p1!==p2){a2toast('كلمتا المرور غير متطابقتين','err');return;}
  if(p1.length<8){a2toast('كلمة المرور يجب أن تكون 8 أحرف على الأقل','err');return;}
  const r=await a2api('/api/auth/change-password',{currentPassword:'',newPassword:p1});
  r.ok?a2toast('✅ تم تغيير كلمة المرور'):a2toast(r.error||'خطأ - أدخل كلمة المرور الحالية في الـ API','err');
}

function exportConfig(){
  fetch('/api/config').then(r=>r.json()).then(cfg=>{
    const b=new Blob([JSON.stringify(cfg,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='site-config.json';a.click();
    a2toast('📤 تم التصدير!');
  });
}

function importConfig(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=e=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const cfg=JSON.parse(ev.target.result);
        a2api('/api/admin/config',cfg).then(r=>r.ok?a2toast('✅ تم استيراد الإعدادات'):a2toast(r.error,'err'));
      }catch{a2toast('ملف غير صالح','err');}
    };
    reader.readAsText(e.target.files[0]);
  };
  inp.click();
}

function resetConfig(){
  a2api('/api/admin/config',{siteName:'شات عربي',primaryColor:'#7c3aed',bgColor:'#0f0f1a'}).then(()=>{
    a2toast('🔄 تم إعادة الضبط الجزئي');
  });
}

console.log('✅ admin2.js loaded successfully');
