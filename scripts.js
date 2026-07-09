/*
 * Arquivo: scripts.js - v3.4.0
 * Sistema: Assistência Farmacêutica - Controlados, Especiais e Diabetes
 * Correções: Sincronização forçada com logs, tratamento de erros, limpeza de cache.
 */
const API_URL = 'https://farmacia-api-controlados.up.railway.app';
const SHEET_ID_PACIENTES = '14JGqndfKqh3kVvzMJBqa13XO6z_SpXnoGTUJ-ZWtIdI';
const SHEET_ID_CTRL = '1WIpoH1sZsuMCaSsD6QC6LAcDo-6Rc013MlGDztlzqRo';
const SHEET_ID_ESP = '13oodt6jGo8TgAaxKqWUMS64a0y0TnPX5ZUmDXx3BL_M';
const SHEET_ID_DIABETES = '1POcsyqGHIN908kgiE_be3oyz9ILBntiSv7hn7iyXJt4';
const VERSAO = '3.4.0';

const MEDICAMENTOS_CTRL = [
  "Amitriptilina 25mg","Amitriptilina 75mg","Biperideno 2mg","Carbamazepina 200mg","Carbonato de Lítio 300mg",
  "Clomipramina 25mg","Clorpromazina 25mg","Clorpromazina 100mg","Carbamazepina Susp.","Clonazepam Sol.","Diazepam 5mg",
  "Fenitoína 100mg","Fenobarbital 100mg","Fenobarbital Sol. 4%","Fluoxetina 20 mg","Haloperidol 1mg","Haloperidol 5mg",
  "Decanoato de haloperidol","Nortriptilina 25mg","Metilfenidato 10mg","Oxcarbamazepina 60mg/mL","Sertralina 50mg","Ácido Valproico 250mg",
  "Valproato de sódio 500mg","Valproato de sódio Xpe.","Divaproato de sódio","Talidomida","Trazodona 50mg"
];
const MEDICAMENTOS_ESP = [
  "Sacarato de Óxido Férrico 20mg/mL injetável",
  "Enoxaparina 40mg/0,4mL"
];
const RESPONSAVEIS = ["Cinthia M.", "Daniel C.", "Luana Q.", "Marcos J."];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const ITENS_DIABETES = {
    Canetas: ["Caneta de Insulina NPH", "Caneta de Insulina Rápida", "Caneta de Insulina Glargina"],
    Refis: ["Refil de Lanceta", "Refil de Fita Glicêmica"],
    Insumos: ["Algodão", "Álcool 70%", "Seringa 1mL", "Agulha 31G"]
};

// ============ VARIÁVEIS ============
let pacientes = [];
let registrosCtrl = [];
let registrosEsp = [];
let estoque = {};
let registrosDiabetes = { canetas: [], refis: [], insumos: [] };
let limitesRefil = JSON.parse(localStorage.getItem('limites_refil') || '{}');

let medicamentosAtivosCtrl = [...MEDICAMENTOS_CTRL];
let responsaveisAtivos = [...RESPONSAVEIS];
let medicamentosEstoqueBaixo = JSON.parse(localStorage.getItem('meds_estoque_baixo') || '[]');
let acsOptions = JSON.parse(localStorage.getItem('acs_options') || '["ACS 1","ACS 2","ACS 3"]');
let ubsOptions = JSON.parse(localStorage.getItem('ubs_options') || '["UBS Central","UBS Norte","UBS Sul"]');

let mesCtrl = 'todos', mesEsp = 'todos', mesDiabetes = 'todos';
let dashboardMesCtrl = null, dashboardMesEsp = null, dashboardMesDiabetes = null;
let cfgEstoqueCritico = parseInt(localStorage.getItem('cfg_estoque_critico') || '5', 10);
let cfgEstoqueBaixo = parseInt(localStorage.getItem('cfg_estoque_baixo') || '15', 10);
let filaOffline = JSON.parse(localStorage.getItem('fila_offline') || '[]');

// Controles de salvamento
let salvandoControlado = false;
let salvandoEspecial = false;
let salvandoDiabetes = false;
let salvandoPaciente = false;

