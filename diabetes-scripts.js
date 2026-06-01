/*
 * Arquivo: diabetes-scripts.js - v1.1
 * Sistema: Controle de Diabetes - Assistência Farmacêutica
 * Atualização: Cadastro central de pacientes
 */

// ============ CONFIGURAÇÃO ============
const API_URL = 'https://farmacia-api-controlados.up.railway.app';
const SHEET_ID_PACIENTES = '14JGqndfKqh3kVvzMJBqa13XO6z_SpXnoGTUJ-ZWtIdI'; // 🆕 Planilha central
const SHEET_ID_DIABETES = '1POcsyqGHIN908kgiE_be3oyz9ILBntiSv7hn7iyXJt4';
const VERSAO = '1.1';

// ============ VARIÁVEIS ============
let pacientes = [];
let canetas = [];
let refis = [];
let insumos = [];
let limitesRefil = JSON.parse(localStorage.getItem('limites_refil') || '{}');
let filaOffline = JSON.parse(localStorage.getItem('fila_diabetes_offline') || '[]');

// ============ INICIALIZAÇÃO ============
function inicializar() {
    pacientes = JSON.parse(localStorage.getItem('diabetes_pacientes') || '[]');
    canetas = JSON.parse(localStorage.getItem('diabetes_canetas') || '[]');
    refis = JSON.parse(localStorage.getItem('diabetes_refis') || '[]');
    insumos = JSON.parse(localStorage.getItem('diabetes_insumos') || '[]');
    
    carregarSelectPacientes();
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
    
    if (navigator.onLine && filaOffline.length > 0) {
        processarFilaOffline();
    }
    
    console.log(`🚀 Diabetes v${VERSAO} - Cadastro Central de Pacientes`);
}

// ============ NAVEGAÇÃO ============
function trocarModulo(m) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modulo').forEach(m => m.classList.remove('active'));
    
    const modulos = ['pacientes', 'canetas', 'refis', 'insumos'];
    const idx = modulos.indexOf(m);
    
    if (idx >= 0) {
        document.querySelectorAll('.nav-tab')[idx].classList.add('active');
        document.getElementById(`modulo-${m}`).classList.add('active');
        if (m === 'refis') atualizarLimiteRefil();
    }
}

// ============ API ============
async function lerPlanilha(sheetId, aba, range) {
    try {
        const response = await fetch(`${API_URL}/api/ler-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planilhaId: sheetId, range: `${aba}!${range}` })
        });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        return data.valores || [];
    } catch (error) {
        console.error('Erro ao ler:', error);
        return [];
    }
}

async function escreverPlanilha(sheetId, aba, range, values) {
    try {
        const response = await fetch(`${API_URL}/api/escrever-planilha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                planilhaId: sheetId, 
                range: `${aba}!${range}`,
                valores: values 
            })
        });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Erro ao escrever:', error);
        throw error;
    }
}

