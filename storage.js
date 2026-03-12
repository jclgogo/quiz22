/**
 * storage.js - localStorage 数据层
 */

const STORAGE_KEY = 'quiz_user_data';
const STORAGE_VERSION = 1;

function createEmptyUserInfo() {
    return {
        version: STORAGE_VERSION,
        preferences: {
            mode: 'sequential',
            selectedTypes: ['judge', 'single', 'multi']
        },
        progress: {
            questions: {}
        },
        last: {
            qid: ''
        }
    };
}

function normalizeSelectedTypes(selectedTypes) {
    const allowed = new Set(['judge', 'single', 'multi']);
    const normalized = Array.isArray(selectedTypes) ? selectedTypes.filter(t => allowed.has(t)) : [];
    return normalized.length > 0 ? normalized : ['judge', 'single', 'multi'];
}

class StorageManager {
    constructor() {
        this.userInfo = this.loadUserInfo();
    }

    loadUserInfo() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createEmptyUserInfo();

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return createEmptyUserInfo();
        }

        if (parsed && typeof parsed === 'object' && parsed.version === STORAGE_VERSION && parsed.progress?.questions) {
            const next = createEmptyUserInfo();
            next.preferences.mode = typeof parsed.preferences?.mode === 'string' ? parsed.preferences.mode : 'sequential';
            next.preferences.selectedTypes = normalizeSelectedTypes(parsed.preferences?.selectedTypes);
            next.progress.questions = typeof parsed.progress?.questions === 'object' && parsed.progress.questions ? parsed.progress.questions : {};
            next.last.qid = typeof parsed.last?.qid === 'string' ? parsed.last.qid : '';
            return next;
        }

        const migrated = createEmptyUserInfo();
        if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([qid, stat]) => {
                if (!stat || typeof stat !== 'object') return;
                const correct = Number.isFinite(stat.correct) ? stat.correct : 0;
                const wrong = Number.isFinite(stat.wrong) ? stat.wrong : 0;
                const note = typeof stat.note === 'string' ? stat.note : '';
                migrated.progress.questions[qid] = { correct, wrong, note, marked: false };
            });
        }
        return migrated;
    }

    saveUserInfo() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userInfo));
    }

    getQuestionStat(qid) {
        const record = this.userInfo.progress.questions[qid];
        if (!record) return { correct: 0, wrong: 0, note: '', marked: false };
        return {
            correct: Number.isFinite(record.correct) ? record.correct : 0,
            wrong: Number.isFinite(record.wrong) ? record.wrong : 0,
            note: typeof record.note === 'string' ? record.note : '',
            marked: !!record.marked
        };
    }

    updateCorrect(qid) {
        if (!this.userInfo.progress.questions[qid]) this.userInfo.progress.questions[qid] = { correct: 0, wrong: 0, note: '', marked: false };
        this.userInfo.progress.questions[qid].correct++;
        this.userInfo.last.qid = qid;
        this.saveUserInfo();
    }

    updateWrong(qid) {
        if (!this.userInfo.progress.questions[qid]) this.userInfo.progress.questions[qid] = { correct: 0, wrong: 0, note: '', marked: false };
        this.userInfo.progress.questions[qid].wrong++;
        this.userInfo.last.qid = qid;
        this.saveUserInfo();
    }

    saveNote(qid, note) {
        if (!this.userInfo.progress.questions[qid]) this.userInfo.progress.questions[qid] = { correct: 0, wrong: 0, note: '', marked: false };
        this.userInfo.progress.questions[qid].note = typeof note === 'string' ? note : '';
        this.userInfo.last.qid = qid;
        this.saveUserInfo();
    }

    getNote(qid) {
        const stat = this.getQuestionStat(qid);
        return stat.note || '';
    }

    toggleMarked(qid) {
        if (!this.userInfo.progress.questions[qid]) this.userInfo.progress.questions[qid] = { correct: 0, wrong: 0, note: '', marked: false };
        this.userInfo.progress.questions[qid].marked = !this.userInfo.progress.questions[qid].marked;
        this.userInfo.last.qid = qid;
        this.saveUserInfo();
        return !!this.userInfo.progress.questions[qid].marked;
    }

    setMarked(qid, marked) {
        if (!this.userInfo.progress.questions[qid]) this.userInfo.progress.questions[qid] = { correct: 0, wrong: 0, note: '', marked: false };
        this.userInfo.progress.questions[qid].marked = !!marked;
        this.userInfo.last.qid = qid;
        this.saveUserInfo();
    }

    isMarked(qid) {
        const stat = this.getQuestionStat(qid);
        return !!stat.marked;
    }

    getPreferences() {
        return {
            mode: typeof this.userInfo.preferences?.mode === 'string' ? this.userInfo.preferences.mode : 'sequential',
            selectedTypes: normalizeSelectedTypes(this.userInfo.preferences?.selectedTypes)
        };
    }

    savePreferences({ mode, selectedTypes }) {
        this.userInfo.preferences.mode = typeof mode === 'string' ? mode : this.userInfo.preferences.mode;
        this.userInfo.preferences.selectedTypes = normalizeSelectedTypes(selectedTypes);
        this.saveUserInfo();
    }

    getLastQid() {
        return typeof this.userInfo.last?.qid === 'string' ? this.userInfo.last.qid : '';
    }

    setLastQid(qid) {
        this.userInfo.last.qid = typeof qid === 'string' ? qid : '';
        this.saveUserInfo();
    }

    getUserInfoSnapshot() {
        const prefs = this.getPreferences();
        return {
            version: STORAGE_VERSION,
            preferences: prefs,
            progress: {
                questions: { ...this.userInfo.progress.questions }
            },
            last: {
                qid: this.getLastQid()
            }
        };
    }
}

export const storage = new StorageManager();
