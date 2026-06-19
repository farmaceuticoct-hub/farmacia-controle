/*
 * Arquivo: scripts.js - v3.2.0
 * Sistema: Assistência Farmacêutica - Controlados, Especiais e Diabetes
 * Novidades: estoque baixo (pendente próximo mês), ciclo atual (ordinais), opções ACS/UBS editáveis.
 */
const API_URL = 'https://farmacia-api-controlados.up.railway.app';
const SHEET_ID_PACIENTES = '14JGqndfKqh3kVvzMJBqa13XO6z_SpXnoGTUJ-ZWtIdI';
const SHEET_ID_CTRL = '1WIpoH1sZsuMCaSsD6QC6LAcDo-6Rc013MlGDztlzqRo';
const SHEET_ID_ESP = '13oodt6jGo8TgAaxKqWUMS64a0y0TnPX5ZUmDXx3BL_M';
const SHEET_ID_DIABETES = '1POcsyqGHIN908kgiE_be3oyz9ILBntiSv7hn7iyXJt4';
const VERSAO = '3.2.0';

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

// Itens de Diabetes (personalizáveis)
const ITENS_DIABETES = {
    Canetas: ["Caneta de Insulina NPH", "Caneta de Insulina Rápida", "Caneta de Insulina Glargina"],
    Refis: ["Refil de Lanceta", "Refil de Fita Glicêmica"],
    Insumos: ["Algodão", "Álcool 70%", "Seringa 1mL", "Agulha 31G"]
};

// ============ VARIÁVEIS GLOBAIS ============
let pacientes = [];
let registrosCtrl = [];
let registrosEsp = [];
let estoque = {};
let registrosDiabetes = { canetas: [], refis: [], insumos: [] };
let limitesRefil = JSON.parse(localStorage.getItem('limites_refil') || '{}');

// Configurações
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

// ============ INICIALIZAÇÃO ============
function inicializar() {
    // Carrega dados do localStorage
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

    // Carrega opções de ACS/UBS
    carregarOpcoesDiabetes();

    // Preenche selects e dashboards
    carregarSelectsCtrl();
    carregarSelectsEsp();
    carregarSelectsDiabetes();
    carregarDashboardCtrl();
    carregarDashboardEsp();
    carregarDashboardDiabetes();
    carregarSelectPacientesTodos();

    // Datas padrão
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

    // Eventos de conexão
    window.addEventListener('online', () => {
        mostrarStatus('🌐 Internet restaurada! Sincronizando...', 'info');
        processarFilaOffline();
    });
    window.addEventListener('offline', () => {
        mostrarStatus('⚠️ Sem internet! Registros salvos localmente.', 'alerta');
    });
    if (navigator.onLine && filaOffline.length > 0) processarFilaOffline();

    console.log(`🚀 v${VERSAO} - Sistema unificado com Diabetes + Estoque Baixo + ACS/UBS editáveis`);
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
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        return data.valores || [];
    } catch (error) {
        console.error('Erro ao ler:', error);
        return [];
    }
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