// ============ INICIALIZAÇÃO ============
function inicializar() {
    medicamentosAtivosCtrl = JSON.parse(localStorage.getItem('meds_344') || 'null') || [...MEDICAMENTOS_CTRL];
    responsaveisAtivos = JSON.parse(localStorage.getItem('resps_344') || 'null') || [...RESPONSAVEIS];
    pacientes = JSON.parse(localStorage.getItem('ctrl_pacientes') || '[]');
    registrosCtrl = JSON.parse(localStorage.getItem('registros_344') || '[]');
    registrosEsp = JSON.parse(localStorage.getItem('registros_esp') || '[]');
    estoque = JSON.parse(localStorage.getItem('estoque_esp') || '{"Sacarato de Óxido Férrico 20mg/mL injetável":0,"Enoxaparina 40mg/0,4mL":0}');
    registrosDiabetes.canetas = JSON.parse(localStorage.getItem('diabetes_canetas') || '[]');
    registrosDiabetes.refis = JSON.parse(localStorage.getItem('diabetes_refis') || '[]');
    registrosDiabetes.insumos = JSON.parse(localStorage.getItem('diabetes_insumos') || '[]');
    dashboardMesCtrl = localStorage.getItem('dashboard_mes_344') || null;
    dashboardMesEsp = localStorage.getItem('dashboard_mes_esp') || null;
    dashboardMesDiabetes = localStorage.getItem('dashboard_mes_diabetes') || null;

    carregarOpcoesDiabetes();
    carregarSelectsCtrl();
    carregarSelectsEsp();
    carregarSelectsDiabetes();
    carregarDashboardCtrl();
    carregarDashboardEsp();
    carregarDashboardDiabetes();
    carregarSelectPacientesTodos();

    const hoje = new Date();
    const ctrlData = document.getElementById('ctrlData');
    const espData = document.getElementById('espData');
    const diabData = document.getElementById('diabetesData');
    if (ctrlData) ctrlData.valueAsDate = hoje;
    if (espData) espData.valueAsDate = hoje;
    if (diabData) diabData.valueAsDate = hoje;

    const titulo = document.getElementById('ctrlTituloContagem');
    if (titulo) titulo.textContent = MESES[hoje.getMonth()];

    atualizarModuloControlados();
    atualizarModuloEspeciais();
    atualizarModuloDiabetes();
    sincronizarTudo();

    window.addEventListener('online', () => {
        mostrarStatus('🌐 Internet restaurada! Sincronizando...', 'info');
        processarFilaOffline();
    });
    window.addEventListener('offline', () => {
        mostrarStatus('⚠️ Sem internet! Registros salvos localmente.', 'alerta');
    });
    if (navigator.onLine && filaOffline.length > 0) processarFilaOffline();

    console.log(`🚀 v${VERSAO} - Com sincronização forçada e logs`);
}

// ============ TROCA DE MÓDULO ============
function trocarModulo(modulo) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modulo').forEach(m => m.classList.remove('active'));

    if (modulo === 'controlados') {
        document.querySelector('.nav-tab:nth-child(1)').classList.add('active');
        document.getElementById('modulo-controlados').classList.add('active');
    } else if (modulo === 'especiais') {
        document.querySelector('.nav-tab:nth-child(2)').classList.add('active');
        document.getElementById('modulo-especiais').classList.add('active');
    } else if (modulo === 'diabetes') {
        document.querySelector('.nav-tab:nth-child(3)').classList.add('active');
        document.getElementById('modulo-diabetes').classList.add('active');
    }
}

