/*
 * Arquivo: scripts.js - v2.6
 * Sistema: Assistência Farmacêutica
 * Novidades: Modo Offline + Sincronização Multi-computador
 */

// ============ CONFIGURAÇÃO ============
const API_URL = 'https://farmacia-api-controlados.up.railway.app';
const SHEET_ID_CTRL = '1WIpoH1sZsuMCaSsD6QC6LAcDo-6Rc013MlGDztlzqRo';
const SHEET_ID_ESP = '13oodt6jGo8TgAaxKqWUMS64a0y0TnPX5ZUmDXx3BL_M';
const VERSAO = '2.6';

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

// ============ VARIÁVEIS DE TRABALHO ============
let registrosCtrl=[], registrosEsp=[], estoque={};
let medicamentosAtivosCtrl=[...MEDICAMENTOS_CTRL], responsaveisAtivos=[...RESPONSAVEIS];
let mesCtrl='todos', mesEsp='todos', dashboardMesCtrl=null, dashboardMesEsp=null;
let cfgEstoqueCritico=parseInt(localStorage.getItem('cfg_estoque_critico')||'5');
let cfgEstoqueBaixo=parseInt(localStorage.getItem('cfg_estoque_baixo')||'15');

// 🆕 VARIÁVEIS DE SINCRONIZAÇÃO
let online = navigator.onLine;
let filaOffline = JSON.parse(localStorage.getItem('fila_offline')||'[]');
let ultimaSincronizacao = localStorage.getItem('ultima_sync')||null;
let sincronizando = false;

// ============ INICIALIZAÇÃO ============
function inicializar(){
    medicamentosAtivosCtrl=JSON.parse(localStorage.getItem('meds_344')||'null')||[...MEDICAMENTOS_CTRL];
    responsaveisAtivos=JSON.parse(localStorage.getItem('resps_344')||'null')||[...RESPONSAVEIS];
    registrosCtrl=JSON.parse(localStorage.getItem('registros_344')||'[]');
    registrosEsp=JSON.parse(localStorage.getItem('registros_esp')||'[]');
    estoque=JSON.parse(localStorage.getItem('estoque_esp')||'{"Sacarato de Óxido Férrico 20mg/mL injetável":0,"Enoxaparina 40mg/0,4mL":0}');
    dashboardMesCtrl=localStorage.getItem('dashboard_mes_344')||null;
    dashboardMesEsp=localStorage.getItem('dashboard_mes_esp')||null;
    
    carregarSelectsCtrl();carregarSelectsEsp();carregarDashboardCtrl();carregarDashboardEsp();
    document.getElementById('ctrlData').valueAsDate=new Date();
    document.getElementById('espData').valueAsDate=new Date();
    document.getElementById('ctrlTituloContagem').textContent=MESES[new Date().getMonth()];
    atualizarModuloControlados();atualizarModuloEspeciais();
    
    // 🆕 Verificar conexão e processar fila offline
    verificarConexao();
    
    // 🆕 Configurar listeners de conexão
    window.addEventListener('online', () => {
        online = true;
        mostrarStatus('🌐 Internet restaurada! Sincronizando...', 'info');
        processarFilaOffline();
    });
    
    window.addEventListener('offline', () => {
        online = false;
        mostrarStatus('⚠️ Sem internet! Os registros serão salvos localmente.', 'alerta');
    });
    
    // 🆕 Sincronizar periodicamente (a cada 2 minutos)
    setInterval(() => {
        if (online && !sincronizando) {
            sincronizarTudo();
            processarFilaOffline();
        }
    }, 120000); // 2 minutos
    
    console.log(`🚀 Assistência Farmacêutica v${VERSAO} - Offline Ready`);
}

// 🆕 VERIFICAR CONEXÃO
async function verificarConexao(){
    online = navigator.onLine;
    if (online) {
        await sincronizarTudo();
        if (filaOffline.length > 0) {
            mostrarStatus(`📤 ${filaOffline.length} registro(s) pendente(s) para sincronizar...`, 'info');
            await processarFilaOffline();
        }
    } else {
        mostrarStatus('⚠️ Modo Offline - Dados salvos localmente', 'alerta');
    }
}

