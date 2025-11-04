"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = ShippingStationsPage;
const prisma_1 = require("@/lib/prisma");
const ShippingStationsManager_1 = __importDefault(require("./_components/ShippingStationsManager"));
exports.dynamic = 'force-dynamic';
async function ShippingStationsPage() {
    const shops = await prisma_1.prisma.shop.findMany({
        where: { isActive: true, platform: 'JUMIA' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    }).catch(() => []);
    return (<div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Jumia Shipping Stations</h1>
        <p className="text-slate-300">Set default shipping station per shop and discover providers live from an example order.</p>
      </div>
      <ShippingStationsManager_1.default shops={shops}/>
    </div>);
}
