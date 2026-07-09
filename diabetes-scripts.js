/*
 * Arquivo: diabetes-scripts.js - v2.1
 * Sistema: Controle de Diabetes - Assistência Farmacêutica
 * Funcionalidades: cadastro de pacientes, canetas, refis (com limite), insumos (com itens configuráveis)
 * Sincronização forçada com a planilha.
 */

// ============ CONFIGURAÇÃO ============
const API_URL = 'https://farmacia-api-controlados.up.railway.app';
const SHEET_ID_PACIENTES = '14JGqndfKqh3kVvzMJBqa13XO6z_SpXnoGTUJ-ZWtIdI';
const SHEET_ID_DIABETES = '1POcsyqGHIN908kgiE_be3oyz9ILBntiSv7hn7iyXJt4';
const VERSAO = '2.1';

// ============ VARIÁVEIS ============
let pacientes = [];
let canetas = [];
let refis = [];
let insumos = [];
let limitesRefil = JSON.parse(localStorage.getItem('limites_refil') || '{}');
let filaOffline = JSON.parse(localStorage.getItem('fila_diabetes_offline') || '[]');

// Itens configuráveis (carregados do localStorage)
let itensDiabetes = JSON.parse(localStorage.getItem('itens_diabetes')) || {
    Canetas: ["Caneta de Insulina NPH", "Caneta de Insulina Rápida", "Caneta de Insulina Glargina"],
    Refis: ["Refil de Lanceta", "Refil de Fita Glicêmica"],
    Insumos: ["Algodão", "Álcool 70%", "Seringa 1mL", "Agulha 31G"]
};

// Controles de salvamento para evitar duplicação
let salvandoCaneta = false;
let salvandoRefil = false;
let salvandoInsumo = false;
let salvandoPaciente = false;

// ============ INICIALIZAÇÃO ============
function inicializar() {
    pacientes = JSON.parse(localStorage.getItem('diabetes_pacientes') || '[]');
    canetas = JSON.parse(localStorage.getItem('diabetes_canetas') || '[]');
    refis = JSON.parse(localStorage.getItem('diabetes_refis') || '[]');
    insumos = JSON.parse(localStorage.getItem('diabetes_insumos') || '[]');

    carregarSelectPacientes();
    carregarSelectsInsumos();
    document.getElementById('canetaData').valueAsDate = new Date();
    document.getElementById('refilData').valueAsDate = new Date();
    document.getElementById('insumoData').valueAsDate = new Date();

    atualizarTodosModulos();
    sincronizarTudo();

    window.addEventListener('online', () => {
        mostrarStatus('🌐 Internet restaurada! Sincronizando...', 'info');
        processarFilaOffline();
    });
    window.addEventListener('offline', () => {
        mostrarStatus('⚠️ Sem internet! Registros salvos localmente.', 'alerta');
    });
    if (navigator.onLine && filaOffline.length > 0) processarFilaOffline();

    console.log(`🚀 Diabetes v${VERSAO} - Itens configuráveis e sincronização forçada`);
}

