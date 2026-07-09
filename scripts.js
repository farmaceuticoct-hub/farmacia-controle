/*
 * Arquivo: scripts.js - v3.5.1
 * Sistema: Assistência Farmacêutica - Controlados, Especiais e Diabetes
 * Última atualização: Consolidação completa do módulo Diabetes
 */

// ============ CONFIGURAÇÃO ============
const API_URL = 'https://farmacia-api-controlados.up.railway.app';
const SHEET_ID_PACIENTES = '14JGqndfKqh3kVvzMJBqa13XO6z_SpXnoGTUJ-ZWtIdI';
const SHEET_ID_CTRL = '1WIpoH1sZsuMCaSsD6QC6LAcDo-6Rc013MlGDztlzqRo';
const SHEET_ID_ESP = '13oodt6jGo8TgAaxKqWUMS64a0y0TnPX5ZUmDXx3BL_M';
const SHEET_ID_DIABETES = '1POcsyqGHIN908kgiE_be3oyz9ILBntiSv7hn7iyXJt4';
const VERSAO = '3.5.1';

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

// ============ ITENS DE DIABETES (configuráveis) ============
let itensDiabetes = JSON.parse(localStorage.getItem('itens_diabetes')) || {
    Canetas: ["Caneta de Insulina NPH", "Caneta de Insulina Rápida", "Caneta de Insulina Glargina"],
    Refis: ["Refil de Lanceta", "Refil de Fita Glicêmica"],
    Insumos: ["Algodão", "Álcool 70%", "Seringa 1mL", "Agulha 31G"]
};

// ============ ESTRUTURA UNIFICADA DE DADOS ============
let pacientes = [];
let registrosCtrl = [];
let registrosEsp = [];
let estoque = {};

// ESTRUTURA ÚNICA para Diabetes (compatível com localStorage)
let registrosDiabetes = {
    canetas: [],   // { data, paciente, lote, obs }
    refis: [],     // { data, paciente, quantidade, limite }
    insumos: []    // { data, paciente, tipo, item, quantidade }
};

let limitesRefil = JSON.parse(localStorage.getItem('limites_refil') || '{}');

// ============ CONFIGURAÇÕES ============
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
    // Carrega dados do localStorage
    medicamentosAtivosCtrl = JSON.parse(localStorage.getItem('meds_344') || 'null') || [...MEDICAMENTOS_CTRL];
    responsaveisAtivos = JSON.parse(localStorage.getItem('resps_344') || 'null') || [...RESPONSAVEIS];
    pacientes = JSON.parse(localStorage.getItem('ctrl_pacientes') || '[]');
    registrosCtrl = JSON.parse(localStorage.getItem('registros_344') || '[]');
    registrosEsp = JSON.parse(localStorage.getItem('registros_esp') || '[]');
    estoque = JSON.parse(localStorage.getItem('estoque_esp') || '{"Sacarato de Óxido Férrico 20mg/mL injetável":0,"Enoxaparina 40mg/0,4mL":0}');

    // Carrega diabetes da estrutura unificada
    const dadosDiabetes = JSON.parse(localStorage.getItem('diabetes_dados') || 'null');
    if (dadosDiabetes) {
        registrosDiabetes = dadosDiabetes;
    } else {
        // Fallback para dados antigos (migração)
        registrosDiabetes.canetas = JSON.parse(localStorage.getItem('diabetes_canetas') || '[]');
        registrosDiabetes.refis = JSON.parse(localStorage.getItem('diabetes_refis') || '[]');
        registrosDiabetes.insumos = JSON.parse(localStorage.getItem('diabetes_insumos') || '[]');
        // Salva no novo formato
        localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));
        // Limpa chaves antigas
        localStorage.removeItem('diabetes_canetas');
        localStorage.removeItem('diabetes_refis');
        localStorage.removeItem('diabetes_insumos');
    }

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

    if (document.getElementById('tabelaPacientes')) {
        aplicarFiltrosPacientes();
    }

    sincronizarTudo();

    window.addEventListener('online', () => {
        mostrarStatus('🌐 Internet restaurada! Sincronizando...', 'info');
        processarFilaOffline();
    });
    window.addEventListener('offline', () => {
        mostrarStatus('⚠️ Sem internet! Registros salvos localmente.', 'alerta');
    });
    if (navigator.onLine && filaOffline.length > 0) processarFilaOffline();

    console.log(`🚀 v${VERSAO} - Sistema unificado com Diabetes`);
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
        if (document.getElementById('tabelaPacientes')) {
            aplicarFiltrosPacientes();
        }
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

