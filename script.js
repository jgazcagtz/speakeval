class SpeakEvalApp {
    constructor() {
        // DOM Elements
        this.chatWindow = document.getElementById('chat-window');
        this.micButton = document.getElementById('mic-button');
        this.micIcon = document.getElementById('mic-icon');
        this.themeToggle = document.getElementById('theme-toggle');
        this.voiceSelect = document.getElementById('voice-select');
        this.progressBar = document.getElementById('progress-bar');
        this.progressFill = document.querySelector('.progress-fill');
        this.progressText = document.querySelector('.progress-text');
        
        // Speech Recognition Setup
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.audioQueue = [];
        this.audioContextAllowed = false;
        
        // Evaluation State
        this.evaluationStep = 0;
        this.totalSteps = 5;
        this.conversationHistory = [];
        this.userResponses = [];
        this.conversationPhase = 'initial'; // 'initial' | 'evaluation' | 'complete'
        
        this.init();
    }
    
    init() {
        // Initialize Event Listeners
        this.micButton.addEventListener('click', () => this.toggleSpeechRecognition());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setLanguage(btn.dataset.lang));
        });
        
        // Check Browser Support
        if (!this.SpeechRecognition) {
            this.showUnsupportedMessage('Speech recognition not supported. Please use Chrome or Edge.');
            this.micButton.disabled = true;
            return;
        }
        
        this.initSpeechRecognition();
        this.loadThemePreference();
        this.startConversation();
    }
    
    async initializeAudioContext() {
        return new Promise((resolve) => {
            const handleUserInteraction = () => {
                document.removeEventListener('click', handleUserInteraction);
                document.removeEventListener('keydown', handleUserInteraction);
                resolve();
            };
            
            document.addEventListener('click', handleUserInteraction);
            document.addEventListener('keydown', handleUserInteraction);
            
            // Show instruction if no interaction after 3 seconds
            setTimeout(() => {
                if (!this.audioContextAllowed) {
                    this.addSystemMessage('Please interact with the page (click/tap) to enable voice features');
                }
            }, 3000);
        });
    }
    
    startConversation() {
        const welcomeMessage = "Welcome to your English evaluation. Let's begin with your introduction. Please say: 'My name is [name], I'm a [occupation]'";
        this.addMessage('ai', welcomeMessage);
        this.speakResponse(welcomeMessage);
    }
    
    initSpeechRecognition() {
        this.recognition = new this.SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.micButton.classList.add('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"></path>`;
            document.querySelector('.mic-label').textContent = 'Listening...';
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.micButton.classList.remove('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 9a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.08A7 7 0 0 0 19 11z"></path>`;
            document.querySelector('.mic-label').textContent = 'Press to Speak';
        };
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.processUserResponse(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            this.addSystemMessage(`Error: ${event.error}. Please try again.`);
        };
    }
    
    async processUserResponse(transcript) {
        this.addMessage('user', transcript);
        this.userResponses.push(transcript);
        this.showTypingIndicator();
        
        try {
            // Initialize audio context on first interaction
            if (!this.audioContextAllowed) {
                await this.initializeAudioContext();
                this.audioContextAllowed = true;
            }
            
            // Transition to evaluation phase after first response
            if (this.conversationPhase === 'initial') {
                this.conversationPhase = 'evaluation';
            }
            
            // Prepare conversation history for API
            const messages = [
                ...this.conversationHistory,
                { role: 'user', content: transcript }
            ];
            
            // Call API with current state
            const response = await this.callAPI(messages, this.evaluationStep, this.totalSteps);
            
            this.removeTypingIndicator();
            
            if (!response?.message) {
                throw new Error('Invalid response from server');
            }
            
            // Add AI response to conversation history
            this.addMessage('ai', response.message);
            this.conversationHistory.push(
                { role: 'user', content: transcript },
                { role: 'assistant', content: response.message }
            );
            
            await this.speakResponse(response.message);
            
            if (this.conversationPhase === 'evaluation') {
                this.evaluationStep++;
                this.updateProgress();
                
                if (!response.isFinal) {
                    // Continue conversation
                    setTimeout(() => {
                        const nextQuestion = this.getNextQuestion();
                        this.addMessage('ai', nextQuestion);
                        this.conversationHistory.push(
                            { role: 'assistant', content: nextQuestion }
                        );
                        this.speakResponse(nextQuestion);
                    }, 800);
                } else {
                    // Evaluation complete
                    this.conversationPhase = 'complete';
                    this.micButton.disabled = true;
                }
            }
        } catch (error) {
            console.error('Error processing response:', error);
            this.removeTypingIndicator();
            this.addSystemMessage('Error processing your response. Please try again.');
        }
    }
    
    getNextQuestion() {
        const questions = [
            "Now describe your daily work activities.",
            "Tell me about a professional challenge you've faced.",
            "What are your career goals for the next 5 years?",
            "Discuss a recent trend in your industry."
        ];
        return questions[this.evaluationStep - 1] || "Please continue your response.";
    }
    
    async callAPI(messages, evaluationStep, totalSteps) {
        try {
            const response = await fetch('/api/eval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages,
                    evaluationStep,
                    totalSteps
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                throw new Error(errorData.error || 'API request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Call Error:', error);
            throw error;
        }
    }
    
    async speakResponse(text) {
        if (!text || !this.audioContextAllowed) {
            if (text) this.audioQueue.push(text);
            return;
        }

        if (this.isSpeaking) {
            this.audioQueue.push(text);
            return;
        }

        this.isSpeaking = true;
        try {
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text,
                    voice: this.voiceSelect.value || 'nova'
                })
            });

            if (!response.ok) throw new Error('TTS request failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.isSpeaking = false;
                if (this.audioQueue.length) {
                    this.speakResponse(this.audioQueue.shift());
                }
            };

            await audio.play().catch(error => {
                console.error('Playback prevented:', error);
                this.addSystemMessage('Please click the 🔊 icon to hear messages');
                this.isSpeaking = false;
            });
        } catch (error) {
            console.error('TTS Error:', error);
            this.isSpeaking = false;
        }
    }
    
    updateProgress() {
        const percent = Math.min(100, (this.evaluationStep / this.totalSteps) * 100);
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = `Evaluation Progress: ${Math.round(percent)}%`;
        
        if (percent >= 100) {
            this.progressBar.classList.add('complete');
        }
    }
    
    addMessage(sender, content) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message animate__animated animate__fadeInUp`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-content">
                ${content.split('\n').map(p => `<p>${p}</p>`).join('')}
            </div>
            <div class="message-meta">
                <span class="timestamp">${timestamp}</span>
                ${sender === 'ai' ? '<button class="speak-button" aria-label="Speak message">🔊</button>' : ''}
            </div>
        `;
        
        this.chatWindow.appendChild(messageElement);
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
        
        if (sender === 'ai') {
            messageElement.querySelector('.speak-button').addEventListener('click', () => {
                this.speakResponse(content);
            });
        }
    }
    
    addSystemMessage(content) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message system-message animate__animated animate__fadeIn';
        messageElement.innerHTML = `
            <div class="message-content">
                <p><em>${content}</em></p>
            </div>
        `;
        this.chatWindow.appendChild(messageElement);
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }
    
    showTypingIndicator() {
        this.removeTypingIndicator();
        
        const typingElement = document.createElement('div');
        typingElement.className = 'typing-indicator';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        
        this.chatWindow.appendChild(typingElement);
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }
    
    removeTypingIndicator() {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) typingElement.remove();
    }
    
    toggleSpeechRecognition() {
        if (this.isListening) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Speech recognition start failed:', error);
                this.addSystemMessage('Microphone error. Check permissions.');
            }
        }
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        
        const themeIcon = this.themeToggle.querySelector('.theme-icon');
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        localStorage.setItem('speakeval-theme', newTheme);
    }
    
    setLanguage(lang) {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    }
    
    showUnsupportedMessage(message) {
        const unsupportedElement = document.createElement('div');
        unsupportedElement.className = 'unsupported-message';
        unsupportedElement.innerHTML = `<p>⚠️ ${message}</p>`;
        this.chatWindow.appendChild(unsupportedElement);
    }
    
    loadThemePreference() {
        const savedTheme = localStorage.getItem('speakeval-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            const themeIcon = this.themeToggle.querySelector('.theme-icon');
            themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new SpeakEvalApp();
});
