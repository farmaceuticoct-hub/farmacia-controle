/*
 * Arquivo: scripts.js - v2.7
 * Sistema: Assistência Farmacêutica - Controlados e Especiais
 * Atualização: Cadastro central de pacientes
 */

// ============ CONFIGURAÇÃO ============
const API_URL = 'https://farmacia-api-controlados.up.railway.app';
const SHEET_ID_PACIENTES = '14JGqndfKqh3kVvzMJBqa13XO6z_SpXnoGTUJ-ZWtIdI'; // 🆕 Planilha central
const SHEET_ID_CTRL = '1WIpoH1sZsuMCaSsD6QC6LAcDo-6Rc013MlGDztlzqRo';
const SHEET_ID_ESP = '13oodt6jGo8TgAaxKqWUMS64a0y0TnPX5ZUmDXx3BL_M';
const VERSAO = '2.7';

const MEDICAMENTOS_CTRL = [
  "Amitriptilina 25mg", "Amitriptilina 75mg", "Biperideno 2mg", "Carbamazepina 200mg", "Carbonato de Lítio 300mg",
  "Clomipramina 25mg", "Clorpromazina 25mg", "Clorpromazina 100mg","Diazepam 5mg","Diazepam 10mg","Fenobarbital 100mg",
  "Fluoxetina 20mg","Haloperidol 5mg","Haloperidol 1mg","Levomepromazina 25mg","Levomepromazina 100mg","Lorazepam 2mg",
  "Nitrazepam 5mg","Nortriptilina 25mg","Risperidona 1mg","Risperidona 2mg","Sertralina 50mg","Sertralina 100mg",
  "Topiramato 25mg","Topiramato 50mg"
];
const MEDICAMENTOS_ESP = [
  "Sacarato de Óxido Férrico 20mg/mL injetável",
  "Enoxaparina 40mg/0,4mL"
];
const RESPONSAVEIS = ["Cinthia M.", "Daniel C.", "Luana Q.", "Marcos J."];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ============ VARIÁVEIS ============
let pacientes = []; // 🆕 Pacientes da planilha central
let registrosCtrl=[], registrosEsp=[], estoque={};
let medicamentosAtivosCtrl=[...MEDICAMENTOS_CTRL], responsaveisAtivos=[...RESPONSAVEIS];
let mesCtrl='todos', mesEsp='todos', dashboardMesCtrl=null, dashboardMesEsp=null;
let cfgEstoqueCritico=parseInt(localStorage.getItem('cfg_estoque_critico')||'5');
let cfgEstoqueBaixo=parseInt(localStorage.getItem('cfg_estoque_baixo')||'15');
let filaOffline = JSON.parse(localStorage.getItem('fila_offline')||'[]');

// ============ INICIALIZAÇÃO ============
function inicializar(){
    medicamentosAtivosCtrl=JSON.parse(localStorage.getItem('meds_344')||'null')||[...MEDICAMENTOS_CTRL];
    responsaveisAtivos=JSON.parse(localStorage.getItem('resps_344')||'null')||[...RESPONSAVEIS];
    pacientes=JSON.parse(localStorage.getItem('ctrl_pacientes')||'[]'); // 🆕
    registrosCtrl=JSON.parse(localStorage.getItem('registros_344')||'[]');
    registrosEsp=JSON.parse(localStorage.getItem('registros_esp')||'[]');
    estoque=JSON.parse(localStorage.getItem('estoque_esp')||'{"Sacarato de Óxido Férrico 20mg/mL injetável":0,"Enoxaparina 40mg/0,4mL":0}');
    dashboardMesCtrl=localStorage.getItem('dashboard_mes_344')||null;
    dashboardMesEsp=localStorage.getItem('dashboard_mes_esp')||null;
    
    carregarSelectsCtrl();carregarSelectsEsp();carregarDashboardCtrl();carregarDashboardEsp();
    carregarSelectPacientesCtrl(); // 🆕 Carregar pacientes nos campos
    document.getElementById('ctrlData').valueAsDate=new Date();
    document.getElementById('espData').valueAsDate=new Date();
    document.getElementById('ctrlTituloContagem').textContent=MESES[new Date().getMonth()];
    atualizarModuloControlados();atualizarModuloEspeciais();
    sincronizarTudo();
    
    window.addEventListener('online', () => {
        mostrarStatus('🌐 Internet restaurada! Sincronizando...', 'info');
        processarFilaOffline();
    });
    window.addEventListener('offline', () => {
        mostrarStatus('⚠️ Sem internet! Registros salvos localmente.', 'alerta');
    });
    if (navigator.onLine && filaOffline.length > 0) processarFilaOffline();
    
    console.log(`🚀 v${VERSAO} - Cadastro Central de Pacientes`);
}

function trocarModulo(m){
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.modulo').forEach(m=>m.classList.remove('active'));
    if(m==='controlados'){document.querySelector('.nav-tab:nth-child(1)').classList.add('active');document.getElementById('modulo-controlados').classList.add('active');}
    else{document.querySelector('.nav-tab:nth-child(2)').classList.add('active');document.getElementById('modulo-especiais').classList.add('active');}
}

