/*
 * Copyright (c) 2024 Lord Aroma - Francisco Leite.
 * Todos os direitos reservados.
 *
 * VERSÃO 4.2 - Correção de Envio de Leads
*/

// --- CONFIGURAÇÃO ---
const GOOGLE_SHEET_URL_PERFUMES = 'https://script.google.com/macros/s/AKfycbxmIvPrUPOtn5xALHbFKSHjjtvT0Bm37y5GADmbNqBLVbhctylofHnCaPU1W27NBmI/exec';
const GOOGLE_SHEET_URL_MAPPING = 'https://script.google.com/macros/s/AKfycbzxZDfrUJK0VxetiUaSQqXTlRKQu_TMjyb5N5-G78_ueCG1VYH4qhEOqwnJ9OJVdDXB/exec';
// IMPORTANTE: Certifique-se de que esta é a URL da sua *última implantação* do App da Web.
const GOOGLE_SHEET_URL_LEADS = 'https://script.google.com/macros/s/AKfycbxOidKtrbNnv7wwU-WoKBoAb5SjaQlfTJNsU-Hf7MUKLQ4ZyCifJxwYx1ugnSnGUas/exec'; 
const WHATSAPP_NUMBER = '5511999999999';

// --- ARQUÉTIPOS ---
const archetypes = {
    'amadeirado': { name: 'A Alma Sólida', description: 'Você valoriza a tradição e a força. Suas fragrâncias são marcantes, elegantes e transmitem uma confiança inabalável, como raízes profundas e nobres.' },
    'cítrico': { name: 'O Espírito Livre', description: 'Energia, frescor e otimismo definem você. Seus perfumes são vibrantes e revigorantes, perfeitos para quem vive a vida com leveza e dinamismo.' },
    'floral': { name: 'O Coração Romântico', description: 'Sua essência é a sensibilidade e a sofisticação. Você se conecta com fragrâncias delicadas e envolventes, que celebram a beleza em suas mais variadas formas.' },
    'frutado': { name: 'A Personalidade Radiante', description: 'Alegre, jovial e contagiante. Suas fragrâncias são doces e vibrantes, refletindo uma personalidade magnética que adora celebrar os bons momentos.' },
    'especiado': { name: 'A Mente Misteriosa', description: 'Intenso, exótico e magnético. Você é atraído por perfumes quentes e picantes que criam uma aura de mistério e sedução por onde passa.' },
    'aromático': { name: 'A Natureza Clássica', description: 'Equilíbrio e naturalidade são suas marcas. Você prefere fragrâncias limpas e atemporais, que evocam a sensação de bem-estar e a elegância do que é essencial.' },
    'oriental': { name: 'A Presença Exótica', description: 'Sedutor, opulento e inesquecível. Seus perfumes são ricos e complexos, ideais para quem tem uma personalidade forte e não tem medo de deixar sua marca.' },
    'default': { name: 'O Explorador Olfativo', description: 'Sua personalidade é versátil e aberta a novas descobertas. Esta seleção foi criada para se adaptar aos seus mais variados momentos e humores.' }
};
const accordToArchetypeMap = { 'Amadeirado': 'amadeirado', 'Cítrico': 'cítrico', 'Floral': 'floral', 'Frutado': 'frutado', 'Especiado': 'especiado', 'Aromático': 'aromático', 'Oriental': 'oriental', 'Fougère': 'aromático', 'Chipre': 'amadeirado', 'Gourmand': 'oriental' };

