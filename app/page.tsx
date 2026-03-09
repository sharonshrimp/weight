"use client";

import { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import Chart from 'chart.js/auto';

// --- Firebase 配置 (維持妳的設定) ---
const firebaseConfig = {
  apiKey: "AIzaSyABcguF-gLkoJX2v1S7Q_bPNQaTQQFqfLM",
  authDomain: "myfitnesstracker-b7f16.firebaseapp.com",
  projectId: "myfitnesstracker-b7f16",
  storageBucket: "myfitnesstracker-b7f16.firebasestorage.app",
  messagingSenderId: "187825503361",
  appId: "1:187825503361:web:550888ed857bbe5a526180",
  measurementId: "G-S7W5PPBQ2P"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function FitnessTracker() {
  const [activeTab, setActiveTab] = useState('check');
  const [history, setHistory] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  
  // 原本程式碼的關鍵 State
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [currentScore, setCurrentScore] = useState(0);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    fat: '',
    calories: '',
    protein: '',
    diet: '',
    workout: ''
  });

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  // 原本的所有功能清單與加權
  const checklistItems = [
    { id: 'water', emoji: '💧', label: '飲水 2.5L', w: 15 },
    { id: 'sugar', emoji: '🚫', label: '無糖環境', w: 15 },
    { id: 'protein', emoji: '🍗', label: '足量蛋白', w: 15 },
    { id: 'fiber', emoji: '🥗', label: '足量蔬菜', w: 15 },
    { id: 'steps', emoji: '👟', label: '萬步達成', w: 10 },
    { id: 'sleep', emoji: '🌙', label: '睡足 8H', w: 10 },
    { id: 'bowel', emoji: '💩', label: '每日排便', w: 20, full: true }
  ];

  // 1. 雲端監聽：確保路徑正確且即時更新
  useEffect(() => {
    const colRef = collection(db, 'artifacts', 'yi-ching-fitness-v2', 'history');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data);
      setDbLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. 圖表渲染邏輯
  useEffect(() => {
    if (activeTab === 'trend' && chartRef.current && history.length > 0) {
      const sorted = [...history].sort((a: any, b: any) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
      if (chartInstance.current) chartInstance.current.destroy();
      
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: sorted.map(d => d.date),
          datasets: [
            { label: '體重 (kg)', data: sorted.map(d => d.weight), borderColor: '#3b82f6', tension: 0.3, yAxisID: 'y' },
            { label: '熱量 (kcal)', data: sorted.map(d => d.calories), borderColor: '#f97316', tension: 0.4, yAxisID: 'y1', fill: true, backgroundColor: 'rgba(249, 115, 22, 0.05)' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } }
        }
      });
    }
  }, [activeTab, history]);

  // 3. 處理勾選與分數計算
  const toggleCheck = (id: string, weight: number) => {
    const newChecks = { ...checks, [id]: !checks[id] };
    setChecks(newChecks);
    const score = checklistItems.reduce((acc, item) => newChecks[item.id] ? acc + item.w : acc, 0);
    setCurrentScore(score);
  };

  // 4. 儲存至雲端
  const handleSave = async () => {
    if (!formData.weight) { alert("請輸入體重"); return; }
    
    const dateObj = new Date(formData.date);
    const payload = {
      ...formData,
      weight: parseFloat(formData.weight),
      calories: parseInt(formData.calories) || 0,
      protein: parseInt(formData.protein) || 0,
      fat: parseFloat(formData.fat) || 0,
      date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
      fullDate: formData.date,
      score: currentScore,
      checks: checks,
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'artifacts', 'yi-ching-fitness-v2', 'history'), payload);
      // 重置表單
      setFormData({ ...formData, weight: '', fat: '', calories: '', protein: '', diet: '', workout: '' });
      setChecks({});
      setCurrentScore(0);
      setActiveTab('history');
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  if (dbLoading) return <div className="flex items-center justify-center min-h-screen text-slate-400 font-bold">同步雲端資料中...</div>;

  return (
    <main className="bg-slate-50 min-h-screen pb-10 font-sans text-slate-900">
      <div className="max-w-md mx-auto p-4">
        {/* --- Header --- */}
        <header className="bg-white rounded-3xl p-6 shadow-sm mb-6 text-center border-b-4 border-blue-100">
          <h1 className="text-2xl font-bold text-slate-800">Fitness Tracker</h1>
          <p className="text-green-500 text-[10px] mt-1 font-bold italic uppercase tracking-widest">● Cloud Synced</p>
          <div className="mt-4 flex justify-around">
            <div className="text-center">
              <span className="block text-2xl font-bold text-blue-600">{currentScore}%</span>
              <span className="text-xs text-slate-400 font-bold uppercase">Daily Goal</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-bold text-orange-500">{history.length}</span>
              <span className="text-xs text-slate-400 font-bold uppercase">Days Total</span>
            </div>
          </div>
        </header>

        {/* --- Tabs --- */}
        <div className="flex mb-4 bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 text-[11px] font-bold">
          {['check', 'trend', 'history'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 transition-all ${activeTab === tab ? 'text-blue-600 border-b-4 border-blue-500 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {tab === 'check' ? 'DAILY CHECK' : tab === 'trend' ? 'TREND' : 'HISTORY'}
            </button>
          ))}
        </div>

        {/* --- Tab Content: Checklist & Input --- */}
        {activeTab === 'check' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Checklist Grid */}
            <div className="grid grid-cols-2 gap-2">
              {checklistItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => toggleCheck(item.id, item.w)}
                  className={`p-4 rounded-2xl bg-white border-2 flex flex-col items-center cursor-pointer transition-all active:scale-95 ${item.full ? 'col-span-2 py-3' : ''} ${checks[item.id] ? 'border-blue-500 bg-blue-50 shadow-inner' : 'border-transparent shadow-sm'}`}
                >
                  <div className="text-xl mb-1">{item.emoji}</div>
                  <p className="text-[10px] font-black text-slate-500 uppercase">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Form Section */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-black text-slate-800 text-sm italic uppercase">Input Data</h3>
                <input 
                  type="date" 
                  className="text-[11px] bg-slate-100 px-3 py-1.5 rounded-full font-bold text-slate-600 outline-none"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <input className="bg-slate-50 p-3 rounded-xl text-xs border-0 focus:ring-2 ring-blue-100 outline-none font-bold" placeholder="KCAL" type="number" value={formData.calories} onChange={(e) => setFormData({...formData, calories: e.target.value})} />
                <input className="bg-slate-50 p-3 rounded-xl text-xs border-0 focus:ring-2 ring-blue-100 outline-none font-bold" placeholder="PROTEIN (G)" type="number" value={formData.protein} onChange={(e) => setFormData({...formData, protein: e.target.value})} />
                <input className="bg-slate-50 p-3 rounded-xl text-xs border-0 focus:ring-2 ring-blue-100 outline-none font-bold" placeholder="WEIGHT (KG)" type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} />
                <input className="bg-slate-50 p-3 rounded-xl text-xs border-0 focus:ring-2 ring-blue-100 outline-none font-bold" placeholder="WAIST (CM)" type="number" value={formData.fat} onChange={(e) => setFormData({...formData, fat: e.target.value})} />
              </div>

              <textarea 
                className="w-full bg-slate-50 rounded-xl p-3 text-xs border-0 focus:ring-2 ring-blue-100 outline-none min-h-[60px]" 
                placeholder="DIET LOG..." 
                value={formData.diet}
                onChange={(e) => setFormData({...formData, diet: e.target.value})}
              />
              
              <button 
                onClick={handleSave}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform uppercase tracking-widest text-xs"
              >
                Save Daily Record
              </button>
            </div>
          </div>
        )}

        {/* --- Tab Content: Trend --- */}
        {activeTab === 'trend' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm h-80 animate-in slide-in-from-right-4 duration-300">
            <canvas ref={chartRef}></canvas>
          </div>
        )}

        {/* --- Tab Content: History --- */}
        {activeTab === 'history' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {history.map((item: any) => (
              <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-black text-slate-800">{item.date} <span className="text-blue-500 ml-2">{item.score}%</span></div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                      {item.weight}kg · {item.calories}kcal · P:{item.protein}g
                    </div>
                  </div>
                  <button 
                    onClick={() => { if(confirm('DELETE RECORD?')) deleteDoc(doc(db, 'artifacts', 'yi-ching-fitness-v2', 'history', item.id)) }} 
                    className="text-red-300 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                {item.diet && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed font-medium">
                    {item.diet}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}