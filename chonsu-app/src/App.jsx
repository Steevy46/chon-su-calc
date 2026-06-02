import React, { useState, useMemo } from "react";

/* =========================================================================
   촌수 계산 엔진
   - 촌수: 가계 그래프를 구성해 혈연 간선 수를 셈 (민법 세수등친제)
   - 호칭: 체인을 [부모]*[형제]?[자식]* 문법으로 파싱하여 판정
   - 인척: 배우자 간선 기준으로 분리하여 호칭 판정
   ========================================================================= */

// 직전 사람(curGender) 기준으로 선택 가능한 관계 옵션
function optionsFor(curGender) {
  return [
    { key: "father", label: "아버지", type: "parent", gender: "M" },
    { key: "mother", label: "어머니", type: "parent", gender: "F" },
    { key: "obro", label: curGender === "M" ? "형" : "오빠", type: "sibling", gender: "M", older: true },
    { key: "osis", label: curGender === "M" ? "누나" : "언니", type: "sibling", gender: "F", older: true },
    { key: "ybro", label: "남동생", type: "sibling", gender: "M", older: false },
    { key: "ysis", label: "여동생", type: "sibling", gender: "F", older: false },
    { key: "son", label: "아들", type: "child", gender: "M" },
    { key: "daughter", label: "딸", type: "child", gender: "F" },
    { key: "spouse", label: curGender === "M" ? "아내" : "남편", type: "spouse", gender: curGender === "M" ? "F" : "M" },
  ];
}

function resolveOption(key, curGender) {
  return optionsFor(curGender).find((o) => o.key === key);
}

// 체인(선택 key 배열) → 의미 있는 move 배열 + 표시 라벨
function buildMoves(myGender, chainKeys) {
  const moves = [];
  let cur = myGender;
  for (const key of chainKeys) {
    const opt = resolveOption(key, cur);
    if (!opt) break;
    moves.push({ type: opt.type, gender: opt.gender, older: opt.older, label: opt.label });
    cur = opt.gender; // 다음 사람의 성별
  }
  return moves;
}

/* ---------------- 그래프 기반 촌수 계산 ---------------- */
function computeChon(myGender, moves) {
  const nodes = {};
  let nid = 0;
  const add = (gender) => {
    const id = "n" + nid++;
    nodes[id] = { id, gender, parents: [], children: [], spouse: null };
    return id;
  };
  const me = add(myGender);
  let cur = me;
  for (const mv of moves) {
    if (mv.type === "parent") {
      // 같은 성별의 부모가 이미 있으면 그 사람을 재사용 (예: 형의 어머니 = 내 어머니)
      const existing = nodes[cur].parents.find((pid) => nodes[pid].gender === mv.gender);
      if (existing) {
        cur = existing;
      } else {
        const p = add(mv.gender);
        nodes[p].children.push(cur);
        nodes[cur].parents.push(p);
        // 반대 성별 부모가 이미 있으면 부부로 연결
        const other = nodes[cur].parents.find((pid) => pid !== p && nodes[pid].spouse === null);
        if (other) {
          nodes[p].spouse = other;
          nodes[other].spouse = p;
        }
        cur = p;
      }
    } else if (mv.type === "child") {
      const c = add(mv.gender);
      nodes[cur].children.push(c);
      nodes[c].parents.push(cur);
      cur = c;
    } else if (mv.type === "sibling") {
      if (nodes[cur].parents.length === 0) {
        const f = add("M");
        const m = add("F");
        nodes[f].children.push(cur);
        nodes[m].children.push(cur);
        nodes[cur].parents.push(f, m);
        nodes[f].spouse = m;
        nodes[m].spouse = f;
      }
      const sib = add(mv.gender);
      for (const pp of nodes[cur].parents) {
        nodes[pp].children.push(sib);
        nodes[sib].parents.push(pp);
      }
      cur = sib;
    } else if (mv.type === "spouse") {
      const s = add(mv.gender);
      nodes[cur].spouse = s;
      nodes[s].spouse = cur;
      cur = s;
    }
  }
  const target = cur;

  // me -> target 단순 경로 탐색 (BFS)
  const prev = {};
  const edge = {};
  const visited = new Set([me]);
  const queue = [me];
  while (queue.length) {
    const x = queue.shift();
    if (x === target) break;
    const neigh = [];
    nodes[x].parents.forEach((p) => neigh.push([p, "blood"]));
    nodes[x].children.forEach((c) => neigh.push([c, "blood"]));
    if (nodes[x].spouse) neigh.push([nodes[x].spouse, "marriage"]);
    for (const [y, t] of neigh) {
      if (!visited.has(y)) {
        visited.add(y);
        prev[y] = x;
        edge[y] = t;
        queue.push(y);
      }
    }
  }
  let chon = 0;
  let inlaw = false;
  let node = target;
  while (node !== me && prev[node] !== undefined) {
    if (edge[node] === "blood") chon++;
    else inlaw = true;
    node = prev[node];
  }
  return { chon, inlaw };
}

