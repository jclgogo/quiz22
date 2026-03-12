/**
 * ui.js - 渲染题目 UI
 */

export const ui = {
    navLimits: { judge: 200, single: 200, multi: 200 },
    navExpandedType: 'judge',
    setNavExpanded(type) {
        if (type !== 'judge' && type !== 'single' && type !== 'multi') return;
        this.navExpandedType = type;
        this.applyNavExpanded();
    },
    applyNavExpanded() {
        const { nav } = this.getContainer();
        const grids = {
            judge: nav.judge,
            single: nav.single,
            multi: nav.multi
        };
        Object.entries(grids).forEach(([type, el]) => {
            if (!el) return;
            if (type === this.navExpandedType) {
                el.classList.remove('collapsed');
            } else {
                el.classList.add('collapsed');
            }
        });
    },
    resetNavLimits() {
        this.navLimits = { judge: 200, single: 200, multi: 200 };
    },
    increaseNavLimit(type, delta = 200) {
        if (!this.navLimits[type]) this.navLimits[type] = 0;
        this.navLimits[type] += delta;
        if (this.navLimits[type] > 10000) this.navLimits[type] = 10000;
    },
    /**
     * 获取题目容器
     */
    getContainer() {
        return {
            question: document.getElementById('question'),
            options: document.getElementById('options'),
            submit: document.getElementById('submit'),
            prevBtn: document.getElementById('prev-btn'),
            markBtn: document.getElementById('mark-btn'),
            result: document.getElementById('result'),
            explanation: document.getElementById('explanation'),
            stats: document.getElementById('stats'),
            noteArea: document.getElementById('note-area'),
            noteText: document.getElementById('note-text'),
            saveNote: document.getElementById('save-note'),
            nextBtn: document.getElementById('next-btn'),
            profileLink: document.getElementById('profile-link'),
            backToQuiz: document.getElementById('back-to-quiz'),
            quizView: document.getElementById('quiz-view'),
            profileView: document.getElementById('profile-view'),
            nav: {
                judge: document.getElementById('nav-judge'),
                single: document.getElementById('nav-single'),
                multi: document.getElementById('nav-multi')
            },
            profile: {
                summary: document.getElementById('profile-summary'),
                done: {
                    judge: document.getElementById('profile-done-judge'),
                    single: document.getElementById('profile-done-single'),
                    multi: document.getElementById('profile-done-multi')
                },
                wrong: {
                    judge: document.getElementById('profile-wrong-judge'),
                    single: document.getElementById('profile-wrong-single'),
                    multi: document.getElementById('profile-wrong-multi')
                },
                marked: {
                    judge: document.getElementById('profile-marked-judge'),
                    single: document.getElementById('profile-marked-single'),
                    multi: document.getElementById('profile-marked-multi')
                }
            }
        };
    },

    /**
     * 渲染题目
     * @param {Object} question 
     * @param {number} index 
     * @param {number} total 
     */
    renderQuestion(question, index, total, { marked } = {}) {
        const { question: qDiv, options: oDiv, submit, result, explanation, stats, noteArea, markBtn } = this.getContainer();
        
        // 重置 UI
        qDiv.innerHTML = `<h3>[${this.getTypeLabel(question.type)}] ${index + 1}/${total}</h3><p>${question.question}</p>`;
        oDiv.innerHTML = '';
        result.innerHTML = '';
        explanation.innerHTML = '';
        stats.innerHTML = '';
        noteArea.style.display = 'none';
        submit.style.display = 'block';
        markBtn.textContent = marked ? '取消标记' : '标记';

        // 渲染选项
        question.options.forEach((opt, i) => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            const char = String.fromCharCode(65 + i); // A, B, C...
            
            input.type = question.type === 'multi' ? 'checkbox' : 'radio';
            input.name = 'option';
            input.value = char;
            
            label.appendChild(input);
            label.appendChild(document.createTextNode(` ${opt}`));
            oDiv.appendChild(label);
        });
    },

    /**
     * 获取题目类型标签
     */
    getTypeLabel(type) {
        const labels = {
            'judge': '判断题',
            'single': '单选题',
            'multi': '多选题'
        };
        return labels[type] || '未知类型';
    },

    /**
     * 获取用户选择的答案
     * @param {string} type 
     */
    getUserAnswer(type) {
        const inputs = document.querySelectorAll('input[name="option"]:checked');
        if (type === 'multi') {
            return Array.from(inputs).map(i => i.value).sort().join('');
        }
        return inputs.length > 0 ? inputs[0].value : '';
    },

    /**
     * 渲染结果和解析
     * @param {boolean} isCorrect 
     * @param {Object} question 
     * @param {Object} stat {correct, wrong, note}
     */
    renderResult(isCorrect, question, stat) {
        const { submit, result, explanation, stats, noteArea, noteText } = this.getContainer();
        
        submit.style.display = 'none';

        result.innerHTML = isCorrect 
            ? '<span style="color: green; font-weight: bold;">回答正确！</span>' 
            : `<span style="color: red; font-weight: bold;">回答错误。正确答案是：${question.answer}</span>`;
        
        explanation.innerHTML = `<h4>解析：</h4><p>${question.explanation || '暂无解析'}</p>`;
        
        stats.innerHTML = `<h4>统计：</h4><p>正确次数：${stat.correct}，错误次数：${stat.wrong}</p>`;
        
        noteArea.style.display = 'block';
        noteText.value = stat.note || '';
    },

    setView(view) {
        const { quizView, profileView } = this.getContainer();
        if (view === 'profile') {
            quizView.style.display = 'none';
            profileView.style.display = 'block';
            return;
        }
        quizView.style.display = 'block';
        profileView.style.display = 'none';
    },

    renderQuestionNavigation(questions, currentIndex, records) {
        const { nav } = this.getContainer();
        nav.judge.innerHTML = '';
        nav.single.innerHTML = '';
        nav.multi.innerHTML = '';

        const byType = { judge: [], single: [], multi: [] };
        questions.forEach((q, idx) => {
            byType[q.type]?.push({ q, idx });
        });

        const current = questions[currentIndex];
        if (current) {
            const arr = byType[current.type];
            const pos = arr.findIndex(item => item.idx === currentIndex);
            if (pos >= 0 && this.navLimits[current.type] < pos + 1) {
                this.navLimits[current.type] = pos + 1;
            }
        }

        const renderType = (type, container) => {
            const items = byType[type];
            const limit = this.navLimits[type] || 200;
            const slice = items.slice(0, limit);

            slice.forEach(({ q, idx }) => {
                const qid = `${q.type}_${q.id}`;
                const record = records[qid] || { correct: 0, wrong: 0, note: '', marked: false };
                const done = (record.correct || 0) + (record.wrong || 0) > 0;
                const wrong = (record.wrong || 0) > 0;
                const marked = !!record.marked;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'nav-box';
                btn.textContent = String(q.id);
                btn.dataset.index = String(idx);
                btn.dataset.qid = qid;

                if (idx === currentIndex) btn.classList.add('is-current');
                if (done) btn.classList.add('is-done');
                if (wrong) btn.classList.add('is-wrong');
                if (marked) btn.classList.add('is-marked');

                container.appendChild(btn);
            });

            if (items.length > limit) {
                const more = document.createElement('button');
                more.type = 'button';
                more.className = 'nav-box nav-more';
                more.textContent = `更多 (${items.length - limit})`;
                more.dataset.type = type;
                container.appendChild(more);
            }
        };

        renderType('judge', nav.judge);
        renderType('single', nav.single);
        renderType('multi', nav.multi);
        this.applyNavExpanded();
    },

    renderProfile(allQuestions, records) {
        const { profile } = this.getContainer();

        const questionByQid = new Map(allQuestions.map(q => [`${q.type}_${q.id}`, q]));

        const done = [];
        const wrong = [];
        const marked = [];

        Object.entries(records).forEach(([qid, stat]) => {
            const q = questionByQid.get(qid);
            if (!q) return;
            const correct = Number.isFinite(stat.correct) ? stat.correct : 0;
            const wrongCount = Number.isFinite(stat.wrong) ? stat.wrong : 0;
            const isDone = correct + wrongCount > 0;
            const isWrong = wrongCount > 0;
            const isMarked = !!stat.marked;

            if (isDone) done.push(q);
            if (isWrong) wrong.push(q);
            if (isMarked) marked.push(q);
        });

        const sortFn = (a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        };

        done.sort(sortFn);
        wrong.sort(sortFn);
        marked.sort(sortFn);

        const total = allQuestions.length;
        profile.summary.innerHTML = `<div>总题数：${total}，已做：${done.length}，错题：${wrong.length}，标记：${marked.length}</div>`;

        const fillGrid = (container, items) => {
            container.innerHTML = '';
            items.forEach(q => {
                const qid = `${q.type}_${q.id}`;
                const stat = records[qid] || {};
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'nav-box';
                btn.textContent = String(q.id);
                btn.dataset.qid = qid;
                if ((stat.correct || 0) + (stat.wrong || 0) > 0) btn.classList.add('is-done');
                if ((stat.wrong || 0) > 0) btn.classList.add('is-wrong');
                if (stat.marked) btn.classList.add('is-marked');
                container.appendChild(btn);
            });
        };

        const groupByType = (items) => {
            const g = { judge: [], single: [], multi: [] };
            items.forEach(q => g[q.type]?.push(q));
            return g;
        };

        const doneGroup = groupByType(done);
        const wrongGroup = groupByType(wrong);
        const markedGroup = groupByType(marked);

        fillGrid(profile.done.judge, doneGroup.judge);
        fillGrid(profile.done.single, doneGroup.single);
        fillGrid(profile.done.multi, doneGroup.multi);

        fillGrid(profile.wrong.judge, wrongGroup.judge);
        fillGrid(profile.wrong.single, wrongGroup.single);
        fillGrid(profile.wrong.multi, wrongGroup.multi);

        fillGrid(profile.marked.judge, markedGroup.judge);
        fillGrid(profile.marked.single, markedGroup.single);
        fillGrid(profile.marked.multi, markedGroup.multi);
    }
};