// ============ SINCRONIZAÇÃO FORÇADA ============
async function sincronizarTudo(force = false) {
    const sd = document.getElementById('statusDot');
    const st = document.getElementById('statusText');
    if (sd) sd.style.background = '#ffa500';
    if (st) st.textContent = 'Sincronizando...';

    if (force) {
        console.log('🔄 Forçando sincronização - limpando cache local');
        localStorage.removeItem('ctrl_pacientes');
        localStorage.removeItem('registros_344');
        localStorage.removeItem('registros_esp');
        localStorage.removeItem('diabetes_dados');
        pacientes = [];
        registrosCtrl = [];
        registrosEsp = [];
        registrosDiabetes = { canetas: [], refis: [], insumos: [] };
    }

    try {
        // 1. PACIENTES
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
            }
        } catch (e) {
            console.error('Erro ao ler especiais:', e);
        }

        // 4. DIABETES (estrutura unificada)
        console.log('📥 Lendo diabetes...');
        registrosDiabetes = { canetas: [], refis: [], insumos: [] };

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
                }
            } catch (e) {
                console.error(`Erro ao ler ${aba.nome}:`, e);
            }
        }

        localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));

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

    if (document.getElementById('tabelaPacientes')) {
        aplicarFiltrosPacientes();
    }
    if (document.getElementById('tabelaCanetas')) atualizarTabelaCanetas();
    if (document.getElementById('tabelaRefis')) atualizarTabelaRefis();
    if (document.getElementById('tabelaInsumos')) atualizarTabelaInsumos();

    atualizarContadorFila();
}

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

function calcularIdade(nascimento) {
    if (!nascimento) return '?';
    const hoje = new Date();
    const nasc = new Date(nascimento + 'T00:00:00');
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
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

function aplicarFiltrosPacientes() {
    const tb = document.getElementById('tabelaPacientes');
    if (!tb) return;

    const filtroNome = (document.getElementById('filtroPacienteNome')?.value || '').toLowerCase();
    const filtroUBS = document.getElementById('filtroPacienteUBS')?.value || 'todas';

    let dados = [...pacientes];
    if (filtroNome) dados = dados.filter(p => p.nome.toLowerCase().includes(filtroNome));
    if (filtroUBS !== 'todas') dados = dados.filter(p => p.ubs === filtroUBS);
    dados.sort((a, b) => a.nome.localeCompare(b.nome));

    const countEl = document.getElementById('pacientesCount');
    if (countEl) countEl.textContent = `${dados.length} paciente(s)`;

    if (dados.length === 0) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Nenhum paciente encontrado</td></tr>';
        return;
    }

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    tb.innerHTML = dados.map(p => {
        const refisPaciente = registrosDiabetes.refis.filter(r => r.paciente === p.nome && r.data);
        const refisMes = refisPaciente.filter(r => {
            const d = new Date(r.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        }).reduce((s, r) => s + r.quantidade, 0);
        const limite = limitesRefil[p.nome] || 3;
        return `
            <tr>
                <td><strong>${p.nome}</strong></td>
                <td>${fData(p.nascimento)}</td>
                <td>${calcularIdade(p.nascimento)} anos</td>
                <td>${p.acs}</td>
                <td>${p.telefone}</td>
                <td>${p.ubs}</td>
                <td>${limite}</td>
                <td>${refisMes}${refisMes >= limite ? ' ⚠️' : ''}</td>
            </tr>
        `;
    }).join('');
}

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
        aplicarFiltrosPacientes();
    } finally {
        salvandoPaciente = false;
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Paciente'; }
    }
}

