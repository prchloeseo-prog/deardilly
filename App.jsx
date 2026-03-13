import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── 채널 정의 ────────────────────────────────────────────────────────────────
const CHANNELS = {
  coupang: { name: "쿠팡",        color: "#E31837", bg: "#fff0f0", fee: 16,  icon: "🛒" },
  naver:   { name: "스마트스토어", color: "#03C75A", bg: "#f0fdf4", fee: 9.6, icon: "🟢" },
  cafe24:  { name: "카페24",      color: "#FF6B35", bg: "#fff7f0", fee: 5,   icon: "🟠" },
};

const INITIAL_PRODUCTS = [
  { id:1,  name:"도넛터번",           category:"터번",    cost:4500,  price:14500 },
  { id:2,  name:"플랫터번 리본",      category:"터번",    cost:4500,  price:17500 },
  { id:3,  name:"말랑터번",           category:"터번",    cost:4200,  price:16500 },
  { id:4,  name:"하트 워밍터번",      category:"터번",    cost:4500,  price:14500 },
  { id:5,  name:"호피터번",           category:"터번",    cost:4200,  price:19500 },
  { id:6,  name:"뽀숑터번",           category:"터번",    cost:4200,  price:13000 },
  { id:7,  name:"양머리터번",         category:"터번",    cost:5000,  price:19800 },
  { id:8,  name:"스윔터번",           category:"터번",    cost:5500,  price:21800 },
  { id:9,  name:"치타 트위스트 밴드", category:"헤어밴드", cost:3800,  price:13000 },
  { id:10, name:"빅리본 헤어밴드",    category:"헤어밴드", cost:3500,  price:10500 },
  { id:11, name:"쉬폰 헤어밴드",      category:"헤어밴드", cost:3200,  price:13500 },
  { id:12, name:"호피 치타 내복",     category:"내복",    cost:8500,  price:29500 },
  { id:13, name:"레오파드 내복 세트", category:"내복",    cost:9000,  price:27600 },
  { id:14, name:"꽃분이 내복",        category:"내복",    cost:8500,  price:39200 },
  { id:15, name:"효도내복 빨간내복",  category:"내복",    cost:8500,  price:34100 },
  { id:16, name:"봄 할미 레이스 내복",category:"내복",    cost:8500,  price:29700 },
  { id:17, name:"목욕가운 터번",      category:"목욕",    cost:12000, price:17400 },
  { id:18, name:"패딩 장갑",          category:"기타",    cost:6000,  price:18100 },
  { id:19, name:"이른둥이 모자",      category:"터번",    cost:3500,  price:14800 },
  { id:20, name:"OODD",              category:"의류",    cost:15000, price:29000 },
  { id:21, name:"루즐린",             category:"의류",    cost:15000, price:29000 },
];

const CATEGORIES = ["전체","터번","헤어밴드","내복","의류","목욕","기타"];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
const fmt    = n => n == null ? "-" : Math.round(n).toLocaleString();
const fmtW   = n => n == null ? "-" : Math.round(n).toLocaleString() + "원";
const fmtPct = n => n == null ? "-" : n.toFixed(1) + "%";
const rc = r => r >= 400 ? "#10b981" : r >= 200 ? "#f59e0b" : "#ef4444";
const rb = r => r >= 400 ? "#dcfce7" : r >= 200 ? "#fef9c3" : "#fee2e2";

// ─── localStorage 헬퍼 ────────────────────────────────────────────────────────
const lsGet = key => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
const lsDel = key => { try { localStorage.removeItem(key); } catch {} };