// ============ SUB-ABAS ============
function trocarSubAba(aba) {
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));

    const idx = ['pacientes', 'canetas', 'refis', 'insumos'].indexOf(aba);
    if (idx >= 0) {
        document.querySelectorAll('.sub-tab')[idx].classList.add('active');
        document.querySelectorAll('.sub-panel')[idx].classList.add('active');
    }
    // Atualizar dados ao trocar
    if (aba === 'pacientes') aplicarFiltrosPacientes();
    else if (aba === 'canetas') atualizarTabelaCanetas();
    else if (aba === 'refis') { atualizarLimiteRefil(); atualizarTabelaRefis(); }
    else if (aba === 'insumos') atualizarTabelaInsumos();
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
    try {
        const response = await fetch(`${API_URL}/api/escrever-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planilhaId: sheetId, range: range, valores: values })
        });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Erro ao escrever:', error);
        throw error;
    }
}

// ============ FILA OFFLINE ============
function adicionarFilaOffline(tipo, sheetId, range, dados) {
    filaOffline.push({ id: Date.now(), tipo, sheetId, range, dados, data: new Date().toISOString() });
    localStorage.setItem('fila_diabetes_offline', JSON.stringify(filaOffline));
}

async function processarFilaOffline() {
    if (filaOffline.length === 0 || !navigator.onLine) return;

    let processados = 0;
    const filaAtual = [...filaOffline];

    for (const item of filaAtual) {
        try {
            await escreverPlanilha(item.sheetId, item.range, item.dados);
            processados++;
            filaOffline = filaOffline.filter(f => f.id !== item.id);
        } catch (e) {
            console.error('Erro ao processar fila:', e);
            break;
        }
    }

    localStorage.setItem('fila_diabetes_offline', JSON.stringify(filaOffline));

    if (processados > 0) {
        mostrarStatus(`✅ ${processados} registro(s) sincronizado(s)!`, 'sucesso');
        await sincronizarTudo();
    }
}

// ============ SINCRONIZAÇÃO FORÇADA ============
async function sincronizarTudo() {
    const sd = document.getElementById('statusDot');
    const st = document.getElementById('statusText');
    if (sd) sd.style.background = '#ffa500';
    if (st) st.textContent = 'Sincronizando...';

    try {
        // 1. Pacientes (sempre da planilha)
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
            localStorage.setItem('diabetes_pacientes', JSON.stringify(pacientes));
        }

        // 2. Canetas
        const dc = await lerPlanilha(SHEET_ID_DIABETES, 'Canetas!A1:D1000');
        if (dc.length > 1) {
            canetas = dc.slice(1).filter(r => r[0] && r[1]).map(r => ({
                data: nData(r[0] || ''),
                paciente: (r[1] || '').trim(),
                lote: (r[2] || '').trim(),
                obs: (r[3] || '').trim()
            }));
            localStorage.setItem('diabetes_canetas', JSON.stringify(canetas));
        }

        // 3. Refis
        const dr = await lerPlanilha(SHEET_ID_DIABETES, 'Refis!A1:D1000');
        if (dr.length > 1) {
            refis = dr.slice(1).filter(r => r[0] && r[1]).map(r => ({
                data: nData(r[0] || ''),
                paciente: (r[1] || '').trim(),
                quantidade: parseInt(r[2]) || 0,
                limite: parseInt(r[3]) || 0
            }));
            localStorage.setItem('diabetes_refis', JSON.stringify(refis));
        }

        // 4. Insumos
        const di = await lerPlanilha(SHEET_ID_DIABETES, 'Insumos!A1:D1000');
        if (di.length > 1) {
            insumos = di.slice(1).filter(r => r[0] && r[1]).map(r => ({
                data: nData(r[0] || ''),
                paciente: (r[1] || '').trim(),
                tipo: (r[2] || '').trim(),
                item: (r[3] || '').trim(),
                quantidade: parseInt(r[4]) || 0
            }));
            localStorage.setItem('diabetes_insumos', JSON.stringify(insumos));
        }

        if (sd) sd.style.background = '#48bb78';
        if (st) st.textContent = '✅ Conectado';
    } catch (e) {
        console.error(e);
        if (sd) sd.style.background = '#f56565';
        if (st) st.textContent = '⚠️ Erro';
    }

    carregarSelectPacientes();
    carregarSelectsInsumos();
    atualizarTodosModulos();
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

// ============ PACIENTES ============
function carregarSelectPacientes() {
    const selects = ['canetaPaciente', 'refilPaciente', 'insumoPaciente', 'limitePaciente'];
    const opts = pacientes.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">Selecione o paciente</option>' + opts;
    });
}

function abrirCadastroPaciente() {
    document.getElementById('cadNome').value = '';
    document.getElementById('cadNascimento').value = '';
    document.getElementById('cadACS').value = '';
    document.getElementById('cadTelefone').value = '';
    document.getElementById('cadUBS').value = '';
    document.getElementById('modalCadastroPaciente').classList.add('active');
}

async function salvarPaciente() {
    if (salvandoPaciente) {
        mostrarStatus('⏳ Aguarde, salvando paciente...', 'info');
        return;
    }
    salvandoPaciente = true;
    const btn = document.querySelector('#modalCadastroPaciente .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '💾 Salvando...'; }

    try {
        const nome = document.getElementById('cadNome').value.trim();
        const nascimento = document.getElementById('cadNascimento').value;
        const acs = document.getElementById('cadACS').value.trim();
        const telefone = document.getElementById('cadTelefone').value.trim();
        const ubs = document.getElementById('cadUBS').value.trim();

        if (!nome || !nascimento || !acs || !telefone || !ubs) {
            mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
            return;
        }

        const id = 'P' + Date.now().toString(36).toUpperCase();
        const valores = [id, nome, nascimento, acs, telefone, ubs];

        pacientes.push({ id, nome, nascimento, acs, telefone, ubs });
        localStorage.setItem('diabetes_pacientes', JSON.stringify(pacientes));

        if (navigator.onLine) {
            try {
                await escreverPlanilha(SHEET_ID_PACIENTES, 'Pacientes!A:F', valores);
                mostrarStatus(`✅ Paciente "${nome}" cadastrado!`, 'sucesso');
            } catch (e) {
                adicionarFilaOffline('paciente', SHEET_ID_PACIENTES, 'Pacientes!A:F', valores);
                mostrarStatus('⚠️ Salvo localmente!', 'alerta');
            }
        } else {
            adicionarFilaOffline('paciente', SHEET_ID_PACIENTES, 'Pacientes!A:F', valores);
            mostrarStatus('💾 Offline! Salvo localmente.', 'info');
        }

        fecharModal('modalCadastroPaciente');
        carregarSelectPacientes();
        aplicarFiltrosPacientes();
    } finally {
        salvandoPaciente = false;
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar'; }
    }
}

function aplicarFiltrosPacientes() {
    const filtroNome = (document.getElementById('filtroPacienteNome')?.value || '').toLowerCase();
    const filtroUBS = document.getElementById('filtroPacienteUBS')?.value || 'todas';

    let dados = [...pacientes];
    if (filtroNome) dados = dados.filter(p => p.nome.toLowerCase().includes(filtroNome));
    if (filtroUBS !== 'todas') dados = dados.filter(p => p.ubs === filtroUBS);
    dados.sort((a, b) => a.nome.localeCompare(b.nome));

    document.getElementById('pacientesCount').textContent = `${dados.length} paciente(s)`;

    const tb = document.getElementById('tabelaPacientes');
    if (dados.length === 0) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Nenhum paciente encontrado</td></tr>';
        return;
    }

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    tb.innerHTML = dados.map(p => {
        const refisPaciente = refis.filter(r => r.paciente === p.nome && r.data);
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

function calcularIdade(nascimento) {
    if (!nascimento) return '?';
    const hoje = new Date();
    const nasc = new Date(nascimento + 'T00:00:00');
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
}

// ============ CANETAS ============
async function registrarCaneta() {
    if (salvandoCaneta) {
        mostrarStatus('⏳ Aguarde, registrando...', 'info');
        return;
    }
    salvandoCaneta = true;
    const btn = document.querySelector('#sub-canetas .btn-primary');
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
        canetas.push({ data, paciente, lote, obs });
        localStorage.setItem('diabetes_canetas', JSON.stringify(canetas));

        if (navigator.onLine) {
            try {
                // Lê dados existentes e anexa (append)
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
        salvandoCaneta = false;
        if (btn) { btn.disabled = false; btn.textContent = '💉 Registrar Caneta'; }
    }
}

function atualizarTabelaCanetas() {
    const dados = [...canetas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('tabelaCanetas');

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

// ============ REFIS ============
function atualizarLimiteRefil() {
    const paciente = document.getElementById('refilPaciente').value;
    const limiteInput = document.getElementById('refilLimite');
    const retiradoInput = document.getElementById('refilRetirado');

    if (!paciente) {
        limiteInput.value = 'Selecione o paciente';
        retiradoInput.value = '0';
        return;
    }

    const limite = limitesRefil[paciente] || 3;
    limiteInput.value = `${limite} refis/mês`;

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const retiradoEsteMes = refis
        .filter(r => r.paciente === paciente)
        .filter(r => {
            if (!r.data) return false;
            const d = new Date(r.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        })
        .reduce((s, r) => s + r.quantidade, 0);

    retiradoInput.value = retiradoEsteMes;

    if (retiradoEsteMes >= limite) {
        retiradoInput.style.cssText = 'color:#e53e3e!important;background:#fed7d7!important;font-weight:bold;';
    } else {
        retiradoInput.style.cssText = '';
    }
}

function abrirLimiteRefil() {
    const select = document.getElementById('limitePaciente');
    select.innerHTML = '<option value="">Selecione</option>' +
        pacientes.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
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
    if (salvandoRefil) {
        mostrarStatus('⏳ Aguarde, registrando...', 'info');
        return;
    }
    salvandoRefil = true;
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

        const retiradoEsteMes = refis
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
        refis.push({ data, paciente, quantidade, limite });
        localStorage.setItem('diabetes_refis', JSON.stringify(refis));

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
        salvandoRefil = false;
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Registrar Refil'; }
    }
}

function atualizarTabelaRefis() {
    const dados = [...refis].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('tabelaRefis');

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

// ============ INSUMOS ============
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
    if (salvandoInsumo) {
        mostrarStatus('⏳ Aguarde, registrando...', 'info');
        return;
    }
    salvandoInsumo = true;
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
        insumos.push({ data, paciente, tipo, item, quantidade });
        localStorage.setItem('diabetes_insumos', JSON.stringify(insumos));

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
        salvandoInsumo = false;
        if (btn) { btn.disabled = false; btn.textContent = '📦 Registrar Insumo'; }
    }
}

function atualizarTabelaInsumos() {
    const dados = [...insumos].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('tabelaInsumos');

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
    fecharModal('modalConfigItens');
    mostrarStatus('✅ Itens de diabetes atualizados!', 'sucesso');
}

// ============ BACKUP MANUAL ============
function exportarBackupDrive() {
    try {
        const data = {
            versao: VERSAO,
            data: new Date().toISOString(),
            pacientes: pacientes,
            canetas: canetas,
            refis: refis,
            insumos: insumos,
            limitesRefil: limitesRefil,
            itensDiabetes: itensDiabetes
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const now = new Date();
        const fileName = `backup_diabetes_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`;
        link.download = fileName;
        link.click();
        mostrarStatus(`📥 Backup baixado: ${fileName}`, 'sucesso');
    } catch (e) {
        console.error(e);
        mostrarStatus('❌ Erro ao gerar backup', 'erro');
    }
}

// ============ UTILITÁRIOS ============
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

function fecharModal(id) { document.getElementById(id).classList.remove('active'); }

// ============ ATUALIZAÇÃO GERAL ============
function atualizarTodosModulos() {
    carregarSelectPacientes();
    carregarSelectsInsumos();
    aplicarFiltrosPacientes();
    atualizarTabelaCanetas();
    atualizarTabelaRefis();
    atualizarTabelaInsumos();
}

// ============ INICIALIZAR ============
inicializar();
