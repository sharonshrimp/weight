"use client";

import { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import Chart from 'chart.js/auto';

// --- Firebase 配置 ---
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
  
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [currentScore, setCurrentScore] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 修正時間顯示：改用本地日期
  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    date: getLocalDate(),
    weight: '',
    fat: '',
    calories: '',
    protein: '',
    diet: '',
    workout: ''
  });

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const checklistItems = [
    { id: 'water', emoji: '💧', label: '飲水 2.5L', w: 15 },
    { id: 'sugar', emoji: '🚫', label: '無糖環境', w: 15 },
    { id: 'protein', emoji: '🍗', label: '足量蛋白', w: 15 },
    { id: 'fiber', emoji: '🥗', label: '足量蔬菜', w: 15 },
    { id: 'steps', emoji: '👟', label: '萬步達成', w: 10 },
    { id: 'sleep', emoji: '🌙', label: '睡足 8H', w: 10 },
    { id: 'bowel', emoji: '💩', label: '每日排便', w: 20, full: true }
  ];

  useEffect(() => {
    const colRef = collection(db, 'artifacts', 'yi-ching-fitness-v2', 'history');
    const q = query(colRef, orderBy('fullDate', 'desc')); // 改用 fullDate 排序更準確
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data);
      setDbLoading(false);
    });
    return () => unsub();
  }, []);

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
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } } }
      });
    }
  }, [activeTab, history]);

  const toggleCheck = (id: string) => {
    const newChecks = { ...checks, [id]: !checks[id] };
    setChecks(newChecks);
    const score = checklistItems.reduce((acc, item) => newChecks[item.id] ? acc + item.w : acc, 0);
    setCurrentScore(score);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      date: item.fullDate,
      weight: item.weight.toString(),
      fat: item.fat.toString(),
      calories: item.calories.toString(),
      protein: item.protein.toString(),
      diet: item.diet || '',
      workout: item.workout || ''
    });
    setChecks(item.checks || {});
    setCurrentScore(item.score || 0);
    setActiveTab('check');
  };

  const handleSave = async () => {
    if (!formData.weight) { alert("請輸入體重"); return; }
    
    const dateObj = new Date(formData.date);
    const payload = {
      ...formData,
      weight: parseFloat(formData.weight),
      calories: parseInt(formData.calories) || 0,
      protein: parseInt(formData.protein) || 0,
      fat: parseFloat(formData.fat) || 0,
      date: `${dateObj.getMonth() + 1}/${dateObj.getDate() + 1}`, // 修正日期顯示
      fullDate: formData.date,
      score: currentScore,
      checks: checks,
      createdAt: editingId ? history.find(h => h.id === editingId).createdAt : Date.now()
    };

    try {
      if (editingId) {
        await setDoc(doc(db, 'artifacts', 'yi-ching-fitness-v2', 'history', editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'artifacts', 'yi-ching-fitness-v2', 'history'), payload);
      }
      setFormData({ date: getLocalDate(), weight: '', fat: '', calories: '', protein: '', diet: '', workout: '' });
      setChecks({});
      setCurrentScore(0);
      setActiveTab('history');
    } catch (e) { console.error(e); }
  };

  if (dbLoading) return <div className="flex items-center justify-center min-h-screen text-slate-400 font-bold tracking-tighter italic">SYNCING WITH DALLAS CLOUD...</div>;

  return (
    <main className="bg-slate-50 min-h-screen pb-10 font-sans text-slate-900">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <header className="bg-white rounded-3xl p-6 shadow-sm mb-6 text-center border-b-4 border-blue-100">
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter italic">FITNESS TRACKER</h1>
          <p className="text-blue-500 text-[10px] mt-1 font-bold italic tracking-widest uppercase">● LIVE CLOUD V2</p>
          <div className="mt-4 flex justify-around border-t border-slate-50 pt-4">
            <div className="text-center">
              <span className="block text-2xl font-black text-blue-600 leading-none">{currentScore}%</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 block">Goal</span>
            </div>
            <div className="text-center border-l border-slate-100 pl-8">
              <span className="block text-2xl font-black text-orange-500 leading-none">{history.length}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 block">Log</span>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex mb-4 bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 text-[10px] font-black">
          {['check', 'trend', 'history'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 transition-all ${activeTab === tab ? 'text-blue-600 bg-blue-50/50 border-b-4 border-blue-500' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Content: Checklist */}
        {activeTab === 'check' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {checklistItems.map(item => (
                <div key={item.id} onClick={() => toggleCheck(item.id)}
                  className={`p-4 rounded-2xl bg-white border-2 flex flex-col items-center cursor-pointer transition-all active:scale-95 ${item.full ? 'col-span-2 py-3' : ''} ${checks[item.id] ? 'border-blue-500 bg-blue-50 shadow-inner' : 'border-transparent shadow-sm'}`}
                >
                  <div className="text-xl mb-1">{item.emoji}</div>
                  <p className="text-[10px] font-black text-slate-500 uppercase">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-slate-100">
              <div className="flex justify-between items-center px-1 border-b border-slate-50 pb-3">
                <h3 className="font-black text-slate-800 text-xs italic uppercase">Data Entry {editingId && <span className="text-orange-500 ml-2">(EDITING)</span>}</h3>
                <input type="date" className="text-[11px] bg-slate-100 px-3 py-1.5 rounded-full font-bold text-slate-600 outline-none"
                  value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {['calories', 'protein', 'weight', 'fat'].map((field) => (
                  <div key={field} className="relative">
                    <span className="absolute left-3 top-2 text-[8px] font-black text-slate-300 uppercase">{field}</span>
                    <input className="bg-slate-50 w-full pt-5 pb-2 px-3 rounded-xl text-xs border-0 focus:ring-2 ring-blue-100 outline-none font-bold" 
                      placeholder="0" type="number" value={(formData as any)[field]} onChange={(e) => setFormData({...formData, [field]: e.target.value})} />
                  </div>
                ))}
              </div>

              <textarea className="w-full bg-slate-50 rounded-xl p-3 text-xs border-0 focus:ring-2 ring-blue-100 outline-none min-h-[60px] font-medium" 
                placeholder="DIET LOG..." value={formData.diet} onChange={(e) => setFormData({...formData, diet: e.target.value})} />
              <textarea className="w-full bg-slate-50 rounded-xl p-3 text-xs border-0 focus:ring-2 ring-blue-100 outline-none min-h-[40px] font-medium italic" 
                placeholder="WORKOUT (Tennis, Gym...)" value={formData.workout} onChange={(e) => setFormData({...formData, workout: e.target.value})} />
              
              <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform uppercase tracking-widest text-xs">
                {editingId ? 'Update Record' : 'Save Daily Record'}
              </button>
              {editingId && <button onClick={() => {setEditingId(null); setFormData({ ...formData, weight: '', fat: '', calories: '', protein: '', diet: '', workout: '' });}} className="w-full text-slate-400 text-[10px] font-bold uppercase">Cancel Edit</button>}
            </div>
          </div>
        )}

        {activeTab === 'trend' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm h-80 animate-in slide-in-from-right-4 duration-300">
            <canvas ref={chartRef}></canvas>
          </div>
        )}

        {/* Tab Content: History (強化顯示功能) */}
        {activeTab === 'history' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {history.map((item: any) => (
              <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 group">
                <div className="flex justify-between items-start mb-3">
                  <div onClick={() => handleEdit(item)} className="cursor-pointer">
                    <div className="font-black text-slate-800 text-sm">{item.date} <span className="text-blue-500 ml-2">{item.score}%</span></div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex gap-2">
                      <span>W: {item.weight}kg</span>
                      <span>F: {item.fat}cm</span>
                      <span>C: {item.calories}kcal</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleEdit(item)} className="text-blue-300 hover:text-blue-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button onClick={() => { if(confirm('DELETE?')) deleteDoc(doc(db, 'artifacts', 'yi-ching-fitness-v2', 'history', item.id)) }} className="text-red-200 hover:text-red-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg></button>
                  </div>
                </div>
                {item.diet && <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed font-medium mb-2">🍽 {item.diet}</div>}
                {item.workout && <div className="text-[10px] text-blue-500 font-bold italic ml-1">🎾 {item.workout}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}