// ============ API ============
async function lerPlanilha(sheetId, range) {
    try {
        const response = await fetch(`${API_URL}/api/ler-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planilhaId: sheetId, range: range })
        });
        if (!response.ok) {
            const erro = await response.text();
            throw new Error(`Erro ${response.status}: ${erro}`);
        }
        const data = await response.json();
        return data.valores || [];
    } catch (error) {
        console.error('Erro ao ler planilha:', error);
        mostrarStatus(`❌ Erro ao ler planilha: ${error.message}`, 'erro');
        return [];
    }
}

async function escreverPlanilha(sheetId, range, values) {
    try {
        const response = await fetch(`${API_URL}/api/escrever-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planilhaId: sheetId, range: range, valores: values })
        });
        if (!response.ok) {
            const erro = await response.text();
            throw new Error(`Erro ${response.status}: ${erro}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erro ao escrever planilha:', error);
        mostrarStatus(`❌ Erro ao salvar: ${error.message}`, 'erro');
        throw error;
    }
}

// ============ FILA OFFLINE ============
function adicionarFilaOffline(tipo, sheetId, range, dados) {
    filaOffline.push({ id: Date.now(), tipo, sheetId, range, dados, data: new Date().toISOString() });
    localStorage.setItem('fila_offline', JSON.stringify(filaOffline));
    atualizarContadorFila();
}

async function processarFilaOffline() {
    if (filaOffline.length === 0 || !navigator.onLine) return;
    let processados = 0;
    for (const item of [...filaOffline]) {
        try {
            await escreverPlanilha(item.sheetId, item.range, item.dados);
            processados++;
            filaOffline = filaOffline.filter(f => f.id !== item.id);
        } catch (e) {
            console.error('Erro ao processar fila:', e);
            break;
        }
    }
    localStorage.setItem('fila_offline', JSON.stringify(filaOffline));
    if (processados > 0) {
        mostrarStatus(`✅ ${processados} registro(s) sincronizado(s)!`, 'sucesso');
        await sincronizarTudo();
    }
    atualizarContadorFila();
}

function atualizarContadorFila() {
    const el = document.getElementById('diabetesFila');
    if (el) el.textContent = filaOffline.length;
}

// ============ SINCRONIZAÇÃO FORÇADA (COM LOGS) ============
async function sincronizarTudo(force = false) {
    const sd = document.getElementById('statusDot');
    const st = document.getElementById('statusText');
    if (sd) sd.style.background = '#ffa500';
    if (st) st.textContent = 'Sincronizando...';

    // Se force for true, limpa o localStorage dos dados para forçar recarga
    if (force) {
        console.log('🔄 Forçando sincronização - limpando cache local');
        localStorage.removeItem('ctrl_pacientes');
        localStorage.removeItem('registros_344');
        localStorage.removeItem('registros_esp');
        localStorage.removeItem('diabetes_canetas');
        localStorage.removeItem('diabetes_refis');
        localStorage.removeItem('diabetes_insumos');
        // Recarrega os dados vazios
        pacientes = [];
        registrosCtrl = [];
        registrosEsp = [];
        registrosDiabetes = { canetas: [], refis: [], insumos: [] };
    }

    try {
        // 1. PACIENTES (sempre da planilha)
        console.log('📥 Lendo pacientes...');
        const dp = await lerPlanilha(SHEET_ID_PACIENTES, 'Pacientes!A1:F1000');
        if (dp.length > 1) {
            pacientes = dp.slice(1).filter(r => r[1] && r[2]).map(r => ({
                id: r[0] || '',
                nome: r[1] || '',
                nascimento: r[2] || '',
                acs: r[3] || '',
                telefone: r[4] || '',
                ubs: r[5] || ''
            }));
            localStorage.setItem('ctrl_pacientes', JSON.stringify(pacientes));
            console.log(`✅ ${pacientes.length} pacientes carregados`);
        } else {
            console.warn('⚠️ Nenhum paciente encontrado na planilha');
        }
        carregarSelectPacientesTodos();

        // 2. CONTROLADOS
        console.log('📥 Lendo controlados...');
        const dc = await lerPlanilha(SHEET_ID_CTRL, 'Registros!A1:G1000');
        if (dc.length > 1) {
            registrosCtrl = dc.slice(1).filter(r => r.length >= 5 && r[1] && r[2]).map(r => ({
                data: nData(r[0] || ''),
                paciente: (r[1] || '').trim(),
                medicamento: (r[2] || '').trim(),
                quantidade: parseFloat(r[3] || 0),
                responsavel: (r[4] || '').trim(),
                repetente: (r[5] || 'Não'),
                pendente: (r[6] || '').trim() === 'Pendente próximo mês'
            }));
            localStorage.setItem('registros_344', JSON.stringify(registrosCtrl));
            console.log(`✅ ${registrosCtrl.length} registros controlados carregados`);
        } else {
            console.warn('⚠️ Nenhum registro controlado encontrado');
        }

        // 3. ESPECIAIS
        console.log('📥 Lendo especiais...');
        try {
            const de = await lerPlanilha(SHEET_ID_ESP, 'Página1!A1:H1000');
            if (de.length > 1) {
                registrosEsp = de.slice(1).filter(r => r.length >= 5 && r[1] && r[2]).map(r => ({
                    data: nData(r[0] || ''),
                    paciente: (r[1] || '').trim(),
                    medicamento: (r[2] || '').trim(),
                    ampolas: parseInt(r[3]) || 0,
                    prescritor: (r[4] || '').trim(),
                    cicloAtual: (r[5] || '').trim(),
                    ciclosEV: parseInt(r[6]) || 0,
                    estoque: parseInt(r[7]) || 0
                }));
                localStorage.setItem('registros_esp', JSON.stringify(registrosEsp));
                console.log(`✅ ${registrosEsp.length} registros especiais carregados`);
            } else {
                console.warn('⚠️ Nenhum registro especial encontrado');
            }
        } catch (e) {
            console.error('Erro ao ler especiais:', e);
        }

        // 4. DIABETES (Canetas, Refis, Insumos)
        console.log('📥 Lendo diabetes...');
        registrosDiabetes.canetas = [];
        registrosDiabetes.refis = [];
        registrosDiabetes.insumos = [];

        const abas = [
            { nome: 'Canetas', range: 'Canetas!A1:D1000', destino: 'canetas' },
            { nome: 'Refis', range: 'Refis!A1:D1000', destino: 'refis' },
            { nome: 'Insumos', range: 'Insumos!A1:E1000', destino: 'insumos' }
        ];

        for (const aba of abas) {
            try {
                const dados = await lerPlanilha(SHEET_ID_DIABETES, aba.range);
                if (dados.length > 1) {
                    const registros = dados.slice(1).filter(r => r[0] && r[1]).map(r => ({
                        data: nData(r[0] || ''),
                        paciente: (r[1] || '').trim(),
                        ...(aba.destino === 'canetas' && { lote: (r[2] || '').trim(), obs: (r[3] || '').trim() }),
                        ...(aba.destino === 'refis' && { quantidade: parseInt(r[2]) || 0, limite: parseInt(r[3]) || 0 }),
                        ...(aba.destino === 'insumos' && { tipo: (r[2] || '').trim(), item: (r[3] || '').trim(), quantidade: parseInt(r[4]) || 0 })
                    }));
                    registrosDiabetes[aba.destino] = registros;
                    console.log(`✅ ${registros.length} registros de ${aba.nome} carregados`);
                } else {
                    console.warn(`⚠️ Nenhum registro de ${aba.nome} encontrado`);
                }
            } catch (e) {
                console.error(`Erro ao ler ${aba.nome}:`, e);
            }
        }

        localStorage.setItem('diabetes_canetas', JSON.stringify(registrosDiabetes.canetas));
        localStorage.setItem('diabetes_refis', JSON.stringify(registrosDiabetes.refis));
        localStorage.setItem('diabetes_insumos', JSON.stringify(registrosDiabetes.insumos));

        if (sd) sd.style.background = '#48bb78';
        if (st) st.textContent = '✅ Conectado';
        mostrarStatus('✅ Sincronização concluída!', 'sucesso');
        console.log('✅ Sincronização finalizada com sucesso');
    } catch (e) {
        console.error('❌ Erro na sincronização:', e);
        if (sd) sd.style.background = '#f56565';
        if (st) st.textContent = '⚠️ Erro';
        mostrarStatus(`❌ Erro ao sincronizar: ${e.message}`, 'erro');
    }

    carregarSelectPacientesTodos();
    carregarDashboardCtrl();
    carregarDashboardEsp();
    carregarDashboardDiabetes();
    atualizarModuloControlados();
    atualizarModuloEspeciais();
    atualizarModuloDiabetes();
    atualizarContadorFila();
}

// Função para forçar sincronização (pode ser chamada de um botão)
function forcarSincronizacao() {
    if (confirm('⚠️ Isso vai apagar os dados locais e recarregar tudo da planilha. Continuar?')) {
        sincronizarTudo(true);
    }
}

// ============ FUNÇÕES AUXILIARES ============
function nData(s) {
    if (!s) return '';
    s = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes('/')) {
        const p = s.split('/');
        if (p.length === 3) return `${p[2].padStart(4, '20')}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
    return '';
}

function fData(s) {
    if (!s) return '';
    try {
        const p = s.split('-');
        if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    } catch (e) {}
    return s;
}

// ============ PACIENTES ============
function carregarSelectPacientesTodos() {
    const listas = ['listaPacientesCtrl', 'listaPacientesEsp', 'listaPacientesDiabetes'];
    const opts = pacientes.map(p => `<option value="${p.nome}">${p.nome} - ${p.ubs || 'Sem UBS'}</option>`).join('');
    listas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}

function carregarOpcoesDiabetes() {
    const acsList = document.getElementById('listaAcsOptions');
    const ubsList = document.getElementById('listaUbsOptions');
    if (acsList) acsList.innerHTML = acsOptions.map(o => `<option value="${o}">`).join('');
    if (ubsList) ubsList.innerHTML = ubsOptions.map(o => `<option value="${o}">`).join('');
}

// ============ STATUS E NAVEGAÇÃO ============
function mostrarStatus(m, tipo) {
    const s = document.getElementById('statusFlutuante');
    if (!s) return;
    s.textContent = m;
    s.className = `status-registro status-${tipo}`;
    s.style.display = 'block';
    setTimeout(() => { s.style.display = 'none'; }, 5000);
}

function irParaTopo() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function irParaBase() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }

window.addEventListener('scroll', function() {
    const b = document.querySelectorAll('.btn-navegacao');
    const s = window.pageYOffset || document.documentElement.scrollTop;
    if (s > 300) {
        b.forEach(btn => btn.classList.add('visivel'));
    } else {
        b.forEach(btn => btn.classList.remove('visivel'));
    }
});

// ============ CADASTRO DE PACIENTE (via Diabetes) ============
async function cadastrarPaciente() {
    if (salvandoPaciente) {
        mostrarStatus('⏳ Aguarde, salvando paciente...', 'info');
        return;
    }
    salvandoPaciente = true;
    const btn = document.querySelector('#modulo-diabetes .form-section .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '💾 Salvando...'; }

    try {
        const nome = document.getElementById('diabPacNome').value.trim();
        const nasc = document.getElementById('diabPacNasc').value;
        const acs = document.getElementById('diabPacACS').value.trim();
        const tel = document.getElementById('diabPacTel').value.trim();
        const ubs = document.getElementById('diabPacUBS').value.trim();

        if (!nome || !nasc) {
            mostrarStatus('⚠️ Nome e Nascimento são obrigatórios!', 'alerta');
            return;
        }

        const id = 'P' + Date.now().toString(36).toUpperCase();
        const valores = [id, nome, nasc, acs, tel, ubs];

        pacientes.push({ id, nome, nascimento: nasc, acs, telefone: tel, ubs });
        localStorage.setItem('ctrl_pacientes', JSON.stringify(pacientes));
        carregarSelectPacientesTodos();

        if (navigator.onLine) {
            try {
                await escreverPlanilha(SHEET_ID_PACIENTES, 'Pacientes!A:F', valores);
                mostrarStatus(`✅ Paciente ${nome} cadastrado!`, 'sucesso');
            } catch (e) {
                adicionarFilaOffline('paciente', SHEET_ID_PACIENTES, 'Pacientes!A:F', valores);
                mostrarStatus('💾 Salvo offline', 'info');
            }
        } else {
            adicionarFilaOffline('paciente', SHEET_ID_PACIENTES, 'Pacientes!A:F', valores);
            mostrarStatus('💾 Offline! Salvo localmente.', 'info');
        }

        document.getElementById('diabPacNome').value = '';
        document.getElementById('diabPacNasc').value = '';
        document.getElementById('diabPacACS').value = '';
        document.getElementById('diabPacTel').value = '';
        document.getElementById('diabPacUBS').value = '';
    } finally {
        salvandoPaciente = false;
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Paciente'; }
    }
}

// ============ DIABETES ============
function carregarSelectsDiabetes() {
    const selFiltro = document.getElementById('diabetesFiltroTipo');
    if (selFiltro) {
        selFiltro.innerHTML = `<option value="todos">Todos os Tipos</option>
                               <option value="Canetas">Canetas</option>
                               <option value="Refis">Refis</option>
                               <option value="Insumos">Insumos</option>`;
    }
    atualizarItensDiabetes();
}

function atualizarItensDiabetes() {
    const tipoEl = document.getElementById('diabetesTipo');
    const sel = document.getElementById('diabetesItem');
    if (!tipoEl || !sel) return;
    const tipo = tipoEl.value;
    if (!tipo) {
        sel.innerHTML = '<option value="">Selecione primeiro o Tipo</option>';
        return;
    }
    const itens = ITENS_DIABETES[tipo] || [];
    sel.innerHTML = '<option value="">Selecione</option>' + itens.map(i => `<option value="${i}">${i}</option>`).join('');
}

function carregarDashboardDiabetes() {
    const s = document.getElementById('dashboardMesDiabetes');
    if (!s) return;
    s.innerHTML = '<option value="atual">Mês Atual</option>';
    const todosRegistros = [...registrosDiabetes.canetas, ...registrosDiabetes.refis, ...registrosDiabetes.insumos];
    const m = new Set();
    todosRegistros.forEach(r => {
        if (r.data) {
            const p = r.data.split('-');
            if (p.length >= 2) m.add(`${p[0]}-${parseInt(p[1]) - 1}`);
        }
    });
    Array.from(m).sort().reverse().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        s.innerHTML += `<option value="${k}" ${dashboardMesDiabetes === k ? 'selected' : ''}>${MESES[me]} de ${a}</option>`;
    });
    if (dashboardMesDiabetes && m.has(dashboardMesDiabetes)) s.value = dashboardMesDiabetes;
}

