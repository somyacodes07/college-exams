import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X, Loader2, Command, Sparkles, User, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStudentByRoll, getSearchIndex } from '../utils/api';

const Search = ({ onSelectStudent }) => {
    const [query, setQuery] = useState('');
    const [searchIndex, setSearchIndex] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isIndexing, setIsIndexing] = useState(true);
    const inputRef = useRef(null);

    useEffect(() => {
        let active = true;
        const loadIndex = async () => {
            try {
                const index = await getSearchIndex();
                if (active) {
                    setSearchIndex(index);
                }
            } catch (err) {
                console.error('Failed to load search index:', err);
            } finally {
                if (active) {
                    setIsIndexing(false);
                }
            }
        };
        loadIndex();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === '/' || (e.metaKey && e.key === 'k') || (e.ctrlKey && e.key === 'k')) && document.activeElement !== inputRef.current) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (query.trim().length < 2) {
            setSuggestions([]);
            return;
        }

        const normalizedQuery = query.trim().toLowerCase();
        const filtered = searchIndex.filter(student => 
            (student.name && student.name.toLowerCase().includes(normalizedQuery)) ||
            (student.rollNo && student.rollNo.toLowerCase().includes(normalizedQuery)) ||
            (student.cohort && student.cohort.toLowerCase().includes(normalizedQuery))
        ).slice(0, 15);

        setSuggestions(filtered);
    }, [query, searchIndex]);

    const handleSelect = async (student) => {
        setQuery(student.name);
        setSuggestions([]);
        setIsLoading(true);
        try {
            const fullStudent = await getStudentByRoll(student.rollNo);
            if (fullStudent) {
                onSelectStudent(fullStudent);
            }
        } catch (err) {
            console.error('Failed to fetch full student details:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative w-full max-w-xl mx-auto z-50 px-1 sm:px-0">
            {/* Ambient Search Glow */}
            <div className={`absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-purple-500/20 rounded-3xl blur-xl transition-opacity duration-500 ${isFocused ? 'opacity-100' : 'opacity-30'}`} />

            <div className={`relative flex items-center bg-white dark:bg-[#0c101c]/95 border transition-all duration-300 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-lg shadow-slate-200/50 dark:shadow-none ${
                isFocused 
                    ? 'border-emerald-500/80 ring-2 ring-emerald-500/20' 
                    : 'border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            }`}>
                <div className="pl-3.5 sm:pl-4 pr-1">
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500 animate-spin" />
                    ) : (
                        <SearchIcon className={`w-5 h-5 transition-colors ${isFocused ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} />
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    placeholder="Search Name or Roll Number..."
                    className="w-full bg-transparent text-slate-900 dark:text-white font-sans text-base px-2.5 sm:px-3 py-3.5 sm:py-4 outline-none placeholder-slate-400 dark:placeholder-slate-500 min-h-[48px]"
                />

                <div className="flex items-center gap-1.5 pr-3 sm:pr-4">
                    {query ? (
                        <button
                            onClick={() => {
                                setQuery('');
                                setSuggestions([]);
                                onSelectStudent(null);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                            title="Clear search"
                        >
                            <X size={18} />
                        </button>
                    ) : (
                        <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            <Command size={10} />
                            <span>K</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Instant Predictive Suggestions Dropdown */}
            <AnimatePresence>
                {suggestions.length > 0 && isFocused && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-1 right-1 sm:left-0 sm:right-0 mt-2.5 bg-white dark:bg-[#0c101c]/95 border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl max-h-64 sm:max-h-72 overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-white/5"
                    >
                        <div className="px-3.5 sm:px-4 py-2 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between border-b border-slate-200/60 dark:border-white/5">
                            <span>Matches ({suggestions.length})</span>
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                                <Sparkles size={10} /> Instant lookup
                            </span>
                        </div>

                        {suggestions.map((student) => (
                            <div
                                key={student.rollNo}
                                onClick={() => handleSelect(student)}
                                className="px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-slate-100 dark:hover:bg-emerald-500/10 active:bg-slate-200 dark:active:bg-emerald-500/20 cursor-pointer transition-all flex items-center justify-between gap-2 group"
                            >
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                    <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-500 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/10 transition-colors flex-shrink-0">
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold font-sans text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                            {student.name}
                                        </div>
                                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                            <Hash size={10} className="flex-shrink-0" />
                                            <span className="truncate">{student.rollNo}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {student.batch && (
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                            Batch {student.batch}
                                        </span>
                                    )}
                                    {student.cohort && (
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20">
                                            {student.cohort}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Search;