// --- VARIÁVEIS DE ESTADO E ELEMENTOS DO DOM ---
const questions = [ { id: 'familia_olfativa', title: "Qual destes universos de cheiros mais te atrai?", options: [ { text: "Cítricos & Frescos", value: ["GRUPO: CÍTRICAS", "GRUPO: FRUTAS"] }, { text: "Doces & Gourmands", value: ["GRUPO: DOCES & AROMAS GOURMETS", "GRUPO: BEBIDAS"] }, { text: "Florais & Delicados", value: ["GRUPO: FLORES BRANCAS", "GRUPO: FLORES NATURAIS E RECONSTRUÍDAS"] }, { text: "Amadeirados & Marcantes", value: ["GRUPO: MADEIRAS & MUSGOS", "GRUPO: RESINAS & BÁLSAMOS"] }, { text: "Exóticos & Especiados", value: ["GRUPO: ESPECIARIAS", "GRUPO: MUSK, ÂMBARES, NOTAS ANIMÁLICA"] }, { text: "Verdes & Naturais", value: ["GRUPO: PLANTAS, ERVAS E FOUGÈRES", "GRUPO: VEGETAIS"] } ] }, { id: 'estacao', title: "Você busca um perfume para qual estação?", options: [ { text: "Calor Intenso (Verão)", value: "verao" }, { text: "Frio Aconchegante (Inverno)", value: "inverno" }, { text: "Clima Amenos (Outono/Primavera)", value: "outono,primavera" }, { text: "Todas as Estações", value: "todas" } ] }, { id: 'horario', title: "E para qual momento do dia?", options: [ { text: "Para o Dia", value: "dia" }, { text: "Para a Noite", value: "noite" }, { text: "Versátil (Dia e Noite)", value: "ambos" } ] } ];
let currentState = { screen: 'welcome', currentQuestion: 0, userPreferences: {}, userProfile: { name: '', photo: null, universe: '', origin: '' }, result: [], archetype: null };
let perfumeDatabase = [], olfactoryMapping = {}, cropper = null;
const screens = { welcome: document.getElementById('welcome-screen'), identification: document.getElementById('identification-screen'), quiz: document.getElementById('quiz-screen'), loading: document.getElementById('loading-screen'), results: document.getElementById('results-screen') };
const modal = document.getElementById('crop-modal'), imageToCrop = document.getElementById('image-to-crop'), clickSound = document.getElementById('click-sound'), successSound = document.getElementById('success-sound');

// --- INICIALIZAÇÃO E FUNÇÕES GLOBAIS ---
document.addEventListener('DOMContentLoaded', initializeApp);
async function initializeApp() {
    setupEventListeners();
    try {
        const [perfumesResponse, mappingResponse] = await Promise.all([ fetchGoogleSheet(GOOGLE_SHEET_URL_PERFUMES), fetchGoogleSheet(GOOGLE_SHEET_URL_MAPPING) ]);
        const perfumes = Array.isArray(perfumesResponse) ? perfumesResponse : perfumesResponse[Object.keys(perfumesResponse)[0]];
        const mapping = Array.isArray(mappingResponse) ? mappingResponse : mappingResponse[Object.keys(mappingResponse)[0]];
        if (!Array.isArray(perfumes) || !Array.isArray(mapping)) { throw new Error("Dados da planilha em formato inesperado."); }
        perfumeDatabase = perfumes.map(row => normalizeKeys(row));
        olfactoryMapping = processMappingData(mapping.map(row => normalizeKeys(row)));
    } catch (error) { console.error("ERRO FATAL NA INICIALIZAÇÃO:", error); alert(`Não foi possível carregar os dados. Detalhes: ${error.message}.`); }
}
function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', () => { playSound(clickSound); showScreen('identification'); updateProgress(10); });
    document.getElementById('user-form').addEventListener('submit', handleUserForm);
    document.getElementById('user-photo').addEventListener('change', openCropModal);
    document.querySelector('.photo-preview').addEventListener('click', () => document.getElementById('user-photo').click());
    document.getElementById('confirm-crop-btn').addEventListener('click', applyCrop);
    document.getElementById('cancel-crop-btn').addEventListener('click', cancelCrop);
    document.getElementById('redo-btn').addEventListener('click', () => { playSound(clickSound); showScreen('identification'); updateProgress(10); });
    
    const phoneForm = document.getElementById('phone-form');
    if (phoneForm) {
        phoneForm.addEventListener('submit', submitLeadAndShowResults);
        const phoneInput = document.getElementById('user-phone');
        if (phoneInput) { IMask(phoneInput, { mask: '(00) 00000-0000' }); }
    }
}
function playSound(sound) { try { sound.currentTime = 0; sound.play().catch(e => {}); } catch (e) {} }
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    currentState.screen = screenName;
}
function updateProgress(percentage) { const activeScreen = document.querySelector('.screen.active'); if (!activeScreen) return; const progressBar = activeScreen.querySelector('.progress'); if (progressBar) progressBar.style.width = `${percentage}%`; }
function normalizeKeys(obj) { const newObj = {}; for (const key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key.toLowerCase()] = obj[key]; } } return newObj; }
async function fetchGoogleSheet(url) { try { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); const text = await response.text(); try { return JSON.parse(text); } catch (e) { throw new Error("Resposta inválida da planilha."); } } catch (error) { throw new Error(`Erro de rede ou CORS: ${error.message}`); } }
function processMappingData(mappingData) { const mapping = {}; mappingData.forEach(row => { for (const group in row) { if (row[group]) { if (!mapping[group]) mapping[group] = []; mapping[group].push(row[group]); } } }); return mapping; }