// ============ SINCRONIZAÇÃO ============
async function sincronizarTudo() {
    const sd = document.getElementById('statusDot');
    const st = document.getElementById('statusText');
    if (sd) sd.style.background = '#ffa500';
    if (st) st.textContent = 'Sincronizando...';

    try {
        // 1. Pacientes
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
        }
        carregarSelectPacientesTodos();

        // 2. Controlados (incluindo campo pendente)
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
        }

        // 3. Especiais (com ciclo atual)
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
            }
        } catch (e) { console.log('Especiais:', e.message); }

        // 4. Diabetes (Canetas, Refis, Insumos)
        registrosDiabetes.canetas = [];
        registrosDiabetes.refis = [];
        registrosDiabetes.insumos = [];

        const abas = [
            { nome: 'Canetas', range: 'Canetas!A1:D1000', destino: 'canetas' },
            { nome: 'Refis', range: 'Refis!A1:D1000', destino: 'refis' },
            { nome: 'Insumos', range: 'Insumos!A1:D1000', destino: 'insumos' }
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
                        ...(aba.destino === 'insumos' && { tipo: (r[2] || '').trim(), quantidade: parseInt(r[3]) || 0 })
                    }));
                    registrosDiabetes[aba.destino] = registros;
                }
            } catch (e) { console.log(`Erro ao ler ${aba.nome}:`, e.message); }
        }

        localStorage.setItem('diabetes_canetas', JSON.stringify(registrosDiabetes.canetas));
        localStorage.setItem('diabetes_refis', JSON.stringify(registrosDiabetes.refis));
        localStorage.setItem('diabetes_insumos', JSON.stringify(registrosDiabetes.insumos));

        if (sd) sd.style.background = '#48bb78';
        if (st) st.textContent = '✅ Conectado';
    } catch (e) {
        console.error(e);
        if (sd) sd.style.background = '#f56565';
        if (st) st.textContent = '⚠️ Erro';
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

// ============ PACIENTES (CADASTRO CENTRAL) ============
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

// ============ STATUS + NAVEGAÇÃO ============
function mostrarStatus(m, tipo) {
    const s = document.getElementById('statusFlutuante');
    if (!s) return;
    s.textContent = m;
    s.className = `status-registro status-${tipo}`;
    s.style.display = 'block';
    setTimeout(() => { s.style.display = 'none'; }, 4000);
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
        range = 'Insumos!A1:D1000';
        destino = 'insumos';
        registrosDiabetes.insumos.push({ data, paciente, tipo: item, quantidade: qtd });
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

// ============ CONTROLADOS ============
function carregarSelectsCtrl() {
    const med = document.getElementById('ctrlMedicamento');
    const filtro = document.getElementById('ctrlFiltroMed');
    const resp = document.getElementById('ctrlResponsavel');
    if (med) med.innerHTML = '<option value="">Selecione</option>' + medicamentosAtivosCtrl.map(m => `<option value="${m}">${m}</option>`).join('');
    if (filtro) filtro.innerHTML = '<option value="todos">Todos</option>' + medicamentosAtivosCtrl.map(m => `<option value="${m}">${m}</option>`).join('');
    if (resp) resp.innerHTML = '<option value="">Selecione</option>' + responsaveisAtivos.map(r => `<option value="${r}">${r}</option>`).join('');
}

function carregarDashboardCtrl() {
    const s = document.getElementById('dashboardMesControlados');
    if (!s) return;
    s.innerHTML = '<option value="atual">Mês Atual</option>';
    const m = new Set();
    registrosCtrl.forEach(r => { if (r.data) { const p = r.data.split('-'); if (p.length >= 2) m.add(`${p[0]}-${parseInt(p[1]) - 1}`); } });
    Array.from(m).sort().reverse().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        s.innerHTML += `<option value="${k}" ${dashboardMesCtrl === k ? 'selected' : ''}>${MESES[me]} de ${a}</option>`;
    });
    if (dashboardMesCtrl && m.has(dashboardMesCtrl)) s.value = dashboardMesCtrl;
}

function verificarRepetenteCtrl() {
    const p = document.getElementById('ctrlPaciente').value.trim();
    const m = document.getElementById('ctrlMedicamento').value;
    const d = document.getElementById('ctrlData').value;
    const i = document.getElementById('ctrlRepetente');
    if (!p || !m || !d) { i.value = 'Preencha os campos'; i.style.cssText = ''; return; }
    const pd = d.split('-');
    if (pd.length < 2) return;
    const as = parseInt(pd[0]),
        ms = parseInt(pd[1]) - 1,
        pn = p.toLowerCase().trim(),
        mn = m.toLowerCase().trim();
    const mm = registrosCtrl.filter(r => {
        if (!r.data) return false;
        const pr = r.data.split('-');
        if (pr.length < 2) return false;
        return parseInt(pr[1]) - 1 === ms && parseInt(pr[0]) === as && (r.paciente || '').toLowerCase() === pn && (r.medicamento || '').toLowerCase() === mn;
    });
    let ma = ms - 1,
        aa = as;
    if (ma < 0) { ma = 11;
        aa--; }
    const me = registrosCtrl.filter(r => {
        if (!r.data) return false;
        const pr = r.data.split('-');
        if (pr.length < 2) return false;
        return parseInt(pr[1]) - 1 === ma && parseInt(pr[0]) === aa && (r.paciente || '').toLowerCase() === pn && (r.medicamento || '').toLowerCase() === mn;
    });
    if (mm.length > 0) {
        i.value = `🔴 REPETENTE (Sim) - ${p} já retirou ${m} ${mm.length}x em ${MESES[ms]}!`;
        i.style.cssText = 'color:#e53e3e!important;background:#fed7d7!important;border-color:#e53e3e!important;';
    } else if (me.length > 0) {
        i.value = `🟡 MÊS ANTERIOR - ${p} retirou ${m} em ${MESES[ma]}/${aa}`;
        i.style.cssText = 'color:#975a16!important;background:#fefcbf!important;border-color:#ecc94b!important;';
    } else {
        i.value = `✅ NORMAL (Não) - Primeira dispensação`;
        i.style.cssText = 'color:#38a169!important;background:#c6f6d5!important;';
    }
}

