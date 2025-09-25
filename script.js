/*
 * Copyright (c) 2024 Lord Aroma - Francisco Leite.
 * Todos os direitos reservados. A reprodução, distribuição ou transmissão
 * não autorizada deste código e seus dados associados é estritamente proibida.
 *
 * VERSÃO 2.1 - White Label com Fragrance Match Engine (Correção de Bug e Robustez)
*/

// --- CONFIGURAÇÃO DAS FONTES DE DADOS (GOOGLE SHEETS) ---
const GOOGLE_SHEET_URL_PERFUMES = 'https://script.google.com/macros/s/AKfycbxmIvPrUPOtn5xALHbFKSHjjtvT0Bm37y5GADmbNqBLVbhctylofHnCaPU1W27NBmI/exec';
const GOOGLE_SHEET_URL_MAPPING = 'https://script.google.com/macros/s/AKfycbzxZDfrUJK0VxetiUaSQqXTlRKQu_TMjyb5N5-G78_ueCG1VYH4qhEOqwnJ9OJVdDXB/exec';

// --- NOVAS PERGUNTAS PARA O FRAGRANCE MATCH ENGINE ---
const questions = [
    {
        id: 'familia_olfativa',
        title: "Qual destes universos de cheiros mais te atrai?",
        options: [
            { text: "Cítricos & Frescos", value: ["GRUPO: CÍTRICAS", "GRUPO: FRUTAS"] },
            { text: "Doces & Gourmands", value: ["GRUPO: DOCES & AROMAS GOURMETS", "GRUPO: BEBIDAS"] },
            { text: "Florais & Delicados", value: ["GRUPO: FLORES BRANCAS", "GRUPO: FLORES NATURAIS E RECONSTRUÍDAS"] },
            { text: "Amadeirados & Marcantes", value: ["GRUPO: MADEIRAS & MUSGOS", "GRUPO: RESINAS & BÁLSAMOS"] },
            { text: "Exóticos & Especiados", value: ["GRUPO: ESPECIARIAS", "GRUPO: MUSK, ÂMBARES, NOTAS ANIMÁLICAS"] },
            { text: "Verdes & Naturais", value: ["GRUPO: PLANTAS, ERVAS E FOUGÈRES", "GRUPO: VEGETAIS"] }
        ]
    },
    {
        id: 'estacao',
        title: "Você busca um perfume para qual estação?",
        options: [
            { text: "Calor Intenso (Verão)", value: "verao" },
            { text: "Frio Aconchegante (Inverno)", value: "inverno" },
            { text: "Clima Amenos (Outono/Primavera)", value: "outono,primavera" },
            { text: "Todas as Estações", value: "todas" }
        ]
    },
    {
        id: 'horario',
        title: "E para qual momento do dia?",
        options: [
            { text: "Para o Dia", value: "dia" },
            { text: "Para a Noite", value: "noite" },
            { text: "Versátil (Dia e Noite)", value: "ambos" }
        ]
    }
];

// --- ESTADO DA APLICAÇÃO ---
let currentState = {
    screen: 'welcome',
    currentQuestion: 0,
    userPreferences: {},
    userProfile: { name: '', photo: null, universe: '', origin: '' },
    result: []
};

let perfumeDatabase = [];
let olfactoryMapping = {};
let cropper = null;

// --- ELEMENTOS DO DOM ---
const screens = {
    welcome: document.getElementById('welcome-screen'),
    identification: document.getElementById('identification-screen'),
    quiz: document.getElementById('quiz-screen'),
    loading: document.getElementById('loading-screen'),
    results: document.getElementById('results-screen')
};
const modal = document.getElementById('crop-modal');
const imageToCrop = document.getElementById('image-to-crop');
const clickSound = document.getElementById('click-sound');
const successSound = document.getElementById('success-sound');

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    setupEventListeners();
    try {
        const [perfumes, mapping] = await Promise.all([
            fetchGoogleSheet(GOOGLE_SHEET_URL_PERFUMES),
            fetchGoogleSheet(GOOGLE_SHEET_URL_MAPPING)
        ]);
        // Normaliza as chaves dos objetos para minúsculas para evitar erros de case
        perfumeDatabase = perfumes.map(row => normalizeKeys(row));
        olfactoryMapping = processMappingData(mapping.map(row => normalizeKeys(row)));
        
        console.log("Banco de dados de perfumes carregado:", perfumeDatabase);
        console.log("Mapeamento olfativo carregado:", olfactoryMapping);

    } catch (error) {
        console.error("Erro fatal ao carregar dados das planilhas:", error);
        alert("Não foi possível carregar os dados dos perfumes. Verifique sua conexão e a configuração da planilha.");
    }
}