// ============ DIABETES - CANETAS ============
async function registrarCaneta() {
    if (salvandoDiabetes) {
        mostrarStatus('⏳ Aguarde, registrando...', 'info');
        return;
    }
    salvandoDiabetes = true;
    const btn = document.querySelector('#sub-canetas .btn-primary') || document.querySelector('#modulo-diabetes .btn-dia');
    if (btn) { btn.disabled = true; btn.textContent = '💉 Salvando...'; }

    try {
        const paciente = document.getElementById('canetaPaciente').value;
        const data = document.getElementById('canetaData').value;
        const lote = document.getElementById('canetaLote').value.trim();
        const obs = document.getElementById('canetaObs').value.trim();

        if (!paciente || !data || !lote) {
            mostrarStatus('⚠️ Preencha todos os campos obrigatórios!', 'alerta');
            return;
        }

        const valores = [data, paciente, lote, obs];
        registrosDiabetes.canetas.push({ data, paciente, lote, obs });
        localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));

        if (navigator.onLine) {
            try {
                const dadosExistentes = await lerPlanilha(SHEET_ID_DIABETES, 'Canetas!A1:D1000');
                const novasLinhas = dadosExistentes.concat([valores]);
                await escreverPlanilha(SHEET_ID_DIABETES, 'Canetas!A1:D1000', novasLinhas);
                mostrarStatus(`💉 Caneta registrada!\n${paciente} - Lote: ${lote}`, 'sucesso');
            } catch (e) {
                adicionarFilaOffline('caneta', SHEET_ID_DIABETES, 'Canetas!A1:D1000', valores);
                mostrarStatus('⚠️ Salvo localmente!', 'alerta');
            }
        } else {
            adicionarFilaOffline('caneta', SHEET_ID_DIABETES, 'Canetas!A1:D1000', valores);
            mostrarStatus('💾 Offline! Salvo localmente.', 'info');
        }

        document.getElementById('canetaLote').value = '';
        document.getElementById('canetaObs').value = '';
        document.getElementById('canetaData').valueAsDate = new Date();
        atualizarTabelaCanetas();
    } finally {
        salvandoDiabetes = false;
        if (btn) { btn.disabled = false; btn.textContent = '💉 Registrar Caneta'; }
    }
}

function atualizarTabelaCanetas() {
    const dados = [...registrosDiabetes.canetas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('tabelaCanetas');
    if (!tb) return;

    if (dados.length === 0) {
        tb.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;">Nenhuma caneta registrada</td></tr>';
        return;
    }

    tb.innerHTML = dados.map(c => `
        <tr>
            <td>${fData(c.data)}</td>
            <td>${c.paciente}</td>
            <td>${c.lote}</td>
            <td>${c.obs || '-'}</td>
        </tr>
    `).join('');
}

// ============ DIABETES - REFIS ============
function atualizarLimiteRefil() {
    const paciente = document.getElementById('refilPaciente').value;
    const limiteInput = document.getElementById('refilLimite');
    const retiradoInput = document.getElementById('refilRetirado');

    if (!paciente) {
        if (limiteInput) limiteInput.value = 'Selecione o paciente';
        if (retiradoInput) retiradoInput.value = '0';
        return;
    }

    const limite = limitesRefil[paciente] || 3;
    if (limiteInput) limiteInput.value = `${limite} refis/mês`;

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const retiradoEsteMes = registrosDiabetes.refis
        .filter(r => r.paciente === paciente)
        .filter(r => {
            if (!r.data) return false;
            const d = new Date(r.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        })
        .reduce((s, r) => s + r.quantidade, 0);

    if (retiradoInput) {
        retiradoInput.value = retiradoEsteMes;
        if (retiradoEsteMes >= limite) {
            retiradoInput.style.cssText = 'color:#e53e3e!important;background:#fed7d7!important;font-weight:bold;';
        } else {
            retiradoInput.style.cssText = '';
        }
    }
}

function abrirLimiteRefil() {
    const select = document.getElementById('limitePaciente');
    if (select) {
        select.innerHTML = '<option value="">Selecione</option>' +
            pacientes.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
    }
    document.getElementById('limiteValor').value = '';
    document.getElementById('limiteAtual').value = '-';
    document.getElementById('modalLimiteRefil').classList.add('active');
}

function carregarLimiteAtual() {
    const paciente = document.getElementById('limitePaciente').value;
    if (paciente) {
        document.getElementById('limiteAtual').value = limitesRefil[paciente] || 3;
    }
}

async function salvarLimiteRefil() {
    const paciente = document.getElementById('limitePaciente').value;
    const valor = parseInt(document.getElementById('limiteValor').value);

    if (!paciente || !valor || valor <= 0) {
        mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
        return;
    }

    limitesRefil[paciente] = valor;
    localStorage.setItem('limites_refil', JSON.stringify(limitesRefil));

    fecharModal('modalLimiteRefil');
    mostrarStatus(`✅ Limite de ${paciente} atualizado para ${valor} refis/mês!`, 'sucesso');
    atualizarLimiteRefil();
}

async function registrarRefil() {
    if (salvandoDiabetes) {
        mostrarStatus('⏳ Aguarde, registrando...', 'info');
        return;
    }
    salvandoDiabetes = true;
    const btn = document.querySelector('#sub-refis .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 Salvando...'; }

    try {
        const paciente = document.getElementById('refilPaciente').value;
        const data = document.getElementById('refilData').value;
        const quantidade = parseInt(document.getElementById('refilQuantidade').value);

        if (!paciente || !data || !quantidade || quantidade <= 0) {
            mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
            return;
        }

        const limite = limitesRefil[paciente] || 3;
        const hoje = new Date(data + 'T00:00:00');
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();

        const retiradoEsteMes = registrosDiabetes.refis
            .filter(r => r.paciente === paciente)
            .filter(r => {
                if (!r.data) return false;
                const d = new Date(r.data + 'T00:00:00');
                return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
            })
            .reduce((s, r) => s + r.quantidade, 0);

        if (retiradoEsteMes + quantidade > limite) {
            mostrarStatus(
                `⚠️ Limite excedido!\n\nPaciente: ${paciente}\nLimite mensal: ${limite}\nJá retirado: ${retiradoEsteMes}\nTentando retirar: ${quantidade}\nDisponível: ${limite - retiradoEsteMes}`,
                'alerta'
            );
            return;
        }

        const valores = [data, paciente, quantidade, limite];
        registrosDiabetes.refis.push({ data, paciente, quantidade, limite });
        localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));

        if (navigator.onLine) {
            try {
                const dadosExistentes = await lerPlanilha(SHEET_ID_DIABETES, 'Refis!A1:D1000');
                const novasLinhas = dadosExistentes.concat([valores]);
                await escreverPlanilha(SHEET_ID_DIABETES, 'Refis!A1:D1000', novasLinhas);
                mostrarStatus(`🔄 Refil registrado!\n${paciente} - ${quantidade} refis`, 'sucesso');
            } catch (e) {
                adicionarFilaOffline('refil', SHEET_ID_DIABETES, 'Refis!A1:D1000', valores);
                mostrarStatus('⚠️ Salvo localmente!', 'alerta');
            }
        } else {
            adicionarFilaOffline('refil', SHEET_ID_DIABETES, 'Refis!A1:D1000', valores);
            mostrarStatus('💾 Offline! Salvo localmente.', 'info');
        }

        document.getElementById('refilQuantidade').value = '';
        document.getElementById('refilData').valueAsDate = new Date();
        atualizarLimiteRefil();
        atualizarTabelaRefis();
    } finally {
        salvandoDiabetes = false;
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Registrar Refil'; }
    }
}