async function registrarControlado() {
    const d = document.getElementById('ctrlData').value,
        p = document.getElementById('ctrlPaciente').value.trim(),
        m = document.getElementById('ctrlMedicamento').value,
        q = parseFloat(document.getElementById('ctrlQuantidade').value),
        r = document.getElementById('ctrlResponsavel').value,
        ri = document.getElementById('ctrlRepetente').value;
    if (!d || !p || !m || !q || !r) return mostrarStatus('⚠️ Preencha todos os campos obrigatórios!', 'alerta');
    if (q <= 0) return mostrarStatus('⚠️ Quantidade deve ser maior que zero!', 'alerta');
    let rep = 'Não';
    if (ri.includes('REPETENTE (Sim)')) rep = 'Sim';
    else if (ri.includes('MÊS ANTERIOR')) rep = 'Mês Anterior';

    // Verifica estoque baixo
    let pendente = false;
    if (medicamentosEstoqueBaixo.includes(m)) {
        pendente = true;
        mostrarStatus(`⚠️ Estoque baixo de ${m}. Dispensação para 1 mês. Pendente para o próximo mês.`, 'alerta');
    }
    const pendenteStr = pendente ? 'Pendente próximo mês' : '';
    const valores = [d, p, m, q, r, rep, pendenteStr];

    registrosCtrl.push({ data: d, paciente: p, medicamento: m, quantidade: q, responsavel: r, repetente: rep, pendente: pendente });
    localStorage.setItem('registros_344', JSON.stringify(registrosCtrl));

    if (navigator.onLine) {
        try {
            await escreverPlanilha(SHEET_ID_CTRL, 'Registros!A:G', valores);
            if (rep === 'Sim') mostrarStatus(`🔴 REPETENTE!\n${p} - ${m}\nRegistrado na planilha!`, 'alerta');
            else if (rep === 'Mês Anterior') mostrarStatus(`🟡 MÊS ANTERIOR!\n${p} - ${m}\nRegistrado na planilha!`, 'info');
            else mostrarStatus(`✅ SUCESSO!\n${p} - ${m} (${q} un.)\nRegistrado na planilha!`, 'sucesso');
            if (pendente) mostrarStatus(`⏳ Pendente próximo mês para ${p} - ${m}`, 'info');
        } catch (e) {
            adicionarFilaOffline('controlado', SHEET_ID_CTRL, 'Registros!A:G', valores);
            mostrarStatus(`⚠️ Salvo localmente! Sincroniza depois.`, 'alerta');
        }
    } else {
        adicionarFilaOffline('controlado', SHEET_ID_CTRL, 'Registros!A:G', valores);
        mostrarStatus(`💾 Offline! Salvo localmente (${filaOffline.length} na fila).`, 'info');
    }

    ['ctrlPaciente', 'ctrlMedicamento', 'ctrlQuantidade', 'ctrlResponsavel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const repEl = document.getElementById('ctrlRepetente');
    if (repEl) { repEl.value = 'Preencha os campos';
        repEl.style.cssText = ''; }
    const dataEl = document.getElementById('ctrlData');
    if (dataEl) dataEl.valueAsDate = new Date();
    const ds = document.getElementById('dashboardMesControlados');
    if (ds && ds.value !== 'atual') { dashboardMesCtrl = ds.value;
        localStorage.setItem('dashboard_mes_344', dashboardMesCtrl); }
    carregarDashboardCtrl();
    atualizarModuloControlados();
}

function atualizarDashboardControlados() {
    const s = document.getElementById('dashboardMesControlados');
    if (!s) return;
    const v = s.value;
    if (v !== 'atual') { dashboardMesCtrl = v;
        localStorage.setItem('dashboard_mes_344', dashboardMesCtrl); } else { dashboardMesCtrl = null;
        localStorage.removeItem('dashboard_mes_344'); }
    let mf, af, nm;
    if (v === 'atual') { const h = new Date();
        mf = h.getMonth();
        af = h.getFullYear();
        nm = MESES[mf]; } else { const [a, me] = v.split('-').map(Number);
        mf = me;
        af = a;
        nm = MESES[me]; }
    const mesLabel = document.getElementById('ctrlMesLabel');
    if (mesLabel) mesLabel.textContent = `${nm} de ${af}`;
    const rf = registrosCtrl.filter(r => { if (!r.data) return false; const p = r.data.split('-'); return p.length >= 2 && parseInt(p[1]) - 1 === mf && parseInt(p[0]) === af; });
    const totalEl = document.getElementById('ctrlTotal');
    if (totalEl) totalEl.textContent = rf.length;
    const repEl = document.getElementById('ctrlRepetentes');
    if (repEl) repEl.textContent = rf.filter(r => r.repetente === 'Sim').length;
    const pacEl = document.getElementById('ctrlPacientes');
    if (pacEl) pacEl.textContent = new Set(rf.map(r => r.paciente.toLowerCase())).size;
    const medEl = document.getElementById('ctrlMeds');
    if (medEl) medEl.textContent = new Set(rf.map(r => r.medicamento)).size;
}

function filtrarCtrlMes(m) { mesCtrl = m;
    atualizarModuloControlados(); }

function aplicarFiltrosCtrl() {
    const fm = document.getElementById('ctrlFiltroMed');
    const fp = document.getElementById('ctrlFiltroPaciente');
    if (!fm || !fp) return;
    const filtroMed = fm.value;
    const filtroPac = fp.value.toLowerCase();
    let d = [...registrosCtrl];
    if (mesCtrl !== 'todos') d = d.filter(r => { if (!r.data) return false; const p = r.data.split('-'); return p.length >= 2 && MESES[parseInt(p[1]) - 1] === mesCtrl; });
    if (filtroMed !== 'todos') d = d.filter(r => r.medicamento === filtroMed);
    if (filtroPac) d = d.filter(r => r.paciente.toLowerCase().includes(filtroPac));
    d.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('ctrlTabela');
    if (!tb) return;
    if (d.length === 0) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Nenhum registro</td></tr>'; return; }
    tb.innerHTML = d.map(r => {
        let bc = 'badge-ok',
            bt = '✅ Não';
        if (r.repetente === 'Sim') { bc = 'badge-alert';
            bt = '🔴 Sim'; } else if (r.repetente === 'Mês Anterior') { bc = 'badge-mes-anterior';
            bt = '🟡 Mês Ant.'; }
        let pendenteBadge = '';
        if (r.pendente) pendenteBadge = '<span class="badge badge-pendente" style="background:#fefcbf;color:#975a16;margin-left:5px;">⏳ Pendente</span>';
        return `<tr><td>${fData(r.data)}</td><td>${r.paciente}</td><td>${r.medicamento}</td><td>${r.quantidade}</td><td>${r.responsavel}</td><td><span class="badge ${bc}">${bt}</span></td><td>${pendenteBadge || '-'}</td></tr>`;
    }).join('');
}

function atualizarContagemCtrl() {
    const ma = new Date().getMonth(),
        aa = new Date().getFullYear();
    let mf = ma,
        af = aa;
    if (mesCtrl !== 'todos') { mf = MESES.indexOf(mesCtrl); if (mf < 0) mf = ma; }
    const rm = registrosCtrl.filter(r => { if (!r.data) return false; const p = r.data.split('-'); return p.length >= 2 && parseInt(p[1]) - 1 === mf && parseInt(p[0]) === af; });
    const titulo = document.getElementById('ctrlTituloContagem');
    if (titulo) titulo.textContent = mesCtrl !== 'todos' ? mesCtrl : MESES[ma];
    const ct = {};
    rm.forEach(r => {
        if (!ct[r.medicamento]) ct[r.medicamento] = { q: 0, p: new Set(), a: 0 };
        ct[r.medicamento].q += r.quantidade;
        ct[r.medicamento].p.add(r.paciente.toLowerCase());
        if (r.repetente !== 'Não') ct[r.medicamento].a++;
    });
    const tb = document.getElementById('ctrlTabelaContagem');
    if (!tb) return;
    if (Object.keys(ct).length === 0) { tb.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;">Nenhum dado</td></tr>'; return; }
    tb.innerHTML = Object.entries(ct).sort((a, b) => b[1].q - a[1].q).map(([m, d]) => `<tr><td><strong>${m}</strong></td><td>${d.q.toFixed(2)}</td><td>${d.p.size}</td><td>${d.a > 0 ? `<span class="badge badge-alert">⚠️ ${d.a}</span>` : '-'}</td></tr>`).join('');
}

function atualizarModuloControlados() {
    carregarDashboardCtrl();
    carregarSelectsCtrl();
    carregarSelectPacientesTodos();
    const tc = document.getElementById('ctrlMonthTabs');
    if (!tc) return;
    tc.innerHTML = `<div class="month-tab ${mesCtrl === 'todos' ? 'active' : ''}" onclick="filtrarCtrlMes('todos')">📋 Todos</div>`;
    const mc = new Set();
    registrosCtrl.forEach(r => { if (r.data) { const p = r.data.split('-'); if (p.length >= 2) mc.add(`${parseInt(p[0])}-${parseInt(p[1]) - 1}`); } });
    Array.from(mc).sort().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        const nm = MESES[me];
        const c = registrosCtrl.filter(r => { if (!r.data) return false; const p = r.data.split('-'); return p.length >= 2 && parseInt(p[1]) - 1 === me && parseInt(p[0]) === a; });
        tc.innerHTML += `<div class="month-tab ${mesCtrl === nm ? 'active' : ''}" onclick="filtrarCtrlMes('${nm}')">${nm} (${c.length})</div>`;
    });
    atualizarDashboardControlados();
    aplicarFiltrosCtrl();
    atualizarContagemCtrl();
}