// ============ SINCRONIZAÇÃO ============
async function sincronizarTudo() {
    const sd = document.getElementById('statusDot');
    const st = document.getElementById('statusText');
    sd.style.background = '#ffa500';
    st.textContent = 'Sincronizando...';
    
    try {
        // 🆕 Pacientes (da planilha CENTRAL)
        const dadosPacientes = await lerPlanilha(SHEET_ID_PACIENTES, 'Pacientes', 'A1:F1000');
        if (dadosPacientes.length > 1) {
            pacientes = dadosPacientes.slice(1).filter(r => r[0] && r[1]).map(r => ({
                id: r[0] || '',
                nome: r[1] || '',
                nascimento: r[2] || '',
                acs: r[3] || '',
                telefone: r[4] || '',
                ubs: r[5] || ''
            }));
            localStorage.setItem('diabetes_pacientes', JSON.stringify(pacientes));
        }
        
        // Canetas (da planilha de diabetes)
        const dadosCanetas = await lerPlanilha(SHEET_ID_DIABETES, 'Canetas', 'A1:D1000');
        if (dadosCanetas.length > 1) {
            canetas = dadosCanetas.slice(1).filter(r => r[0] && r[1]).map(r => ({
                data: r[0] || '',
                paciente: r[1] || '',
                lote: r[2] || '',
                obs: r[3] || ''
            }));
            localStorage.setItem('diabetes_canetas', JSON.stringify(canetas));
        }
        
        // Refis
        const dadosRefis = await lerPlanilha(SHEET_ID_DIABETES, 'Refis', 'A1:D1000');
        if (dadosRefis.length > 1) {
            refis = dadosRefis.slice(1).filter(r => r[0] && r[1]).map(r => ({
                data: r[0] || '',
                paciente: r[1] || '',
                quantidade: parseInt(r[2]) || 0,
                limite: parseInt(r[3]) || 0
            }));
            localStorage.setItem('diabetes_refis', JSON.stringify(refis));
        }
        
        // Insumos
        const dadosInsumos = await lerPlanilha(SHEET_ID_DIABETES, 'Insumos', 'A1:D1000');
        if (dadosInsumos.length > 1) {
            insumos = dadosInsumos.slice(1).filter(r => r[0] && r[1]).map(r => ({
                data: r[0] || '',
                paciente: r[1] || '',
                tipo: r[2] || '',
                quantidade: parseInt(r[3]) || 0
            }));
            localStorage.setItem('diabetes_insumos', JSON.stringify(insumos));
        }
        
        sd.style.background = '#48bb78';
        st.textContent = '✅ Conectado';
    } catch(e) {
        console.error(e);
        sd.style.background = '#f56565';
        st.textContent = '⚠️ Erro';
    }
    
    atualizarTodosModulos();
}

// ============ FILA OFFLINE ============
function adicionarFilaOffline(tipo, sheetId, aba, valores) {
    filaOffline.push({
        id: Date.now(),
        tipo: tipo,
        sheetId: sheetId,
        aba: aba,
        valores: valores,
        data: new Date().toISOString()
    });
    localStorage.setItem('fila_diabetes_offline', JSON.stringify(filaOffline));
}

async function processarFilaOffline() {
    if (filaOffline.length === 0 || !navigator.onLine) return;
    
    let processados = 0;
    const filaAtual = [...filaOffline];
    
    for (const item of filaAtual) {
        try {
            await escreverPlanilha(item.sheetId, item.aba, 'A1:Z1000', item.valores);
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

// ============ PACIENTES ============
function carregarSelectPacientes() {
    const selects = ['canetaPaciente', 'refilPaciente', 'insumoPaciente', 'limitePaciente'];
    const opts = pacientes.map(p => `<option value="${p.nome}">${p.nome}</option>`).join('');
    
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">Selecione o paciente</option>' + opts;
    });
}

function carregarListaUBS() {
    const ubs = [...new Set(pacientes.map(p => p.ubs).filter(Boolean))].sort();
    const select = document.getElementById('filtroPacienteUBS');
    if (select) {
        select.innerHTML = '<option value="todas">Todas UBS</option>' + 
            ubs.map(u => `<option value="${u}">${u}</option>`).join('');
    }
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
    const nome = document.getElementById('cadNome').value.trim();
    const nascimento = document.getElementById('cadNascimento').value;
    const acs = document.getElementById('cadACS').value.trim();
    const telefone = document.getElementById('cadTelefone').value.trim();
    const ubs = document.getElementById('cadUBS').value.trim();
    
    if (!nome || !nascimento || !acs || !telefone || !ubs) {
        return mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
    }
    
    // 🆕 Gerar ID único
    const id = 'P' + Date.now().toString(36).toUpperCase();
    
    const novoPaciente = { id, nome, nascimento, acs, telefone, ubs };
    
    pacientes.push(novoPaciente);
    localStorage.setItem('diabetes_pacientes', JSON.stringify(pacientes));
    
    const valores = [id, nome, nascimento, acs, telefone, ubs];
    
    if (navigator.onLine) {
        try {
            await escreverPlanilha(SHEET_ID_PACIENTES, 'Pacientes', 'A1:F1000', valores);
            mostrarStatus(`✅ Paciente "${nome}" cadastrado!`, 'sucesso');
        } catch(e) {
            adicionarFilaOffline('paciente', SHEET_ID_PACIENTES, 'Pacientes', valores);
            mostrarStatus('⚠️ Salvo localmente!', 'alerta');
        }
    } else {
        adicionarFilaOffline('paciente', SHEET_ID_PACIENTES, 'Pacientes', valores);
        mostrarStatus('💾 Offline! Salvo localmente.', 'info');
    }
    
    fecharModal('modalCadastroPaciente');
    carregarSelectPacientes();
    carregarListaUBS();
    aplicarFiltrosPacientes();
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
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Nenhum paciente encontrado</td></tr>';
        return;
    }
    
    tb.innerHTML = dados.map(p => `
        <tr>
            <td><small style="color:var(--texto-claro);">${p.id}</small></td>
            <td><strong>${p.nome}</strong></td>
            <td>${formatarData(p.nascimento)}</td>
            <td>${calcularIdade(p.nascimento)} anos</td>
            <td>${p.acs}</td>
            <td>${p.telefone}</td>
            <td>${p.ubs}</td>
        </tr>
    `).join('');
}

