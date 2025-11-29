import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Supplier } from '../types';
import { Phone, Star, Wrench } from 'lucide-react';

interface SuppliersProps {
  currentEnterpriseId: string;
  readOnly: boolean;
}

export const Suppliers: React.FC<SuppliersProps> = ({ currentEnterpriseId, readOnly }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    db.getSuppliers(currentEnterpriseId).then(setSuppliers);
  }, [currentEnterpriseId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Prestadores de Serviço</h2>
        {!readOnly && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            + Novo Fornecedor
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map(sup => (
          <div key={sup.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Wrench size={24} />
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded text-yellow-700 font-bold text-sm">
                <Star size={14} fill="currentColor" />
                {sup.rating}
              </div>
            </div>
            <h3 className="font-bold text-lg text-slate-800">{sup.name}</h3>
            <p className="text-slate-500 text-sm mb-4">{sup.serviceType}</p>
            <div className="pt-4 border-t border-slate-100">
              <a href={`tel:${sup.contact}`} className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition">
                <Phone size={16} />
                <span className="text-sm font-medium">{sup.contact}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};