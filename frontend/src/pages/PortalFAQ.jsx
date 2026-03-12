import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PortalFAQ() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    axios.get(`${API}/faq`).then(res => setFaqs(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = faqs.filter(f =>
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const byCategory = filtered.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-2">
          <HelpCircle className="w-6 h-6 text-purple-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
        <p className="text-gray-500">Find quick answers to the most common questions.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search FAQ..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
          data-testid="faq-search-input"
        />
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading FAQ...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium">No FAQ items found</p>
          <p className="text-sm mt-1">Try a different search term or submit a support ticket</p>
        </div>
      )}

      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{category}</h2>
          <div className="space-y-2">
            {items.map(faq => (
              <div
                key={faq.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                  data-testid={`faq-item-${faq.id}`}
                >
                  <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                  {openId === faq.id
                    ? <ChevronUp className="w-5 h-5 text-[#0056A8] shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  }
                </button>
                {openId === faq.id && (
                  <div className="px-4 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