// ============ API ============
async function lerPlanilha(sheetId, range) {
    try {
        const response = await fetch(`${API_URL}/api/ler-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planilhaId: sheetId, range: range })
        });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        return data.valores || [];
    } catch (error) { console.error('Erro ao ler:', error); return []; }
}

async function escreverPlanilha(sheetId, range, values) {
    const response = await fetch(`${API_URL}/api/escrever-planilha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planilhaId: sheetId, range: range, valores: values })
    });
    if (!response.ok) throw new Error(`Erro ${response.status}`);
    return await response.json();
}

// ============ FILA OFFLINE ============
function adicionarFilaOffline(tipo, sheetId, range, dados) {
    filaOffline.push({ id: Date.now(), tipo, sheetId, range, dados, data: new Date().toISOString() });
    localStorage.setItem('fila_offline', JSON.stringify(filaOffline));
}

async function processarFilaOffline() {
    if (filaOffline.length === 0 || !navigator.onLine) return;
    let processados = 0;
    for (const item of [...filaOffline]) {
        try {
            await escreverPlanilha(item.sheetId, item.range, item.dados);
            processados++;
            filaOffline = filaOffline.filter(f => f.id !== item.id);
        } catch (e) { console.error('Erro ao processar fila:', e); break; }
    }
    localStorage.setItem('fila_offline', JSON.stringify(filaOffline));
    if (processados > 0) { mostrarStatus(`✅ ${processados} registro(s) sincronizado(s)!`, 'sucesso'); await sincronizarTudo(); }
}

// ============ SINCRONIZAÇÃO ============
async function sincronizarTudo(){
    const sd=document.getElementById('statusDot'),st=document.getElementById('statusText');
    sd.style.background='#ffa500';st.textContent='Sincronizando...';
    try{
        // 🆕 Pacientes da planilha central
        const dp = await lerPlanilha(SHEET_ID_PACIENTES, 'Pacientes!A1:F1000');
        if(dp.length>1){
            pacientes=dp.slice(1).filter(r=>r[1]&&r[2]).map(r=>({
                id:r[0]||'', nome:r[1]||'', nascimento:r[2]||'', acs:r[3]||'', telefone:r[4]||'', ubs:r[5]||''
            }));
            localStorage.setItem('ctrl_pacientes',JSON.stringify(pacientes));
        }
        
        // Controlados
        const dc=await lerPlanilha(SHEET_ID_CTRL, 'Registros!A1:F1000');
        if(dc.length>1){registrosCtrl=dc.slice(1).filter(r=>r.length>=5&&r[1]&&r[2]).map(r=>({data:nData(r[0]||''),paciente:(r[1]||'').trim(),medicamento:(r[2]||'').trim(),quantidade:parseFloat((r[3]||'0').toString().replace(',','.'))||0,responsavel:(r[4]||'').trim(),repetente:(r[5]||'Não').trim()}));localStorage.setItem('registros_344',JSON.stringify(registrosCtrl));}
        
        // Especiais
        try{
            const de=await lerPlanilha(SHEET_ID_ESP, 'Página1!A1:H1000');
            if(de.length>1){registrosEsp=de.slice(1).filter(r=>r.length>=5&&r[1]&&r[2]).map(r=>({data:nData(r[0]||''),paciente:(r[1]||'').trim(),medicamento:(r[2]||'').trim(),ampolas:parseInt(r[3])||0,prescritor:(r[4]||'').trim(),ampolasCiclo:parseInt(r[5])||0,ciclosEV:parseInt(r[6])||0,estoque:parseInt(r[7])||0}));localStorage.setItem('registros_esp',JSON.stringify(registrosEsp));MEDICAMENTOS_ESP.forEach(m=>{const u=registrosEsp.filter(r=>r.medicamento===m).pop();if(u)estoque[m]=u.estoque;});localStorage.setItem('estoque_esp',JSON.stringify(estoque));}
        }catch(e){console.log('Especiais:',e.message);}
        
        sd.style.background='#48bb78';st.textContent='✅ Conectado';
    }catch(e){console.error(e);sd.style.background='#f56565';st.textContent='⚠️ Erro';}
    carregarSelectPacientesCtrl(); // 🆕
    carregarDashboardCtrl();carregarDashboardEsp();
    atualizarModuloControlados();atualizarModuloEspeciais();
}