function atualizarTabelaRefis() {
    const dados = [...registrosDiabetes.refis].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('tabelaRefis');
    if (!tb) return;

    if (dados.length === 0) {
        tb.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;">Nenhum refil registrado</td></tr>';
        return;
    }

    tb.innerHTML = dados.map(r => `
        <tr>
            <td>${fData(r.data)}</td>
            <td>${r.paciente}</td>
            <td>${r.quantidade}</td>
            <td>${r.limite || 3} por mês</td>
        </tr>
    `).join('');
}

// ============ DIABETES - INSUMOS ============
function carregarSelectsInsumos() {
    const tipoSelect = document.getElementById('insumoTipo');
    if (tipoSelect) {
        const tipos = Object.keys(itensDiabetes);
        tipoSelect.innerHTML = '<option value="">Selecione o tipo</option>' +
            tipos.map(t => `<option value="${t}">${t}</option>`).join('');
    }
    atualizarItensInsumo();
}

function atualizarItensInsumo() {
    const tipo = document.getElementById('insumoTipo').value;
    const itemSelect = document.getElementById('insumoItem');
    if (!itemSelect) return;
    if (!tipo) {
        itemSelect.innerHTML = '<option value="">Selecione primeiro o tipo</option>';
        return;
    }
    const itens = itensDiabetes[tipo] || [];
    itemSelect.innerHTML = '<option value="">Selecione o item</option>' +
        itens.map(i => `<option value="${i}">${i}</option>`).join('');
}