// 🆕 FILA OFFLINE
function adicionarFilaOffline(tipo, dados) {
    filaOffline.push({
        id: Date.now(),
        tipo: tipo, // 'controlado' ou 'especial'
        dados: dados,
        data: new Date().toISOString(),
        computador: gerarIdComputador()
    });
    localStorage.setItem('fila_offline', JSON.stringify(filaOffline));
}

async function processarFilaOffline() {
    if (filaOffline.length === 0 || !online || sincronizando) return;
    
    sincronizando = true;
    let processados = 0;
    let erros = 0;
    
    for (const item of [...filaOffline]) {
        try {
            if (item.tipo === 'controlado') {
                await escreverPlanilha(SHEET_ID_CTRL, 'Registros!A:F', item.dados);
            } else if (item.tipo === 'especial') {
                await escreverPlanilha(SHEET_ID_ESP, 'Página1!A:H', item.dados);
            }
            processados++;
            // Remover da fila
            filaOffline = filaOffline.filter(f => f.id !== item.id);
        } catch (e) {
            erros++;
            console.error('Erro ao processar fila:', e);
        }
    }
    
    localStorage.setItem('fila_offline', JSON.stringify(filaOffline));
    
    if (processados > 0) {
        mostrarStatus(`✅ ${processados} registro(s) sincronizado(s)!${erros > 0 ? ` (${erros} erro(s))` : ''}`, 'sucesso');
        await sincronizarTudo(); // Atualizar dados após sincronizar fila
    }
    
    sincronizando = false;
}

// 🆕 IDENTIFICAÇÃO DO COMPUTADOR
function gerarIdComputador() {
    let id = localStorage.getItem('computador_id');
    if (!id) {
        id = 'PC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('computador_id', id);
    }
    return id;
}

// 🆕 STATUS DE CONEXÃO NO HEADER
function atualizarStatusConexao() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (!online) {
        statusDot.style.background = '#f56565';
        statusText.textContent = '⚠️ Offline';
    } else if (filaOffline.length > 0) {
        statusDot.style.background = '#ffa500';
        statusText.textContent = `📤 ${filaOffline.length} pendente(s)`;
    } else {
        statusDot.style.background = '#48bb78';
        statusText.textContent = '✅ Online';
    }
}

function trocarModulo(m){
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.modulo').forEach(m=>m.classList.remove('active'));
    if(m==='controlados'){document.querySelector('.nav-tab:nth-child(1)').classList.add('active');document.getElementById('modulo-controlados').classList.add('active');}
    else{document.querySelector('.nav-tab:nth-child(2)').classList.add('active');document.getElementById('modulo-especiais').classList.add('active');}
}

// ============ API ============
async function lerPlanilha(id, range) {
    try {
        const response = await fetch(`${API_URL}/api/ler-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planilhaId: id, range: range })
        });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        return data.valores || [];
    } catch (error) {
        console.error('Erro ao ler:', error);
        return [];
    }
}

async function escreverPlanilha(id, range, values) {
    try {
        const response = await fetch(`${API_URL}/api/escrever-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planilhaId: id, range: range, valores: values })
        });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Erro ao escrever:', error);
        throw error;
    }
}

