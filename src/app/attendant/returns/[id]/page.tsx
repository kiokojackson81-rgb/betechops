import React from 'react';
import ReturnPickForm from './_components/ReturnPickForm';
import { prisma } from '@/lib/prisma';

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  const ret = await prisma.returnCase.findUnique({ where: { id }, include: { evidence: true, order: true } });
  if (!ret) return <div className="p-6">Return not found</div>;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Return {ret.id}</h1>
      <div>Order: {ret.orderId}</div>
      <div>Status: {ret.status}</div>
      <div>
        <h3 className="font-semibold">Upload pickup evidence</h3>
        <ReturnPickForm id={id} shopId={ret.shopId} />
      </div>
    </div>
  );
}
