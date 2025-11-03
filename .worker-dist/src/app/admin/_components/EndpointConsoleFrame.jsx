"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EndpointConsoleFrame;
const react_1 = __importDefault(require("react"));
const EndpointConsole_1 = __importDefault(require("./jumia/EndpointConsole"));
function EndpointConsoleFrame() {
    return (<div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jumia Console</h1>
          <p className="text-sm text-slate-400">Run allow-listed vendor API calls using stored shop credentials.</p>
        </div>
        <div className="text-sm text-slate-500">
          <a className="underline" href="/docs/INTEGRATIONS/JUMIA.md">Docs</a>
        </div>
      </div>

      <p className="text-sm text-slate-400">Run allow-listed vendor API calls using stored shop credentials.</p>

      <EndpointConsole_1.default />
    </div>);
}