/* ---------------- 혈연 체인 구조 파싱 ---------------- */
function parseBloodStruct(bms) {
  let i = 0;
  const ups = [];
  while (bms[i] && bms[i].type === "parent") {
    ups.push(bms[i]);
    i++;
  }
  let sib = null;
  if (bms[i] && bms[i].type === "sibling") {
    sib = bms[i];
    i++;
  }
  const downs = [];
  while (bms[i] && bms[i].type === "child") {
    downs.push(bms[i]);
    i++;
  }
  if (i !== bms.length) return null; // 비정규 체인
  if (!sib && ups.length > 0 && downs.length > 0) return null; // 모호
  return { ups, sib, downs };
}

const GEN_UP = ["", "할", "증조할", "고조할"]; // index = up steps above parent

// 순수 직계/방계 혈연 호칭
function nameBlood(myGender, bms) {
  const st = parseBloodStruct(bms);
  if (!st) return null;
  const { ups, sib, downs } = st;
  const U = ups.length;
  const D = downs.length;
  const firstUp = U > 0 ? ups[0].gender : null;
  const maternal = firstUp === "F"; // 외가 여부
  const 외 = maternal ? "외" : "";

  // 본인
  if (U === 0 && D === 0 && !sib) return { name: "본인 (나)" };

  /* ----- 순수 직계 존속 (위로만) ----- */
  if (!sib && U > 0 && D === 0) {
    const tg = ups[U - 1].gender;
    if (U === 1) return { name: tg === "M" ? "아버지" : "어머니" };
    const base = GEN_UP[U - 1] || `${U - 1}대조할`;
    const tail = tg === "M" ? "아버지" : "어머니";
    return { name: `${외}${base}${tail}` };
  }

  /* ----- 순수 직계 비속 (아래로만) ----- */
  if (!sib && U === 0 && D > 0) {
    const tg = downs[D - 1].gender;
    if (D === 1) return { name: tg === "M" ? "아들" : "딸" };
    if (D === 2) return { name: tg === "M" ? "손자" : "손녀" };
    if (D === 3) return { name: tg === "M" ? "증손자" : "증손녀" };
    if (D === 4) return { name: tg === "M" ? "고손자(현손)" : "고손녀" };
    return { name: `${D}대손` };
  }

  /* ----- 방계 (형제 분기 포함) ----- */
  if (sib) {
    const tg = D > 0 ? downs[D - 1].gender : sib.gender;

    // 2촌: 나의 형제자매
    if (U === 0 && D === 0) {
      if (sib.gender === "M") return { name: sib.older ? (myGender === "M" ? "형" : "오빠") : "남동생" };
      return { name: sib.older ? (myGender === "M" ? "누나" : "언니") : "여동생" };
    }

    // U=0, 아래로: 형제의 자손 (조카 계열)
    if (U === 0 && D >= 1) {
      if (D === 1) return { name: tg === "M" ? "조카" : "조카딸 (질녀)" };
      if (D === 2) return { name: tg === "M" ? "종손자" : "종손녀" };
      return { name: `${D + 1}촌 조카의 자손` };
    }

    // U=1: 부모의 형제자매 및 그 자손
    if (U === 1) {
      if (D === 0) {
        // 3촌: 삼촌/고모/외삼촌/이모
        if (!maternal) {
          if (sib.gender === "M") return { name: sib.older ? "큰아버지 (백부)" : "작은아버지 (숙부)", sub: "미혼이면 흔히 삼촌" };
          return { name: "고모" };
        } else {
          if (sib.gender === "M") return { name: "외삼촌 (외숙)" };
          return { name: "이모" };
        }
      }
      if (D === 1) {
        // 4촌: 사촌 계열
        let kind;
        if (!maternal) kind = sib.gender === "M" ? "친사촌" : "고종사촌";
        else kind = sib.gender === "M" ? "외사촌" : "이종사촌";
        return { name: `${kind} (4촌)`, sub: tg === "M" ? "사촌 형제" : "사촌 자매" };
      }
      if (D === 2) return { name: `5촌 조카뻘 (당질)` };
    }

    // U=2: 조부모의 형제자매 및 그 자손
    if (U === 2) {
      if (D === 0) return { name: `${외}종조부모 (4촌)`, sub: tg === "M" ? "종조할아버지" : "종조할머니" };
      if (D === 1) return { name: `5촌 (당숙·당고모뻘)` };
      if (D === 2) return { name: `재종형제 (6촌)` };
    }

    // 그 밖의 방계: 촌수만
    const chon = U + D + 2;
    return { name: `${chon}촌 (방계 혈족)` };
  }
  return null;
}