async function registrarInsumo() {
    if (salvandoDiabetes) {
        mostrarStatus('⏳ Aguarde, registrando...', 'info');
        return;
    }
    salvandoDiabetes = true;
    const btn = document.querySelector('#sub-insumos .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '📦 Salvando...'; }

    try {
        const paciente = document.getElementById('insumoPaciente').value;
        const data = document.getElementById('insumoData').value;
        const tipo = document.getElementById('insumoTipo').value;
        const item = document.getElementById('insumoItem').value;
        const quantidade = parseInt(document.getElementById('insumoQuantidade').value);

        if (!paciente || !data || !tipo || !item || !quantidade || quantidade <= 0) {
            mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
            return;
        }

        const valores = [data, paciente, tipo, item, quantidade];
        registrosDiabetes.insumos.push({ data, paciente, tipo, item, quantidade });
        localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));

        if (navigator.onLine) {
            try {
                const dadosExistentes = await lerPlanilha(SHEET_ID_DIABETES, 'Insumos!A1:E1000');
                const novasLinhas = dadosExistentes.concat([valores]);
                await escreverPlanilha(SHEET_ID_DIABETES, 'Insumos!A1:E1000', novasLinhas);
                mostrarStatus(`📦 Insumo registrado!\n${paciente} - ${item} (${quantidade})`, 'sucesso');
            } catch (e) {
                adicionarFilaOffline('insumo', SHEET_ID_DIABETES, 'Insumos!A1:E1000', valores);
                mostrarStatus('⚠️ Salvo localmente!', 'alerta');
            }
        } else {
            adicionarFilaOffline('insumo', SHEET_ID_DIABETES, 'Insumos!A1:E1000', valores);
            mostrarStatus('💾 Offline! Salvo localmente.', 'info');
        }

        document.getElementById('insumoQuantidade').value = '';
        document.getElementById('insumoData').valueAsDate = new Date();
        atualizarTabelaInsumos();
    } finally {
        salvandoDiabetes = false;
        if (btn) { btn.disabled = false; btn.textContent = '📦 Registrar Insumo'; }
    }
}

function atualizarTabelaInsumos() {
    const dados = [...registrosDiabetes.insumos].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('tabelaInsumos');
    if (!tb) return;

    if (dados.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;">Nenhum insumo registrado</td></tr>';
        return;
    }

    tb.innerHTML = dados.map(i => `
        <tr>
            <td>${fData(i.data)}</td>
            <td>${i.paciente}</td>
            <td>${i.tipo}</td>
            <td>${i.item}</td>
            <td>${i.quantidade}</td>
        </tr>
    `).join('');
}

// ============ DIABETES - FUNÇÃO PRINCIPAL (wrapper) ============
async function registrarDiabetes() {
    // Esta função é mantida para compatibilidade com o botão do index.html
    // Ela redireciona para as funções específicas baseado no tipo selecionado
    const tipo = document.getElementById('diabetesTipo').value;

    if (!tipo) {
        mostrarStatus('⚠️ Selecione um tipo de dispensação!', 'alerta');
        return;
    }

    if (tipo === 'Canetas') {
        // Redireciona para o registro de canetas (usando os campos do formulário de diabetes)
        await registrarCanetaFromDiabetesForm();
    } else if (tipo === 'Refis') {
        await registrarRefilFromDiabetesForm();
    } else if (tipo === 'Insumos') {
        await registrarInsumoFromDiabetesForm();
    } else {
        mostrarStatus('⚠️ Tipo inválido!', 'alerta');
    }
}