function atualizarDashboardDiabetes() {
    const s = document.getElementById('dashboardMesDiabetes');
    if (!s) return;
    const v = s.value;
    if (v !== 'atual') {
        dashboardMesDiabetes = v;
        localStorage.setItem('dashboard_mes_diabetes', dashboardMesDiabetes);
    } else {
        dashboardMesDiabetes = null;
        localStorage.removeItem('dashboard_mes_diabetes');
    }

    let mf, af, nm;
    if (v === 'atual') {
        const h = new Date();
        mf = h.getMonth();
        af = h.getFullYear();
        nm = MESES[mf];
    } else {
        const [a, me] = v.split('-').map(Number);
        mf = me;
        af = a;
        nm = MESES[me];
    }
    const mesLabel = document.getElementById('diabetesMesLabel');
    if (mesLabel) mesLabel.textContent = `${nm} de ${af}`;

    const todosRegistros = [...registrosDiabetes.canetas, ...registrosDiabetes.refis, ...registrosDiabetes.insumos];
    const rf = todosRegistros.filter(r => {
        if (!r.data) return false;
        const p = r.data.split('-');
        return p.length >= 2 && parseInt(p[1]) - 1 === mf && parseInt(p[0]) === af;
    });

    const totalEl = document.getElementById('diabetesTotal');
    if (totalEl) totalEl.textContent = rf.length;
    const pacEl = document.getElementById('diabetesPacientes');
    if (pacEl) pacEl.textContent = new Set(rf.map(r => r.paciente.toLowerCase())).size;
    const itensEl = document.getElementById('diabetesItens');
    if (itensEl) {
        let qtd = 0;
        rf.forEach(r => { if (r.quantidade) qtd += r.quantidade; });
        itensEl.textContent = qtd;
    }
    atualizarContadorFila();
}

