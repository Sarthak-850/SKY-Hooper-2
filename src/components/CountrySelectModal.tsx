/**
 * Sky Hopper - Country Selection Modal
 * Allows players to choose or change their country with instant search and flags.
 */

import React, { useState, useMemo } from 'react';
import { X, Search, Globe, Check } from 'lucide-react';
import { COUNTRIES_LIST, findCountry } from '../../server/countries';
import { CountryInfo } from '../types/leaderboard';

interface CountrySelectModalProps {
  currentCountryCode: string;
  onSelectCountry: (country: CountryInfo) => void;
  onClose: () => void;
  isFirstTime?: boolean;
}

export const CountrySelectModal: React.FC<CountrySelectModalProps> = ({
  currentCountryCode,
  onSelectCountry,
  onClose,
  isFirstTime = false,
}) => {
  const [search, setSearch] = useState('');

  const popularCodes = ['IN', 'US', 'JP', 'GB', 'DE', 'FR', 'BR', 'CA', 'AU', 'KR'];
  const popularCountries = useMemo(
    () => popularCodes.map((code) => findCountry(code)),
    []
  );

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return COUNTRIES_LIST;
    const q = search.toLowerCase().trim();
    return COUNTRIES_LIST.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pointer-events-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900/95 border border-sky-500/30 rounded-2xl p-5 shadow-2xl relative max-h-[85vh] flex flex-col">
        {/* Close Button */}
        {!isFirstTime && (
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 mb-1 text-sky-400 text-xs font-bold uppercase tracking-wider">
          <Globe className="w-4 h-4" />
          <span>{isFirstTime ? 'FIRST-TIME SETUP' : 'PILOT NATION'}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
          Choose Your Country
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Represent your nation on the World Leaderboard and Country Battle!
        </p>

        {/* Quick popular select */}
        <div className="mb-3">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">
            Popular Regions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {popularCountries.map((c) => {
              const isSelected = c.code === currentCountryCode.toUpperCase();
              return (
                <button
                  key={c.code}
                  onClick={() => onSelectCountry(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400 text-white font-bold shadow-sm shadow-sky-500/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span>{c.name}</span>
                  {isSelected && <Check className="w-3 h-3 text-sky-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search countries..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        {/* Countries list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar min-h-[160px]">
          {filteredCountries.map((c) => {
            const isSelected = c.code === currentCountryCode.toUpperCase();
            return (
              <button
                key={c.code}
                onClick={() => onSelectCountry(c)}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/20 border border-sky-400/50 text-white font-bold'
                    : 'bg-slate-950/40 hover:bg-slate-800/60 text-slate-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{c.flag}</span>
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">({c.code})</span>
                </div>
                {isSelected && (
                  <span className="flex items-center gap-1 text-[11px] text-sky-400 font-bold uppercase">
                    <Check className="w-3.5 h-3.5" />
                    Selected
                  </span>
                )}
              </button>
            );
          })}
          {filteredCountries.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching countries found
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>You can change this later in Settings.</span>
          {isFirstTime && (
            <button
              onClick={() => onSelectCountry(findCountry(currentCountryCode || 'IN'))}
              className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg cursor-pointer transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