// 괄호 보조설명 제거 (조합용)
const cleanName = (s) => (s ? s.replace(/\s*\(.*?\)/g, "").trim() : s);

// 인척 호칭
function nameInlaw(myGender, moves) {
  const idx = moves.findIndex((m) => m.type === "spouse");
  const before = moves.slice(0, idx);
  const after = moves.slice(idx + 1);
  const spouseGender = moves[idx].gender;
  const mySpouseLabel = myGender === "M" ? "아내" : "남편"; // before가 비었을 때 = 내 배우자

  // (A) 내 배우자 쪽 (before 비어 있음)
  if (before.length === 0) {
    if (after.length === 0) return { name: myGender === "M" ? "아내 (배우자)" : "남편 (배우자)" };
    const st = parseBloodStruct(after);
    if (st) {
      const { ups, sib, downs } = st;
      // 배우자의 부모
      if (ups.length === 1 && !sib && downs.length === 0) {
        const g = ups[0].gender;
        if (myGender === "F") return { name: g === "M" ? "시아버지" : "시어머니" };
        return { name: g === "M" ? "장인 (어른)" : "장모 (어른)" };
      }
      // 배우자의 형제자매
      if (ups.length === 0 && sib && downs.length === 0) {
        if (myGender === "F") {
          if (sib.gender === "M") return { name: sib.older ? "아주버님" : "도련님 / 서방님", sub: "미혼이면 도련님" };
          return { name: sib.older ? "형님" : "아가씨" };
        } else {
          if (sib.gender === "M") return { name: "처남" };
          return { name: sib.older ? "처형" : "처제" };
        }
      }
    }
    // 그 밖: 배우자 기준 혈족 호칭으로 서술 (예: 남편의 외삼촌)
    const q = nameBlood(spouseGender, after);
    if (q && q.name) {
      const base = cleanName(q.name);
      const si = myGender === "F" ? `흔히 ‘시${base}’처럼 부르기도 해요` : null;
      return { name: `${mySpouseLabel}의 ${base}`, sub: si };
    }
    return { name: "배우자의 친척", sub: "세부 호칭은 관계에 따라 달라요" };
  }

  // (B) 혈족의 배우자 (after 비어 있음)
  if (after.length === 0) {
    const st = parseBloodStruct(before);
    if (st) {
      const { ups, sib, downs } = st;
      // 형제자매의 배우자
      if (ups.length === 0 && sib && downs.length === 0) {
        if (sib.gender === "M") {
          if (sib.older) return { name: myGender === "M" ? "형수(님)" : "새언니 (올케)" };
          return { name: myGender === "M" ? "제수(씨)" : "올케" };
        } else {
          if (sib.older) return { name: myGender === "M" ? "매형 (자형)" : "형부" };
          return { name: myGender === "M" ? "매제 (매부)" : "제부" };
        }
      }
      // 자녀의 배우자
      if (ups.length === 0 && !sib && downs.length === 1) {
        return { name: downs[0].gender === "M" ? "며느리" : "사위" };
      }
      // 부모 형제자매의 배우자
      if (ups.length === 1 && sib && downs.length === 0) {
        const maternal = ups[0].gender === "F";
        if (!maternal) {
          if (sib.gender === "M") return { name: sib.older ? "큰어머니 (백모)" : "작은어머니 (숙모)" };
          return { name: "고모부" };
        } else {
          if (sib.gender === "M") return { name: "외숙모" };
          return { name: "이모부" };
        }
      }
    }
    // 그 밖: 내 혈족 호칭 + 배우자로 서술 (예: 사촌의 아내)
    const p = nameBlood(myGender, before);
    if (p && p.name) {
      return { name: `${cleanName(p.name)}의 ${spouseGender === "M" ? "남편" : "아내"}`, sub: "혈족의 배우자예요" };
    }
    return { name: "혈족의 배우자", sub: "세부 호칭은 관계에 따라 달라요" };
  }

  // (C) 복합 인척 (사돈 등): 양쪽을 모두 서술
  const p2 = nameBlood(myGender, before);
  const q2 = nameBlood(spouseGender, after);
  if (p2 && p2.name && q2 && q2.name) {
    return { name: `${cleanName(p2.name)}의 ${spouseGender === "M" ? "남편" : "아내"} 쪽 ${cleanName(q2.name)}`, sub: "먼 인척(사돈 포함) 관계예요" };
  }
  return { name: "인척", sub: "복합 인척 관계예요" };
}