function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', () => { playSound(clickSound); showScreen('identification'); updateProgress(10); });
    document.getElementById('user-form').addEventListener('submit', handleUserForm);
    document.getElementById('user-photo').addEventListener('change', openCropModal);
    document.getElementById('result-user-photo-input').addEventListener('change', openCropModal);
    document.querySelector('.photo-preview').addEventListener('click', () => document.getElementById('user-photo').click());
    document.getElementById('result-photo-container').addEventListener('click', () => document.getElementById('result-user-photo-input').click());
    document.getElementById('confirm-crop-btn').addEventListener('click', applyCrop);
    document.getElementById('cancel-crop-btn').addEventListener('click', cancelCrop);
    document.getElementById('share-btn').addEventListener('click', shareResult);
}


// --- FUNÇÕES UTILITÁRIAS ---
function playSound(sound) { try { sound.currentTime = 0; sound.play().catch(e => console.log('Audio play failed:', e)); } catch (e) { console.log('Audio error:', e); } }
function showScreen(screenName) { Object.values(screens).forEach(screen => screen.classList.remove('active')); screens[screenName].classList.add('active'); currentState.screen = screenName; }
function updateProgress(percentage) {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;
    const progressBar = activeScreen.querySelector('.progress');
    if (progressBar) progressBar.style.width = percentage + '%';
}
// Função para normalizar as chaves de um objeto para minúsculas
function normalizeKeys(obj) {
    const newObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key.toLowerCase()] = obj[key];
        }
    }
    return newObj;
}