function exportarCSVCtrl() {
    if (registrosCtrl.length === 0) return mostrarStatus('⚠️ Nenhum registro!', 'alerta');
    let csv = 'Data,Paciente,Medicamento,Quantidade,Responsável,Repetente,Obs\n';
    registrosCtrl.forEach(r => { csv += `${fData(r.data)},${r.paciente},"${r.medicamento}",${r.quantidade},${r.responsavel},${r.repetente},${r.pendente ? 'Pendente próximo mês' : ''}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `controlados_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    mostrarStatus('✅ CSV exportado!', 'sucesso');
}

// ============ ESPECIAIS ============
function carregarSelectsEsp() {
    const sm = document.getElementById('espMedicamento'),
        sf = document.getElementById('espFiltroMed'),
        se = document.getElementById('entradaMedicamento');
    const opts = MEDICAMENTOS_ESP.map(m => `<option value="${m}">${m}</option>`).join('');
    if (sm) sm.innerHTML = '<option value="">Selecione</option>' + opts;
    if (sf) sf.innerHTML = '<option value="todos">Todos</option>' + opts;
    if (se) se.innerHTML = '<option value="">Selecione</option>' + opts;
}

function carregarDashboardEsp() {
    const s = document.getElementById('dashboardMesEspeciais');
    if (!s) return;
    s.innerHTML = '<option value="atual">Mês Atual</option>';
    const m = new Set();
    registrosEsp.forEach(r => { if (r.data) { const p = r.data.split('-'); if (p.length >= 2) m.add(`${p[0]}-${parseInt(p[1]) - 1}`); } });
    Array.from(m).sort().reverse().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        s.innerHTML += `<option value="${k}" ${dashboardMesEsp === k ? 'selected' : ''}>${MESES[me]} de ${a}</option>`;
    });
    if (dashboardMesEsp && m.has(dashboardMesEsp)) s.value = dashboardMesEsp;
}