// 메인 판정 함수
function analyze(myGender, chainKeys) {
  const moves = buildMoves(myGender, chainKeys);
  if (moves.length === 0) return null;
  const { chon, inlaw } = computeChon(myGender, moves);
  const hasSpouse = moves.some((m) => m.type === "spouse");
  let res;
  if (hasSpouse) res = nameInlaw(myGender, moves);
  else res = nameBlood(myGender, moves);

  // 호칭 폴백 (정규 문법으로 안 떨어지는 우회 입력 대비)
  let name = res?.name;
  let sub = res?.sub || null;
  if (!name) {
    const targetGender = moves[moves.length - 1].gender;
    if (chon === 0 && !inlaw) {
      name = "본인 (나)";
    } else if (chon === 0 && inlaw) {
      name = targetGender === "M" ? "남편 (배우자)" : "아내 (배우자)";
    } else {
      name = `${chon}촌 (${inlaw ? "인척" : "혈족"})`;
      sub = "표준 호칭이 정해지지 않은 관계예요";
    }
  }

  const inRange = inlaw ? chon <= 4 : chon <= 8;
  return { moves, chon, inlaw, name, sub, inRange };
}

/* =========================================================================
   UI
   ========================================================================= */

const PALETTE = {
  paper: "#f3ead9",
  paper2: "#ece0c8",
  ink: "#23303f",
  inkSoft: "#4c5a68",
  seal: "#b23b2e",
  sealDark: "#8f2d23",
  gold: "#a8843e",
  line: "#cdbfa3",
};

const PRESETS = [
  { label: "아버지의 형의 아들", gender: "M", keys: ["father", "obro", "son"] },
  { label: "어머니의 남동생", gender: "M", keys: ["mother", "ybro"] },
  { label: "아버지의 누나", gender: "F", keys: ["father", "osis"] },
  { label: "아내의 아버지", gender: "M", keys: ["spouse", "father"] },
  { label: "형의 아내", gender: "M", keys: ["obro", "spouse"] },
];