function nData(s){if(!s)return'';s=String(s).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;if(s.includes('/')){const p=s.split('/');if(p.length===3)return`${p[2].padStart(4,'20')}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;}try{const d=new Date(s);if(!isNaN(d.getTime()))return d.toISOString().split('T')[0];}catch(e){}return s;}
function fData(s){if(!s)return'';try{const p=s.split('-');if(p.length===3)return`${p[2]}/${p[1]}/${p[0]}`;}catch(e){}return s;}

// ============ 🆕 PACIENTES (CADASTRO CENTRAL) ============
function carregarSelectPacientesCtrl() {
    const selectCtrl = document.getElementById('ctrlPacienteSelect');
    const selectEsp = document.getElementById('espPacienteSelect');
    const opts = pacientes.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
    if (selectCtrl) selectCtrl.innerHTML = '<option value="">Digite ou selecione</option>' + opts;
    if (selectEsp) selectEsp.innerHTML = '<option value="">Digite ou selecione</option>' + opts;
}

// ============ STATUS + NAVEGAÇÃO ============
function mostrarStatus(m,tipo){
    const s=document.getElementById('statusFlutuante');
    s.textContent=m;s.className=`status-registro status-${tipo}`;s.style.display='block';
    setTimeout(()=>{s.style.display='none';},4000);
}
function irParaTopo(){window.scrollTo({top:0,behavior:'smooth'});}
function irParaBase(){window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});}
window.addEventListener('scroll',function(){
    const b=document.querySelectorAll('.btn-navegacao');
    const s=window.pageYOffset||document.documentElement.scrollTop;
    if(s>300){b.forEach(btn=>btn.classList.add('visivel'));}else{b.forEach(btn=>btn.classList.remove('visivel'));}
});

// ============ CONTROLADOS ============
function carregarSelectsCtrl(){
    document.getElementById('ctrlMedicamento').innerHTML='<option value="">Selecione</option>'+medicamentosAtivosCtrl.map(m=>`<option value="${m}">${m}</option>`).join('');
    document.getElementById('ctrlFiltroMed').innerHTML='<option value="todos">Todos</option>'+medicamentosAtivosCtrl.map(m=>`<option value="${m}">${m}</option>`).join('');
    document.getElementById('ctrlResponsavel').innerHTML='<option value="">Selecione</option>'+responsaveisAtivos.map(r=>`<option value="${r}">${r}</option>`).join('');
}
function carregarDashboardCtrl(){
    const s=document.getElementById('dashboardMesControlados');s.innerHTML='<option value="atual">Mês Atual</option>';
    const m=new Set();registrosCtrl.forEach(r=>{if(r.data){const p=r.data.split('-');if(p.length>=2)m.add(`${p[0]}-${parseInt(p[1])-1}`);}});
    Array.from(m).sort().reverse().forEach(k=>{const[a,me]=k.split('-').map(Number);s.innerHTML+=`<option value="${k}" ${dashboardMesCtrl===k?'selected':''}>${MESES[me]} de ${a}</option>`;});
    if(dashboardMesCtrl&&m.has(dashboardMesCtrl))s.value=dashboardMesCtrl;
}
function verificarRepetenteCtrl(){
    const p=document.getElementById('ctrlPaciente').value.trim(),m=document.getElementById('ctrlMedicamento').value,d=document.getElementById('ctrlData').value,i=document.getElementById('ctrlRepetente');
    if(!p||!m||!d){i.value='Preencha os campos';i.style.cssText='';return;}
    const pd=d.split('-');if(pd.length<2)return;
    const as=parseInt(pd[0]),ms=parseInt(pd[1])-1,pn=p.toLowerCase().trim(),mn=m.toLowerCase().trim();
    const mm=registrosCtrl.filter(r=>{if(!r.data)return false;const pr=r.data.split('-');if(pr.length<2)return false;return parseInt(pr[1])-1===ms&&parseInt(pr[0])===as&&(r.paciente||'').toLowerCase().trim()===pn&&(r.medicamento||'').toLowerCase().trim()===mn;});
    let ma=ms-1,aa=as;if(ma<0){ma=11;aa--;}
    const me=registrosCtrl.filter(r=>{if(!r.data)return false;const pr=r.data.split('-');if(pr.length<2)return false;return parseInt(pr[1])-1===ma&&parseInt(pr[0])===aa&&(r.paciente||'').toLowerCase().trim()===pn&&(r.medicamento||'').toLowerCase().trim()===mn;});
    if(mm.length>0){i.value=`🔴 REPETENTE (Sim) - ${p} já retirou ${m} ${mm.length}x em ${MESES[ms]}!`;i.style.cssText='color:#e53e3e!important;background:#fed7d7!important;border-color:#e53e3e!important;';}
    else if(me.length>0){i.value=`🟡 MÊS ANTERIOR - ${p} retirou ${m} em ${MESES[ma]}/${aa}`;i.style.cssText='color:#975a16!important;background:#fefcbf!important;border-color:#ecc94b!important;';}
    else{i.value=`✅ NORMAL (Não) - Primeira dispensação`;i.style.cssText='color:#38a169!important;background:#c6f6d5!important;';}
}
async function registrarControlado(){
    const d=document.getElementById('ctrlData').value,p=document.getElementById('ctrlPaciente').value.trim(),m=document.getElementById('ctrlMedicamento').value,q=parseFloat(document.getElementById('ctrlQuantidade').value.toString().replace(',','.')),r=document.getElementById('ctrlResponsavel').value,ri=document.getElementById('ctrlRepetente').value;
    if(!d||!p||!m||!q||!r)return mostrarStatus('⚠️ Preencha todos os campos obrigatórios!','alerta');
    if(q<=0)return mostrarStatus('⚠️ Quantidade deve ser maior que zero!','alerta');
    let rep='Não';if(ri.includes('REPETENTE (Sim)'))rep='Sim';else if(ri.includes('MÊS ANTERIOR'))rep='Mês Anterior';
    const valores = [d,p,m,q,r,rep];
    registrosCtrl.push({data:d,paciente:p,medicamento:m,quantidade:q,responsavel:r,repetente:rep});
    localStorage.setItem('registros_344',JSON.stringify(registrosCtrl));
    
    if (navigator.onLine) {
        try{
            await escreverPlanilha(SHEET_ID_CTRL,'Registros!A:F',valores);
            if(rep==='Sim')mostrarStatus(`🔴 REPETENTE!\n${p} - ${m}\nRegistrado na planilha!`,'alerta');
            else if(rep==='Mês Anterior')mostrarStatus(`🟡 MÊS ANTERIOR!\n${p} - ${m}\nRegistrado na planilha!`,'info');
            else mostrarStatus(`✅ SUCESSO!\n${p} - ${m} (${q} un.)\nRegistrado na planilha!`,'sucesso');
        }catch(e){
            adicionarFilaOffline('controlado', SHEET_ID_CTRL, 'Registros!A:F', valores);
            mostrarStatus(`⚠️ Salvo localmente! Sincroniza depois.`,'alerta');
        }
    } else {
        adicionarFilaOffline('controlado', SHEET_ID_CTRL, 'Registros!A:F', valores);
        mostrarStatus(`💾 Offline! Salvo localmente (${filaOffline.length} na fila).`,'info');
    }
    
    ['ctrlPaciente','ctrlMedicamento','ctrlQuantidade','ctrlResponsavel'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('ctrlRepetente').value='Preencha os campos';document.getElementById('ctrlRepetente').style.cssText='';
    document.getElementById('ctrlData').valueAsDate=new Date();
    const ds=document.getElementById('dashboardMesControlados');if(ds.value!=='atual'){dashboardMesCtrl=ds.value;localStorage.setItem('dashboard_mes_344',dashboardMesCtrl);}
    carregarDashboardCtrl();atualizarModuloControlados();
}
function atualizarDashboardControlados(){
    const s=document.getElementById('dashboardMesControlados'),v=s.value;
    if(v!=='atual'){dashboardMesCtrl=v;localStorage.setItem('dashboard_mes_344',dashboardMesCtrl);}else{dashboardMesCtrl=null;localStorage.removeItem('dashboard_mes_344');}
    let mf,af,nm;if(v==='atual'){const h=new Date();mf=h.getMonth();af=h.getFullYear();nm=MESES[mf];}else{const[a,me]=v.split('-').map(Number);mf=me;af=a;nm=MESES[me];}
    document.getElementById('ctrlMesLabel').textContent=`${nm} de ${af}`;
    const rf=registrosCtrl.filter(r=>{if(!r.data)return false;const p=r.data.split('-');return p.length>=2&&parseInt(p[1])-1===mf&&parseInt(p[0])===af;});
    document.getElementById('ctrlTotal').textContent=rf.length;document.getElementById('ctrlRepetentes').textContent=rf.filter(r=>r.repetente==='Sim').length;
    document.getElementById('ctrlPacientes').textContent=new Set(rf.map(r=>r.paciente.toLowerCase())).size;document.getElementById('ctrlMeds').textContent=new Set(rf.map(r=>r.medicamento)).size;
}
function filtrarCtrlMes(m){mesCtrl=m;atualizarModuloControlados();}
function aplicarFiltrosCtrl(){
    const fm=document.getElementById('ctrlFiltroMed').value,fp=document.getElementById('ctrlFiltroPaciente').value.toLowerCase();let d=[...registrosCtrl];
    if(mesCtrl!=='todos')d=d.filter(r=>{if(!r.data)return false;const p=r.data.split('-');return p.length>=2&&MESES[parseInt(p[1])-1]===mesCtrl;});
    if(fm!=='todos')d=d.filter(r=>r.medicamento===fm);if(fp)d=d.filter(r=>r.paciente.toLowerCase().includes(fp));
    d.sort((a,b)=>(b.data||'').localeCompare(a.data||''));document.getElementById('ctrlResultCount').textContent=`${d.length} registro(s)`;
    const tb=document.getElementById('ctrlTabela');if(d.length===0){tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:30px;">Nenhum registro</td></tr>';return;}
    tb.innerHTML=d.map(r=>{let bc='badge-ok',bt='✅ Não';if(r.repetente==='Sim'){bc='badge-alert';bt='🔴 Sim';}else if(r.repetente==='Mês Anterior'){bc='badge-mes-anterior';bt='🟡 Mês Ant.';}return`<tr><td>${fData(r.data)}</td><td>${r.paciente}</td><td>${r.medicamento}</td><td>${r.quantidade}</td><td>${r.responsavel}</td><td><span class="badge ${bc}">${bt}</span></td></tr>`;}).join('');
}
function atualizarContagemCtrl(){
    const ma=new Date().getMonth(),aa=new Date().getFullYear();let mf=ma,af=aa;if(mesCtrl!=='todos'){mf=MESES.indexOf(mesCtrl);if(mf<0)mf=ma;}
    const rm=registrosCtrl.filter(r=>{if(!r.data)return false;const p=r.data.split('-');return p.length>=2&&parseInt(p[1])-1===mf&&parseInt(p[0])===af;});
    document.getElementById('ctrlTituloContagem').textContent=mesCtrl!=='todos'?mesCtrl:MESES[ma];
    const ct={};rm.forEach(r=>{if(!ct[r.medicamento])ct[r.medicamento]={q:0,p:new Set(),a:0};ct[r.medicamento].q+=r.quantidade;ct[r.medicamento].p.add(r.paciente.toLowerCase());if(r.repetente!=='Não')ct[r.medicamento].a++;});
    const tb=document.getElementById('ctrlTabelaContagem');if(Object.keys(ct).length===0){tb.innerHTML='<tr><td colspan="4" style="text-align:center;padding:30px;">Nenhum dado</td></tr>';return;}
    tb.innerHTML=Object.entries(ct).sort((a,b)=>b[1].q-a[1].q).map(([m,d])=>`<tr><td><strong>${m}</strong></td><td>${d.q.toFixed(2)}</td><td>${d.p.size}</td><td>${d.a>0?`<span class="badge badge-alert">⚠️ ${d.a}</span>`:'<span class="badge badge-ok">✅ 0</span>'}</td></tr>`).join('');
}
function atualizarModuloControlados(){carregarDashboardCtrl();carregarSelectsCtrl();carregarSelectPacientesCtrl();
    const tc=document.getElementById('ctrlMonthTabs');tc.innerHTML=`<div class="month-tab ${mesCtrl==='todos'?'active':''}" onclick="filtrarCtrlMes('todos')">📋 Todos</div>`;
    const mc=new Set();registrosCtrl.forEach(r=>{if(r.data){const p=r.data.split('-');if(p.length>=2)mc.add(`${parseInt(p[0])}-${parseInt(p[1])-1}`);}});
    Array.from(mc).sort().forEach(k=>{const[a,me]=k.split('-').map(Number);const nm=MESES[me];const c=registrosCtrl.filter(r=>{if(!r.data)return false;const p=r.data.split('-');return p.length>=2&&parseInt(p[1])-1===me&&parseInt(p[0])===a;}).length;tc.innerHTML+=`<div class="month-tab ${mesCtrl===nm?'active':''}" onclick="filtrarCtrlMes('${nm}')">${nm} (${c})</div>`;});
    atualizarDashboardControlados();aplicarFiltrosCtrl();atualizarContagemCtrl();}
function exportarCSVCtrl(){if(registrosCtrl.length===0)return mostrarStatus('⚠️ Nenhum registro!','alerta');let csv='Data,Paciente,Medicamento,Quantidade,Responsável,Repetente\n';registrosCtrl.forEach(r=>{csv+=`${fData(r.data)},"${r.paciente}","${r.medicamento}",${r.quantidade},"${r.responsavel}","${r.repetente}"\n`;});const b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const l=document.createElement('a');l.href=URL.createObjectURL(b);l.download=`controlados_v${VERSAO}_${new Date().toISOString().split('T')[0]}.csv`;l.click();mostrarStatus('📥 CSV exportado!','sucesso');}

// ============ ESPECIAIS ============
function carregarSelectsEsp(){
    const sm=document.getElementById('espMedicamento'),sf=document.getElementById('espFiltroMed'),se=document.getElementById('entradaMedicamento');
    const opts=MEDICAMENTOS_ESP.map(m=>`<option value="${m}">${m}</option>`).join('');
    sm.innerHTML='<option value="">Selecione</option>'+opts;sf.innerHTML='<option value="todos">Todos</option>'+opts;se.innerHTML='<option value="">Selecione</option>'+opts;
}
function carregarDashboardEsp(){
    const s=document.getElementById('dashboardMesEspeciais');s.innerHTML='<option value="atual">Mês Atual</option>';
    const m=new Set();registrosEsp.forEach(r=>{if(r.data){const p=r.data.split('-');if(p.length>=2)m.add(`${p[0]}-${parseInt(p[1])-1}`);}});
    Array.from(m).sort().reverse().forEach(k=>{const[a,me]=k.split('-').map(Number);s.innerHTML+=`<option value="${k}" ${dashboardMesEsp===k?'selected':''}>${MESES[me]} de ${a}</option>`;});
    if(dashboardMesEsp&&m.has(dashboardMesEsp))s.value=dashboardMesEsp;
}
function atualizarEstoqueDisponivel(){
    const med=document.getElementById('espMedicamento').value,input=document.getElementById('espEstoqueDisponivel');
    if(!med){input.value='Selecione o medicamento';input.style.cssText='';return;}
    const disp=estoque[med]||0;input.value=`${disp} unidades disponíveis`;
    if(disp<=cfgEstoqueCritico)input.style.cssText='color:#e53e3e!important;background:#fed7d7!important;font-weight:bold;';
    else if(disp<=cfgEstoqueBaixo)input.style.cssText='color:#975a16!important;background:#fefcbf!important;font-weight:bold;';
    else input.style.cssText='color:#38a169!important;background:#c6f6d5!important;';
}
async function registrarEspecial(){
    const d=document.getElementById('espData').value,p=document.getElementById('espPaciente').value.trim(),m=document.getElementById('espMedicamento').value,a=parseInt(document.getElementById('espAmpolas').value),pr=document.getElementById('espPrescritor').value.trim(),ac=parseInt(document.getElementById('espAmpolasCiclo').value)||0,cv=parseInt(document.getElementById('espCiclosEV').value)||0;
    if(!d||!p||!m||!a||!pr)return mostrarStatus('⚠️ Preencha todos os campos!','alerta');
    if(a<=0)return mostrarStatus('⚠️ Quantidade inválida!','alerta');
    const ea=estoque[m]||0;if(a>ea)return mostrarStatus(`⚠️ Estoque insuficiente!\nDisponível: ${ea} | Solicitado: ${a}`,'alerta');
    estoque[m]=ea-a;const ne=estoque[m];localStorage.setItem('estoque_esp',JSON.stringify(estoque));
    const valores = [d,p,m,a,pr,ac,cv,ne];
    registrosEsp.push({data:d,paciente:p,medicamento:m,ampolas:a,prescritor:pr,ampolasCiclo:ac,ciclosEV:cv,estoque:ne});
    localStorage.setItem('registros_esp',JSON.stringify(registrosEsp));
    
    if (navigator.onLine) {
        try{await escreverPlanilha(SHEET_ID_ESP,'Página1!A:H',valores);mostrarStatus(`✅ DISPENSADO!\n${p} - ${m}\n${a} ampolas | Estoque: ${ne}`,'sucesso');}
        catch(e){adicionarFilaOffline('especial', SHEET_ID_ESP, 'Página1!A:H', valores);mostrarStatus(`⚠️ Salvo localmente!`,'alerta');}
    } else {adicionarFilaOffline('especial', SHEET_ID_ESP, 'Página1!A:H', valores);mostrarStatus(`💾 Offline! Salvo localmente.`,'info');}
    
    ['espPaciente','espAmpolas','espPrescritor','espAmpolasCiclo','espCiclosEV'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('espMedicamento').value='';document.getElementById('espEstoqueDisponivel').value='Selecione';document.getElementById('espEstoqueDisponivel').style.cssText='';
    document.getElementById('espData').valueAsDate=new Date();
    const ds=document.getElementById('dashboardMesEspeciais');if(ds.value!=='atual'){dashboardMesEsp=ds.value;localStorage.setItem('dashboard_mes_esp',dashboardMesEsp);}
    carregarDashboardEsp();atualizarModuloEspeciais();
}
async function registrarEntradaEstoque(){
    const m=document.getElementById('entradaMedicamento').value,q=parseInt(document.getElementById('entradaQuantidade').value);
    if(!m||!q||q<=0){alert('⚠️ Preencha os campos!');return;}
    estoque[m]=(estoque[m]||0)+q;const ne=estoque[m];localStorage.setItem('estoque_esp',JSON.stringify(estoque));
    const hoje=new Date().toISOString().split('T')[0];
    try{await escreverPlanilha(SHEET_ID_ESP,'Página1!A:H',[hoje,'📥 ENTRADA',m,`+${q}`,'Farmácia',0,0,ne]);mostrarStatus(`📥 ENTRADA!\n${m}\n+${q} | Estoque: ${ne}`,'sucesso');}
    catch(e){mostrarStatus(`⚠️ Salvo localmente`,'erro');}
    fecharModal('modalEntradaEstoque');atualizarModuloEspeciais();
}
function atualizarDashboardEspeciais(){
    const s=document.getElementById('dashboardMesEspeciais'),v=s.value;
    if(v!=='atual'){dashboardMesEsp=v;localStorage.setItem('dashboard_mes_esp',dashboardMesEsp);}else{dashboardMesEsp=null;localStorage.removeItem('dashboard_mes_esp');}
    let mf,af,nm;if(v==='atual'){const h=new Date();mf=h.getMonth();af=h.getFullYear();nm=MESES[mf];}else{const[a,me]=v.split('-').map(Number);mf=me;af=a;nm=MESES[me];}
    document.getElementById('espMesLabel').textContent=`${nm} de ${af}`;
    const rf=registrosEsp.filter(r=>{if(!r.data)return false;const p=r.data.split('-');return p.length>=2&&parseInt(p[1])-1===mf&&parseInt(p[0])===af;});
    document.getElementById('espTotal').textContent=rf.length;document.getElementById('espEstoqueFerro').textContent=estoque[MEDICAMENTOS_ESP[0]]||0;
    document.getElementById('espEstoqueEnoxa').textContent=estoque[MEDICAMENTOS_ESP[1]]||0;document.getElementById('espPacientes').textContent=new Set(rf.map(r=>r.paciente.toLowerCase())).size;
}
function atualizarStatusEstoque(){
    const div=document.getElementById('estoqueStatus');
    div.innerHTML=MEDICAMENTOS_ESP.map(m=>{const q=estoque[m]||0;let cls='estoque-ok',badge='badge-estoque-ok',status='🟢 Normal',icone='✅';
        if(q<=cfgEstoqueCritico){cls='estoque-baixo';badge='badge-estoque-baixo';status='🔴 Crítico';icone='🚨';}
        else if(q<=cfgEstoqueBaixo){cls='estoque-medio';badge='badge-estoque-medio';status='🟡 Baixo';icone='⚠️';}
        return`<div class="estoque-card ${cls}"><div><strong>${icone} ${m}</strong><br><small><strong>${q}</strong> unidades</small></div><span class="badge ${badge}">${status}</span></div>`;}).join('');
}
function filtrarEspMes(m){mesEsp=m;atualizarModuloEspeciais();}
function aplicarFiltrosEsp(){
    const fm=document.getElementById('espFiltroMed').value,fp=document.getElementById('espFiltroPaciente').value.toLowerCase();let d=[...registrosEsp];
    if(mesEsp!=='todos')d=d.filter(r=>{if(!r.data)return false;const p=r.data.split('-');return p.length>=2&&MESES[parseInt(p[1])-1]===mesEsp;});
    if(fm!=='todos')d=d.filter(r=>r.medicamento===fm);if(fp)d=d.filter(r=>r.paciente.toLowerCase().includes(fp));
    d.sort((a,b)=>(b.data||'').localeCompare(a.data||''));document.getElementById('espResultCount').textContent=`${d.length} registro(s)`;
    const tb=document.getElementById('espTabela');if(d.length===0){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:30px;">Nenhum registro</td></tr>';return;}
    tb.innerHTML=d.map(r=>`<tr><td>${fData(r.data)}</td><td>${r.paciente}</td><td>${r.medicamento}</td><td>${r.ampolas}</td><td>${r.prescritor}</td><td>${r.ampolasCiclo||'-'}</td><td>${r.ciclosEV||'-'}</td></tr>`).join('');
}
function atualizarModuloEspeciais(){carregarDashboardEsp();carregarSelectsEsp();carregarSelectPacientesCtrl();
    const tc=document.getElementById('espMonthTabs');tc.innerHTML=`<div class="month-tab ${mesEsp==='todos'?'active':''}" onclick="filtrarEspMes('todos')">📋 Todos</div>`;
    const mc=new Set();registrosEsp.forEach(r=>{if(r.data){const p=r.data.split('-');if(p.length>=2)mc.add(`${parseInt(p[0])}-${parseInt(p[1])-1}`);}});
    Array.from(mc).sort().forEach(k=>{const[a,me]=k.split('-').map(Number);const nm=MESES[me];const c=registrosEsp.filter(r=>{if(!r.data)return false;const p=r.data.split('-');return p.length>=2&&parseInt(p[1])-1===me&&parseInt(p[0])===a;}).length;tc.innerHTML+=`<div class="month-tab ${mesEsp===nm?'active':''}" onclick="filtrarEspMes('${nm}')">${nm} (${c})</div>`;});
    atualizarDashboardEspeciais();atualizarStatusEstoque();aplicarFiltrosEsp();}
function abrirEntradaEstoque(){document.getElementById('modalEntradaEstoque').classList.add('active');}
function exportarCSVEsp(){if(registrosEsp.length===0)return mostrarStatus('⚠️ Nenhum registro!','alerta');let csv='Data,Paciente,Medicamento,Ampolas,Prescritor,Ampolas por Ciclo,Ciclos EV\n';registrosEsp.forEach(r=>{csv+=`${fData(r.data)},"${r.paciente}","${r.medicamento}",${r.ampolas},"${r.prescritor}",${r.ampolasCiclo||0},${r.ciclosEV||0}\n`;});const b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const l=document.createElement('a');l.href=URL.createObjectURL(b);l.download=`especiais_v${VERSAO}_${new Date().toISOString().split('T')[0]}.csv`;l.click();mostrarStatus('📥 CSV exportado!','sucesso');}

// ============ CONFIGURAÇÕES ============
function abrirConfig(){
    document.getElementById('cfgMedsCtrl').value=medicamentosAtivosCtrl.join('\n');
    document.getElementById('cfgResps').value=responsaveisAtivos.join('\n');
    document.getElementById('cfgMedsEsp').value=MEDICAMENTOS_ESP.join('\n');
    document.getElementById('cfgEstoqueCritico').value=cfgEstoqueCritico;
    document.getElementById('cfgEstoqueBaixo').value=cfgEstoqueBaixo;
    document.getElementById('configVersao').textContent=VERSAO;document.getElementById('configVersaoSobre').textContent=VERSAO;
    document.getElementById('modalConfig').classList.add('active');trocarConfigTab('medicamentos');
}
function trocarConfigTab(tab){
    document.querySelectorAll('.config-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.config-panel').forEach(p=>p.classList.remove('active'));
    const tabs=['medicamentos','limites','backup','sobre'];const idx=tabs.indexOf(tab);
    if(idx>=0){document.querySelectorAll('.config-tab')[idx].classList.add('active');document.getElementById(`configPanel-${tab}`).classList.add('active');}
}
function salvarConfigMedicamentos(){
    const mctrl=document.getElementById('cfgMedsCtrl').value.split('\n').map(m=>m.trim()).filter(m=>m.length>0);
    const resps=document.getElementById('cfgResps').value.split('\n').map(r=>r.trim()).filter(r=>r.length>0);
    const mesp=document.getElementById('cfgMedsEsp').value.split('\n').map(m=>m.trim()).filter(m=>m.length>0);
    if(mctrl.length===0)return mostrarStatus('⚠️ Adicione pelo menos um medicamento!','alerta');
    medicamentosAtivosCtrl=mctrl.sort();responsaveisAtivos=resps.sort();
    MEDICAMENTOS_ESP.length=0;mesp.forEach(m=>MEDICAMENTOS_ESP.push(m));
    localStorage.setItem('meds_344',JSON.stringify(medicamentosAtivosCtrl));
    localStorage.setItem('resps_344',JSON.stringify(responsaveisAtivos));
    localStorage.setItem('meds_esp_list',JSON.stringify(MEDICAMENTOS_ESP));
    carregarSelectsCtrl();carregarSelectsEsp();fecharModal('modalConfig');mostrarStatus('✅ Listas atualizadas!','sucesso');
}
function salvarConfigLimites(){
    cfgEstoqueCritico=parseInt(document.getElementById('cfgEstoqueCritico').value)||5;
    cfgEstoqueBaixo=parseInt(document.getElementById('cfgEstoqueBaixo').value)||15;
    localStorage.setItem('cfg_estoque_critico',cfgEstoqueCritico);localStorage.setItem('cfg_estoque_baixo',cfgEstoqueBaixo);
    atualizarStatusEstoque();fecharModal('modalConfig');mostrarStatus('✅ Limites atualizados!','sucesso');
}
function exportarConfig(){
    const config={versao:VERSAO,data:new Date().toISOString(),medicamentosCtrl:medicamentosAtivosCtrl,responsaveis:responsaveisAtivos,medicamentosEsp:MEDICAMENTOS_ESP,limites:{estoqueCritico:cfgEstoqueCritico,estoqueBaixo:cfgEstoqueBaixo}};
    const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'});const l=document.createElement('a');
    l.href=URL.createObjectURL(blob);l.download=`config_farmacia_${new Date().toISOString().split('T')[0]}.json`;l.click();
    mostrarStatus('📥 Configurações exportadas!','sucesso');
}
function importarConfig(event){
    const file=event.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=function(e){
        try{
            const config=JSON.parse(e.target.result);
            if(config.medicamentosCtrl){medicamentosAtivosCtrl=config.medicamentosCtrl;localStorage.setItem('meds_344',JSON.stringify(medicamentosAtivosCtrl));}
            if(config.responsaveis){responsaveisAtivos=config.responsaveis;localStorage.setItem('resps_344',JSON.stringify(responsaveisAtivos));}
            if(config.medicamentosEsp){MEDICAMENTOS_ESP.length=0;config.medicamentosEsp.forEach(m=>MEDICAMENTOS_ESP.push(m));localStorage.setItem('meds_esp_list',JSON.stringify(MEDICAMENTOS_ESP));}
            if(config.limites){cfgEstoqueCritico=config.limites.estoqueCritico||5;cfgEstoqueBaixo=config.limites.estoqueBaixo||15;localStorage.setItem('cfg_estoque_critico',cfgEstoqueCritico);localStorage.setItem('cfg_estoque_baixo',cfgEstoqueBaixo);}
            carregarSelectsCtrl();carregarSelectsEsp();atualizarStatusEstoque();fecharModal('modalConfig');mostrarStatus('✅ Configurações importadas!','sucesso');
        }catch(err){mostrarStatus('❌ Arquivo inválido!','erro');}
    };reader.readAsText(file);
}
function resetarDadosLocais(){
    if(confirm('⚠️ Apagar todos os dados locais?\n\nOs dados na planilha NÃO serão afetados.')){if(confirm('⚠️ Última chance! Confirma?')){localStorage.clear();location.reload();}}
}
function fecharModal(id){document.getElementById(id).classList.remove('active');}

inicializar();
