/*
 * Copyright (c) 2024 Lord Aroma - Francisco Leite.
 * Todos os direitos reservados. A reprodução, distribuição ou transmissão
 * não autorizada deste código e seus dados associados é estritamente proibida.
 *
 * VERSÃO 2.0 - White Label com Fragrance Match Engine
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
            { text: "Calor Intenso (Verão)", value: "Verao" },
            { text: "Frio Aconchegante (Inverno)", value: "Inverno" },
            { text: "Clima Amenos (Outono/Primavera)", value: "Outono,Primavera" },
            { text: "Todas as Estações", value: "Todas" }
        ]
    },
    {
        id: 'horario',
        title: "E para qual momento do dia?",
        options: [
            { text: "Para o Dia", value: "Dia" },
            { text: "Para a Noite", value: "Noite" },
            { text: "Versátil (Dia e Noite)", value: "Ambos" }
        ]
    }
];

// --- ESTADO DA APLICAÇÃO ---
let currentState = {
    screen: 'welcome',
    currentQuestion: 0,
    userPreferences: {}, // Objeto para armazenar as novas preferências
    userProfile: { name: '', photo: null, universe: '', origin: '' },
    result: [] // Armazenará a lista de perfumes recomendados
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
    // Event Listeners
    document.getElementById('start-btn').addEventListener('click', () => {
        playSound(clickSound);
        showScreen('identification');
        updateProgress(10);
    });
    document.getElementById('user-form').addEventListener('submit', handleUserForm);
    document.getElementById('user-photo').addEventListener('change', openCropModal);
    document.getElementById('result-user-photo-input').addEventListener('change', openCropModal);
    document.querySelector('.photo-preview').addEventListener('click', () => document.getElementById('user-photo').click());
    document.getElementById('result-photo-container').addEventListener('click', () => document.getElementById('result-user-photo-input').click());
    document.getElementById('confirm-crop-btn').addEventListener('click', applyCrop);
    document.getElementById('cancel-crop-btn').addEventListener('click', cancelCrop);
    document.getElementById('share-btn').addEventListener('click', shareResult);

    // Carregar dados das planilhas
    try {
        const [perfumes, mapping] = await Promise.all([
            fetchGoogleSheet(GOOGLE_SHEET_URL_PERFUMES),
            fetchGoogleSheet(GOOGLE_SHEET_URL_MAPPING)
        ]);
        perfumeDatabase = perfumes;
        olfactoryMapping = processMappingData(mapping);
    } catch (error) {
        console.error("Erro fatal ao carregar dados das planilhas:", error);
        // Exibir uma mensagem de erro para o usuário seria uma boa prática
    }
}

// --- FUNÇÕES DE CONTROLE DE TELA E SOM ---
function playSound(sound) { try { sound.currentTime = 0; sound.play().catch(e => console.log('Audio play failed:', e)); } catch (e) { console.log('Audio error:', e); } }
function showScreen(screenName) { Object.values(screens).forEach(screen => screen.classList.remove('active')); screens[screenName].classList.add('active'); currentState.screen = screenName; }
function updateProgress(percentage) {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;
    const progressBar = activeScreen.querySelector('.progress');
    if (progressBar) progressBar.style.width = percentage + '%';
}

// --- LÓGICA DE DADOS (GOOGLE SHEETS) ---
async function fetchGoogleSheet(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Erro ao buscar dados de: ${url}`, error);
        throw error; // Propaga o erro para ser tratado no initializeApp
    }
}

function processMappingData(mappingData) {
    const mapping = {};
    mappingData.forEach(row => {
        for (const group in row) {
            if (row.hasOwnProperty(group) && row[group]) {
                if (!mapping[group]) {
                    mapping[group] = [];
                }
                mapping[group].push(row[group]);
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
        cropper = new Cropper(imageToCrop, {
            aspectRatio: 1 / 1,
            viewMode: 1,
            background: false,
            autoCropArea: 0.8,
        });
    };
    reader.readAsDataURL(file);
}

function applyCrop() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 256, height: 256 });
    const croppedImageDataURL = canvas.toDataURL('image/jpeg');
    currentState.userProfile.photo = croppedImageDataURL;
    document.getElementById('preview-img').src = croppedImageDataURL;
    document.getElementById('preview-img').style.display = 'block';
    document.querySelector('.photo-placeholder').style.display = 'none';
    document.getElementById('result-user-photo').src = croppedImageDataURL;
    cancelCrop();
}

function cancelCrop() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    modal.style.display = 'none';
}

// --- FLUXO DO USUÁRIO E QUIZ ---
function handleUserForm(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    currentState.userProfile.name = formData.get('user-name');
    currentState.userProfile.universe = formData.get('universe'); // masculino, feminino, versatil
    currentState.userProfile.origin = formData.get('origin');     // nacionais, importados, ambos

    // Mapeamento para a nova lógica
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
    const totalQuestions = questions.length;
    const quizProgress = ((currentState.currentQuestion + 1) / totalQuestions) * 80;
    const progress = 10 + quizProgress;
    updateProgress(progress);

    document.getElementById('question-title').textContent = question.title;
    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';

    const optionsList = document.createElement('div');
    optionsList.className = 'options-list-simple';

    question.options.forEach((option) => {
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
    // Armazena a resposta no objeto de preferências
    if (questionId === 'familia_olfativa') {
        currentState.userPreferences.preferencia_familia_olfativa = value;
    } else if (questionId === 'estacao') {
        currentState.userPreferences.preferencia_estacao = value;
    } else if (questionId === 'horario') {
        currentState.userPreferences.preferencia_horario = value;
    }

    // Animação e transição
    const buttons = document.querySelectorAll('.option-button-simple');
    buttons.forEach(b => b.style.opacity = '0.5');

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

// --- NOVO MOTOR DE RECOMENDAÇÃO ---
function runFragranceMatchEngine() {
    const prefs = currentState.userPreferences;

    // 1. Filtragem rigorosa (Gênero e Origem)
    let candidates = perfumeDatabase.filter(perfume => {
        // Regra de Gênero
        const generoPerfume = (perfume['Gênero'] || '').toLowerCase();
        const generoUsuario = (prefs.preferencia_genero || '').toLowerCase();
        let generoMatch = false;
        if (generoUsuario === 'versatil' || generoUsuario === 'ambos') {
            generoMatch = true;
        } else if (generoPerfume === generoUsuario || generoPerfume === 'unissex' || generoPerfume === 'versátil') {
            generoMatch = true;
        }
        
        // Regra de Origem
        const origemPerfume = (perfume['Origem Perfume'] || '').toLowerCase();
        const origemUsuario = (prefs.preferencia_origem || '').toLowerCase();
        let origemMatch = false;
        if (origemUsuario === 'ambos' || origemPerfume === origemUsuario) {
            origemMatch = true;
        }

        return generoMatch && origemMatch;
    });

    // 2. Mapeamento de Acordes
    const userAccordList = [];
    prefs.preferencia_familia_olfativa.forEach(familyGroup => {
        if (olfactoryMapping[familyGroup]) {
            userAccordList.push(...olfactoryMapping[familyGroup]);
        }
    });
    const uniqueUserAcords = [...new Set(userAccordList)];

    // 3. Pontuação e Ordenação
    const scoredCandidates = candidates.map(perfume => {
        let score = 0;
        
        // Pontuação por Acordes Principais (Peso Alto: 3)
        const perfumeAcords = [perfume['Acorde Principal 1'], perfume['Acorde Principal 2'], perfume['Acorde Principal 3']].filter(Boolean);
        perfumeAcords.forEach(accord => {
            if (uniqueUserAcords.includes(accord)) {
                score += 3;
            }
        });

        // Pontuação por Estação (Peso Médio: 2)
        const estacaoPerfume = (perfume['Estação'] || '').toLowerCase();
        const estacaoUsuario = (prefs.preferencia_estacao || '').toLowerCase();
        if (estacaoUsuario === 'todas' || estacaoUsuario.includes(estacaoPerfume)) {
            score += 2;
        }

        // Pontuação por Horário (Peso Médio: 2)
        const horarioPerfume = (perfume['Horário de uso'] || '').toLowerCase();
        const horarioUsuario = (prefs.preferencia_horario || '').toLowerCase();
        if (horarioUsuario === 'ambos' || horarioPerfume === horarioUsuario) {
            score += 2;
        }

        return { ...perfume, score };
    });

    // Ordenar por pontuação (decrescente) e limitar aos 5 melhores
    const finalRecommendations = scoredCandidates.sort((a, b) => b.score - a.score).slice(0, 5);

    currentState.result = finalRecommendations;
    showResults();
}


// --- TELA DE RESULTADOS ---
function showResults() {
    const userProfile = currentState.userProfile;
    showScreen('results');

    // Informações do usuário
    const photoElement = document.getElementById('result-user-photo');
    if (userProfile.photo) {
        photoElement.src = userProfile.photo;
    } else {
        // Ícone SVG padrão
        photoElement.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23ffd700' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.52 19c.64-2.2 1.84-3 3.22-3h6.52c1.38 0 2.58.8 3.22 3'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E";
    }
    document.getElementById('result-user-name').textContent = (userProfile.name || 'Viajante Olfativo').toUpperCase();

    // Renderiza as recomendações
    displayPerfumeRecommendations();
}

function displayPerfumeRecommendations() {
    const recommendations = currentState.result;
    const container = document.getElementById('recommended-perfumes');
    container.innerHTML = '';

    if (recommendations.length === 0) {
        container.innerHTML = '<p class="no-results-message">Nenhum perfume encontrado com estes critérios. Tente uma combinação diferente!</p>';
        return;
    }

    recommendations.forEach(perfume => {
        const cardLink = document.createElement('a');
        cardLink.href = perfume['Link do botão de compra'] || '#';
        cardLink.target = '_blank';
        cardLink.className = 'perfume-card-link';
        
        // Usando a nova estrutura do card com imagem
        cardLink.innerHTML = `
            <div class="perfume-card">
                <div class="perfume-image-container">
                    <img src="${perfume['Link da foto de exibição'] || 'https://i.postimg.cc/50nm5WfF/foto-lord-aroma.png'}" alt="Foto do perfume ${perfume['Nome do Perfume']}" class="perfume-image">
                </div>
                <div class="perfume-info">
                    <h4>${perfume['Nome do Perfume']}</h4>
                    <div class="brand">${perfume['Marca']}</div>
                    <div class="notes">
                        <strong>Acordes:</strong> ${[perfume['Acorde Principal 1'], perfume['Acorde Principal 2'], perfume['Acorde Principal 3']].filter(Boolean).join(', ')}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(cardLink);
    });
}


// --- FUNCIONALIDADE DE COMPARTILHAMENTO ---
function shareResult() {
    const resultContent = document.getElementById('result-content');
    const options = {
        backgroundColor: '#1a1a1a',
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY
    };

    html2canvas(resultContent, options).then(capturedCanvas => {
        const finalWidth = 1080;
        const finalHeight = 1920;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = finalWidth;
        finalCanvas.height = finalHeight;
        const ctx = finalCanvas.getContext('2d');
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, finalWidth, finalHeight);

        const aspectRatio = capturedCanvas.width / capturedCanvas.height;
        let drawWidth = finalWidth - 80;
        let drawHeight = drawWidth / aspectRatio;
        if (drawHeight > finalHeight - 80) {
            drawHeight = finalHeight - 80;
            drawWidth = drawHeight * aspectRatio;
        }
        const x = (finalWidth - drawWidth) / 2;
        const y = (finalHeight - drawHeight) / 2;

        ctx.drawImage(capturedCanvas, x, y, drawWidth, drawHeight);

        const link = document.createElement('a');
        link.download = `meu-perfil-olfativo-${(currentState.userProfile.name || 'perfil').toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = finalCanvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        playSound(successSound);
        const button = document.getElementById('share-btn');
        const originalText = button.textContent;
        button.textContent = '✅ Imagem salva!';
        button.style.background = '#25D366';
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 3000);

    }).catch(error => {
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
