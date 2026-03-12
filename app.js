/**
 * app.js - 主逻辑控制
 */

import { storage } from './storage.js';
import { ui } from './ui.js';

class QuizApp {
    constructor() {
        this.allQuestions = [];
        this.currentQuestions = [];
        this.currentIndex = 0;
        this.mode = 'sequential';
        this.selectedTypes = ['judge', 'single', 'multi'];
        
        this.init();
    }

    async init() {
        await this.loadQuestions();
        this.loadPreferencesToState();
        this.applyStateToControls();
        this.setupEventListeners();
        this.startQuiz();
    }

    /**
     * 加载题库数据
     */
    async loadQuestions() {
        const files = [
            'data/judge_process.txt',
            'data/single_process.txt',
            'data/multi_process.txt'
        ];

        try {
            const results = await Promise.all(files.map(f => fetch(f).then(r => r.text())));
            
            this.allQuestions = results.flatMap(text => 
                text.split('\n')
                    .filter(line => line.trim() !== '')
                    .map(line => {
                        try {
                            return JSON.parse(line);
                        } catch (e) {
                            console.warn("JSON parse error:", line);
                            return null;
                        }
                    })
                    .filter(q => q !== null)
            );
            
            console.log(`已加载 ${this.allQuestions.length} 道题目`);
        } catch (error) {
            console.error('加载题库失败:', error);
            alert('加载题库失败，请检查网络或文件路径。');
        }
    }

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        const { submit, nextBtn, prevBtn, markBtn, saveNote, profileLink, backToQuiz } = ui.getContainer();
        
        submit.onclick = () => this.handleAnswerSubmit();
        nextBtn.onclick = () => this.nextQuestion();
        prevBtn.onclick = () => this.prevQuestion();
        markBtn.onclick = () => this.toggleMarked();
        saveNote.onclick = () => this.handleSaveNote();
        profileLink.onclick = () => this.showProfileView();
        backToQuiz.onclick = () => this.showQuizView();

        // 模式切换
        document.getElementById('mode-select').onchange = (e) => {
            this.mode = e.target.value;
            storage.savePreferences({ mode: this.mode, selectedTypes: this.selectedTypes });
            this.startQuiz();
        };

        // 题型筛选
        document.querySelectorAll('input[name="type-filter"]').forEach(checkbox => {
            checkbox.onchange = () => {
                this.selectedTypes = Array.from(document.querySelectorAll('input[name="type-filter"]:checked'))
                    .map(cb => cb.value);
                storage.savePreferences({ mode: this.mode, selectedTypes: this.selectedTypes });
                this.startQuiz();
            };
        });