// 🆕 SINCRONIZAÇÃO COM CACHE LOCAL
async function sincronizarTudo(){
    if (!online) {
        // Offline: usar dados locais
        carregarDashboardCtrl();carregarDashboardEsp();
        atualizarModuloControlados();atualizarModuloEspeciais();
        atualizarStatusConexao();
        return;
    }
    
    const sd=document.getElementById('statusDot'),st=document.getElementById('statusText');
    sd.style.background='#ffa500';st.textContent='Sincronizando...';
    
    try{
        const dc=await lerPlanilha(SHEET_ID_CTRL,'Registros!A1:F1000');
        if(dc.length>1){
            registrosCtrl=dc.slice(1).filter(r=>r.length>=5&&r[1]&&r[2]).map(r=>({
                data:nData(r[0]||''),paciente:(r[1]||'').trim(),medicamento:(r[2]||'').trim(),
                quantidade:parseFloat((r[3]||'0').toString().replace(',','.'))||0,
                responsavel:(r[4]||'').trim(),repetente:(r[5]||'Não').trim()
            }));
            localStorage.setItem('registros_344',JSON.stringify(registrosCtrl));
        }
        
        try{
            const de=await lerPlanilha(SHEET_ID_ESP,'Página1!A1:H1000');
            if(de.length>1){
                registrosEsp=de.slice(1).filter(r=>r.length>=5&&r[1]&&r[2]).map(r=>({
                    data:nData(r[0]||''),paciente:(r[1]||'').trim(),medicamento:(r[2]||'').trim(),
                    ampolas:parseInt(r[3])||0,prescritor:(r[4]||'').trim(),
                    ampolasCiclo:parseInt(r[5])||0,ciclosEV:parseInt(r[6])||0,estoque:parseInt(r[7])||0
                }));
                localStorage.setItem('registros_esp',JSON.stringify(registrosEsp));
                MEDICAMENTOS_ESP.forEach(m=>{
                    const u=registrosEsp.filter(r=>r.medicamento===m).pop();
                    if(u)estoque[m]=u.estoque;
                });
                localStorage.setItem('estoque_esp',JSON.stringify(estoque));
            }
        }catch(e){console.log('Especiais:',e.message);}
        
        ultimaSincronizacao = new Date().toISOString();
        localStorage.setItem('ultima_sync', ultimaSincronizacao);
        sd.style.background='#48bb78';st.textContent='✅ Online';
    }catch(e){
        console.error(e);
        sd.style.background='#f56565';st.textContent='⚠️ Erro';
    }
    
    atualizarStatusConexao();
    carregarDashboardCtrl();carregarDashboardEsp();
    atualizarModuloControlados();atualizarModuloEspeciais();
}