function atualizarEstoqueDisponivel() {
    const med = document.getElementById('espMedicamento').value,
        input = document.getElementById('espEstoqueDisponivel');
    if (!med) { input.value = 'Selecione o medicamento';
        input.style.cssText = ''; return; }
    const disp = estoque[med] || 0;
    input.value = `${disp} unidades disponíveis`;
    if (disp <= cfgEstoqueCritico) input.style.cssText = 'color:#e53e3e!important;background:#fed7d7!important;font-weight:bold;';
    else if (disp <= cfgEstoqueBaixo) input.style.cssText = 'color:#975a16!important;background:#fefcbf!important;font-weight:bold;';
    else input.style.cssText = 'color:#38a169!important;background:#c6f6d5!important;';
}

async function registrarEspecial() {
    const d = document.getElementById('espData').value,
        p = document.getElementById('espPaciente').value.trim(),
        m = document.getElementById('espMedicamento').value,
        a = parseInt(document.getElementById('espAmpolas').value),
        pr = document.getElementById('espPrescritor').value.trim(),
        cicloAtual = document.getElementById('espCicloAtual').value || '',
        cv = parseInt(document.getElementById('espCiclosEV').value) || 0;
    if (!d || !p || !m || !a || !pr) return mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
    if (a <= 0) return mostrarStatus('⚠️ Quantidade inválida!', 'alerta');
    const ea = estoque[m] || 0;
    if (a > ea) return mostrarStatus(`⚠️ Estoque insuficiente!\nDisponível: ${ea} | Solicitado: ${a}`, 'alerta');
    estoque[m] = ea - a;
    const ne = estoque[m];
    localStorage.setItem('estoque_esp', JSON.stringify(estoque));
    const valores = [d, p, m, a, pr, cicloAtual, cv, ne];
    registrosEsp.push({ data: d, paciente: p, medicamento: m, ampolas: a, prescritor: pr, cicloAtual, ciclosEV: cv, estoque: ne });
    localStorage.setItem('registros_esp', JSON.stringify(registrosEsp));

    if (navigator.onLine) {
        try {
            await escreverPlanilha(SHEET_ID_ESP, 'Página1!A:H', valores);
            mostrarStatus(`✅ DISPENSADO!\n${p} - ${m}\n${a} ampolas | Estoque: ${ne}`, 'sucesso');
        } catch (e) {
            adicionarFilaOffline('especial', SHEET_ID_ESP, 'Página1!A:H', valores);
            mostrarStatus(`⚠️ Salvo localmente!`, 'alerta');
        }
    } else {
        adicionarFilaOffline('especial', SHEET_ID_ESP, 'Página1!A:H', valores);
        mostrarStatus(`💾 Offline! Salvo localmente.`, 'info');
    }

    ['espPaciente', 'espAmpolas', 'espPrescritor', 'espCiclosEV'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('espCicloAtual').value = '';
    const medEl = document.getElementById('espMedicamento');
    if (medEl) medEl.value = '';
    const estEl = document.getElementById('espEstoqueDisponivel');
    if (estEl) { estEl.value = 'Selecione';
        estEl.style.cssText = ''; }
    const dataEl = document.getElementById('espData');
    if (dataEl) dataEl.valueAsDate = new Date();
    const ds = document.getElementById('dashboardMesEspeciais');
    if (ds && ds.value !== 'atual') { dashboardMesEsp = ds.value;
        localStorage.setItem('dashboard_mes_esp', dashboardMesEsp); }
    carregarDashboardEsp();
    atualizarModuloEspeciais();
}

async function registrarEntradaEstoque() {
    const m = document.getElementById('entradaMedicamento').value,
        q = parseInt(document.getElementById('entradaQuantidade').value);
    if (!m || !q || q <= 0) { alert('⚠️ Preencha os campos!'); return; }
    estoque[m] = (estoque[m] || 0) + q;
    const ne = estoque[m];
    localStorage.setItem('estoque_esp', JSON.stringify(estoque));
    const hoje = new Date().toISOString().split('T')[0];
    try {
        await escreverPlanilha(SHEET_ID_ESP, 'Página1!A:H', [hoje, '📥 ENTRADA', m, `+${q}`, 'Farmácia', '', 0, ne]);
        mostrarStatus(`📥 ENTRADA!\n${m}\n+${q} | Estoque: ${ne}`, 'sucesso');
    } catch (e) { mostrarStatus(`⚠️ Salvo localmente`, 'erro'); }
    fecharModal('modalEntradaEstoque');
    atualizarModuloEspeciais();
}

function atualizarDashboardEspeciais() {
    const s = document.getElementById('dashboardMesEspeciais');
    if (!s) return;
    const v = s.value;
    if (v !== 'atual') { dashboardMesEsp = v;
        localStorage.setItem('dashboard_mes_esp', dashboardMesEsp); } else { dashboardMesEsp = null;
        localStorage.removeItem('dashboard_mes_esp'); }
    let mf, af, nm;
    if (v === 'atual') { const h = new Date();
        mf = h.getMonth();
        af = h.getFullYear();
        nm = MESES[mf]; } else { const [a, me] = v.split('-').map(Number);
        mf = me;
        af = a;
        nm = MESES[me]; }
    const mesLabel = document.getElementById('espMesLabel');
    if (mesLabel) mesLabel.textContent = `${nm} de ${af}`;
    const rf = registrosEsp.filter(r => { if (!r.data) return false; const p = r.data.split('-'); return p.length >= 2 && parseInt(p[1]) - 1 === mf && parseInt(p[0]) === af; });
    const totalEl = document.getElementById('espTotal');
    if (totalEl) totalEl.textContent = rf.length;
    const ferroEl = document.getElementById('espEstoqueFerro');
    if (ferroEl) ferroEl.textContent = estoque[MEDICAMENTOS_ESP[0]] || 0;
    const enoxaEl = document.getElementById('espEstoqueEnoxa');
    if (enoxaEl) enoxaEl.textContent = estoque[MEDICAMENTOS_ESP[1]] || 0;
    const pacEl = document.getElementById('espPacientes');
    if (pacEl) pacEl.textContent = new Set(rf.map(r => r.paciente.toLowerCase())).size;
}

function atualizarStatusEstoque() {
    const div = document.getElementById('estoqueStatus');
    if (!div) return;
    div.innerHTML = MEDICAMENTOS_ESP.map(m => {
        const q = estoque[m] || 0;
        let cls = 'estoque-ok',
            badge = 'badge-estoque-ok',
            status = '🟢 Normal',
            icone = '✅';
        if (q <= cfgEstoqueCritico) { cls = 'estoque-baixo';
            badge = 'badge-estoque-baixo';
            status = '🔴 Crítico';
            icone = '🚨'; } else if (q <= cfgEstoqueBaixo) { cls = 'estoque-medio';
            badge = 'badge-estoque-medio';
            status = '🟡 Baixo';
            icone = '⚠️'; }
        return `<div class="estoque-card ${cls}"><div><strong>${icone} ${m}</strong><br><small><strong>${q}</strong> unidades</small></div><span class="badge ${badge}">${status}</span></div>`;
    }).join('');
}

function filtrarEspMes(m) { mesEsp = m;
    atualizarModuloEspeciais(); }

function aplicarFiltrosEsp() {
    const fm = document.getElementById('espFiltroMed');
    const fp = document.getElementById('espFiltroPaciente');
    if (!fm || !fp) return;
    const filtroMed = fm.value;
    const filtroPac = fp.value.toLowerCase();
    let d = [...registrosEsp];
    if (mesEsp !== 'todos') d = d.filter(r => { if (!r.data) return false; const p = r.data.split('-'); return p.length >= 2 && MESES[parseInt(p[1]) - 1] === mesEsp; });
    if (filtroMed !== 'todos') d = d.filter(r => r.medicamento === filtroMed);
    if (filtroPac) d = d.filter(r => r.paciente.toLowerCase().includes(filtroPac));
    d.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('espTabela');
    if (!tb) return;
    if (d.length === 0) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Nenhum registro</td></tr>'; return; }
    tb.innerHTML = d.map(r => `<tr><td>${fData(r.data)}</td><td>${r.paciente}</td><td>${r.medicamento}</td><td>${r.ampolas}</td><td>${r.prescritor}</td><td>${r.cicloAtual || '-'}</td><td>${r.ciclosEV || '-'}</td></tr>`).join('');
}

function atualizarModuloEspeciais() {
    carregarDashboardEsp();
    carregarSelectsEsp();
    carregarSelectPacientesTodos();
    const tc = document.getElementById('espMonthTabs');
    if (!tc) return;
    tc.innerHTML = `<div class="month-tab ${mesEsp === 'todos' ? 'active' : ''}" onclick="filtrarEspMes('todos')">📋 Todos</div>`;
    const mc = new Set();
    registrosEsp.forEach(r => { if (r.data) { const p = r.data.split('-'); if (p.length >= 2) mc.add(`${parseInt(p[0])}-${parseInt(p[1]) - 1}`); } });
    Array.from(mc).sort().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        const nm = MESES[me];
        const c = registrosEsp.filter(r => { if (!r.data) return false; const p = r.data.split('-'); return p.length >= 2 && parseInt(p[1]) - 1 === me && parseInt(p[0]) === a; });
        tc.innerHTML += `<div class="month-tab ${mesEsp === nm ? 'active' : ''}" onclick="filtrarEspMes('${nm}')">${nm} (${c.length})</div>`;
    });
    atualizarDashboardEspeciais();
    atualizarStatusEstoque();
    aplicarFiltrosEsp();
}