// ============ CANETAS ============
async function registrarCaneta() {
    const paciente = document.getElementById('canetaPaciente').value;
    const data = document.getElementById('canetaData').value;
    const lote = document.getElementById('canetaLote').value.trim();
    const obs = document.getElementById('canetaObs').value.trim();
    
    if (!paciente || !data || !lote) {
        return mostrarStatus('⚠️ Preencha todos os campos obrigatórios!', 'alerta');
    }
    
    const novo = { data, paciente, lote, obs };
    canetas.push(novo);
    localStorage.setItem('diabetes_canetas', JSON.stringify(canetas));
    
    const valores = [data, paciente, lote, obs];
    
    if (navigator.onLine) {
        try {
            await escreverPlanilha(SHEET_ID_DIABETES, 'Canetas', 'A1:D1000', valores);
            mostrarStatus(`💉 Caneta registrada!\n${paciente} - Lote: ${lote}`, 'sucesso');
        } catch(e) {
            adicionarFilaOffline('caneta', SHEET_ID_DIABETES, 'Canetas', valores);
            mostrarStatus('⚠️ Salvo localmente!', 'alerta');
        }
    } else {
        adicionarFilaOffline('caneta', SHEET_ID_DIABETES, 'Canetas', valores);
        mostrarStatus('💾 Offline! Salvo localmente.', 'info');
    }
    
    document.getElementById('canetaLote').value = '';
    document.getElementById('canetaObs').value = '';
    document.getElementById('canetaData').valueAsDate = new Date();
    atualizarTabelaCanetas();
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
            <td>${formatarData(c.data)}</td>
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
    document.getElementById('limitePaciente').innerHTML = 
        '<option value="">Selecione</option>' + 
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
        return mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
    }
    
    limitesRefil[paciente] = valor;
    localStorage.setItem('limites_refil', JSON.stringify(limitesRefil));
    
    fecharModal('modalLimiteRefil');
    mostrarStatus(`✅ Limite de ${paciente} atualizado para ${valor} refis/mês!`, 'sucesso');
    atualizarLimiteRefil();
}

