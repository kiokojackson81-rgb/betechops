"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const react_1 = __importDefault(require("react"));
const ReturnPickForm_1 = __importDefault(require("./_components/ReturnPickForm"));
const prisma_1 = require("@/lib/prisma");
async function Page({ params }) {
    const { id } = await params;
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id }, include: { evidence: true, order: true } });
    if (!ret)
        return <div className="p-6">Return not found</div>;
    return (<div className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Return {ret.id}</h1>
      <div>Order: {ret.orderId}</div>
      <div>Status: {ret.status}</div>
      <div>
        <h3 className="font-semibold">Upload pickup evidence</h3>
        <ReturnPickForm_1.default id={id} shopId={ret.shopId}/>
      </div>
    </div>);
}