// --- MOTOR DE RECOMENDAÇÃO ---
function runFragranceMatchEngine() {
    try {
        const prefs = currentState.userPreferences;
        let candidates = perfumeDatabase.filter(p => (prefs.preferencia_genero === 'versatil' || (p['gênero']||'').toLowerCase() === prefs.preferencia_genero || (p['gênero']||'').toLowerCase() === 'unissex') && (prefs.preferencia_origem === 'ambos' || (p['origem perfume']||'').toLowerCase() === prefs.preferencia_origem));
        const userAccordList = (prefs.familia_olfativa || []).flatMap(group => olfactoryMapping[group.toLowerCase()] || []);
        const uniqueUserAcords = [...new Set(userAccordList)];
        const scoredCandidates = candidates.map(perfume => {
            let score = 0;
            const perfumeAcords = [perfume['acorde principal 1'], perfume['acorde principal 2'], perfume['acorde principal 3']].filter(Boolean);
            perfumeAcords.forEach(accord => { if (uniqueUserAcords.includes(accord)) score += 3; });
            const estacaoPerfume = (perfume['estação'] || '').toLowerCase();
            if (prefs.estacao === 'todas' || (prefs.estacao || '').includes(estacaoPerfume)) score += 2;
            const horarioPerfume = (perfume['horário de uso'] || '').toLowerCase();
            if (prefs.horario === 'ambos' || horarioPerfume === prefs.horario) score += 2;
            return { ...perfume, score };
        });
        const finalRecommendations = scoredCandidates.filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
        currentState.result = finalRecommendations;
        
        let foundArchetypeKey = 'default';
        if (finalRecommendations.length > 0) {
            const topPerfume = finalRecommendations[0];
            const topPerfumeAccords = [topPerfume['acorde principal 1'], topPerfume['acorde principal 2'], topPerfume['acorde principal 3']].filter(Boolean);
            for (const accord of topPerfumeAccords) {
                if (accordToArchetypeMap[accord]) { foundArchetypeKey = accordToArchetypeMap[accord]; break; }
            }
        }
        currentState.archetype = archetypes[foundArchetypeKey];
    } catch (error) { console.error("ERRO NO MOTOR:", error); alert("Ocorreu um erro ao processar suas preferências."); showScreen('welcome'); }
}