async function registrarDiabetes() {
    if (salvandoDiabetes) {
        mostrarStatus('⏳ Aguarde, registrando...', 'info');
        return;
    }
    salvandoDiabetes = true;
    const btn = document.querySelector('#modulo-diabetes .btn-dia');
    if (btn) { btn.disabled = true; btn.textContent = '🩸 Salvando...'; }

    try {
        const data = document.getElementById('diabetesData').value;
        const paciente = document.getElementById('diabetesPaciente').value.trim();
        const tipo = document.getElementById('diabetesTipo').value;
        const item = document.getElementById('diabetesItem').value;
        const qtd = parseInt(document.getElementById('diabetesQuantidade').value);
        const obs = document.getElementById('diabetesObs').value.trim();

        if (!data || !paciente || !tipo || !item || !qtd) {
            mostrarStatus('⚠️ Preencha todos os campos obrigatórios!', 'alerta');
            return;
        }
        if (qtd <= 0) {
            mostrarStatus('⚠️ Quantidade inválida!', 'alerta');
            return;
        }

        let valores, range, destino;
        if (tipo === 'Canetas') {
            valores = [data, paciente, item, obs];
            range = 'Canetas!A1:D1000';
            destino = 'canetas';
            registrosDiabetes.canetas.push({ data, paciente, lote: item, obs });
            localStorage.setItem('diabetes_canetas', JSON.stringify(registrosDiabetes.canetas));
        } else if (tipo === 'Refis') {
            const limite = limitesRefil[paciente] || 3;
            const hoje = new Date(data + 'T00:00:00');
            const mesAtual = hoje.getMonth();
            const anoAtual = hoje.getFullYear();
            const retiradoEsteMes = registrosDiabetes.refis
                .filter(r => r.paciente === paciente && r.data)
                .filter(r => {
                    const d = new Date(r.data + 'T00:00:00');
                    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
                })
                .reduce((s, r) => s + r.quantidade, 0);
            if (retiradoEsteMes + qtd > limite) {
                mostrarStatus(`⚠️ Limite excedido!\nLimite: ${limite} | Já retirado: ${retiradoEsteMes} | Tentando: ${qtd}`, 'alerta');
                return;
            }
            valores = [data, paciente, qtd, limite];
            range = 'Refis!A1:D1000';
            destino = 'refis';
            registrosDiabetes.refis.push({ data, paciente, quantidade: qtd, limite });
            localStorage.setItem('diabetes_refis', JSON.stringify(registrosDiabetes.refis));
        } else if (tipo === 'Insumos') {
            valores = [data, paciente, item, qtd];
            range = 'Insumos!A1:E1000';
            destino = 'insumos';
            registrosDiabetes.insumos.push({ data, paciente, tipo: item, item: item, quantidade: qtd });
            localStorage.setItem('diabetes_insumos', JSON.stringify(registrosDiabetes.insumos));
        } else {
            mostrarStatus('⚠️ Tipo inválido!', 'alerta');
            return;
        }

        if (navigator.onLine) {
            try {
                const dadosExistentes = await lerPlanilha(SHEET_ID_DIABETES, range);
                const novasLinhas = dadosExistentes.concat([valores]);
                await escreverPlanilha(SHEET_ID_DIABETES, range, novasLinhas);
                mostrarStatus(`✅ ${tipo} registrado para ${paciente}!`, 'sucesso');
            } catch (e) {
                adicionarFilaOffline('diabetes', SHEET_ID_DIABETES, range, valores);
                mostrarStatus('💾 Salvo offline', 'info');
            }
        } else {
            adicionarFilaOffline('diabetes', SHEET_ID_DIABETES, range, valores);
            mostrarStatus('💾 Offline! Salvo localmente.', 'info');
        }

        document.getElementById('diabetesPaciente').value = '';
        document.getElementById('diabetesTipo').value = '';
        document.getElementById('diabetesItem').innerHTML = '<option value="">Selecione primeiro o Tipo</option>';
        document.getElementById('diabetesQuantidade').value = '';
        document.getElementById('diabetesObs').value = '';
        document.getElementById('diabetesData').valueAsDate = new Date();

        carregarDashboardDiabetes();
        atualizarModuloDiabetes();
    } finally {
        salvandoDiabetes = false;
        if (btn) { btn.disabled = false; btn.textContent = '🩸 Registrar'; }
    }
}

