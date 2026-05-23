/*
 * Arquivo: scripts.js
 * Descrição: Todas as funcionalidades e lógicas do sistema Assistência Farmacêutica
 *
 * COMO EDITAR?
 * - Altere nomes, opções de listas, mensagens e textos nos blocos para mudar o funcionamento.
 * - Para quem NÃO é programador: mude só o necessário; se precisar de uma função nova, peça ajuda de alguém ou descreva bem!
 *
 * DICAS:
 * - Para alterar nomes de medicamentos, procure por MEDICAMENTOS_CTRL e MEDICAMENTOS_ESP.
 * - Para mudar responsáveis, veja a lista RESPONSAVEIS.
 * - Funções de cadastro, sincronização e exportação estão identificadas por comentários.
 *
 * Se o sistema falhar devido a alterações, volte o arquivo ao original do GitHub.
 */

// ============ CONFIGURAÇÃO (NÃO APAGAR ESSAS VARIÁVEIS!) ===========
// Aqui vão as listas principais do sistema:
const SHEET_ID_CTRL = '1WIpoH1sZsuMCaSsD6QC6LAcDo-6Rc013MlGDztlzqRo';
const SHEET_ID_ESP = '13oodt6jGo8TgAaxKqWUMS64a0y0TnPX5ZUmDXx3BL_M';
const VERSAO = '2.4';

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
const RESPONSAVEIS = [
  "Dr. João Silva", "Dra. Maria Santos", "Enf. Carlos Oliveira","Farm. Ana Pereira","Dr. Pedro Costa","Enf. Lucia Ferreira"
];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ============ VARIÁVEIS DE TRABALHO (não precisa mexer) ===========
let registrosCtrl=[], registrosEsp=[], estoque={};
let medicamentosAtivosCtrl=[...MEDICAMENTOS_CTRL], responsaveisAtivos=[...RESPONSAVEIS];
let mesCtrl='todos', mesEsp='todos', dashboardMesCtrl=null, dashboardMesEsp=null, token=null;
let cfgEstoqueCritico=parseInt(localStorage.getItem('cfg_estoque_critico')||'5');
let cfgEstoqueBaixo=parseInt(localStorage.getItem('cfg_estoque_baixo')||'15');

// ============ INICIALIZAÇÃO DO SISTEMA ===========
function inicializar(){
    // DICA: Se aparecer erro "null is not iterable", veja se há problemas de digitação em listas!
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
    atualizarModuloControlados();atualizarModuloEspeciais();sincronizarTudo();
    console.log('🚀 v2.4 - GitHub Ready');
}

// ============ RESTANTE DO JS ===========
// TODO O RESTANTE DO JS DEVE SER COPIADO EXATAMENTE COMO ESTÁ NO SEU ARQUIVO ORIGINAL
// (Incluindo funções de cadastro, controle, navegação, Google API, configurações, etc.)
//
// Recomendação: Deixe sempre os comentários dos blocos grandes para não se perder.

// ... cole aqui todas as funções JS do <script> do index.html ...

// Por fim, sempre inicialize o sistema assim:
inicializar();