// --- LÓGICA DE DADOS (GOOGLE SHEETS) ---
async function fetchGoogleSheet(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Erro ao buscar dados de: ${url}`, error);
        throw error;
    }
}

function processMappingData(mappingData) {
    const mapping = {};
    mappingData.forEach(row => {
        for (const group in row) {
            // Normaliza o nome do grupo para corresponder ao que vem das perguntas
            const normalizedGroup = group.toUpperCase().replace(/\s+/g, '_');
            if (row[group]) {
                 if (!mapping[normalizedGroup]) {
                    mapping[normalizedGroup] = [];
                }
                mapping[normalizedGroup].push(row[group]);
            }
        }
    });
    return mapping;
}


// --- LÓGICA DO CROPPER.JS ---
function openCropModal(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        imageToCrop.src = e.target.result;
        modal.style.display = 'flex';
        if (cropper) cropper.destroy();
        cropper = new Cropper(imageToCrop, { aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 0.8 });
    };
    reader.readAsDataURL(file);
}

function applyCrop() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 256, height: 256 });
    currentState.userProfile.photo = canvas.toDataURL('image/jpeg');
    document.getElementById('preview-img').src = currentState.userProfile.photo;
    document.getElementById('preview-img').style.display = 'block';
    document.querySelector('.photo-placeholder').style.display = 'none';
    document.getElementById('result-user-photo').src = currentState.userProfile.photo;
    cancelCrop();
}

function cancelCrop() {
    if (cropper) { cropper.destroy(); cropper = null; }
    modal.style.display = 'none';
}


// --- FLUXO DO USUÁRIO E QUIZ ---
function handleUserForm(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    currentState.userProfile.name = formData.get('user-name');
    currentState.userPreferences.preferencia_genero = formData.get('universe');
    currentState.userPreferences.preferencia_origem = formData.get('origin');
    playSound(successSound);
    startQuiz();
}

function startQuiz() {
    showScreen('quiz');
    currentState.currentQuestion = 0;
    displayQuestion();
}

function displayQuestion() {
    const question = questions[currentState.currentQuestion];
    const progress = 10 + ((currentState.currentQuestion + 1) / questions.length) * 80;
    updateProgress(progress);

    document.getElementById('question-title').textContent = question.title;
    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';
    const optionsList = document.createElement('div');
    optionsList.className = 'options-list-simple';

    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-button-simple';
        button.textContent = option.text;
        button.addEventListener('click', () => selectAnswer(question.id, option.value));
        optionsList.appendChild(button);
    });
    optionsContainer.appendChild(optionsList);
}

function selectAnswer(questionId, value) {
    playSound(clickSound);
    currentState.userPreferences[questionId] = value;
    
    setTimeout(() => {
        if (currentState.currentQuestion < questions.length - 1) {
            currentState.currentQuestion++;
            displayQuestion();
        } else {
            showLoadingScreen();
        }
    }, 400);
}

function showLoadingScreen() {
    showScreen('loading');
    setTimeout(() => {
        runFragranceMatchEngine();
    }, 3000);
}


// --- MOTOR DE RECOMENDAÇÃO (COM CORREÇÕES) ---
function runFragranceMatchEngine() {
    try {
        console.log("Preferências do usuário para o motor:", currentState.userPreferences);
        const prefs = currentState.userPreferences;

        // 1. Filtragem rigorosa
        let candidates = perfumeDatabase.filter(perfume => {
            const generoPerfume = (perfume['gênero'] || '').toLowerCase();
            const generoUsuario = (prefs.preferencia_genero || '').toLowerCase();
            let generoMatch = generoUsuario === 'versatil' || generoPerfume === generoUsuario || generoPerfume === 'unissex';
            
            const origemPerfume = (perfume['origem perfume'] || '').toLowerCase();
            const origemUsuario = (prefs.preferencia_origem || '').toLowerCase();
            let origemMatch = origemUsuario === 'ambos' || origemPerfume === origemUsuario;

            return generoMatch && origemMatch;
        });

        // 2. Mapeamento de Acordes
        const userAccordList = (prefs.familia_olfativa || []).flatMap(familyGroup => olfactoryMapping[familyGroup] || []);
        const uniqueUserAcords = [...new Set(userAccordList)];
        
        // 3. Pontuação e Ordenação
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

        const finalRecommendations = scoredCandidates.sort((a, b) => b.score - a.score).slice(0, 5);
        console.log("Recomendações finais:", finalRecommendations);
        
        currentState.result = finalRecommendations;
        showResults();

    } catch (error) {
        console.error("ERRO NO MOTOR DE RECOMENDAÇÃO:", error);
        alert("Ocorreu um erro ao processar suas preferências. Por favor, tente novamente.");
        // Opcional: voltar para a tela inicial
        showScreen('welcome');
    }
}


// --- TELA DE RESULTADOS ---
function showResults() {
    showScreen('results');
    const userProfile = currentState.userProfile;

    const photoElement = document.getElementById('result-user-photo');
    photoElement.src = userProfile.photo || "data:image/svg+xml,..."; // SVG Padrão
    document.getElementById('result-user-name').textContent = (userProfile.name || 'Viajante Olfativo').toUpperCase();
    
    displayPerfumeRecommendations();
}

function displayPerfumeRecommendations() {
    const recommendations = currentState.result;
    const container = document.getElementById('recommended-perfumes');
    container.innerHTML = '';

    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = '<p class="no-results-message">Nenhum perfume encontrado com estes critérios. Tente uma combinação diferente!</p>';
        return;
    }

    recommendations.forEach(perfume => {
        const cardLink = document.createElement('a');
        cardLink.href = perfume['link do botão de compra'] || '#';
        cardLink.target = '_blank';
        cardLink.className = 'perfume-card-link';
        cardLink.innerHTML = `
            <div class="perfume-card">
                <div class="perfume-image-container">
                    <img src="${perfume['link da foto de exibição'] || 'https://i.postimg.cc/50nm5WfF/foto-lord-aroma.png'}" alt="Foto do perfume ${perfume['nome do perfume']}" class="perfume-image">
                </div>
                <div class="perfume-info">
                    <h4>${perfume['nome do perfume']}</h4>
                    <div class="brand">${perfume['marca']}</div>
                    <div class="notes">
                        <strong>Acordes:</strong> ${[perfume['acorde principal 1'], perfume['acorde principal 2'], perfume['acorde principal 3']].filter(Boolean).join(', ')}
                    </div>
                </div>
            </div>`;
        container.appendChild(cardLink);
    });
}


// --- FUNCIONALIDADE DE COMPARTILHAMENTO ---
function shareResult() {
    const resultContent = document.getElementById('result-content');
    html2canvas(resultContent, { backgroundColor: '#1a1a1a', scale: 2, useCORS: true, scrollY: -window.scrollY })
        .then(canvas => {
            const link = document.createElement('a');
            link.download = `meu-perfil-olfativo-${(currentState.userProfile.name || 'perfil').toLowerCase().replace(/\s+/g, '-')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            playSound(successSound);
            const button = document.getElementById('share-btn');
            const originalText = button.textContent;
            button.textContent = '✅ Imagem salva!';
            button.style.background = '#25D366';
            setTimeout(() => { button.textContent = originalText; button.style.background = ''; }, 3000);
        })
        .catch(error => {
            console.error('Erro ao gerar imagem:', error);
            alert('Erro ao gerar imagem. Tente novamente.');
        });
}


// --- CÓDIGO DE PROTEÇÃO ---
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', event => {
    if (event.ctrlKey && ['c', 'u', 's'].includes(event.key.toLowerCase())) {
        event.preventDefault();
    }
});
