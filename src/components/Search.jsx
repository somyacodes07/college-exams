import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { Search as SearchIcon, X, Loader2, User, Hash, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStudentByRoll, getSearchIndex, subscribeToIndex, rankStudents } from '../utils/api';

const RECENT_KEY = 'recentStudents';
const MAX_RECENT = 4;

const readRecent = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
    } catch {
        return [];
    }
};

const saveRecent = (student) => {
    try {
        const entry = { name: student.name, rollNo: String(student.rollNo), batch: student.batch, cohort: student.cohort || '' };
        const next = [entry, ...readRecent().filter((s) => s.rollNo !== entry.rollNo)].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
    } catch {
        return [];
    }
};

/** Highlights the matched part of a label. */
const Highlight = ({ text, query }) => {
    const q = query.trim().toLowerCase();
    const idx = q ? text.toLowerCase().indexOf(q) : -1;
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-emerald-200/70 dark:bg-emerald-500/30 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
            {text.slice(idx + q.length)}
        </>
    );
};

const Search = ({ onSelectStudent, selectedStudent }) => {
    const [query, setQuery] = useState(selectedStudent?.name || '');
    const [searchIndex, setSearchIndex] = useState([]);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [recent, setRecent] = useState(readRecent);
    const [notFound, setNotFound] = useState(false);
    const inputRef = useRef(null);
    const deferredQuery = useDeferredValue(query);

    useEffect(() => {
        let active = true;
        getSearchIndex().then((index) => active && setSearchIndex(index));
        const unsubscribe = subscribeToIndex((index) => active && setSearchIndex(index));
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    // Keep the input in sync when the parent selects a student (deep link / recent)
    const prevSelected = useRef(selectedStudent);
    useEffect(() => {
        const prev = prevSelected.current;
        prevSelected.current = selectedStudent;
        if (selectedStudent) {
            setQuery(selectedStudent.name);
            setRecent(saveRecent(selectedStudent));
        } else if (prev) {
            // Cleared from outside (back button / logo): reset the input
            setQuery((q) => (q === prev.name ? '' : q));
        }
    }, [selectedStudent]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const suggestions = useMemo(() => {
        if (selectedStudent && deferredQuery === selectedStudent.name) return [];
        return rankStudents(deferredQuery, searchIndex, 15);
    }, [deferredQuery, searchIndex, selectedStudent]);

    useEffect(() => setSelectedIndex(-1), [suggestions]);

    const showRecent = isFocused && query.trim().length < 2 && recent.length > 0;
    const list = showRecent ? recent : suggestions;
    const showDropdown = isFocused && list.length > 0;
    const showEmpty = isFocused && !showRecent && query.trim().length >= 2 && suggestions.length === 0
        && !(selectedStudent && query === selectedStudent.name);

    const handleSelect = async (student) => {
        if (!student) return;
        setQuery(student.name);
        setSelectedIndex(-1);
        setIsFocused(false);
        inputRef.current?.blur();
        setIsLoading(true);
        setNotFound(false);
        try {
            const fullStudent = await getStudentByRoll(student.rollNo);
            if (fullStudent) {
                onSelectStudent(fullStudent);
            } else {
                setNotFound(true);
            }
        } catch (err) {
            console.error('Failed to fetch full student details:', err);
            setNotFound(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setQuery('');
        setSelectedIndex(-1);
        setNotFound(false);
        onSelectStudent(null);
        inputRef.current?.focus();
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsFocused(false);
            inputRef.current?.blur();
            return;
        }
        if (list.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % list.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + list.length) % list.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(selectedIndex >= 0 ? list[selectedIndex] : list[0]);
        }
    };

    return (
        <div className="relative w-full max-w-xl mx-auto z-40">
            <div className={`absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-violet-500/20 rounded-3xl blur-xl transition-opacity duration-500 pointer-events-none ${isFocused ? 'opacity-100' : 'opacity-30'}`} />

            <div className={`relative flex items-center bg-white dark:bg-[#0c101c] border transition-all duration-200 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none ${isFocused
                ? 'border-emerald-500/80 ring-4 ring-emerald-500/15'
                : 'border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}
            >
                <div className="pl-4 pr-1 flex-shrink-0">
                    {isLoading
                        ? <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500 animate-spin" />
                        : <SearchIcon className={`w-5 h-5 transition-colors ${isFocused ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} />}
                </div>

                <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-controls="student-suggestions"
                    aria-autocomplete="list"
                    aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
                    aria-label="Search by name or roll number"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setNotFound(false);
                        setIsFocused(true);
                    }}
                    onKeyDown={handleInputKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Your name or roll number"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="search"
                    className="w-full bg-transparent text-slate-900 dark:text-white text-base px-2.5 py-3.5 sm:py-4 outline-none placeholder-slate-400 dark:placeholder-slate-500 min-h-[52px] [&::-webkit-search-cancel-button]:hidden"
                />

                <div className="flex items-center pr-1.5 flex-shrink-0">
                    {query ? (
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleClear}
                            className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Clear search"
                        >
                            <X size={18} />
                        </button>
                    ) : (
                        <kbd className="hidden sm:flex items-center px-2 py-1 mr-2 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            /
                        </kbd>
                    )}
                </div>
            </div>

            {notFound && (
                <p className="mt-2 text-center text-xs text-rose-600 dark:text-rose-400">
                    Couldn't load that schedule. Check your connection and try again.
                </p>
            )}

            <AnimatePresence>
                {(showDropdown || showEmpty) && (
                    <motion.div
                        id="student-suggestions"
                        role="listbox"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0c101c] border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[min(55vh,22rem)] overflow-y-auto overscroll-contain"
                    >
                        <div className="px-4 py-2 bg-slate-50 dark:bg-white/[0.03] text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 sticky top-0 z-10">
                            <span className="flex items-center gap-1.5">
                                {showRecent ? <><History size={11} /> Recent</> : showEmpty ? 'No matches' : `${suggestions.length} match${suggestions.length === 1 ? '' : 'es'}`}
                            </span>
                            <span className="hidden sm:inline font-normal">↑ ↓ to move · ↵ to open</span>
                        </div>

                        {showEmpty && (
                            <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                No student found for “{query.trim()}”. Try part of your first name or the last digits of your roll number.
                            </div>
                        )}

                        {showDropdown && list.map((student, idx) => {
                            const isSelected = selectedIndex === idx;
                            return (
                                <div
                                    id={`suggestion-${idx}`}
                                    role="option"
                                    aria-selected={isSelected}
                                    key={student.rollNo}
                                    onClick={() => handleSelect(student)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`px-4 py-3 min-h-[56px] cursor-pointer flex items-center justify-between gap-3 border-b last:border-b-0 border-slate-100 dark:border-white/5 transition-colors ${isSelected
                                        ? 'bg-emerald-50 dark:bg-emerald-500/10'
                                        : 'active:bg-slate-100 dark:active:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}
                                        >
                                            {showRecent ? <History size={16} /> : <User size={16} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                <Highlight text={student.name} query={showRecent ? '' : query} />
                                            </div>
                                            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                                <Hash size={10} className="flex-shrink-0" />
                                                <span className="truncate"><Highlight text={student.rollNo} query={showRecent ? '' : query} /></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {student.batch && (
                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                                {student.batch}
                                            </span>
                                        )}
                                        {student.cohort && (
                                            <span className="hidden sm:inline text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20">
                                                {student.cohort}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Search;