function filtrarDiabetesMes(mes) {
    mesDiabetes = mes;
    atualizarModuloDiabetes();
}

function aplicarFiltrosDiabetes() {
    const filtroTipo = document.getElementById('diabetesFiltroTipo');
    const filtroPaciente = document.getElementById('diabetesFiltroPaciente');
    if (!filtroTipo || !filtroPaciente) return;

    const tipo = filtroTipo.value;
    const paciente = filtroPaciente.value.toLowerCase();

    let todos = [];
    todos = todos.concat(registrosDiabetes.canetas.map(r => ({ ...r, tipo: 'Canetas' })));
    todos = todos.concat(registrosDiabetes.refis.map(r => ({ ...r, tipo: 'Refis' })));
    todos = todos.concat(registrosDiabetes.insumos.map(r => ({ ...r, tipo: 'Insumos' })));

    let dados = [...todos];
    if (mesDiabetes !== 'todos') {
        dados = dados.filter(r => {
            if (!r.data) return false;
            const p = r.data.split('-');
            return p.length >= 2 && MESES[parseInt(p[1]) - 1] === mesDiabetes;
        });
    }
    if (tipo !== 'todos') dados = dados.filter(r => r.tipo === tipo);
    if (paciente) dados = dados.filter(r => r.paciente.toLowerCase().includes(paciente));

    dados.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const tb = document.getElementById('diabetesTabela');
    if (!tb) return;
    if (dados.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;">Nenhum registro</td></tr>';
        return;
    }
    tb.innerHTML = dados.map(r => `
        <tr>
            <td>${fData(r.data)}</td>
            <td>${r.paciente}</td>
            <td>${r.tipo}</td>
            <td>${r.lote || r.tipo === 'Insumos' ? r.tipo : (r.item || '')}</td>
            <td>${r.quantidade || r.lote ? '1' : ''}</td>
            <td>${r.obs || '-'}</td>
        </tr>
    `).join('');
    const count = document.getElementById('diabetesResultCount');
    if (count) count.textContent = `${dados.length} registros`;
}