function nData(s){if(!s)return'';s=String(s).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;if(s.includes('/')){const p=s.split('/');if(p.length===3)return`${p[2].padStart(4,'20')}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;}try{const d=new Date(s);if(!isNaN(d.getTime()))return d.toISOString().split('T')[0];}catch(e){}return s;}
function fData(s){if(!s)return'';try{const p=s.split('-');if(p.length===3)return`${p[2]}/${p[1]}/${p[0]}`;}catch(e){}return s;}

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

// 🆕 REGISTRAR COM SUPORTE OFFLINE
async function registrarControlado(){
    const d=document.getElementById('ctrlData').value,p=document.getElementById('ctrlPaciente').value.trim(),m=document.getElementById('ctrlMedicamento').value,q=parseFloat(document.getElementById('ctrlQuantidade').value.toString().replace(',','.')),r=document.getElementById('ctrlResponsavel').value,ri=document.getElementById('ctrlRepetente').value;
    if(!d||!p||!m||!q||!r)return mostrarStatus('⚠️ Preencha todos os campos obrigatórios!','alerta');
    if(q<=0)return mostrarStatus('⚠️ Quantidade deve ser maior que zero!','alerta');
    let rep='Não';if(ri.includes('REPETENTE (Sim)'))rep='Sim';else if(ri.includes('MÊS ANTERIOR'))rep='Mês Anterior';
    
    // Salvar localmente (sempre)
    const novoRegistro = {data:d,paciente:p,medicamento:m,quantidade:q,responsavel:r,repetente:rep};
    registrosCtrl.push(novoRegistro);
    localStorage.setItem('registros_344',JSON.stringify(registrosCtrl));
    
    // Tentar enviar para o servidor
    if (online) {
        try{
            await escreverPlanilha(SHEET_ID_CTRL,'Registros!A:F',[d,p,m,q,r,rep]);
            if(rep==='Sim')mostrarStatus(`🔴 REPETENTE!\n${p} - ${m}\nRegistrado na planilha com sucesso!`,'alerta');
            else if(rep==='Mês Anterior')mostrarStatus(`🟡 MÊS ANTERIOR!\n${p} - ${m}\nRegistrado na planilha com sucesso!`,'info');
            else mostrarStatus(`✅ SUCESSO!\n${p} - ${m} (${q} un.)\nRegistrado na planilha!`,'sucesso');
        }catch(e){
            // 🆕 Se falhar, adicionar à fila offline
            adicionarFilaOffline('controlado', [d,p,m,q,r,rep]);
            mostrarStatus(`⚠️ Salvo localmente!\nSerá sincronizado quando a internet voltar.`,'alerta');
        }
    } else {
        // 🆕 Modo offline: salvar na fila
        adicionarFilaOffline('controlado', [d,p,m,q,r,rep]);
        mostrarStatus(`💾 Modo Offline!\nRegistro salvo localmente (${filaOffline.length} na fila).`,'info');
    }
    
    ['ctrlPaciente','ctrlMedicamento','ctrlQuantidade','ctrlResponsavel'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('ctrlRepetente').value='Preencha os campos';document.getElementById('ctrlRepetente').style.cssText='';
    document.getElementById('ctrlData').valueAsDate=new Date();
    const ds=document.getElementById('dashboardMesControlados');if(ds.value!=='atual'){dashboardMesCtrl=ds.value;localStorage.setItem('dashboard_mes_344',dashboardMesCtrl);}
    carregarDashboardCtrl();atualizarModuloControlados();atualizarStatusConexao();
}

// 🆕 REGISTRAR ESPECIAL COM SUPORTE OFFLINE
async function registrarEspecial(){
    const d=document.getElementById('espData').value,p=document.getElementById('espPaciente').value.trim(),m=document.getElementById('espMedicamento').value,a=parseInt(document.getElementById('espAmpolas').value),pr=document.getElementById('espPrescritor').value.trim(),ac=parseInt(document.getElementById('espAmpolasCiclo').value)||0,cv=parseInt(document.getElementById('espCiclosEV').value)||0;
    if(!d||!p||!m||!a||!pr)return mostrarStatus('⚠️ Preencha todos os campos!','alerta');
    if(a<=0)return mostrarStatus('⚠️ Quantidade inválida!','alerta');
    const ea=estoque[m]||0;if(a>ea)return mostrarStatus(`⚠️ Estoque insuficiente!\nDisponível: ${ea} | Solicitado: ${a}`,'alerta');
    
    estoque[m]=ea-a;const ne=estoque[m];localStorage.setItem('estoque_esp',JSON.stringify(estoque));
    const novoRegistro = {data:d,paciente:p,medicamento:m,ampolas:a,prescritor:pr,ampolasCiclo:ac,ciclosEV:cv,estoque:ne};
    registrosEsp.push(novoRegistro);
    localStorage.setItem('registros_esp',JSON.stringify(registrosEsp));
    
    if (online) {
        try{
            await escreverPlanilha(SHEET_ID_ESP,'Página1!A:H',[d,p,m,a,pr,ac,cv,ne]);
            mostrarStatus(`✅ DISPENSADO!\n${p} - ${m}\n${a} ampolas | Estoque: ${ne}`,'sucesso');
        }catch(e){
            adicionarFilaOffline('especial', [d,p,m,a,pr,ac,cv,ne]);
            mostrarStatus(`⚠️ Salvo localmente!\nSerá sincronizado quando a internet voltar.`,'alerta');
        }
    } else {
        adicionarFilaOffline('especial', [d,p,m,a,pr,ac,cv,ne]);
        mostrarStatus(`💾 Modo Offline!\nRegistro salvo localmente (${filaOffline.length} na fila).`,'info');
    }
    
    ['espPaciente','espAmpolas','espPrescritor','espAmpolasCiclo','espCiclosEV'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('espMedicamento').value='';document.getElementById('espEstoqueDisponivel').value='Selecione';document.getElementById('espEstoqueDisponivel').style.cssText='';
    document.getElementById('espData').valueAsDate=new Date();
    const ds=document.getElementById('dashboardMesEspeciais');if(ds.value!=='atual'){dashboardMesEsp=ds.value;localStorage.setItem('dashboard_mes_esp',dashboardMesEsp);}
    carregarDashboardEsp();atualizarModuloEspeciais();atualizarStatusConexao();
}

// ... (manter todas as outras funções iguais: atualizarDashboardControlados, filtrarCtrlMes, etc.) ...

// ============ ESPECIAIS ============
// ... (manter todas as funções de especiais iguais) ...

// ============ CONFIGURAÇÕES ============
// ... (manter todas as funções de configurações iguais) ...

// Inicializar
inicializar();