async function registrarRefil() {
    const paciente = document.getElementById('refilPaciente').value;
    const data = document.getElementById('refilData').value;
    const quantidade = parseInt(document.getElementById('refilQuantidade').value);
    
    if (!paciente || !data || !quantidade || quantidade <= 0) {
        return mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
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
        return mostrarStatus(
            `⚠️ Limite excedido!\n\nPaciente: ${paciente}\nLimite mensal: ${limite}\nJá retirado: ${retiradoEsteMes}\nTentando retirar: ${quantidade}\nDisponível: ${limite - retiradoEsteMes}`,
            'alerta'
        );
    }
    
    const novo = { data, paciente, quantidade, limite };
    refis.push(novo);
    localStorage.setItem('diabetes_refis', JSON.stringify(refis));
    
    const valores = [data, paciente, quantidade, limite];
    
    if (navigator.onLine) {
        try {
            await escreverPlanilha(SHEET_ID_DIABETES, 'Refis', 'A1:D1000', valores);
            mostrarStatus(`🔄 Refil registrado!\n${paciente} - ${quantidade} refis`, 'sucesso');
        } catch(e) {
            adicionarFilaOffline('refil', SHEET_ID_DIABETES, 'Refis', valores);
            mostrarStatus('⚠️ Salvo localmente!', 'alerta');
        }
    } else {
        adicionarFilaOffline('refil', SHEET_ID_DIABETES, 'Refis', valores);
        mostrarStatus('💾 Offline! Salvo localmente.', 'info');
    }
    
    document.getElementById('refilQuantidade').value = '';
    document.getElementById('refilData').valueAsDate = new Date();
    atualizarLimiteRefil();
    atualizarTabelaRefis();
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
            <td>${formatarData(r.data)}</td>
            <td>${r.paciente}</td>
            <td>${r.quantidade}</td>
            <td>${r.limite || 3} por mês</td>
        </tr>
    `).join('');
}

// ============ INSUMOS ============
async function registrarInsumo() {
    const paciente = document.getElementById('insumoPaciente').value;
    const data = document.getElementById('insumoData').value;
    const tipo = document.getElementById('insumoTipo').value;
    const quantidade = parseInt(document.getElementById('insumoQuantidade').value);
    
    if (!paciente || !data || !tipo || !quantidade || quantidade <= 0) {
        return mostrarStatus('⚠️ Preencha todos os campos!', 'alerta');
    }
    
    const novo = { data, paciente, tipo, quantidade };
    insumos.push(novo);
    localStorage.setItem('diabetes_insumos', JSON.stringify(insumos));
    
    const valores = [data, paciente, tipo, quantidade];
    
    if (navigator.onLine) {
        try {
            await escreverPlanilha(SHEET_ID_DIABETES, 'Insumos', 'A1:D1000', valores);
            mostrarStatus(`📦 Insumo registrado!\n${paciente} - ${tipo} (${quantidade})`, 'sucesso');
        } catch(e) {
            adicionarFilaOffline('insumo', SHEET_ID_DIABETES, 'Insumos', valores);
            mostrarStatus('⚠️ Salvo localmente!', 'alerta');
        }
    } else {
        adicionarFilaOffline('insumo', SHEET_ID_DIABETES, 'Insumos', valores);
        mostrarStatus('💾 Offline! Salvo localmente.', 'info');
    }
    
    document.getElementById('insumoQuantidade').value = '';
    document.getElementById('insumoData').valueAsDate = new Date();
    atualizarTabelaInsumos();
}

function atualizarTabelaInsumos() {
    const dados = [...insumos].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const tb = document.getElementById('tabelaInsumos');
    
    if (dados.length === 0) {
        tb.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;">Nenhum insumo registrado</td></tr>';
        return;
    }
    
    tb.innerHTML = dados.map(i => `
        <tr>
            <td>${formatarData(i.data)}</td>
            <td>${i.paciente}</td>
            <td>${i.tipo}</td>
            <td>${i.quantidade}</td>
        </tr>
    `).join('');
}

// ============ ATUALIZAÇÃO GERAL ============
function atualizarTodosModulos() {
    carregarSelectPacientes();
    carregarListaUBS();
    aplicarFiltrosPacientes();
    atualizarTabelaCanetas();
    atualizarTabelaRefis();
    atualizarTabelaInsumos();
}

// ============ UTILITÁRIOS ============
function formatarData(dataStr) {
    if (!dataStr) return '';
    if (dataStr.includes('-')) {
        const p = dataStr.split('-');
        if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return dataStr;
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

// ============ STATUS + NAVEGAÇÃO ============
function mostrarStatus(m, tipo) {
    const s = document.getElementById('statusFlutuante');
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
    if (s > 300) { b.forEach(btn => btn.classList.add('visivel')); }
    else { b.forEach(btn => btn.classList.remove('visivel')); }
});

function fecharModal(id) { document.getElementById(id).classList.remove('active'); }

inicializar();