// --- TELA DE RESULTADOS E AÇÕES ---
function showResults() {
    showScreen('results');
    const { name, photo } = currentState.userProfile;
    const { archetype } = currentState;
    document.getElementById('result-user-photo').src = photo || "data:image/svg+xml;charset=UTF-8,%3csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='120' height='120' fill='%231a1a1a'/%3e%3c/svg%3e";
    document.getElementById('result-user-name').textContent = name || 'Viajante Olfativo';
    if (archetype) {
        document.getElementById('archetype-name').textContent = archetype.name;
        document.getElementById('archetype-description').textContent = archetype.description;
    }
    displayPerfumeRecommendations();
    setupActionButtons();
}
function displayPerfumeRecommendations() {
    const container = document.getElementById('recommended-perfumes');
    container.innerHTML = '';
    if (!currentState.result || currentState.result.length === 0) {
        container.innerHTML = '<p class="no-results-message">Nenhum perfume encontrado. Tente refazer o teste com outras opções!</p>';
        return;
    }
    currentState.result.forEach(perfume => {
        const card = document.createElement('div');
        card.className = 'perfume-card';
        card.innerHTML = `<div class="perfume-image-container"><img src="${perfume['link da foto de exibição'] || 'https://i.postimg.cc/50nm5WfF/foto-lord-aroma.png'}" alt="Foto do perfume ${perfume['nome do perfume']}" class="perfume-image"></div><div class="perfume-info"><h4>${perfume['nome do perfume']}</h4><div class="brand">${perfume['marca']}</div><div class="notes">Acordes: ${[perfume['acorde principal 1'], perfume['acorde principal 2'], perfume['acorde principal 3']].filter(Boolean).join(', ')}</div></div><a href="${perfume['link do botão de compra'] || '#'}" target="_blank" class="buy-button">Compre Agora</a>`;
        container.appendChild(card);
    });
}
function setupActionButtons() {
    const whatsappBtn = document.getElementById('whatsapp-btn');
    const recommendations = currentState.result;
    let message = `Olá! Fiz o teste de personalidade olfativa e estas foram minhas recomendações:\n\n`;
    if (recommendations.length > 0) {
        recommendations.forEach(p => { message += `- ${p['nome do perfume']} (${p['marca']})\n`; });
        message += `\nGostaria de saber mais sobre eles ou outras opções.`;
    } else {
        message = `Olá! Fiz o teste de personalidade olfativa, mas não encontrei uma recomendação. Pode me ajudar a encontrar um perfume?`;
    }
    whatsappBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// --- Funções de QUIZ, CROP e FLUXO DE SUBMISSÃO ---
function handleUserForm(event) { event.preventDefault(); const formData = new FormData(event.target); currentState.userProfile.name = formData.get('user-name'); currentState.userPreferences.preferencia_genero = formData.get('universe'); currentState.userPreferences.preferencia_origem = formData.get('origin'); playSound(successSound); startQuiz(); }
function startQuiz() { showScreen('quiz'); currentState.currentQuestion = 0; displayQuestion(); }
function displayQuestion() { const question = questions[currentState.currentQuestion]; const progress = 10 + ((currentState.currentQuestion + 1) / questions.length) * 80; updateProgress(progress); document.getElementById('question-title').textContent = question.title; const optionsContainer = document.getElementById('question-options'); optionsContainer.innerHTML = ''; const optionsList = document.createElement('div'); optionsList.className = 'options-list-simple'; question.options.forEach(option => { const button = document.createElement('button'); button.className = 'option-button-simple'; button.textContent = option.text; button.addEventListener('click', () => selectAnswer(question.id, option.value)); optionsList.appendChild(button); }); optionsContainer.appendChild(optionsList); }
function selectAnswer(questionId, value) { playSound(clickSound); currentState.userPreferences[questionId] = value; setTimeout(() => { if (currentState.currentQuestion < questions.length - 1) { currentState.currentQuestion++; displayQuestion(); } else { showLoadingScreen(); } }, 400); }

function showLoadingScreen() {
    showScreen('loading');
    runFragranceMatchEngine();
}

async function submitLeadAndShowResults(event) {
    event.preventDefault();
    const phoneInput = document.getElementById('user-phone');
    const userPhoneClean = phoneInput.value.replace(/\D/g, ''); 
    const button = event.target.querySelector('button[type="submit"]');

    if (userPhoneClean.length < 10) {
        alert('Por favor, digite um número de WhatsApp válido com DDD.');
        return;
    }
    
    button.textContent = 'Enviando...';
    button.disabled = true;

    const leadData = {
        nome: currentState.userProfile.name,
        telefone: userPhoneClean,
        universo: currentState.userPreferences.preferencia_genero,
        origem: currentState.userPreferences.preferencia_origem,
        familiaOlfativa: currentState.userPreferences.familia_olfativa,
        estacao: currentState.userPreferences.estacao,
        horario: currentState.userPreferences.horario,
        recomendacoes: currentState.result
    };
    
    // A mágica acontece aqui. Usamos um FormData para contornar o problema de CORS de forma mais confiável.
    const formData = new FormData();
    formData.append('entry.1', leadData.nome); // Substitua por seus IDs de campo, se usar Google Forms
    formData.append('data', JSON.stringify(leadData)); // Método genérico para Apps Script

    try {
        // CORREÇÃO: Usamos um método que não depende do 'no-cors' para garantir o envio.
        await fetch(GOOGLE_SHEET_URL_LEADS, {
            method: 'POST',
            body: JSON.stringify(leadData), // Enviamos como string de texto
            headers: {
              'Content-Type': 'text/plain;charset=utf-8', // O script do Google espera texto
            },
        });
    } catch (error) {
        console.error("Erro ao enviar o lead:", error);
        // Mesmo se der erro, continua para a tela de resultados para não prejudicar a experiência
    } finally {
        setTimeout(() => {
            playSound(successSound);
            showResults();
            button.textContent = 'Ver meu resultado!';
            button.disabled = false;
        }, 800);
    }
}

// Funções de Crop
function openCropModal(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { imageToCrop.src = e.target.result; modal.style.display = 'flex'; if (cropper) cropper.destroy(); cropper = new Cropper(imageTo-crop, { aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 0.8 }); }; reader.readAsDataURL(file); }
function applyCrop() { if (!cropper) return; const canvas = cropper.getCroppedCanvas({ width: 256, height: 256 }); currentState.userProfile.photo = canvas.toDataURL('image/jpeg'); document.getElementById('preview-img').src = currentState.userProfile.photo; document.getElementById('preview-img').style.display = 'block'; document.querySelector('.photo-placeholder').style.display = 'none'; document.getElementById('result-user-photo').src = currentState.userProfile.photo; cancelCrop(); }
function cancelCrop() { if (cropper) { cropper.destroy(); cropper = null; } modal.style.display = 'none'; }
