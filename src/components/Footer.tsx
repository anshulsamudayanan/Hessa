import React from 'react';
import { ShieldCheck, Users, Sparkles, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/10 bg-[#040813] py-12 text-slate-400 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl text-white tracking-wider">FAREEG</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-black bg-[#d4af37] text-[#060b18]">AI</span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              AI-Powered Emirati Traditional Games Arena developed for the Student Technology Competition under the theme <strong className="text-slate-200">“AI for Family”</strong>. Connecting generations through culture, camera analysis, and tournament play.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-2">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" /> Family Privacy First
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-400" /> Host-in-the-Loop Review
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Modular CV Engine
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Supported Games</h4>
            <ul className="space-y-1.5 text-sm">
              <li className="hover:text-white transition-colors">كرة القدم (Football)</li>
              <li className="hover:text-white transition-colors">التيلة (Al Teela Marbles)</li>
              <li className="hover:text-white transition-colors">الدامة (Al Dama Draughts)</li>
              <li className="hover:text-white transition-colors">اللقف (Al Laqaf Dexterity)</li>
              <li className="hover:text-white transition-colors">قِف (Qif Halt & Freeze)</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-3">Architecture & Safety</h4>
            <ul className="space-y-1.5 text-sm">
              <li>Deterministic Scoring Engine</li>
              <li>Browser MediaRecorder API</li>
              <li>FastAPI OpenCV Vision Contract</li>
              <li>Local Secure Storage</li>
              <li>Consent & Data Cleanup</li>
            </ul>
          </div>

        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 FAREEG AI. Preserving Emirati traditional heritage with modern technology.</p>
          <p className="flex items-center gap-1 mt-2 sm:mt-0">
            Built with <Heart className="w-3 h-3 text-red-400 fill-red-400" /> for Family Tech Innovation
          </p>
        </div>
      </div>
    </footer>
  );
};