// Funções auxiliares para o formulário principal de diabetes
async function registrarCanetaFromDiabetesForm() {
    const data = document.getElementById('diabetesData').value;
    const paciente = document.getElementById('diabetesPaciente').value.trim();
    const item = document.getElementById('diabetesItem').value;
    const obs = document.getElementById('diabetesObs').value.trim();

    if (!data || !paciente || !item) {
        mostrarStatus('⚠️ Preencha todos os campos obrigatórios!', 'alerta');
        return;
    }

    // Reutiliza a lógica de registrarCaneta
    const valores = [data, paciente, item, obs];
    registrosDiabetes.canetas.push({ data, paciente, lote: item, obs });
    localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));

    if (navigator.onLine) {
        try {
            const dadosExistentes = await lerPlanilha(SHEET_ID_DIABETES, 'Canetas!A1:D1000');
            const novasLinhas = dadosExistentes.concat([valores]);
            await escreverPlanilha(SHEET_ID_DIABETES, 'Canetas!A1:D1000', novasLinhas);
            mostrarStatus(`💉 Caneta registrada!\n${paciente} - ${item}`, 'sucesso');
        } catch (e) {
            adicionarFilaOffline('caneta', SHEET_ID_DIABETES, 'Canetas!A1:D1000', valores);
            mostrarStatus('⚠️ Salvo localmente!', 'alerta');
        }
    } else {
        adicionarFilaOffline('caneta', SHEET_ID_DIABETES, 'Canetas!A1:D1000', valores);
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

async function registrarRefilFromDiabetesForm() {
    const data = document.getElementById('diabetesData').value;
    const paciente = document.getElementById('diabetesPaciente').value.trim();
    const item = document.getElementById('diabetesItem').value; // não usado para refis
    const qtd = parseInt(document.getElementById('diabetesQuantidade').value);
    const obs = document.getElementById('diabetesObs').value.trim(); // não usado

    if (!data || !paciente || !qtd || qtd <= 0) {
        mostrarStatus('⚠️ Preencha todos os campos obrigatórios!', 'alerta');
        return;
    }

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

    const valores = [data, paciente, qtd, limite];
    registrosDiabetes.refis.push({ data, paciente, quantidade: qtd, limite });
    localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));

    if (navigator.onLine) {
        try {
            const dadosExistentes = await lerPlanilha(SHEET_ID_DIABETES, 'Refis!A1:D1000');
            const novasLinhas = dadosExistentes.concat([valores]);
            await escreverPlanilha(SHEET_ID_DIABETES, 'Refis!A1:D1000', novasLinhas);
            mostrarStatus(`🔄 Refil registrado!\n${paciente} - ${qtd} refis`, 'sucesso');
        } catch (e) {
            adicionarFilaOffline('refil', SHEET_ID_DIABETES, 'Refis!A1:D1000', valores);
            mostrarStatus('⚠️ Salvo localmente!', 'alerta');
        }
    } else {
        adicionarFilaOffline('refil', SHEET_ID_DIABETES, 'Refis!A1:D1000', valores);
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

async function registrarInsumoFromDiabetesForm() {
    const data = document.getElementById('diabetesData').value;
    const paciente = document.getElementById('diabetesPaciente').value.trim();
    const tipo = document.getElementById('diabetesTipo').value;
    const item = document.getElementById('diabetesItem').value;
    const qtd = parseInt(document.getElementById('diabetesQuantidade').value);
    const obs = document.getElementById('diabetesObs').value.trim();

    if (!data || !paciente || !tipo || !item || !qtd || qtd <= 0) {
        mostrarStatus('⚠️ Preencha todos os campos obrigatórios!', 'alerta');
        return;
    }

    const valores = [data, paciente, tipo, item, qtd];
    registrosDiabetes.insumos.push({ data, paciente, tipo, item, quantidade: qtd });
    localStorage.setItem('diabetes_dados', JSON.stringify(registrosDiabetes));

    if (navigator.onLine) {
        try {
            const dadosExistentes = await lerPlanilha(SHEET_ID_DIABETES, 'Insumos!A1:E1000');
            const novasLinhas = dadosExistentes.concat([valores]);
            await escreverPlanilha(SHEET_ID_DIABETES, 'Insumos!A1:E1000', novasLinhas);
            mostrarStatus(`📦 Insumo registrado!\n${paciente} - ${item} (${qtd})`, 'sucesso');
        } catch (e) {
            adicionarFilaOffline('insumo', SHEET_ID_DIABETES, 'Insumos!A1:E1000', valores);
            mostrarStatus('⚠️ Salvo localmente!', 'alerta');
        }
    } else {
        adicionarFilaOffline('insumo', SHEET_ID_DIABETES, 'Insumos!A1:E1000', valores);
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

// ============ DIABETES - DASHBOARD E FILTROS ============
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
    const itens = itensDiabetes[tipo] || [];
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
            <td>${r.lote || r.tipo === 'Insumos' ? (r.item || r.tipo) : (r.item || '')}</td>
            <td>${r.quantidade || (r.lote ? '1' : '')}</td>
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

    if (document.getElementById('tabelaPacientes')) {
        aplicarFiltrosPacientes();
    }
}

// ============ CONFIGURAÇÃO DE ITENS ============
function abrirConfigItens() {
    document.getElementById('cfgCanetas').value = itensDiabetes.Canetas.join('\n');
    document.getElementById('cfgRefis').value = itensDiabetes.Refis.join('\n');
    document.getElementById('cfgInsumos').value = itensDiabetes.Insumos.join('\n');
    document.getElementById('modalConfigItens').classList.add('active');
}

function salvarConfigItens() {
    const canetas = document.getElementById('cfgCanetas').value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const refis = document.getElementById('cfgRefis').value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const insumos = document.getElementById('cfgInsumos').value.split('\n').map(s => s.trim()).filter(s => s.length > 0);

    if (canetas.length === 0 || refis.length === 0 || insumos.length === 0) {
        mostrarStatus('⚠️ Cada categoria deve ter pelo menos um item!', 'alerta');
        return;
    }

    itensDiabetes = { Canetas: canetas, Refis: refis, Insumos: insumos };
    localStorage.setItem('itens_diabetes', JSON.stringify(itensDiabetes));

    carregarSelectsInsumos();
    carregarSelectsDiabetes();
    fecharModal('modalConfigItens');
    mostrarStatus('✅ Itens de diabetes atualizados!', 'sucesso');
}

// ============ BACKUP ============
function exportarBackupDrive() {
    try {
        const data = {
            versao: VERSAO,
            data: new Date().toISOString(),
            pacientes: pacientes,
            controlados: registrosCtrl,
            especiais: registrosEsp,
            diabetes: registrosDiabetes,
            estoque: estoque,
            limitesRefil: limitesRefil,
            itensDiabetes: itensDiabetes,
            config: {
                medicamentosCtrl: medicamentosAtivosCtrl,
                responsaveis: responsaveisAtivos,
                medicamentosEsp: MEDICAMENTOS_ESP,
                estoqueBaixo: medicamentosEstoqueBaixo,
                acsOptions: acsOptions,
                ubsOptions: ubsOptions
            }
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const now = new Date();
        const fileName = `backup_farmacia_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`;
        link.download = fileName;
        link.click();
        mostrarStatus(`📥 Backup baixado: ${fileName}`, 'sucesso');
    } catch (e) {
        console.error(e);
        mostrarStatus('❌ Erro ao gerar backup', 'erro');
    }
}

// ============ FUNÇÕES DE STATUS E NAVEGAÇÃO ============
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

function fecharModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

// ============ DASHBOARDS (CONTROLADOS, ESPECIAIS) ============
function carregarDashboardCtrl() {
    const s = document.getElementById('dashboardMesControlados');
    if (!s) return;
    s.innerHTML = '<option value="atual">Mês Atual</option>';
    const m = new Set();
    registrosCtrl.forEach(r => {
        if (r.data) {
            const p = r.data.split('-');
            if (p.length >= 2) m.add(`${p[0]}-${parseInt(p[1]) - 1}`);
        }
    });
    Array.from(m).sort().reverse().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        s.innerHTML += `<option value="${k}" ${dashboardMesCtrl === k ? 'selected' : ''}>${MESES[me]} de ${a}</option>`;
    });
    if (dashboardMesCtrl && m.has(dashboardMesCtrl)) s.value = dashboardMesCtrl;
}

function carregarDashboardEsp() {
    const s = document.getElementById('dashboardMesEspeciais');
    if (!s) return;
    s.innerHTML = '<option value="atual">Mês Atual</option>';
    const m = new Set();
    registrosEsp.forEach(r => {
        if (r.data) {
            const p = r.data.split('-');
            if (p.length >= 2) m.add(`${p[0]}-${parseInt(p[1]) - 1}`);
        }
    });
    Array.from(m).sort().reverse().forEach(k => {
        const [a, me] = k.split('-').map(Number);
        s.innerHTML += `<option value="${k}" ${dashboardMesEsp === k ? 'selected' : ''}>${MESES[me]} de ${a}</option>`;
    });
    if (dashboardMesEsp && m.has(dashboardMesEsp)) s.value = dashboardMesEsp;
}

// ============ OBSERVAÇÃO ============
// As funções de CONTROLADOS e ESPECIAIS (registrarControlado, registrarEspecial,
// carregarSelectsCtrl, carregarSelectsEsp, atualizarModuloControlados,
// atualizarModuloEspeciais, exportarCSVCtrl, exportarCSVEsp, etc.)
// permanecem EXATAMENTE como estavam na versão anterior.
// Elas não foram alteradas nesta consolidação.
// ============================================

// ============ INICIALIZAR ============
inicializar();
