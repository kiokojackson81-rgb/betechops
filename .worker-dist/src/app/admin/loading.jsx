"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Loading;
function Loading() {
    return (<div className="p-8 animate-pulse">
      <div className="h-6 w-56 bg-white/10 rounded mb-4"/>
      <div className="grid md:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => (<div key={i} className="h-24 rounded-2xl border border-white/10 bg-white/5"/>))}
      </div>
    </div>);
}