// ─── 파일 파서 ────────────────────────────────────────────────────────────────
function parseChannelFile(raw) {
  let hRow = -1;
  for (let i = 0; i < Math.min(raw.length, 8); i++) {
    const r = raw[i];
    if (r && r.some(c => ["상품명","매출","주문","결제","광고비","판매금액"].some(k => String(c||"").includes(k)))) {
      hRow = i; break;
    }
  }
  if (hRow < 0) return null;

  const headers = raw[hRow].map(h => String(h || ""));
  const rows    = raw.slice(hRow + 1).filter(r => r && r.some(c => c != null && c !== ""));
  const fc = (...kw) => headers.findIndex(h => kw.some(k => h.includes(k)));
  const isAd = headers.some(h => h.includes("광고비") || h.includes("ROAS"));

  if (isAd) {
    const nameCol   = fc("상품명","광고집행");
    const adCol     = fc("광고비");
    const dirRevCol = fc("직접 전환 매출액 (14일)","직접 전환 매출액");
    const indRevCol = fc("간접 전환 매출액 (14일)","간접 전환 매출액");
    const orderCol  = fc("총 주문수 (14일)","주문수");
    const items = {};
    rows.forEach(row => {
      let name = nameCol >= 0 ? String(row[nameCol]||"").split(",")[0].trim() : "";
      name = name.replace(/^\[디어딜리[^\]]*\]\s*/,"").replace(/\[디어딜리\]/,"").trim();
      if (!name || name.length < 2) return;
      const ad  = +String(row[adCol]||"0").replace(/[^0-9.-]/g,"") || 0;
      const dir = +String(row[dirRevCol]||"0").replace(/[^0-9.-]/g,"") || 0;
      const ind = indRevCol >= 0 ? +String(row[indRevCol]||"0").replace(/[^0-9.-]/g,"") || 0 : 0;
      const ord = orderCol >= 0 ? +String(row[orderCol]||"0").replace(/[^0-9.-]/g,"") || 0 : 0;
      if (!items[name]) items[name] = { name, adCost:0, revenue:0, orders:0 };
      items[name].adCost += ad; items[name].revenue += dir + ind; items[name].orders += ord;
    });
    return { type:"ad", rows: Object.values(items).filter(i => i.adCost > 0)
      .map(i => ({...i, roas: i.adCost > 0 ? i.revenue / i.adCost * 100 : 0}))
      .sort((a,b) => b.adCost - a.adCost) };
  } else {
    const nameCol  = fc("상품명","상품 명","제품명");
    const revCol   = fc("매출","결제금액","판매금액","주문금액");
    const orderCol = fc("주문수","주문 수","판매수","결제수");
    const qtyCol   = fc("수량","판매량","판매 수량");
    const items = {};
    rows.forEach(row => {
      const name = nameCol >= 0 ? String(row[nameCol]||"").split(",")[0].trim() : "";
      if (!name || name.length < 2) return;
      const rev = revCol >= 0 ? +String(row[revCol]||"0").replace(/[^0-9.-]/g,"") || 0 : 0;
      const ord = orderCol >= 0 ? +String(row[orderCol]||"0").replace(/[^0-9.-]/g,"") || 0 : 0;
      const qty = qtyCol >= 0 ? +String(row[qtyCol]||"0").replace(/[^0-9.-]/g,"") || 0 : 0;
      if (!items[name]) items[name] = { name, revenue:0, orders:0, qty:0 };
      items[name].revenue += rev; items[name].orders += ord; items[name].qty += qty;
    });
    return { type:"sales", rows: Object.values(items).filter(i => i.revenue > 0 || i.orders > 0)
      .sort((a,b) => b.revenue - a.revenue) };
  }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState("dashboard");
  const [products, setProducts]     = useState(() => lsGet("dd_products") || INITIAL_PRODUCTS);
  const [channelData, setChannelData] = useState(() => lsGet("dd_channels") || { coupang:{}, naver:{}, cafe24:{} });
  const [strategy, setStrategy]     = useState(() => lsGet("dd_strategy") || "");
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [editBuf, setEditBuf]       = useState({});
  const [catFilter, setCatFilter]   = useState("전체");
  const [newProd, setNewProd]       = useState({ name:"", category:"터번", cost:"", price:"" });
  const [showAdd, setShowAdd]       = useState(false);
  const [toast, setToast]           = useState("");
  const [dataChannel, setDataChannel] = useState("coupang");

  const notify = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const saveProducts = p => { setProducts(p); lsSet("dd_products", p); };
  const saveChannels = cd => { setChannelData(cd); lsSet("dd_channels", cd); };

  const handleFile = useCallback(async (file, ch) => {
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf);
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header:1 });
    const result = parseChannelFile(raw);
    if (!result) { notify("❌ 파일 형식을 인식하지 못했어요"); return; }
    const updated = { ...channelData, [ch]: { ...channelData[ch], [result.type]: result.rows }};
    saveChannels(updated);
    notify(`✅ ${CHANNELS[ch].name} ${result.type==="ad"?"광고":"매출"} 로드 완료 (${result.rows.length}개)`);
  }, [channelData]);

  const deleteChannelData = (ch, type) => {
    const updated = { ...channelData, [ch]: { ...channelData[ch], [type]: null }};
    saveChannels(updated);
    notify("🗑️ 삭제됐어요");
  };

  const startEdit = p => { setEditingId(p.id); setEditBuf({ cost:p.cost, price:p.price }); };
  const saveEdit = id => {
    const updated = products.map(p => p.id === id ? {...p, cost:+editBuf.cost, price:+editBuf.price} : p);
    saveProducts(updated); setEditingId(null); notify("✅ 저장됐어요!");
  };
  const addProduct = () => {
    if (!newProd.name) return;
    const p = { id: Date.now(), ...newProd, cost:+newProd.cost, price:+newProd.price };
    saveProducts([...products, p]);
    setNewProd({ name:"", category:"터번", cost:"", price:"" }); setShowAdd(false); notify("✅ 추가됐어요!");
  };

  // ─── 집계 ─────────────────────────────────────────────────────────────────
  const chTotal     = (ch, type, field) => (channelData[ch]?.[type] || []).reduce((s,r) => s + (r[field]||0), 0);
  const allSales    = Object.keys(CHANNELS).reduce((s,ch) => s + chTotal(ch,"sales","revenue"), 0);
  const allAd       = Object.keys(CHANNELS).reduce((s,ch) => s + chTotal(ch,"ad","adCost"), 0);
  const allAdRev    = Object.keys(CHANNELS).reduce((s,ch) => s + chTotal(ch,"ad","revenue"), 0);
  const overallRoas = allAd > 0 ? allAdRev / allAd * 100 : 0;
  const avgMargin   = products.filter(p=>p.price>0).reduce((s,p) => s + (p.price-p.cost)/p.price*100, 0) / (products.filter(p=>p.price>0).length || 1);
  const netMargin   = (p, ch) => p.price > 0 ? (p.price-p.cost)/p.price*100 - CHANNELS[ch].fee : 0;

  // ─── AI 전략 ──────────────────────────────────────────────────────────────
  const generateStrategy = async () => {
    setStrategyLoading(true); setStrategy("");
    const prodSummary = products.slice(0,20).map(p =>
      `${p.name}(원가${p.cost}/판매가${p.price}/마진${((p.price-p.cost)/p.price*100).toFixed(0)}%)`
    ).join(", ");
    const chSummary = Object.entries(CHANNELS).map(([k,ch]) => {
      const sales = chTotal(k,"sales","revenue");
      const ad    = chTotal(k,"ad","adCost");
      const adRev = chTotal(k,"ad","revenue");
      const roas  = ad > 0 ? adRev/ad*100 : 0;
      return `${ch.name}: 매출${Math.round(sales/10000)}만원 광고비${Math.round(ad/10000)}만원 ROAS${roas.toFixed(0)}%`;
    }).join(" | ");

    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: `당신은 디어딜리(Dear Dilly) 한국 베이비/유아 브랜드 전략 컨설턴트입니다.
쿠팡(수수료16%), 네이버 스마트스토어(수수료9.6%), 카페24(수수료5%)에서 판매 중입니다.
채널별 특성을 고려한 실행 가능한 전략을 한국어로 제공하세요.
형식:
🔥 즉시 실행 (이번 주)
📈 채널별 전략 (쿠팡 / 스마트스토어 / 카페24)
💡 핵심 인사이트
각 항목은 2-3개 bullet, 구체적 숫자 포함.`,
          messages: [{
            role: "user",
            content: `디어딜리 운영 현황:\n\n【상품】${prodSummary}\n\n【채널별 성과】${chSummary}\n\n전체 매출: ${Math.round(allSales/10000)}만원 / 전체 광고비: ${Math.round(allAd/10000)}만원 / ROAS: ${overallRoas.toFixed(0)}%\n\n채널별 맞춤 전략을 알려주세요.`
          }]
        })
      });
      const data  = await res.json();
      const text  = data.content?.[0]?.text || "오류가 발생했어요.";
      setStrategy(text); lsSet("dd_strategy", text);
    } catch(e) {
      setStrategy("❌ 오류: " + e.message);
    }
    setStrategyLoading(false);
  };

  const filteredProds = catFilter === "전체" ? products : products.filter(p => p.category === catFilter);

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Apple SD Gothic Neo','Malgun Gothic',sans-serif", background:"#f0f0ee", minHeight:"100vh" }}>
      {toast && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:9999, background:"#1e293b", color:"white", padding:"12px 20px", borderRadius:12, fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div style={{ background:"linear-gradient(135deg,#0f172a,#1e3a5f)", padding:"20px 28px 0", color:"white" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <span style={{ fontSize:22 }}>🎀</span>
            <div>
              <div style={{ fontSize:18, fontWeight:800, letterSpacing:-0.5 }}>Dear Dilly</div>
              <div style={{ fontSize:11, color:"#94a3b8", letterSpacing:1 }}>멀티채널 운영 대시보드</div>
            </div>
            <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
              {Object.entries(CHANNELS).map(([k,ch]) => {
                const hasData = channelData[k]?.sales || channelData[k]?.ad;
                return (
                  <div key={k} style={{ padding:"4px 10px", borderRadius:20, background:hasData?ch.color+"30":"rgba(255,255,255,0.1)", border:`1px solid ${hasData?ch.color:"rgba(255,255,255,0.2)"}`, fontSize:11, color:hasData?ch.color:"#94a3b8", fontWeight:600 }}>
                    {ch.icon} {ch.name} {hasData?"✅":""}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display:"flex", gap:2 }}>
            {[
              { id:"dashboard", label:"📊 대시보드" },
              { id:"channels",  label:"🏪 채널 비교" },
              { id:"products",  label:"📦 상품 관리" },
              { id:"data",      label:"📁 데이터 업로드" },
              { id:"strategy",  label:"🧠 AI 전략" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"10px 16px", border:"none", cursor:"pointer", borderRadius:"10px 10px 0 0", fontSize:13, fontWeight:600, transition:"all 0.15s", background:tab===t.id?"#f0f0ee":"transparent", color:tab===t.id?"#0f172a":"#94a3b8" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 28px" }}>

        {/* ── 대시보드 ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
              {[
                { label:"전체 매출",  value:allSales>0?fmt(allSales/10000)+"만원":"미업로드",     icon:"💰", bg:"#dcfce7" },
                { label:"전체 광고비",value:allAd>0?fmt(allAd/10000)+"만원":"미업로드",           icon:"📢", bg:"#e0e7ff" },
                { label:"전체 ROAS", value:overallRoas>0?fmtPct(overallRoas):"미업로드",          icon:"📈", bg:overallRoas>=300?"#dcfce7":overallRoas>0?"#fef9c3":"#f1f5f9", color:overallRoas>0?rc(overallRoas):undefined },
                { label:"평균 마진율",value:fmtPct(avgMargin),                                    icon:"🎯", bg:"#fef9c3" },
              ].map((k,i) => (
                <div key={i} style={{ background:"white", borderRadius:16, padding:"16px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:6 }}>{k.label}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:k.color||"#1e293b" }}>{k.value}</div>
                    </div>
                    <div style={{ background:k.bg, borderRadius:10, padding:"8px", fontSize:18 }}>{k.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 채널 요약 */}
            <div style={{ background:"white", borderRadius:16, padding:"22px", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#1e293b", marginBottom:16 }}>🏪 채널별 성과 요약</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {Object.entries(CHANNELS).map(([k,ch]) => {
                  const sales  = chTotal(k,"sales","revenue");
                  const ad     = chTotal(k,"ad","adCost");
                  const adRev  = chTotal(k,"ad","revenue");
                  const roas   = ad > 0 ? adRev/ad*100 : 0;
                  const orders = chTotal(k,"sales","orders");
                  const hasData = sales > 0 || ad > 0;
                  return (
                    <div key={k} style={{ padding:"16px", borderRadius:12, border:`2px solid ${hasData?ch.color+"40":"#f1f5f9"}`, background:hasData?ch.bg:"#fafafa" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                        <span style={{ fontSize:18 }}>{ch.icon}</span>
                        <span style={{ fontSize:14, fontWeight:800, color:ch.color }}>{ch.name}</span>
                        <span style={{ fontSize:10, color:"#94a3b8", marginLeft:"auto" }}>수수료 {ch.fee}%</span>
                      </div>
                      {hasData ? (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                          {[
                            { label:"매출",   value:sales>0?fmt(sales/10000)+"만":"미업로드" },
                            { label:"주문",   value:orders>0?fmt(orders)+"건":"미업로드" },
                            { label:"광고비", value:ad>0?fmt(ad/10000)+"만":"미업로드" },
                            { label:"ROAS",  value:roas>0?fmtPct(roas):"미업로드", color:roas>0?rc(roas):"#94a3b8" },
                          ].map((s,i) => (
                            <div key={i} style={{ background:"white", borderRadius:8, padding:"8px 10px" }}>
                              <div style={{ fontSize:10, color:"#94a3b8" }}>{s.label}</div>
                              <div style={{ fontSize:14, fontWeight:700, color:s.color||"#1e293b" }}>{s.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign:"center", padding:"16px 0", color:"#94a3b8", fontSize:12 }}>
                          데이터를 업로드해주세요
                          <div>
                            <button onClick={() => { setTab("data"); setDataChannel(k); }} style={{ marginTop:8, padding:"5px 12px", borderRadius:8, border:"1px solid #e2e8f0", background:"white", cursor:"pointer", fontSize:11, color:ch.color, fontWeight:600 }}>
                              업로드 →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 마진율 테이블 */}
            <div style={{ background:"white", borderRadius:16, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#1e293b", marginBottom:14 }}>💰 상품별 순마진율 (채널 수수료 반영)</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
                {Object.entries(CHANNELS).map(([k,ch]) => (
                  <div key={k} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#64748b" }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:ch.color }} /> {ch.name} (-{ch.fee}%)
                  </div>
                ))}
              </div>
              {[...products].filter(p=>p.price>0).sort((a,b)=>(b.price-b.cost)/b.price-(a.price-a.cost)/a.price).slice(0,10).map((p,i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr repeat(3,1fr)", gap:8, alignItems:"center", padding:"8px 12px", borderRadius:8, background:"#f8fafc", marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{p.name}</div>
                  {Object.entries(CHANNELS).map(([k]) => {
                    const nm = netMargin(p, k);
                    return <div key={k} style={{ textAlign:"center", fontSize:12, fontWeight:700, color:nm>=30?"#10b981":nm>=15?"#f59e0b":"#ef4444" }}>{fmtPct(nm)}</div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 채널 비교 ── */}
        {tab === "channels" && (
          <div>
            {Object.entries(CHANNELS).map(([k,ch]) => {
              const sales     = channelData[k]?.sales || [];
              const ads       = channelData[k]?.ad    || [];
              const totalSales = sales.reduce((s,r) => s+r.revenue, 0);
              const totalAd    = ads.reduce((s,a) => s+a.adCost, 0);
              const totalAdRev = ads.reduce((s,a) => s+a.revenue, 0);
              const roas       = totalAd > 0 ? totalAdRev/totalAd*100 : 0;
              return (
                <div key={k} style={{ background:"white", borderRadius:18, marginBottom:20, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ background:ch.bg, padding:"18px 24px", borderBottom:`3px solid ${ch.color}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:24 }}>{ch.icon}</span>
                        <div>
                          <div style={{ fontSize:18, fontWeight:800, color:ch.color }}>{ch.name}</div>
                          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>수수료 {ch.fee}%</div>
                        </div>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, textAlign:"center" }}>
                        {[
                          { label:"매출",   value:totalSales>0?fmt(totalSales/10000)+"만":"미업로드" },
                          { label:"광고비", value:totalAd>0?fmt(totalAd/10000)+"만":"미업로드" },
                          { label:"ROAS",  value:roas>0?fmtPct(roas):"미업로드", color:roas>0?rc(roas):"#94a3b8" },
                        ].map((s,i) => (
                          <div key={i} style={{ background:"white", borderRadius:10, padding:"10px 14px" }}>
                            <div style={{ fontSize:10, color:"#94a3b8" }}>{s.label}</div>
                            <div style={{ fontSize:16, fontWeight:800, color:s.color||"#1e293b" }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding:"20px 24px", display:"grid", gridTemplateColumns:sales.length>0&&ads.length>0?"1fr 1fr":"1fr", gap:20 }}>
                    {sales.length > 0 && (
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#1e293b", marginBottom:10 }}>📦 매출 TOP 상품</div>
                        {sales.slice(0,8).map((s,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f8fafc", fontSize:13 }}>
                            <span style={{ color:"#475569", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:8 }}>{s.name.slice(0,20)}</span>
                            <span style={{ fontWeight:700, color:ch.color, whiteSpace:"nowrap" }}>{fmt(s.revenue/10000)}만원</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ads.length > 0 && (
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#1e293b", marginBottom:10 }}>📊 광고 ROAS</div>
                        {ads.slice(0,8).map((a,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #f8fafc" }}>
                            <span style={{ fontSize:13, color:"#475569", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:8 }}>{a.name.slice(0,18)}</span>
                            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:6, background:rb(a.roas), color:rc(a.roas), fontWeight:700 }}>{fmtPct(a.roas)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {sales.length === 0 && ads.length === 0 && (
                      <div style={{ textAlign:"center", padding:"24px", color:"#94a3b8" }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>📁</div>
                        <div style={{ fontSize:13 }}>아직 데이터가 없어요</div>
                        <button onClick={() => { setTab("data"); setDataChannel(k); }} style={{ marginTop:10, padding:"8px 16px", borderRadius:8, border:"none", background:ch.color, color:"white", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                          데이터 업로드 →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 상품 관리 ── */}
        {tab === "products" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCatFilter(c)} style={{ padding:"6px 14px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:catFilter===c?"#0f172a":"white", color:catFilter===c?"white":"#64748b", boxShadow:"0 1px 3px rgba(0,0,0,0.07)" }}>{c}</button>
                ))}
              </div>
              <button onClick={() => setShowAdd(!showAdd)} style={{ padding:"8px 16px", borderRadius:10, border:"none", cursor:"pointer", background:"#6366f1", color:"white", fontWeight:700, fontSize:13 }}>+ 상품 추가</button>
            </div>

            {showAdd && (
              <div style={{ background:"white", borderRadius:14, padding:"18px 20px", marginBottom:14, boxShadow:"0 1px 4px rgba(0,0,0,0.07)", border:"2px solid #6366f1" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#1e293b", marginBottom:12 }}>새 상품 추가</div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:8, alignItems:"end" }}>
                  <input placeholder="상품명" value={newProd.name} onChange={e=>setNewProd({...newProd,name:e.target.value})} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, outline:"none" }}/>
                  <input type="number" placeholder="원가(원)" value={newProd.cost} onChange={e=>setNewProd({...newProd,cost:e.target.value})} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, outline:"none" }}/>
                  <input type="number" placeholder="판매가(원)" value={newProd.price} onChange={e=>setNewProd({...newProd,price:e.target.value})} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, outline:"none" }}/>
                  <select value={newProd.category} onChange={e=>setNewProd({...newProd,category:e.target.value})} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13 }}>
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button onClick={addProduct} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#6366f1", color:"white", cursor:"pointer", fontWeight:700, fontSize:13 }}>추가</button>
                </div>
              </div>
            )}

            <div style={{ background:"white", borderRadius:16, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto", padding:"10px 16px", background:"#f8fafc", fontSize:11, color:"#94a3b8", fontWeight:700, gap:4 }}>
                <div>상품명</div>
                <div style={{textAlign:"right"}}>카테고리</div>
                <div style={{textAlign:"right"}}>원가</div>
                <div style={{textAlign:"right"}}>판매가</div>
                <div style={{textAlign:"right"}}>원마진</div>
                <div style={{textAlign:"right",color:CHANNELS.coupang.color}}>쿠팡순</div>
                <div style={{textAlign:"right",color:CHANNELS.naver.color}}>스토어순</div>
                <div style={{textAlign:"right",color:CHANNELS.cafe24.color}}>카페24순</div>
                <div/>
              </div>
              {filteredProds.map((p,i) => {
                const raw = p.price > 0 ? (p.price-p.cost)/p.price*100 : 0;
                const isEditing = editingId === p.id;
                return (
                  <div key={p.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto", padding:"11px 16px", alignItems:"center", borderTop:i>0?"1px solid #f1f5f9":"none", background:isEditing?"#f0f9ff":"white", gap:4 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{p.name}</div>
                    <div style={{ textAlign:"right", fontSize:12, color:"#64748b" }}>{p.category}</div>
                    {isEditing ? (
                      <>
                        <div style={{textAlign:"right"}}><input type="number" value={editBuf.cost} onChange={e=>setEditBuf({...editBuf,cost:e.target.value})} style={{ width:68, padding:"4px 6px", borderRadius:6, border:"1px solid #6366f1", fontSize:12, textAlign:"right" }}/></div>
                        <div style={{textAlign:"right"}}><input type="number" value={editBuf.price} onChange={e=>setEditBuf({...editBuf,price:e.target.value})} style={{ width:68, padding:"4px 6px", borderRadius:6, border:"1px solid #6366f1", fontSize:12, textAlign:"right" }}/></div>
                        <div style={{ textAlign:"right", fontSize:12, fontWeight:700, color:"#f59e0b" }}>{fmtPct((editBuf.price-editBuf.cost)/editBuf.price*100)}</div>
                        {Object.entries(CHANNELS).map(([k,ch]) => {
                          const nm = editBuf.price>0?((editBuf.price-editBuf.cost)/editBuf.price*100-ch.fee):0;
                          return <div key={k} style={{ textAlign:"right", fontSize:12, fontWeight:700, color:nm>=20?"#10b981":nm>=10?"#f59e0b":"#ef4444" }}>{fmtPct(nm)}</div>;
                        })}
                      </>
                    ) : (
                      <>
                        <div style={{ textAlign:"right", fontSize:12, color:"#475569" }}>{fmtW(p.cost)}</div>
                        <div style={{ textAlign:"right", fontSize:12, color:"#475569" }}>{fmtW(p.price)}</div>
                        <div style={{ textAlign:"right", fontSize:12, fontWeight:700, color:raw>=40?"#10b981":raw>=25?"#f59e0b":"#ef4444" }}>{fmtPct(raw)}</div>
                        {Object.entries(CHANNELS).map(([k]) => {
                          const nm = netMargin(p,k);
                          return <div key={k} style={{ textAlign:"right", fontSize:12, fontWeight:700, color:nm>=20?"#10b981":nm>=10?"#f59e0b":"#ef4444" }}>{fmtPct(nm)}</div>;
                        })}
                      </>
                    )}
                    <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(p.id)} style={{ padding:"5px 10px", borderRadius:7, border:"none", background:"#10b981", color:"white", cursor:"pointer", fontSize:11, fontWeight:700 }}>저장</button>
                          <button onClick={() => setEditingId(null)} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid #e2e8f0", background:"white", cursor:"pointer", fontSize:11 }}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(p)} style={{ padding:"5px 10px", borderRadius:7, border:"1px solid #e2e8f0", background:"white", cursor:"pointer", fontSize:11, color:"#6366f1", fontWeight:600 }}>수정</button>
                          <button onClick={() => { saveProducts(products.filter(x=>x.id!==p.id)); notify("🗑️ 삭제됐어요"); }} style={{ padding:"5px 8px", borderRadius:7, border:"none", background:"#fee2e2", cursor:"pointer", fontSize:11, color:"#ef4444" }}>🗑</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 데이터 업로드 ── */}
        {tab === "data" && (
          <div>
            <div style={{ display:"flex", gap:6, marginBottom:20 }}>
              {Object.entries(CHANNELS).map(([k,ch]) => (
                <button key={k} onClick={() => setDataChannel(k)} style={{ padding:"10px 20px", borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, background:dataChannel===k?ch.color:"white", color:dataChannel===k?"white":ch.color, boxShadow:"0 1px 4px rgba(0,0,0,0.07)", transition:"all 0.15s" }}>
                  {ch.icon} {ch.name}
                </button>
              ))}
            </div>

            {Object.entries(CHANNELS).map(([k,ch]) => (
              dataChannel === k && (
                <div key={k}>
                  <div style={{ padding:"14px 18px", background:ch.bg, borderRadius:12, border:`1px solid ${ch.color}30`, marginBottom:20, fontSize:13, color:"#475569" }}>
                    <strong style={{ color:ch.color }}>{ch.icon} {ch.name}</strong> · 수수료 {ch.fee}% · 매출/광고 파일 자동 감지
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                    {[
                      { type:"sales", label:"📦 매출 데이터", desc:`${ch.name} 매출/주문 Excel 또는 CSV`, color:ch.color },
                      { type:"ad",   label:"📊 광고 데이터", desc:`${ch.name} 광고 성과 Excel`,           color:"#6366f1" },
                    ].map(({ type, label, desc, color }) => (
                      <div key={type} style={{ background:"white", borderRadius:18, padding:"24px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                        <div style={{ fontSize:15, fontWeight:800, color:"#1e293b", marginBottom:5 }}>{label}</div>
                        <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>{desc}</div>
                        <FileUploader color={color} onFile={f => handleFile(f, k)} />
                        {channelData[k]?.[type] && (
                          <div style={{ marginTop:14 }}>
                            <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>✅ {channelData[k][type].length}개 로드됨</div>
                            <div style={{ maxHeight:200, overflowY:"auto" }}>
                              {channelData[k][type].slice(0,12).map((item,i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f8fafc", fontSize:12 }}>
                                  <span style={{ color:"#1e293b", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:8 }}>{item.name.slice(0,20)}</span>
                                  {item.roas != null
                                    ? <span style={{ padding:"2px 7px", borderRadius:5, background:rb(item.roas), color:rc(item.roas), fontWeight:700, fontSize:11 }}>{fmtPct(item.roas)}</span>
                                    : <span style={{ color:ch.color, fontWeight:700 }}>{fmt(item.revenue/10000)}만</span>
                                  }
                                </div>
                              ))}
                            </div>
                            <button onClick={() => deleteChannelData(k, type)} style={{ marginTop:10, padding:"5px 12px", borderRadius:8, border:"1px solid #fee2e2", background:"white", cursor:"pointer", fontSize:11, color:"#ef4444" }}>초기화</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* ── AI 전략 ── */}
        {tab === "strategy" && (
          <div>
            <div style={{ background:"white", borderRadius:18, padding:"24px", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#1e293b" }}>🧠 멀티채널 AI 전략 분석</div>
                  <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>
                    {Object.entries(CHANNELS).map(([k,ch]) => {
                      const has = channelData[k]?.sales || channelData[k]?.ad;
                      return `${ch.name} ${has?"✅":"⬜"}`;
                    }).join("  ·  ")}
                  </div>
                </div>
                <button onClick={generateStrategy} disabled={strategyLoading} style={{ padding:"12px 24px", borderRadius:12, border:"none", cursor:strategyLoading?"not-allowed":"pointer", background:strategyLoading?"#94a3b8":"linear-gradient(135deg,#6366f1,#0ea5e9)", color:"white", fontWeight:800, fontSize:14, boxShadow:"0 4px 12px rgba(99,102,241,0.3)" }}>
                  {strategyLoading ? "⏳ 분석 중..." : "✨ 전략 생성"}
                </button>
              </div>
              {strategy ? (
                <div style={{ background:"#f8fafc", borderRadius:12, padding:"22px", fontSize:14, lineHeight:2, color:"#1e293b", whiteSpace:"pre-wrap" }}>{strategy}</div>
              ) : (
                <div style={{ textAlign:"center", padding:"50px 0", color:"#94a3b8" }}>
                  <div style={{ fontSize:44, marginBottom:14 }}>🧠</div>
                  <div style={{ fontSize:14 }}>쿠팡 · 스마트스토어 · 카페24 데이터를 종합해서<br />채널별 맞춤 전략을 만들어드려요</div>
                </div>
              )}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
              {Object.entries(CHANNELS).map(([k,ch]) => {
                const ads       = channelData[k]?.ad    || [];
                const sales     = channelData[k]?.sales  || [];
                const lowRoas   = ads.filter(a => a.roas < 150 && a.adCost >= 10000);
                const topSales  = sales.slice(0,3);
                if (!ads.length && !sales.length) return (
                  <div key={k} style={{ background:"white", borderRadius:16, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", textAlign:"center", color:"#94a3b8" }}>
                    <div style={{ fontSize:24, marginBottom:8 }}>{ch.icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:ch.color, marginBottom:6 }}>{ch.name}</div>
                    <div style={{ fontSize:12 }}>데이터 없음</div>
                    <button onClick={() => { setTab("data"); setDataChannel(k); }} style={{ marginTop:10, padding:"6px 14px", borderRadius:8, border:"none", background:ch.color, color:"white", cursor:"pointer", fontSize:11, fontWeight:700 }}>업로드 →</button>
                  </div>
                );
                return (
                  <div key={k} style={{ background:"white", borderRadius:16, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize:14, fontWeight:800, color:ch.color, marginBottom:12 }}>{ch.icon} {ch.name}</div>
                    {lowRoas.length > 0 && (
                      <>
                        <div style={{ fontSize:11, fontWeight:700, color:"#ef4444", marginBottom:6 }}>🚨 광고 OFF 추천</div>
                        {lowRoas.slice(0,3).map((a,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #f8fafc" }}>
                            <span style={{ color:"#475569" }}>{a.name.slice(0,12)}</span>
                            <span style={{ color:"#ef4444", fontWeight:700 }}>{fmtPct(a.roas)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {topSales.length > 0 && (
                      <>
                        <div style={{ fontSize:11, fontWeight:700, color:"#10b981", marginTop:10, marginBottom:6 }}>🔥 매출 TOP</div>
                        {topSales.map((s,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #f8fafc" }}>
                            <span style={{ color:"#475569" }}>{s.name.slice(0,12)}</span>
                            <span style={{ color:ch.color, fontWeight:700 }}>{fmt(s.revenue/10000)}만</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 파일 업로더 ─────────────────────────────────────────────────────────────
function FileUploader({ color, onFile }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const handle = f => { if (f) onFile(f); };
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => ref.current.click()}
      style={{ border:`2px dashed ${drag?color:"#e2e8f0"}`, borderRadius:12, padding:"22px", textAlign:"center", cursor:"pointer", transition:"all 0.2s", background:drag?color+"10":"#f8fafc" }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={e => handle(e.target.files[0])} />
      <div style={{ fontSize:26, marginBottom:7 }}>📂</div>
      <div style={{ fontSize:13, color:"#64748b", fontWeight:600 }}>클릭하거나 드래그하여 업로드</div>
      <div style={{ fontSize:11, color:"#94a3b8", marginTop:3 }}>Excel (.xlsx) / CSV · 매출·광고 자동 감지</div>
    </div>
  );
}