function abrirEntradaEstoque() { document.getElementById('modalEntradaEstoque').classList.add('active'); }

function exportarCSVEsp() {
    if (registrosEsp.length === 0) return mostrarStatus('⚠️ Nenhum registro!', 'alerta');
    let csv = 'Data,Paciente,Medicamento,Ampolas,Prescritor,Ciclo atual,Ciclos EV\n';
    registrosEsp.forEach(r => { csv += `${fData(r.data)},${r.paciente},"${r.medicamento}",${r.ampolas},${r.prescritor},${r.cicloAtual || '-'},${r.ciclosEV || '-'}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `especiais_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    mostrarStatus('✅ CSV exportado!', 'sucesso');
}

// ============ CONFIGURAÇÕES ============
function abrirConfig() {
    document.getElementById('cfgMedsCtrl').value = medicamentosAtivosCtrl.join('\n');
    document.getElementById('cfgResps').value = responsaveisAtivos.join('\n');
    document.getElementById('cfgMedsEsp').value = MEDICAMENTOS_ESP.join('\n');
    document.getElementById('cfgEstoqueCritico').value = cfgEstoqueCritico;
    document.getElementById('cfgEstoqueBaixo').value = cfgEstoqueBaixo;
    document.getElementById('cfgEstoqueBaixoCtrl').value = medicamentosEstoqueBaixo.join('\n');
    document.getElementById('cfgAcsOptions').value = acsOptions.join('\n');
    document.getElementById('cfgUbsOptions').value = ubsOptions.join('\n');
    document.getElementById('configVersao').textContent = VERSAO;
    document.getElementById('modalConfig').classList.add('active');
    trocarConfigTab('medicamentos');
}

function trocarConfigTab(tab) {
    document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
    const tabs = ['medicamentos', 'limites', 'backup', 'sobre', 'estoque', 'diabetes-opcoes'];
    const idx = tabs.indexOf(tab);
    if (idx >= 0) {
        document.querySelectorAll('.config-tab')[idx].classList.add('active');
        document.getElementById(`configPanel-${tab}`).classList.add('active');
    }
}

function salvarConfigMedicamentos() {
    const mctrl = document.getElementById('cfgMedsCtrl').value.split('\n').map(m => m.trim()).filter(m => m.length > 0);
    const resps = document.getElementById('cfgResps').value.split('\n').map(r => r.trim()).filter(r => r.length > 0);
    const mesp = document.getElementById('cfgMedsEsp').value.split('\n').map(m => m.trim()).filter(m => m.length > 0);
    if (mctrl.length === 0) return mostrarStatus('⚠️ Adicione pelo menos um medicamento!', 'alerta');
    medicamentosAtivosCtrl = mctrl.sort();
    responsaveisAtivos = resps.sort();
    MEDICAMENTOS_ESP.length = 0;
    mesp.forEach(m => MEDICAMENTOS_ESP.push(m));
    localStorage.setItem('meds_344', JSON.stringify(medicamentosAtivosCtrl));
    localStorage.setItem('resps_344', JSON.stringify(responsaveisAtivos));
    localStorage.setItem('meds_esp_list', JSON.stringify(MEDICAMENTOS_ESP));
    carregarSelectsCtrl();
    carregarSelectsEsp();
    fecharModal('modalConfig');
    mostrarStatus('✅ Listas atualizadas!', 'sucesso');
}

function salvarConfigLimites() {
    cfgEstoqueCritico = parseInt(document.getElementById('cfgEstoqueCritico').value, 10) || 5;
    cfgEstoqueBaixo = parseInt(document.getElementById('cfgEstoqueBaixo').value, 10) || 15;
    localStorage.setItem('cfg_estoque_critico', cfgEstoqueCritico);
    localStorage.setItem('cfg_estoque_baixo', cfgEstoqueBaixo);
    atualizarStatusEstoque();
    fecharModal('modalConfig');
    mostrarStatus('✅ Limites atualizados!', 'sucesso');
}

function salvarConfigEstoqueBaixo() {
    const text = document.getElementById('cfgEstoqueBaixoCtrl').value;
    medicamentosEstoqueBaixo = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    localStorage.setItem('meds_estoque_baixo', JSON.stringify(medicamentosEstoqueBaixo));
    mostrarStatus('✅ Lista de estoque baixo atualizada!', 'sucesso');
    fecharModal('modalConfig');
}

function salvarConfigDiabetesOpcoes() {
    const acsText = document.getElementById('cfgAcsOptions').value;
    const ubsText = document.getElementById('cfgUbsOptions').value;
    acsOptions = acsText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    ubsOptions = ubsText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    localStorage.setItem('acs_options', JSON.stringify(acsOptions));
    localStorage.setItem('ubs_options', JSON.stringify(ubsOptions));
    carregarOpcoesDiabetes();
    mostrarStatus('✅ Opções de ACS e UBS atualizadas!', 'sucesso');
    fecharModal('modalConfig');
}

function exportarConfig() {
    const config = {
        versao: VERSAO,
        data: new Date().toISOString(),
        medicamentosCtrl: medicamentosAtivosCtrl,
        responsaveis: responsaveisAtivos,
        medicamentosEsp: MEDICAMENTOS_ESP,
        limites: { estoqueCritico: cfgEstoqueCritico, estoqueBaixo: cfgEstoqueBaixo },
        estoqueBaixo: medicamentosEstoqueBaixo,
        acsOptions: acsOptions,
        ubsOptions: ubsOptions
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const l = document.createElement('a');
    l.href = URL.createObjectURL(blob);
    l.download = `config_farmacia_${new Date().toISOString().split('T')[0]}.json`;
    l.click();
    mostrarStatus('📥 Configurações exportadas!', 'sucesso');
}

function importarConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            if (config.medicamentosCtrl) { medicamentosAtivosCtrl = config.medicamentosCtrl;
                localStorage.setItem('meds_344', JSON.stringify(medicamentosAtivosCtrl)); }
            if (config.responsaveis) { responsaveisAtivos = config.responsaveis;
                localStorage.setItem('resps_344', JSON.stringify(responsaveisAtivos)); }
            if (config.medicamentosEsp) { MEDICAMENTOS_ESP.length = 0;
                config.medicamentosEsp.forEach(m => MEDICAMENTOS_ESP.push(m));
                localStorage.setItem('meds_esp_list', JSON.stringify(MEDICAMENTOS_ESP)); }
            if (config.limites) { cfgEstoqueCritico = config.limites.estoqueCritico || 5;
                cfgEstoqueBaixo = config.limites.estoqueBaixo || 15;
                localStorage.setItem('cfg_estoque_critico', cfgEstoqueCritico);
                localStorage.setItem('cfg_estoque_baixo', cfgEstoqueBaixo); }
            if (config.estoqueBaixo) { medicamentosEstoqueBaixo = config.estoqueBaixo;
                localStorage.setItem('meds_estoque_baixo', JSON.stringify(medicamentosEstoqueBaixo)); }
            if (config.acsOptions) { acsOptions = config.acsOptions;
                localStorage.setItem('acs_options', JSON.stringify(acsOptions)); }
            if (config.ubsOptions) { ubsOptions = config.ubsOptions;
                localStorage.setItem('ubs_options', JSON.stringify(ubsOptions)); }
            carregarSelectsCtrl();
            carregarSelectsEsp();
            carregarOpcoesDiabetes();
            atualizarStatusEstoque();
            fecharModal('modalConfig');
            mostrarStatus('✅ Configurações importadas!', 'sucesso');
        } catch (err) { mostrarStatus('❌ Arquivo inválido!', 'erro'); }
    };
    reader.readAsText(file);
}

function resetarDadosLocais() {
    if (confirm('⚠️ Apagar todos os dados locais?\n\nOs dados na planilha NÃO serão afetados.')) {
        if (confirm('⚠️ Última chance! Confirma?')) {
            localStorage.clear();
            location.reload();
        }
    }
}

function fecharModal(id) { document.getElementById(id).classList.remove('active'); }

// ============ INICIALIZAR ============
inicializar();
