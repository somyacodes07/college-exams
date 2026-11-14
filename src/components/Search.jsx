import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { Search as SearchIcon, X, Loader2, Copy } from 'lucide-react';
import { getStudentByRoll, getSearchIndex, subscribeToIndex, rankStudents } from '../utils/api';
import { readRecent, saveRecent, displayRoll } from '../utils/recent';
import { copyText } from '../utils/copy';

/** Highlights the matched part of a label. */
const Highlight = ({ text, query }) => {
    const q = query.trim().toLowerCase();
    const idx = q ? text.toLowerCase().indexOf(q) : -1;
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-transparent text-inherit underline decoration-2 decoration-ink-faint underline-offset-[3px]">{text.slice(idx, idx + q.length)}</mark>
            {text.slice(idx + q.length)}
        </>
    );
};

const Search = ({ onSelectStudent, selectedStudent, onLoadingChange }) => {
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
        const sync = () => setRecent(readRecent());
        window.addEventListener('recent-change', sync);
        return () => window.removeEventListener('recent-change', sync);
    }, []);

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
        onLoadingChange?.(true);
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
            onLoadingChange?.(false);
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
        <div className="relative w-full max-w-2xl lg:max-w-3xl z-30">
            {/* One focus indicator: the box itself (the input's own outline is off) */}
            <div className="flex items-center bg-paper rounded-lg border border-rule transition-colors hover:border-ink-faint focus-within:border-ink! focus-within:ring-2 focus-within:ring-ink/15">
                <div className="pl-4 lg:pl-5 pr-1 flex-shrink-0 text-ink-faint" aria-hidden="true">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <SearchIcon className="w-5 h-5" />}
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
                    onFocus={() => {
                        setIsFocused(true);
                        if (searchIndex.length === 0) getSearchIndex().then((index) => index.length && setSearchIndex(index));
                    }}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Name or roll number"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="search"
                    className="tnum w-full bg-transparent text-ink text-[18px] lg:text-[21px] px-2.5 lg:px-3 h-14 lg:h-16 outline-none focus-visible:outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
                />

                {query && (
                    <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleClear}
                        className="mr-1.5 w-11 h-11 flex-shrink-0 inline-flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-desk transition-colors"
                        aria-label="Clear search"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {!query && !isFocused && !selectedStudent && (
                <p className="mt-2 text-[14px] lg:text-[16px] text-ink-faint">Tip: the last 3 or 4 digits of your roll number are enough.</p>
            )}

            {notFound && (
                <p className="mt-2 text-[14px] text-stamp">
                    Couldn't load that schedule. Check your connection and try again.
                </p>
            )}

            {(showDropdown || showEmpty) && (
                <div
                    id="student-suggestions"
                    role="listbox"
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute top-full left-0 right-0 mt-1.5 bg-paper border border-rule rounded-lg shadow-[0_12px_32px_-12px_rgba(28,42,71,0.35)] overflow-hidden max-h-[min(55vh,24rem)] overflow-y-auto overscroll-contain"
                >
                    {showRecent && <p className="px-4 pt-3 pb-1 text-[13px] text-ink-faint">Recently opened</p>}

                    {showEmpty && searchIndex.length === 0 && (
                        <div className="px-4 py-2" role="status" aria-label="Loading students">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="py-2.5 border-t first:border-t-0 border-rule space-y-1.5">
                                    <div className="skeleton h-4" style={{ width: `${55 - i * 10}%` }} />
                                    <div className="skeleton h-3 w-32" />
                                </div>
                            ))}
                        </div>
                    )}
                    {showEmpty && searchIndex.length > 0 && (
                        <p className="px-4 py-5 text-[15px] lg:text-[17px] text-ink-soft">
                            No student found for “{query.trim()}”. Try part of your first name, or the last digits of your roll number.
                        </p>
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
                                className={`px-4 py-3 min-h-[56px] cursor-pointer flex items-center justify-between gap-4 border-t first:border-t-0 border-rule ${isSelected ? 'bg-desk' : ''}`}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="text-[16px] lg:text-[18px] font-bold text-ink truncate">
                                        <Highlight text={student.name} query={showRecent ? '' : query} />
                                    </div>
                                    <div className="tnum text-[14px] lg:text-[16px] text-ink-soft truncate">
                                        <Highlight text={displayRoll(student)} query={showRecent ? '' : query} />
                                        <span className="ml-2 text-ink-faint">{student.batch}</span>
                                        {student.rollPending && <span className="ml-2 text-ink-faint">roll no. being verified</span>}
                                    </div>
                                </div>
                                {/* Copy the roll number without opening the schedule */}
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyText(displayRoll(student), `Roll number ${displayRoll(student)} copied`);
                                    }}
                                    className="flex-shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-rule bg-paper text-[14px] font-bold text-ink-soft hover:text-ink hover:border-ink-faint active:scale-[0.97] transition"
                                    aria-label={`Copy roll number of ${student.name}`}
                                >
                                    <Copy size={15} /> Copy
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Search;