export default function ChonsuCalculator() {
  const [myGender, setMyGender] = useState("M");
  const [chain, setChain] = useState(["father"]);

  // 각 슬롯의 컨텍스트 성별
  const contextGenders = useMemo(() => {
    const arr = [myGender];
    let cur = myGender;
    for (const key of chain) {
      const opt = resolveOption(key, cur);
      cur = opt ? opt.gender : cur;
      arr.push(cur);
    }
    return arr;
  }, [myGender, chain]);

  const result = useMemo(() => analyze(myGender, chain), [myGender, chain]);

  const updateSlot = (i, key) => {
    const next = [...chain];
    next[i] = key;
    setChain(next);
  };
  const addSlot = () => {
    const lastGender = contextGenders[chain.length];
    setChain([...chain, optionsFor(lastGender)[0].key]);
  };
  const removeSlot = (i) => {
    if (chain.length <= 1) return;
    setChain(chain.filter((_, idx) => idx !== i));
  };
  const applyPreset = (p) => {
    setMyGender(p.gender);
    setChain(p.keys);
  };

  const sealFont = { fontFamily: "'Gowun Batang','Nanum Myeongjo',serif" };
  const bodyFont = { fontFamily: "'Nanum Myeongjo','Apple SD Gothic Neo',serif" };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at 20% 0%, ${PALETTE.paper} 0%, ${PALETTE.paper2} 100%)`,
        color: PALETTE.ink,
        ...bodyFont,
        padding: "0",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Nanum+Myeongjo:wght@400;700;800&display=swap');
        .fade-up { animation: fadeUp .5s ease both; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(8px);} to {opacity:1; transform:none;} }
        .stamp { animation: stamp .45s cubic-bezier(.2,1.4,.4,1) both; }
        @keyframes stamp { 0%{opacity:0; transform: scale(1.6) rotate(-8deg);} 60%{opacity:1;} 100%{opacity:1; transform:none;} }
        select.chon-sel:focus { outline: 2px solid ${PALETTE.seal}; }
        .grain::before {
          content:""; position:absolute; inset:0; pointer-events:none; opacity:.04;
          background-image: radial-gradient(${PALETTE.ink} 1px, transparent 1px);
          background-size: 4px 4px;
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* 헤더 */}
        <div className="fade-up" style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-block",
              border: `2px solid ${PALETTE.seal}`,
              color: PALETTE.seal,
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 13,
              letterSpacing: 4,
              marginBottom: 14,
              ...sealFont,
            }}
          >
            寸 數
          </div>
          <h1 style={{ ...sealFont, fontSize: 38, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.1 }}>
            촌수 계산기
          </h1>
          <p style={{ color: PALETTE.inkSoft, fontSize: 15, margin: 0 }}>
            나로부터 관계를 이어 붙이면 촌수와 호칭을 알려드려요
          </p>
        </div>

        {/* 성별 선택 */}
        <div className="fade-up" style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 26 }}>
          <span style={{ alignSelf: "center", color: PALETTE.inkSoft, fontSize: 14 }}>나는</span>
          {[
            { v: "M", t: "남자" },
            { v: "F", t: "여자" },
          ].map((g) => (
            <button
              key={g.v}
              onClick={() => setMyGender(g.v)}
              style={{
                ...sealFont,
                cursor: "pointer",
                padding: "8px 22px",
                borderRadius: 30,
                fontSize: 15,
                fontWeight: 700,
                border: `1.5px solid ${myGender === g.v ? PALETTE.seal : PALETTE.line}`,
                background: myGender === g.v ? PALETTE.seal : "transparent",
                color: myGender === g.v ? "#fff" : PALETTE.inkSoft,
                transition: "all .2s",
              }}
            >
              {g.t}
            </button>
          ))}
        </div>

        {/* 체인 빌더 */}
        <div
          className="grain fade-up"
          style={{
            position: "relative",
            background: "rgba(255,255,255,0.45)",
            border: `1px solid ${PALETTE.line}`,
            borderRadius: 16,
            padding: "26px 22px",
            boxShadow: "0 8px 30px rgba(35,48,63,0.08)",
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, lineHeight: 2 }}>
            <span style={{ ...sealFont, fontSize: 20, fontWeight: 700 }}>나의</span>
            {chain.map((key, i) => {
              const opts = optionsFor(contextGenders[i]);
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                    <select
                      className="chon-sel"
                      value={key}
                      onChange={(e) => updateSlot(i, e.target.value)}
                      style={{
                        ...sealFont,
                        appearance: "none",
                        cursor: "pointer",
                        fontSize: 18,
                        fontWeight: 700,
                        color: PALETTE.ink,
                        background: PALETTE.paper,
                        border: `1.5px solid ${PALETTE.gold}`,
                        borderRadius: 10,
                        padding: "7px 30px 7px 14px",
                      }}
                    >
                      {opts.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span style={{ position: "absolute", right: 11, pointerEvents: "none", color: PALETTE.gold, fontSize: 11 }}>
                      ▼
                    </span>
                    {chain.length > 1 && (
                      <button
                        onClick={() => removeSlot(i)}
                        title="삭제"
                        style={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          border: "none",
                          background: PALETTE.seal,
                          color: "#fff",
                          fontSize: 12,
                          lineHeight: "20px",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                  <span style={{ ...sealFont, fontSize: 18, color: PALETTE.inkSoft }}>의</span>
                </span>
              );
            })}
            <button
              onClick={addSlot}
              style={{
                ...sealFont,
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                color: PALETTE.gold,
                background: "transparent",
                border: `1.5px dashed ${PALETTE.gold}`,
                borderRadius: 10,
                padding: "7px 14px",
              }}
            >
              + 관계
            </button>
            <span style={{ ...sealFont, fontSize: 20, fontWeight: 700 }}>은(는)?</span>
          </div>
        </div>

        {/* 결과 */}
        {result && (
          <div
            key={result.name + result.chon}
            className="fade-up"
            style={{
              background: PALETTE.ink,
              borderRadius: 18,
              padding: "30px 26px",
              color: PALETTE.paper,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, letterSpacing: 2, color: PALETTE.gold, marginBottom: 6 }}>
                  {result.chon === 0 ? "본인" : `${result.inlaw ? "인척" : "혈족"}`}
                </div>
                <div style={{ ...sealFont, fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>{result.name}</div>
                {result.sub && (
                  <div style={{ fontSize: 14, color: PALETTE.line, marginTop: 8 }}>{result.sub}</div>
                )}
              </div>
              {result.chon > 0 && (
                <div
                  className="stamp"
                  style={{
                    flexShrink: 0,
                    width: 86,
                    height: 86,
                    borderRadius: 14,
                    border: `3px solid ${PALETTE.seal}`,
                    color: PALETTE.seal,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(178,59,46,0.08)",
                    ...sealFont,
                  }}
                >
                  <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{result.chon}</span>
                  <span style={{ fontSize: 14, marginTop: 2 }}>촌</span>
                </div>
              )}
            </div>

            {!result.inRange && (
              <div
                style={{
                  marginTop: 18,
                  fontSize: 13,
                  color: PALETTE.line,
                  borderTop: `1px solid rgba(255,255,255,0.15)`,
                  paddingTop: 12,
                }}
              >
                ※ 민법상 친족 범위(혈족 8촌·인척 4촌)를 벗어나는 관계예요.
              </div>
            )}
          </div>
        )}

        {/* 예시 */}
        <div className="fade-up" style={{ marginTop: 30 }}>
          <div style={{ fontSize: 13, color: PALETTE.inkSoft, marginBottom: 10, letterSpacing: 1 }}>예시로 시작하기</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                style={{
                  cursor: "pointer",
                  fontSize: 13,
                  color: PALETTE.ink,
                  background: "rgba(255,255,255,0.5)",
                  border: `1px solid ${PALETTE.line}`,
                  borderRadius: 20,
                  padding: "6px 14px",
                  ...bodyFont,
                }}
              >
                {p.gender === "M" ? "♂ " : "♀ "}
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 34, fontSize: 12, color: PALETTE.inkSoft, textAlign: "center", lineHeight: 1.7 }}>
          촌수는 부모–자식을 1촌으로 보는 세수등친제를 따릅니다.<br />
          호칭은 표준 관계를 기준으로 하며, 지역·가풍에 따라 달리 부를 수 있어요.
        </div>
      </div>
    </div>
  );
}