        document.getElementById('question-nav').addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.classList.contains('nav-more')) {
                const type = target.dataset.type;
                if (type) {
                    ui.increaseNavLimit(type, 200);
                    ui.renderQuestionNavigation(this.currentQuestions, this.currentIndex, storage.getUserInfoSnapshot().progress.questions);
                }
                return;
            }
            const title = target.closest('.nav-title');
            if (title) {
                const grid = title.nextElementSibling;
                if (grid && grid.id && grid.id.startsWith('nav-')) {
                    const type = grid.id.replace('nav-', '');
                    ui.setNavExpanded(type);
                }
                return;
            }
            if (!target.classList.contains('nav-box')) return;
            const indexStr = target.dataset.index;
            if (!indexStr) return;
            const index = Number(indexStr);
            if (!Number.isFinite(index)) return;
            this.goToIndex(index);
        });

        document.getElementById('profile-view').addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.classList.contains('nav-box')) return;
            const qid = target.dataset.qid;
            if (!qid) return;
            this.jumpToQid(qid);
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    loadPreferencesToState() {
        const prefs = storage.getPreferences();
        this.mode = prefs.mode;
        this.selectedTypes = prefs.selectedTypes;
    }

    applyStateToControls() {
        const modeSelect = document.getElementById('mode-select');
        if (modeSelect) modeSelect.value = this.mode;

        const selected = new Set(this.selectedTypes);
        document.querySelectorAll('input[name="type-filter"]').forEach(cb => {
            cb.checked = selected.has(cb.value);
        });
    }

    /**
     * 开始刷题
     */
    startQuiz() {
        let baseQuestions = this.allQuestions.filter(q => this.selectedTypes.includes(q.type));

        if (this.mode === 'wrong') {
            this.currentQuestions = baseQuestions.filter(q => {
                const stat = storage.getQuestionStat(`${q.type}_${q.id}`);
                return stat.wrong > 0;
            });
        } else {
            this.currentQuestions = [...baseQuestions];
        }
        
        if (this.mode === 'random') {
            this.shuffle(this.currentQuestions);
        } else {
            // 按序，可以根据 id 排序
            this.currentQuestions.sort((a, b) => {
                if (a.type !== b.type) return a.type.localeCompare(b.type);
                return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
            });
        }

        ui.resetNavLimits();
        this.currentIndex = 0;
        if (this.currentQuestions.length === 0) {
            alert('没有符合筛选条件的题目！');
            ui.renderQuestionNavigation([], 0, storage.getUserInfoSnapshot().progress.questions);
            return;
        }

        const lastQid = storage.getLastQid();
        if (lastQid) {
            const idx = this.currentQuestions.findIndex(q => `${q.type}_${q.id}` === lastQid);
            if (idx >= 0) this.currentIndex = idx;
        }

        this.showCurrentQuestion();
    }

    /**
     * 显示当前题目
     */
    showCurrentQuestion() {
        const question = this.currentQuestions[this.currentIndex];
        const qid = `${question.type}_${question.id}`;
        const stat = storage.getQuestionStat(qid);
        ui.renderQuestion(question, this.currentIndex, this.currentQuestions.length, { marked: stat.marked });
        ui.renderQuestionNavigation(this.currentQuestions, this.currentIndex, storage.getUserInfoSnapshot().progress.questions);
        ui.setNavExpanded(question.type);
        storage.setLastQid(qid);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /**
     * 处理提交答案
     */
    handleAnswerSubmit() {
        const question = this.currentQuestions[this.currentIndex];
        const userAnswer = ui.getUserAnswer(question.type);
        
        if (!userAnswer) {
            alert('请先选择答案！');
            return;
        }

        let correctAnswer = question.answer;
        if (question.type === 'multi') {
            correctAnswer = correctAnswer.split('').sort().join('');
        }
        const isCorrect = userAnswer === correctAnswer;
        const qid = `${question.type}_${question.id}`;

        if (isCorrect) {
            storage.updateCorrect(qid);
        } else {
            storage.updateWrong(qid);
        }

        const stat = storage.getQuestionStat(qid);
        ui.renderResult(isCorrect, question, stat);
        ui.renderQuestionNavigation(this.currentQuestions, this.currentIndex, storage.getUserInfoSnapshot().progress.questions);
    }

    /**
     * 下一题
     */
    nextQuestion() {
        if (this.shouldConfirmSkipCurrent()) {
            const ok = confirm('本题未提交，确定跳过？');
            if (!ok) return;
        }
        this.goToIndex(this.currentIndex + 1, { wrap: true });
    }

    prevQuestion() {
        if (this.shouldConfirmSkipCurrent()) {
            const ok = confirm('本题未提交，确定跳过？');
            if (!ok) return;
        }
        this.goToIndex(this.currentIndex - 1, { wrap: true });
    }

    goToIndex(index, { wrap } = {}) {
        if (this.currentQuestions.length === 0) return;
        let nextIndex = index;
        if (wrap) {
            if (nextIndex < 0) nextIndex = this.currentQuestions.length - 1;
            if (nextIndex >= this.currentQuestions.length) nextIndex = 0;
        }
        if (nextIndex < 0 || nextIndex >= this.currentQuestions.length) return;
        this.currentIndex = nextIndex;
        this.showCurrentQuestion();
    }

    shouldConfirmSkipCurrent() {
        const { submit, profileView } = ui.getContainer();
        if (profileView.style.display === 'block') return false;
        return submit.style.display === 'block';
    }

    toggleMarked() {
        if (this.currentQuestions.length === 0) return;
        const question = this.currentQuestions[this.currentIndex];
        const qid = `${question.type}_${question.id}`;
        const marked = storage.toggleMarked(qid);
        const { markBtn } = ui.getContainer();
        markBtn.textContent = marked ? '取消标记' : '标记';
        ui.renderQuestionNavigation(this.currentQuestions, this.currentIndex, storage.getUserInfoSnapshot().progress.questions);
    }

    showProfileView() {
        const snapshot = storage.getUserInfoSnapshot();
        ui.renderProfile(this.allQuestions, snapshot.progress.questions);
        ui.setView('profile');
    }

    showQuizView() {
        ui.setView('quiz');
    }

    jumpToQid(qid) {
        const idx = this.currentQuestions.findIndex(q => `${q.type}_${q.id}` === qid);
        if (idx >= 0) {
            this.showQuizView();
            this.goToIndex(idx);
            return;
        }

        this.mode = 'sequential';
        this.selectedTypes = ['judge', 'single', 'multi'];
        storage.savePreferences({ mode: this.mode, selectedTypes: this.selectedTypes });
        this.applyStateToControls();
        this.startQuiz();

        const nextIdx = this.currentQuestions.findIndex(q => `${q.type}_${q.id}` === qid);
        if (nextIdx >= 0) {
            this.showQuizView();
            this.goToIndex(nextIdx);
            return;
        }

        alert('未找到该题目，可能题库已变更。');
    }

    /**
     * 保存笔记
     */
    handleSaveNote() {
        const question = this.currentQuestions[this.currentIndex];
        const qid = `${question.type}_${question.id}`;
        const note = document.getElementById('note-text').value;
        storage.saveNote(qid, note);
        alert('笔记已保存！');
        ui.renderQuestionNavigation(this.currentQuestions, this.currentIndex, storage.getUserInfoSnapshot().progress.questions);
    }

    /**
     * Fisher-Yates shuffle 算法
     * @param {Array} arr 
     */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    /**
     * 处理键盘快捷键
     * @param {KeyboardEvent} e 
     */
    handleKeyPress(e) {
        // 在输入笔记时禁用快捷键
        if (e.target.tagName === 'TEXTAREA') return;

        const { submit } = ui.getContainer();

        // 数字键选择选项 (1-8)
        if (e.key >= '1' && e.key <= '8') {
            const index = parseInt(e.key) - 1;
            const options = document.querySelectorAll('input[name="option"]');
            if (options[index]) {
                options[index].click();
            }
        }

        // Enter 键提交或下一题
        if (e.key === 'Enter') {
            if (submit.style.display === 'block') {
                this.handleAnswerSubmit();
            } else {
                this.nextQuestion();
            }
        }

        // N 键下一题
        if (e.key.toLowerCase() === 'n') {
            this.nextQuestion();
        }

        if (e.key.toLowerCase() === 'p') {
            this.prevQuestion();
        }

        if (e.key.toLowerCase() === 'm') {
            this.toggleMarked();
        }

        if (e.key.toLowerCase() === 'i') {
            this.showProfileView();
        }

        if (e.key === 'Escape') {
            this.showQuizView();
        }
    }
}

// 启动应用
new QuizApp();
