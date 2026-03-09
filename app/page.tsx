"use client";

import { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, deleteDoc } from "firebase/firestore";
import Chart from 'chart.js/auto';

// --- Firebase 配置 (沿用妳的帳號) ---
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
  const [currentScore, setCurrentScore] = useState(0);
  const [checks, setChecks] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // 表單狀態
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

  const checklistItems = [
    { id: 'water', emoji: '💧', label: '飲水 2.5L', w: 15 },
    { id: 'sugar', emoji: '🚫', label: '無糖', w: 15 },
    { id: 'protein', emoji: '🍗', label: '蛋白質', w: 15 },
    { id: 'fiber', emoji: '🥗', label: '足量蔬菜', w: 15 },
    { id: 'steps', emoji: '👟', label: '萬步達成', w: 10 },
    { id: 'sleep', emoji: '🌙', label: '睡足 8H', w: 10 },
    { id: 'bowel', emoji: '💩', label: '排便', w: 20, full: true }
  ];

  // 1. 監聽雲端數據 (路徑設為 yi-ching-fitness-v2，不影響舊資料)
  useEffect(() => {
    const colRef = collection(db, 'artifacts', 'yi-ching-fitness-v2', 'history');
    const unsub = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a: any, b: any) => b.createdAt - a.createdAt);
      setHistory(sorted);
      setDbLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. 處理圖表
  useEffect(() => {
    if (activeTab === 'trend' && chartRef.current && history.length > 0) {
      const sortedForChart = [...history].sort((a: any, b: any) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
      
      if (chartInstance.current) chartInstance.current.destroy();
      
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: sortedForChart.map(d => d.date),
          datasets: [
            { label: '體重 (kg)', data: sortedForChart.map(d => d.weight), borderColor: '#3b82f6', yAxisID: 'y', tension: 0.3 },
            { label: '熱量 (kcal)', data: sortedForChart.map(d => d.calories), borderColor: '#f97316', yAxisID: 'y1', tension: 0.4, fill: true, backgroundColor: 'rgba(249, 115, 22, 0.05)' }
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

  const toggleCheck = (id: string, w: number) => {
    const newChecks = { ...checks, [id]: !checks[id] };
    setChecks(newChecks);
    const score = checklistItems.reduce((acc, item) => newChecks[item.id] ? acc + item.w : acc, 0);
    setCurrentScore(score);
  };

  const handleSave = async () => {
    const colRef = collection(db, 'artifacts', 'yi-ching-fitness-v2', 'history');
    const dateObj = new Date(formData.date);
    const payload = {
      ...formData,
      date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
      fullDate: formData.date,
      score: currentScore,
      checks: checks,
      createdAt: editingId ? history.find(h => h.id === editingId).createdAt : Date.now()
    };

    if (editingId) {
      await setDoc(doc(db, 'artifacts', 'yi-ching-fitness-v2', 'history', editingId), payload);
      setEditingId(null);
    } else {
      await addDoc(colRef, payload);
    }

    // 重置
    setFormData({ ...formData, weight: '', fat: '', calories: '', protein: '', diet: '', workout: '' });
    setChecks({});
    setCurrentScore(0);
    setActiveTab('history');
  };

  const deleteEntry = async (id: string) => {
    if (confirm('確定要刪除嗎？')) {
      await deleteDoc(doc(db, 'artifacts', 'yi-ching-fitness-v2', 'history', id));
    }
  };

  if (dbLoading) return <div className="flex items-center justify-center min-h-screen font-bold text-slate-400">LOADING DATA...</div>;

  return (
    <main className="bg-slate-50 min-h-screen pb-10 font-sans text-slate-900">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <header className="bg-white rounded-3xl p-6 shadow-sm mb-6 text-center border-b-4 border-blue-100">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Fitness Tracker</h1>
          <p className="text-green-500 text-[10px] mt-1 font-bold italic uppercase tracking-widest">● 雲端同步中</p>
          <div className="mt-4 flex justify-around">
            <div className="text-center">
              <span className="block text-2xl font-bold text-blue-600">{currentScore}%</span>
              <span className="text-xs text-slate-400">今日完成率</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-bold text-orange-500">{history.length}</span>
              <span className="text-xs text-slate-400">累計紀錄</span>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex mb-4 bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 text-xs font-bold">
          {['check', 'trend', 'plan', 'history'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 transition-all ${activeTab === tab ? 'text-blue-600 border-b-4 border-blue-500' : 'text-slate-400'}`}
            >
              {tab === 'check' ? '每日清單' : tab === 'trend' ? '趨勢圖' : tab === 'plan' ? '計畫表' : '歷史'}
            </button>
          ))}
        </div>

        {/* Section: Checklist */}
        {activeTab === 'check' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-blue-500">
               <h4 className="text-sm font-bold text-slate-800 mb-2">💡 營養攝取建議</h4>
               <p className="text-[11px] text-slate-600">熱量：1,300 - 1,500 kcal | 蛋白質：100 - 115 g</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {checklistItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => toggleCheck(item.id, item.w)}
                  className={`p-4 rounded-2xl bg-white border-2 flex flex-col items-center cursor-pointer transition-all ${item.full ? 'col-span-2' : ''} ${checks[item.id] ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}
                >
                  <div className="text-xl mb-1">{item.emoji}</div>
                  <p className="text-[10px] font-bold">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-slate-700">數據錄入</h3>
                <input 
                  type="date" 
                  className="text-xs bg-slate-100 px-2 py-1.5 rounded-lg outline-none"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="bg-slate-50 p-2 rounded-xl text-sm border outline-none" placeholder="卡路里" type="number" value={formData.calories} onChange={(e) => setFormData({...formData, calories: e.target.value})}/>
                <input className="bg-slate-50 p-2 rounded-xl text-sm border outline-none" placeholder="蛋白質" type="number" value={formData.protein} onChange={(e) => setFormData({...formData, protein: e.target.value})}/>
                <input className="bg-slate-50 p-2 rounded-xl text-sm border outline-none" placeholder="體重" type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})}/>
                <input className="bg-slate-50 p-2 rounded-xl text-sm border outline-none" placeholder="腰圍" type="number" value={formData.fat} onChange={(e) => setFormData({...formData, fat: e.target.value})}/>
              </div>
              <textarea className="w-full bg-slate-50 rounded-xl p-3 text-sm border outline-none" placeholder="飲食內容..." value={formData.diet} onChange={(e) => setFormData({...formData, diet: e.target.value})}/>
              <button onClick={handleSave} className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-transform">
                {editingId ? '更新紀錄' : '儲存今日紀錄'}
              </button>
            </div>
          </div>
        )}

        {/* Section: Trend */}
        {activeTab === 'trend' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm h-80">
            <canvas ref={chartRef}></canvas>
          </div>
        )}

        {/* Section: History */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {history.map((item: any) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-800">{item.date} <span className="text-blue-500">{item.score}%</span></div>
                    <div className="text-[10px] text-slate-400">{item.weight}kg | {item.calories}kcal</div>
                  </div>
                  <button onClick={() => deleteEntry(item.id)} className="text-red-400 font-bold text-xs">✕ 刪除</button>
                </div>
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg mt-2">
                  🍽 {item.diet || '未紀錄'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}