function atualizarModuloDiabetes() {
    carregarDashboardDiabetes();
    carregarSelectsDiabetes();
    carregarSelectPacientesTodos();
    carregarOpcoesDiabetes();

    const tc = document.getElementById('diabetesMonthTabs');
    if (!tc) return;
    tc.innerHTML = `<div class="month-tab ${mesDiabetes === 'todos' ? 'active' : ''}" onclick="filtrarDiabetesMes('todos')">📋 Todos</div>`;

    const todos = [];
    todos.push(...registrosDiabetes.canetas.map(r => ({ ...r, tipo: 'Canetas' })));
    todos.push(...registrosDiabetes.refis.map(r => ({ ...r, tipo: 'Refis' })));
    todos.push(...registrosDiabetes.insumos.map(r => ({ ...r, tipo: 'Insumos' })));

    const mc = new Set();
    todos.forEach(r => {
        if (r.data) {
            const p = r.data.split('-');
            if (p.length >= 2) mc.add(`${parseInt(p[0])}-${parseInt(p[1]) - 1}`);
        }
    });
    Array.from(mc).sort().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        const nm = MESES[me];
        const c = todos.filter(r => {
            if (!r.data) return false;
            const p = r.data.split('-');
            return p.length >= 2 && parseInt(p[1]) - 1 === me && parseInt(p[0]) === a;
        });
        tc.innerHTML += `<div class="month-tab ${mesDiabetes === nm ? 'active' : ''}" onclick="filtrarDiabetesMes('${nm}')">${nm} (${c.length})</div>`;
    });

    atualizarDashboardDiabetes();
    aplicarFiltrosDiabetes();
}

// ============ CONTROLADOS (sem alterações significativas) ============
// ... (mantenha o código original de controlados e especiais, pois não foram alterados)
// Para economia de espaço, estou omitindo as funções completas de controlados e especiais,
// mas você deve mantê-las exatamente como estavam. Elas não são o foco da correção.

// ============ CONFIGURAÇÕES ============
// ... (mantenha as funções de configuração existentes)

// ============ INICIALIZAR ============
inicializar();
