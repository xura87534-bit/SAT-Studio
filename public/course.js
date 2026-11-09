/* SAT Studio: 90-Day Course.
   A locked learning path: each lesson explains a topic, then gives a quiz with fresh numbers.
   The next lesson unlocks only after a 100% score. Progress is saved in SETTINGS.course.
   Uses the app's globals at call time: shell, esc, $, $$, SETTINGS, persist, go, view, bindCommon. */
(function () {
"use strict";

/* ---------- small helpers ---------- */
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const nz = (a, b) => { let x; do x = ri(a, b); while (x === 0); return x; };
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const isInt = x => Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9;
const num = x => { x = Math.round(x * 10000) / 10000; return String(Math.abs(x)); };
const N = x => { x = Math.round(x * 10000) / 10000; return x < 0 ? "−" + num(x) : num(x); };
const P = x => x < 0 ? "(" + N(x) + ")" : N(x);
const F = (n, d) => { if (d === 0) return "NaN"; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); n /= g; d /= g; return d === 1 ? N(n) : (n < 0 ? "−" : "") + Math.abs(n) + "/" + d; };
const piF = (n, d) => { const g = gcd(n, d); n /= g; d /= g; const top = n === 1 ? "π" : n + "π"; return d === 1 ? top : top + "/" + d; };
const poly = ts => { let s = ""; for (const [c, v] of ts) { if (!c) continue; const a = Math.abs(c), co = v && a === 1 ? "" : num(a); if (!s) s = (c < 0 ? "−" : "") + co + v; else s += (c < 0 ? " − " : " + ") + co + v; } return s || "0"; };
const lin = (m, b, v = "x") => poly([[m, v], [b, ""]]);
const quad = (a, b, c) => poly([[a, "x²"], [b, "x"], [c, ""]]);
const sg = n => n < 0 ? "− " + Math.abs(n) : "+ " + n;
const pt = (a, b) => "(" + N(a) + ", " + N(b) + ")";
const xp = (b, e) => b + "<sup>" + e + "</sup>";
const S = v => typeof v === "number" ? N(v) : String(v);
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
const tbl = rows => `<table class="crtbl">${rows.map((r, i) => `<tr>${r.map(c => i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
const fixed = list => () => { const x = pick(list); return { q: x[0], a: x[1], w: x[2], e: x[3] }; };

/* Turn a generator result into a 4-choice question with distinct options. */
function build(gen) {
  for (let t = 0; t < 60; t++) {
    let r; try { r = gen(); } catch (e) { continue; }
    if (!r) continue;
    const A = S(r.a), bad = s => /NaN|Infinity|undefined/.test(s);
    if (bad(A) || bad(r.q)) continue;
    const seen = new Set([A]), ch = [A];
    for (const w of r.w || []) { const s = S(w); if (s && !seen.has(s) && !bad(s)) { seen.add(s); ch.push(s); } if (ch.length === 4) break; }
    if (ch.length < 4 && typeof r.a === "number") {
      for (let k = 1; ch.length < 4 && k < 40; k++) for (const v of [r.a + k, r.a - k]) { const s = S(v); if (!seen.has(s) && ch.length < 4) { seen.add(s); ch.push(s); } }
    }
    if (ch.length < 4) continue;
    const order = shuf([0, 1, 2, 3]);
    return { q: r.q, c: order.map(i => ch[i]), a: order.indexOf(0), e: r.e || "" };
  }
  return null;
}

/* ---------- lesson content ---------- */
const box = h => `<div class="crx">${h}</div>`;
const ex = (t, h) => `<div class="crex"><b>${t}</b>${h}</div>`;
const tip = h => `<div class="crtip"><b>Watch out:</b> ${h}</div>`;

const C = [];   // all course items in order
const M = (m, w, day, kind, id, title, extra) => C.push(Object.assign({ m, w, day, kind, id, title }, extra));

/* ===== MONTH 1: FOUNDATIONS ===== */

M(1, 1, "1", "lesson", "m1d1", "Integers and negative numbers", {
  sum: "Add, subtract, multiply and divide with negative numbers.",
  body: `<p>Integers are whole numbers and their negatives: … −3, −2, −1, 0, 1, 2, 3 … On a number line, numbers get smaller as you move left.</p>
<h3>Adding and subtracting</h3>
<ul><li>Adding a negative is the same as subtracting: 7 + (−3) = 7 − 3 = 4.</li>
<li>Subtracting a negative is the same as adding: 5 − (−4) = 5 + 4 = 9.</li>
<li>With different signs, subtract the sizes and keep the sign of the bigger one: −9 + 4 = −5.</li></ul>
<h3>Multiplying and dividing</h3>
${box("Same signs → positive &nbsp;&nbsp;·&nbsp;&nbsp; Different signs → negative")}
<p>(−6) × (−3) = 18, &nbsp;(−6) × 3 = −18, &nbsp;(−20) ÷ 4 = −5, &nbsp;(−20) ÷ (−4) = 5.</p>
<p>Count the negative signs in a product: an even number gives a positive answer, an odd number gives a negative answer.</p>
${ex("Example", "The temperature is −7°C and rises 12 degrees. New temperature: −7 + 12 = 5°C.")}
${tip("“Two minus signs make a plus” is true for <i>multiplying</i>, not for adding. −3 + (−5) = −8, not 8.")}`,
  gens: [
    () => { const a = nz(-12, 12), b = nz(-12, -1); return { q: `What is ${N(a)} − ${P(b)}?`, a: a - b, w: [a + b, b - a, -(a + b)], e: `Subtracting a negative means adding: ${N(a)} − ${P(b)} = ${N(a)} + ${-b} = ${N(a - b)}.` }; },
    () => { let a = nz(-9, 9), b = nz(-9, 9); if (Math.abs(a) < 2 || Math.abs(b) < 2) return null; if (a > 0 && b > 0) b = -b; return { q: `What is ${P(a)} × ${P(b)}?`, a: a * b, w: [-a * b, a + b, Math.abs(a) + Math.abs(b)], e: `${a * b > 0 ? "Same signs give a positive" : "Different signs give a negative"}: ${P(a)} × ${P(b)} = ${N(a * b)}.` }; },
    () => { const t = ri(3, 15), r = ri(4, 25); return { q: `At 6 a.m. the temperature was −${t}°C. By noon it had risen ${r} degrees. What was the temperature at noon, in °C?`, a: r - t, w: [-t - r, t + r, t - r], e: `Rising means adding: −${t} + ${r} = ${N(r - t)}.` }; },
    () => { let b = nz(-9, 9), q = nz(-9, 9); if (Math.abs(b) < 2 || Math.abs(q) < 2) return null; if (b > 0 && q > 0) q = -q; const a = b * q; return { q: `What is ${N(a)} ÷ ${P(b)}?`, a: q, w: [-q, a + b, a - b], e: `${q > 0 ? "Same signs give a positive" : "Different signs give a negative"}: ${N(a)} ÷ ${P(b)} = ${N(q)}.` }; },
  ],
});

M(1, 1, "2", "lesson", "m1d2", "Order of operations", {
  sum: "Parentheses, exponents, multiplication and division, then addition and subtraction.",
  body: `<p>When an expression has several operations, always do them in this order (often remembered as PEMDAS):</p>
<ol class="crol"><li><b>P</b>arentheses (and other grouping, like a fraction bar)</li><li><b>E</b>xponents and roots</li><li><b>M</b>ultiplication and <b>D</b>ivision, left to right</li><li><b>A</b>ddition and <b>S</b>ubtraction, left to right</li></ol>
${ex("Example 1", "3 + 4 × 5 = 3 + 20 = 23 (multiply before adding, so the answer is not 35).")}
${ex("Example 2", "(2 + 3)² − 4 = 5² − 4 = 25 − 4 = 21.")}
${ex("Example 3", "20 − 12 ÷ 4 = 20 − 3 = 17.")}
${tip("Multiplication does not always come before division. They are done together, left to right: 12 ÷ 3 × 2 = 4 × 2 = 8.")}`,
  gens: [
    () => { const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9); return { q: `What is ${a} + ${b} × ${c}?`, a: a + b * c, w: [(a + b) * c, a * b + c, a + b + c], e: `Multiply first: ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${a + b * c}.` }; },
    () => { const a = ri(1, 5), b = ri(1, 5), c = ri(1, 9); return { q: `What is (${a} + ${b})² − ${c}?`, a: (a + b) ** 2 - c, w: [a * a + b * b - c, (a + b) * 2 - c, (a + b - c) ** 2], e: `Parentheses first: ${a + b}. Then the exponent: ${(a + b) ** 2}. Then subtract: ${(a + b) ** 2} − ${c} = ${(a + b) ** 2 - c}.` }; },
    () => { const d = ri(2, 6), q = ri(2, 8), k = ri(1, 5), a = d * (k + q); return { q: `What is ${a} − ${d * q} ÷ ${d}?`, a: a - q, w: [k, a + q, a - d * q], e: `Divide first: ${d * q} ÷ ${d} = ${q}. Then ${a} − ${q} = ${a - q}.` }; },
    () => { const a = ri(2, 6), b = ri(1, 9); return { q: `What is 2 × ${a}² − ${b}?`, a: 2 * a * a - b, w: [4 * a * a - b, 4 * a - b, 2 * a - b], e: `Exponent first: ${a}² = ${a * a}. Then 2 × ${a * a} = ${2 * a * a}, and ${2 * a * a} − ${b} = ${2 * a * a - b}.` }; },
  ],
});

const fr = () => { const ds = [2, 3, 4, 5, 6, 8]; const b = pick(ds); let d; do d = pick(ds); while (d === b); return [ri(1, b - 1), b, ri(1, d - 1), d]; };
M(1, 1, "3", "lesson", "m1d3", "Fractions: simplifying, adding and subtracting", {
  sum: "Common denominators, simplifying, adding and subtracting fractions.",
  body: `<p>A fraction a/b means a parts out of b equal parts. The bottom number is the <b>denominator</b>, the top number is the <b>numerator</b>.</p>
<h3>Simplifying</h3><p>Divide the top and bottom by their greatest common factor: 12/18 = (12 ÷ 6)/(18 ÷ 6) = 2/3.</p>
<h3>Adding and subtracting</h3>
<p>You can only add fractions that have the same denominator. If they are different, rewrite both with a common denominator first.</p>
${box("a/b + c/d = (a·d + c·b) / (b·d)")}
${ex("Example", "1/4 + 2/3: the common denominator is 12. 1/4 = 3/12 and 2/3 = 8/12, so the sum is 11/12.")}
${ex("Example", "5/6 − 1/4 = 10/12 − 3/12 = 7/12.")}
${tip("Never add the denominators. 1/2 + 1/3 is not 2/5; it is 3/6 + 2/6 = 5/6.")}`,
  gens: [
    () => { const [a, b, c, d] = fr(); return { q: `What is ${a}/${b} + ${c}/${d}? Give the answer in simplest form.`, a: F(a * d + c * b, b * d), w: [F(a + c, b + d), F(a + c, b * d), F(a * d + c * b, b + d)], e: `Use the common denominator ${b * d}: ${a}/${b} = ${a * d}/${b * d} and ${c}/${d} = ${c * b}/${b * d}. The sum is ${a * d + c * b}/${b * d} = ${F(a * d + c * b, b * d)}.` }; },
    () => { const [a, b, c, d] = fr(); return { q: `What is ${a}/${b} − ${c}/${d}? Give the answer in simplest form.`, a: F(a * d - c * b, b * d), w: [F(a - c, b * d), F(c * b - a * d, b * d), F(a * d + c * b, b * d)], e: `Common denominator ${b * d}: ${a * d}/${b * d} − ${c * b}/${b * d} = ${a * d - c * b}/${b * d} = ${F(a * d - c * b, b * d)}.` }; },
    () => { let n, d; do { n = ri(1, 8); d = ri(n + 1, 12); } while (gcd(n, d) !== 1); const g = ri(2, 6); return { q: `Which fraction is ${n * g}/${d * g} in simplest form?`, a: F(n, d), w: [F(n + 1, d), F(n, d + 1), F(d, n)], e: `Divide the top and bottom by ${g}: ${n * g} ÷ ${g} = ${n}, ${d * g} ÷ ${g} = ${d}. So it is ${F(n, d)}.` }; },
    () => { const [a, b, c, d] = fr(); const p = pick(["a pizza", "a cake", "a bag of rice"]); return { q: `Aziz used ${a}/${b} of ${p} and Bek used ${c}/${d} of it. What fraction did they use together?`, a: F(a * d + c * b, b * d), w: [F(a + c, b + d), F(a + c, b * d), F(a * c, b * d)], e: `Add the fractions with the common denominator ${b * d}: ${a * d}/${b * d} + ${c * b}/${b * d} = ${F(a * d + c * b, b * d)}.` }; },
  ],
});

M(1, 1, "4", "lesson", "m1d4", "Fractions: multiplying and dividing", {
  sum: "Multiply straight across, divide by flipping, and mixed numbers.",
  body: `<h3>Multiplying</h3><p>Multiply the numerators together and the denominators together. No common denominator is needed.</p>
${box("a/b × c/d = (a·c)/(b·d)")}
<h3>Dividing</h3><p>Keep the first fraction, change ÷ to ×, and flip the second fraction (use its reciprocal).</p>
${box("a/b ÷ c/d = a/b × d/c = (a·d)/(b·c)")}
<h3>Mixed numbers</h3><p>2 3/4 means 2 + 3/4. To write it as one fraction: 2 × 4 + 3 = 11, so 2 3/4 = 11/4.</p>
<h3>A fraction of a number</h3><p>“3/4 of 48” means 3/4 × 48 = 48 ÷ 4 × 3 = 36.</p>
${ex("Example", "2/3 ÷ 4/5 = 2/3 × 5/4 = 10/12 = 5/6.")}
${tip("Flip only the second fraction, the one you divide by.")}`,
  gens: [
    () => { const [a, b, c, d] = fr(); return { q: `What is ${a}/${b} × ${c}/${d}? Give the answer in simplest form.`, a: F(a * c, b * d), w: [F(a * d, b * c), F(a + c, b + d), F(a * c, b + d)], e: `Multiply across: (${a}·${c})/(${b}·${d}) = ${a * c}/${b * d} = ${F(a * c, b * d)}.` }; },
    () => { const [a, b, c, d] = fr(); return { q: `What is ${a}/${b} ÷ ${c}/${d}? Give the answer in simplest form.`, a: F(a * d, b * c), w: [F(a * c, b * d), F(b * c, a * d), F(a + d, b + c)], e: `Flip the second fraction and multiply: ${a}/${b} × ${d}/${c} = ${a * d}/${b * c} = ${F(a * d, b * c)}.` }; },
    () => { let w0 = ri(1, 5), d, n; do { d = ri(2, 9); n = ri(1, d - 1); } while (gcd(n, d) !== 1); return { q: `Which improper fraction equals ${w0} ${n}/${d}?`, a: `${w0 * d + n}/${d}`, w: [`${w0 * n + d}/${d}`, `${w0 + n}/${d}`, `${w0 * d + n}/${d * w0}`, `${w0 * d - n}/${d}`], e: `Multiply the whole number by the denominator and add the numerator: ${w0} × ${d} + ${n} = ${w0 * d + n}. So ${w0} ${n}/${d} = ${w0 * d + n}/${d}.` }; },
    () => { let a, d; do { d = pick([3, 4, 5, 6, 8]); a = ri(1, d - 1); } while (gcd(a, d) !== 1); const n = d * ri(3, 12); return { q: `What is ${a}/${d} of ${n}?`, a: n * a / d, w: [n / d, n - n * a / d, n * a], e: `${n} ÷ ${d} = ${n / d}, then × ${a} = ${n * a / d}.` }; },
  ],
});

M(1, 1, "5", "lesson", "m1d5", "Decimals and percents", {
  sum: "Convert between fractions, decimals and percents; find a percent of a number.",
  body: `<p><b>Percent</b> means “out of 100”. 35% = 35/100 = 0.35.</p>
<h3>Converting</h3>
${tbl([["Fraction", "Decimal", "Percent"], ["1/2", "0.5", "50%"], ["1/4", "0.25", "25%"], ["3/4", "0.75", "75%"], ["1/5", "0.2", "20%"], ["1/10", "0.1", "10%"], ["1/8", "0.125", "12.5%"]])}
<ul><li>Decimal → percent: multiply by 100 (move the point two places right): 0.07 = 7%.</li>
<li>Percent → decimal: divide by 100: 45% = 0.45.</li>
<li>Fraction → percent: divide, then multiply by 100: 3/8 = 0.375 = 37.5%.</li></ul>
<h3>Percent of a number</h3>
${box("p% of n = (p / 100) × n")}
${ex("Example", "30% of 80 = 0.30 × 80 = 24.")}
${ex("Percent increase", "A $40 item goes up by 25%. New price = 40 × 1.25 = $50. (A 25% decrease would be 40 × 0.75 = $30.)")}
${tip("0.5% is not 0.5. 0.5% = 0.005.")}`,
  gens: [
    () => { let p, n; do { p = pick([5, 10, 15, 20, 25, 30, 40, 50, 75]); n = 20 * ri(1, 20); } while ((p * n) % 100); return { q: `What is ${p}% of ${n}?`, a: p * n / 100, w: [p * n / 10, n + p * n / 100, n - p * n / 100], e: `${p}% = ${p / 100}. ${p / 100} × ${n} = ${p * n / 100}.` }; },
    () => { const [n, d, p] = pick([[1, 4, 25], [3, 4, 75], [1, 5, 20], [2, 5, 40], [3, 5, 60], [4, 5, 80], [1, 8, 12.5], [3, 8, 37.5], [7, 10, 70], [9, 20, 45], [3, 20, 15], [7, 25, 28]]); return { q: `Which percent is equal to ${n}/${d}?`, a: `${p}%`, w: [`${n}${d}%`, `${p / 10}%`, `${100 - p}%`, `${n / d}%`], e: `${n} ÷ ${d} = ${n / d}. Multiply by 100: ${p}%.` }; },
    () => { const k = ri(1, 99), d = k / 100; return { q: `Which percent is equal to ${d.toFixed(2)}?`, a: `${k}%`, w: [`${d.toFixed(2)}%`, `${k / 10}%`, `${k * 10}%`], e: `Multiply by 100 (move the decimal point two places right): ${d.toFixed(2)} = ${k}%.` }; },
    () => { const n = ri(2, 20) * 10, p = pick([10, 20, 25, 50]), up = pick([true, false]); const ans = up ? n * (1 + p / 100) : n * (1 - p / 100); return { q: `A jacket costs $${n}. Its price ${up ? "increases" : "decreases"} by ${p}%. What is the new price, in dollars?`, a: ans, w: [n * p / 100, up ? n * (1 - p / 100) : n * (1 + p / 100), up ? n + p : n - p], e: `${up ? "Increase" : "Decrease"} by ${p}% means multiply by ${up ? 1 + p / 100 : 1 - p / 100}: ${n} × ${up ? 1 + p / 100 : 1 - p / 100} = ${N(ans)}.` }; },
  ],
});

M(1, 1, "6", "lesson", "m1d6", "Exponents and square roots", {
  sum: "Powers, perfect squares, square roots and the sign of a square.",
  body: `<p>An exponent tells you how many times to multiply a number by itself: 2⁴ = 2 × 2 × 2 × 2 = 16.</p>
<p>A <b>square root</b> undoes squaring: √49 = 7 because 7² = 49.</p>
<h3>Learn these squares</h3>
${tbl([["n", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"], ["n²", "1", "4", "9", "16", "25", "36", "49", "64", "81", "100", "121", "144", "169", "196", "225"]])}
<h3>Negative numbers and exponents</h3>
${box("(−3)² = (−3)(−3) = 9 &nbsp;&nbsp;but&nbsp;&nbsp; −3² = −(3²) = −9")}
<p>The exponent only applies to what is directly in front of it. Without parentheses, the minus sign is not squared.</p>
${ex("Example", "√36 + 2³ = 6 + 8 = 14.")}
${tip("2³ is not 2 × 3. 2³ = 8, while 2 × 3 = 6.")}`,
  gens: [
    () => { let a, b; do { a = ri(2, 5); b = ri(2, 4); } while (a === b); return { q: `What is the value of ${xp(a, b)}?`, a: a ** b, w: [a * b, b ** a, a + b], e: `${xp(a, b)} means ${Array(b).fill(a).join(" × ")} = ${a ** b}.` }; },
    () => { const k = ri(2, 15); return { q: `What is √${k * k}?`, a: k, w: [k * 2, k + 1, k * k / 2], e: `${k} × ${k} = ${k * k}, so √${k * k} = ${k}.` }; },
    () => { const a = ri(2, 9), par = pick([true, false]); return par ? { q: `What is the value of (−${a})²?`, a: a * a, w: [-a * a, -2 * a, 2 * a], e: `The parentheses mean the negative is squared: (−${a})(−${a}) = ${a * a}.` } : { q: `What is the value of −${a}²?`, a: -a * a, w: [a * a, -2 * a, 2 * a], e: `Only ${a} is squared: −(${a}²) = −${a * a}.` }; },
    () => { const m = ri(2, 12), n = ri(2, 6); return { q: `What is √${m * m} + ${n}²?`, a: m + n * n, w: [(m + n) ** 2, m * m + n * n, m + 2 * n], e: `√${m * m} = ${m} and ${n}² = ${n * n}, so the sum is ${m + n * n}.` }; },
  ],
});
M(1, 1, "7", "review", "m1d7", "Week 1 review", { from: ["m1d1", "m1d2", "m1d3", "m1d4", "m1d5", "m1d6"], n: 10, sum: "Mixed quiz on numbers, fractions, percents and exponents." });

M(1, 2, "8", "lesson", "m1d8", "Variables and expressions", {
  sum: "Substitute numbers into expressions and evaluate them.",
  body: `<p>A <b>variable</b> is a letter that stands for a number. An <b>expression</b> such as 3x + 2 has no equals sign; you can find its value when you know x.</p>
<h3>Evaluating</h3><ol class="crol"><li>Replace each variable with its value, in parentheses.</li><li>Follow the order of operations.</li></ol>
${ex("Example", "If x = −2, then 3x + 7 = 3(−2) + 7 = −6 + 7 = 1.")}
${ex("Example", "If x = −3, then x² + 4x = (−3)² + 4(−3) = 9 − 12 = −3.")}
<p>3x means 3 × x. When x is negative, the parentheses keep the sign in the right place.</p>
${tip("For x = −3, x² is 9, not −9. Always write (−3)².")}`,
  gens: [
    () => { const x = nz(-5, 6), a = ri(2, 9), b = nz(-9, 9); return { q: `If x = ${N(x)}, what is the value of ${lin(a, b)}?`, a: a * x + b, w: [a + x + b, a * -x + b, a * x - b], e: `${a}(${N(x)}) ${sg(b)} = ${N(a * x)} ${sg(b)} = ${N(a * x + b)}.` }; },
    () => { const x = nz(-4, 5), b = nz(-6, 6); return { q: `If x = ${N(x)}, what is the value of ${poly([[1, "x²"], [b, "x"]])}?`, a: x * x + b * x, w: [-(x * x) + b * x, 2 * x + b * x, x * x - b * x], e: `(${N(x)})² = ${x * x} and ${b}(${N(x)}) = ${N(b * x)}. Total: ${N(x * x + b * x)}.` }; },
    () => { const a = ri(1, 6), b = nz(-5, 5), p = ri(2, 5), q = ri(2, 5); return { q: `If a = ${a} and b = ${N(b)}, what is the value of ${p}a − ${q}b?`, a: p * a - q * b, w: [p * a + q * b, p * b - q * a, (p - q) * (a - b)], e: `${p}(${a}) − ${q}(${N(b)}) = ${p * a} − ${P(q * b)} = ${N(p * a - q * b)}.` }; },
  ],
});

M(1, 2, "9", "lesson", "m1d9", "Like terms and the distributive property", {
  sum: "Combine like terms and multiply out parentheses.",
  body: `<p><b>Like terms</b> have the same variable part. 5x and −2x are like terms; 5x and 5 are not.</p>
<h3>Combining like terms</h3><p>Add the coefficients of like terms: 4x + 3 − x + 6 = (4 − 1)x + (3 + 6) = 3x + 9.</p>
<h3>Distributive property</h3>
${box("a(b + c) = ab + ac")}
${ex("Example", "3(x + 4) = 3x + 12.")}
${ex("Example", "2(x + 5) − 3(x − 1) = 2x + 10 − 3x + 3 = −x + 13.")}
${tip("A minus in front of parentheses changes the sign of <i>every</i> term inside: −3(x − 1) = −3x + 3.")}`,
  gens: [
    () => { let a = ri(2, 9), c = ri(1, 9); if (a === c) c++; const b = nz(-9, 9), d = nz(-9, 9); return { q: `Which expression is equivalent to ${a}x ${sg(b)} − ${c}x ${sg(d)}?`, a: lin(a - c, b + d), w: [lin(a + c, b + d), lin(a - c, b - d), lin(a - c + b + d, 0)], e: `x-terms: ${a}x − ${c}x = ${lin(a - c, 0)}. Numbers: ${N(b)} ${sg(d)} = ${N(b + d)}. Result: ${lin(a - c, b + d)}.` }; },
    () => { let k = ri(2, 6), n = ri(2, 6); if (k === n) n++; const m = ri(1, 8), p = ri(1, 8); return { q: `Which expression is equivalent to ${k}(x + ${m}) − ${n}(x − ${p})?`, a: lin(k - n, k * m + n * p), w: [lin(k - n, k * m - n * p), lin(k + n, k * m + n * p), lin(k - n, m + n * p)], e: `${k}(x + ${m}) = ${lin(k, k * m)}. −${n}(x − ${p}) = ${lin(-n, n * p)}. Combine: ${lin(k - n, k * m + n * p)}.` }; },
    () => { const k = ri(2, 7), a = ri(2, 6), b = ri(1, 9); return { q: `Which expression is equivalent to ${k}(${a}x − ${b})?`, a: lin(k * a, -k * b), w: [lin(k * a, -b), lin(a, -k * b), lin(k + a, -k * b)], e: `Multiply ${k} by each term: ${k}·${a}x = ${k * a}x and ${k}·(−${b}) = −${k * b}.` }; },
  ],
});

M(1, 2, "10", "lesson", "m1d10", "One-step equations", {
  sum: "Solve equations with one inverse operation.",
  body: `<p>An equation says two things are equal. To solve it, get x alone by doing the <b>opposite</b> operation to both sides.</p>
${tbl([["Equation", "Undo it by", "Answer"], ["x + 5 = 12", "subtracting 5", "x = 7"], ["x − 4 = 9", "adding 4", "x = 13"], ["3x = 21", "dividing by 3", "x = 7"], ["x / 4 = 6", "multiplying by 4", "x = 24"]])}
<p>Whatever you do to one side, you must do to the other side, so the equation stays balanced.</p>
${ex("Check your answer", "Put it back in: if 3x = 21 and x = 7, then 3(7) = 21. ✓")}
${tip("−5x = 20 gives x = −4: divide by −5, including the sign.")}`,
  gens: [
    () => { const a = nz(-12, 12), x = nz(-15, 15), b = x + a; return { q: `If x ${sg(a)} = ${N(b)}, what is x?`, a: x, w: [b + a, a - b, b], e: `Subtract ${N(a)} from both sides: x = ${N(b)} − ${P(a)} = ${N(x)}.` }; },
    () => { const x = nz(-12, 12); let a = nz(-9, 9); if (Math.abs(a) < 2) a = 3; const b = a * x; return { q: `If ${N(a)}x = ${N(b)}, what is x?`, a: x, w: [b - a, b * a, -x], e: `Divide both sides by ${N(a)}: x = ${N(b)} ÷ ${P(a)} = ${N(x)}.` }; },
    () => { const a = ri(2, 9), b = nz(-9, 9); return { q: `If x/${a} = ${N(b)}, what is x?`, a: a * b, w: [a + b, b - a, -a * b], e: `Multiply both sides by ${a}: x = ${a} × ${P(b)} = ${N(a * b)}.` }; },
    () => { const a = ri(1, 15), b = nz(-10, 20); return { q: `If x − ${a} = ${N(b)}, what is x?`, a: b + a, w: [b - a, a - b, -b - a], e: `Add ${a} to both sides: x = ${N(b)} + ${a} = ${N(b + a)}.` }; },
  ],
});

M(1, 2, "11", "lesson", "m1d11", "Multi-step equations", {
  sum: "Variables on both sides, parentheses, and several steps.",
  body: `<p>For longer equations, follow this order:</p>
<ol class="crol"><li>Remove parentheses (distribute).</li><li>Combine like terms on each side.</li><li>Move all x-terms to one side and all numbers to the other.</li><li>Divide by the coefficient of x.</li></ol>
${ex("Example", "5x − 3 = 2x + 9 → subtract 2x: 3x − 3 = 9 → add 3: 3x = 12 → divide by 3: x = 4.")}
${ex("Example", "4(x − 2) = 20 → 4x − 8 = 20 → 4x = 28 → x = 7.")}
${tip("When you move a term across the equals sign, its sign changes because you are subtracting (or adding) it on both sides.")}`,
  gens: [
    () => { const x = nz(-9, 9), a = ri(2, 9); let c = nz(-6, 8); if (c === a) c = a - 1 || -1; const b = nz(-15, 15), d = a * x + b - c * x; const w1 = (d + b) / (a - c); return { q: `If ${lin(a, b)} = ${lin(c, d)}, what is x?`, a: x, w: [-x, isInt(w1) ? w1 : x + 2, x + 1], e: `Move x-terms left and numbers right: ${a}x − ${P(c)}x = ${N(d)} − ${P(b)}, so ${N(a - c)}x = ${N(d - b)} and x = ${N(x)}.` }; },
    () => { const x = nz(-8, 10), k = ri(2, 6), m = nz(-7, 7), n = k * (x + m); return { q: `If ${k}(x ${sg(m)}) = ${N(n)}, what is x?`, a: x, w: [x + 2 * m, n - m, x + m], e: `Distribute: ${lin(k, k * m)} = ${N(n)}. Then ${k}x = ${N(n - k * m)}, so x = ${N(x)}. (Or divide by ${k} first: x ${sg(m)} = ${N(x + m)}.)` }; },
  ],
});

M(1, 2, "12", "lesson", "m1d12", "Equations with fractions", {
  sum: "Clear fractions by multiplying both sides.",
  body: `<p>Fractions make equations look harder, but one step removes them: multiply both sides by the denominator.</p>
${ex("Example", "x/3 + 4 = 10 → subtract 4: x/3 = 6 → multiply by 3: x = 18.")}
${ex("Example", "(x + 2)/5 = 3 → multiply by 5: x + 2 = 15 → x = 13.")}
${ex("Cross-multiplying", "x/6 = 2/3 → 3x = 12 → x = 4.")}
${box("If a/b = c/d, then a·d = b·c")}
${tip("In (x + 2)/5, the 5 divides the whole top, so multiply by 5 before you subtract 2.")}`,
  gens: [
    () => { const a = ri(2, 9), x = a * nz(-6, 8), b = nz(-9, 9), c = x / a + b; return { q: `If x/${a} ${sg(b)} = ${N(c)}, what is x?`, a: x, w: [x / a, a * (c + b), a * c - b], e: `Subtract ${N(b)}: x/${a} = ${N(c - b)}. Multiply by ${a}: x = ${N(x)}.` }; },
    () => { const a = ri(2, 9), c = nz(-6, 9), b = nz(-9, 9); return { q: `If (x ${sg(b)})/${a} = ${N(c)}, what is x?`, a: a * c - b, w: [a * c + b, a * (c - b), c - b], e: `Multiply by ${a}: x ${sg(b)} = ${N(a * c)}. Then x = ${N(a * c - b)}.` }; },
    () => { const d = ri(2, 6), k = ri(2, 5), c = ri(1, 9), a = d * k; return { q: `If x/${a} = ${c}/${d}, what is x?`, a: k * c, w: [c * d, k + c, a * d / c], e: `Cross-multiply: ${d}x = ${a} × ${c} = ${a * c}, so x = ${k * c}.` }; },
  ],
});

M(1, 2, "13", "lesson", "m1d13", "Turning words into equations", {
  sum: "Translate word problems into equations and solve them.",
  body: `<p>Most SAT questions are word problems. Translate the words into math one phrase at a time.</p>
${tbl([["Words", "Math"], ["is, equals, will be", "="], ["more than, increased by, total", "+"], ["less than, decreased by, fewer", "−"], ["times, of, twice (2×), triple (3×)", "×"], ["per, each, divided by", "÷ (or a rate)"]])}
<ol class="crol"><li>Name the unknown: let x = …</li><li>Write the equation.</li><li>Solve and check that the answer makes sense.</li></ol>
${ex("Example", "Three times a number minus 5 is 22. → 3x − 5 = 22 → 3x = 27 → x = 9.")}
${ex("Example", "Ali has 4 times as many books as Bek. Together they have 45. → x + 4x = 45 → x = 9 (Bek), Ali has 36.")}
${tip("“5 less than x” is x − 5, not 5 − x.")}`,
  gens: [
    () => { const a = ri(3, 20), x = ri(2, 40); return { q: `A number increased by ${a} is ${x + a}. What is the number?`, a: x, w: [x + 2 * a, a, x + a], e: `x + ${a} = ${x + a}, so x = ${x}.` }; },
    () => { const k = ri(2, 5), x = ri(2, 15), a = ri(1, 12), b = k * x - a; const word = { 2: "Twice", 3: "Three times", 4: "Four times", 5: "Five times" }[k]; const w1 = (b - a) / k; return { q: `${word} a number minus ${a} is ${b}. What is the number?`, a: x, w: [isInt(w1) ? w1 : x - 1, b + a, k * b - a], e: `${k}x − ${a} = ${b} → ${k}x = ${b + a} → x = ${x}.` }; },
    () => { const B = ri(3, 20), k = ri(2, 5), T = B * (k + 1); return { q: `Dilnoza has ${k} times as many stamps as Kamola. Together they have ${T} stamps. How many stamps does Kamola have?`, a: B, w: [isInt(T / k) ? T / k : B + k, k * B, T - k], e: `Let Kamola have x. Then x + ${k}x = ${T}, so ${k + 1}x = ${T} and x = ${B}.` }; },
    () => { const p = ri(5, 15), f = ri(2, 9), n0 = ri(2, 8), T = p * n0 + f; return { q: `Movie tickets cost $${p} each, plus a one-time $${f} booking fee. Sardor paid $${T} in total for n tickets. Which equation can be used to find n?`, a: `${p}n + ${f} = ${T}`, w: [`${f}n + ${p} = ${T}`, `${p}(n + ${f}) = ${T}`, `${p}n − ${f} = ${T}`], e: `Each ticket costs ${p}, so n tickets cost ${p}n. Add the one-time fee: ${p}n + ${f} = ${T}.` }; },
  ],
});
M(1, 2, "14", "review", "m1d14", "Week 2 review", { from: ["m1d8", "m1d9", "m1d10", "m1d11", "m1d12", "m1d13"], n: 10, sum: "Mixed quiz on expressions and equations." });

M(1, 3, "15", "lesson", "m1d15", "The coordinate plane", {
  sum: "Points, quadrants, reflections and distances on the plane.",
  body: `<p>A point (x, y) is found by moving x units left or right, then y units up or down from the origin (0, 0).</p>
${tbl([["Quadrant", "x", "y"], ["I (top right)", "+", "+"], ["II (top left)", "−", "+"], ["III (bottom left)", "−", "−"], ["IV (bottom right)", "+", "−"]])}
<ul><li>Points on the x-axis have y = 0; points on the y-axis have x = 0.</li>
<li>Reflect over the x-axis: (a, b) → (a, −b). Reflect over the y-axis: (a, b) → (−a, b).</li>
<li>Two points with the same y are on a horizontal line; the distance between them is the difference of their x-values.</li></ul>
${ex("Example", "The distance from (−3, 4) to (5, 4) is 5 − (−3) = 8.")}
${tip("The x-coordinate always comes first.")}`,
  gens: [
    () => { const a = nz(-9, 9), b = nz(-9, 9); const Q = a > 0 ? (b > 0 ? "I" : "IV") : (b > 0 ? "II" : "III"); return { q: `In which quadrant is the point ${pt(a, b)}?`, a: `Quadrant ${Q}`, w: ["I", "II", "III", "IV"].filter(x => x !== Q).map(x => `Quadrant ${x}`), e: `x is ${a > 0 ? "positive" : "negative"} and y is ${b > 0 ? "positive" : "negative"}, so the point is in Quadrant ${Q}.` }; },
    () => { const a = nz(-9, 9), b = nz(-9, 9), ax = pick(["x", "y"]); const ans = ax === "x" ? pt(a, -b) : pt(-a, b); return { q: `The point ${pt(a, b)} is reflected over the ${ax}-axis. What are the coordinates of the new point?`, a: ans, w: [ax === "x" ? pt(-a, b) : pt(a, -b), pt(-a, -b), pt(b, a)], e: `Reflecting over the ${ax}-axis changes the sign of the ${ax === "x" ? "y" : "x"}-coordinate: ${ans}.` }; },
    () => { const a = nz(-9, 6), c = a + ri(2, 12), y = nz(-8, 8); return { q: `What is the distance between ${pt(a, y)} and ${pt(c, y)}?`, a: c - a, w: [Math.abs(a) + Math.abs(c) === c - a ? Math.abs(c + a) : Math.abs(a) + Math.abs(c), Math.abs(y), c + a], e: `Both points have y = ${N(y)}, so subtract the x-values: ${N(c)} − ${P(a)} = ${c - a}.` }; },
  ],
});

M(1, 3, "16", "lesson", "m1d16", "Slope", {
  sum: "Rise over run, and what positive, negative and zero slope mean.",
  body: `<p><b>Slope</b> measures how steep a line is: how much y changes when x increases by 1.</p>
${box("slope m = (y₂ − y₁) / (x₂ − x₁) = rise / run")}
${ex("Example", "Through (1, 2) and (4, 11): m = (11 − 2)/(4 − 1) = 9/3 = 3.")}
<ul><li>Positive slope: the line goes up from left to right.</li><li>Negative slope: the line goes down.</li><li>Horizontal line (y = k): slope 0.</li><li>Vertical line (x = k): slope is undefined.</li></ul>
${tip("Keep the same order on top and bottom: (y₂ − y₁) with (x₂ − x₁). Don't flip it to run/rise.")}`,
  gens: [
    () => { const x1 = nz(-6, 6), y1 = nz(-8, 8); let x2 = x1 + nz(-6, 6), y2 = y1 + nz(-9, 9); return { q: `What is the slope of the line through ${pt(x1, y1)} and ${pt(x2, y2)}?`, a: F(y2 - y1, x2 - x1), w: [F(x2 - x1, y2 - y1), F(y1 - y2, x2 - x1), F(y2 + y1, x2 + x1)], e: `m = (${N(y2)} − ${P(y1)}) / (${N(x2)} − ${P(x1)}) = ${N(y2 - y1)}/${N(x2 - x1)} = ${F(y2 - y1, x2 - x1)}.` }; },
    fixed([
      ["What is the slope of the line y = 4?", "0", ["Undefined", "4", "1"], "y = 4 is a horizontal line. y never changes, so the slope is 0."],
      ["What is the slope of the line x = −3?", "Undefined", ["0", "−3", "1"], "x = −3 is a vertical line. The run is 0, and you cannot divide by 0, so the slope is undefined."],
      ["A line goes down from left to right. Its slope is:", "Negative", ["Positive", "Zero", "Undefined"], "When y decreases as x increases, the slope is negative."],
      ["A line goes up from left to right. Its slope is:", "Positive", ["Negative", "Zero", "Undefined"], "When y increases as x increases, the slope is positive."],
    ]),
    () => { const r = ri(1, 9), h = ri(r + 1, 24); return { q: `A ramp rises ${r} feet over a horizontal distance of ${h} feet. What is the slope of the ramp?`, a: F(r, h), w: [F(h, r), F(r, r + h), F(h - r, h)], e: `Slope = rise/run = ${r}/${h} = ${F(r, h)}.` }; },
  ],
});

M(1, 3, "17", "lesson", "m1d17", "Slope-intercept form: y = mx + b", {
  sum: "Read the slope and y-intercept from an equation and use it.",
  body: `${box("y = mx + b &nbsp;&nbsp;→&nbsp;&nbsp; m = slope, &nbsp;b = y-intercept (where the line crosses the y-axis)")}
${ex("Example", "y = −2x + 5 has slope −2 and crosses the y-axis at (0, 5).")}
<h3>Rewriting into this form</h3><p>If the equation is not solved for y, solve it first: 3y = 6x − 9 → y = 2x − 3, so the slope is 2.</p>
<h3>Finding a point</h3><p>Plug in x: for y = 2x − 3 and x = 4, y = 2(4) − 3 = 5, so (4, 5) is on the line.</p>
${tip("The y-intercept is a point on the y-axis, so its x-coordinate is 0: (0, b), not (b, 0).")}`,
  gens: [
    () => { const m = nz(-7, 7), b = nz(-9, 9); return pick([true, false]) ? { q: `What is the slope of the line y = ${lin(m, b)}?`, a: m, w: [b, -m, m + b], e: `In y = mx + b, the slope is the coefficient of x: ${N(m)}.` } : { q: `Where does the line y = ${lin(m, b)} cross the y-axis?`, a: pt(0, b), w: [pt(b, 0), pt(0, m), pt(0, -b)], e: `The y-intercept is b = ${N(b)}, at the point ${pt(0, b)}.` }; },
    () => { const m = nz(-5, 5), b = nz(-6, 6), k = ri(2, 5); return { q: `What is the slope of the line ${k}y = ${lin(k * m, k * b)}?`, a: m, w: [k * m, b, k * b], e: `Divide every term by ${k}: y = ${lin(m, b)}. The slope is ${N(m)}.` }; },
    () => { const m = nz(-6, 6), b = nz(-9, 9), t = nz(-5, 5); return { q: `The line y = ${lin(m, b)} passes through a point with x = ${N(t)}. What is the y-coordinate of that point?`, a: m * t + b, w: [m + t + b, m * t - b, (m + b) * t], e: `y = ${N(m)}(${N(t)}) ${sg(b)} = ${N(m * t + b)}.` }; },
  ],
});

M(1, 3, "18", "lesson", "m1d18", "Writing the equation of a line", {
  sum: "Find y = mx + b from two points or from a slope and a point.",
  body: `<ol class="crol"><li>Find the slope m from the two points.</li><li>Put m and one point (x, y) into y = mx + b.</li><li>Solve for b.</li></ol>
${ex("Example", "Through (1, 5) and (3, 11): m = (11 − 5)/(3 − 1) = 3. Then 5 = 3(1) + b, so b = 2. The line is y = 3x + 2.")}
${box("b = y − m·x")}
${ex("Check", "Put the other point in: 3(3) + 2 = 11. ✓")}
${tip("After finding b, always check the equation with the second point.")}`,
  gens: [
    () => { const m = nz(-5, 5), b = nz(-9, 9), x1 = nz(-4, 4), x2 = x1 + ri(1, 4), y1 = m * x1 + b, y2 = m * x2 + b; return { q: `Which equation describes the line through ${pt(x1, y1)} and ${pt(x2, y2)}?`, a: `y = ${lin(m, b)}`, w: [`y = ${lin(-m, b)}`, `y = ${lin(m, -b)}`, `y = ${lin(m, y1 + m * x1)}`, `y = ${lin(b, m)}`], e: `m = (${N(y2)} − ${P(y1)})/(${N(x2)} − ${P(x1)}) = ${N(m)}. b = ${N(y1)} − (${N(m)})(${N(x1)}) = ${N(b)}. So y = ${lin(m, b)}.` }; },
    () => { const m = nz(-6, 6), p = nz(-5, 5), q = nz(-9, 9); return { q: `A line has slope ${N(m)} and passes through ${pt(p, q)}. What is its y-intercept b?`, a: q - m * p, w: [q + m * p, q - p, m * p - q], e: `b = y − m·x = ${N(q)} − (${N(m)})(${N(p)}) = ${N(q - m * p)}.` }; },
  ],
});

const flipOp = o => ({ "<": ">", ">": "<", "≤": "≥", "≥": "≤" })[o];
M(1, 3, "19", "lesson", "m1d19", "Linear inequalities", {
  sum: "Solve inequalities and remember when to flip the sign.",
  body: `<p>Inequalities use &lt; (less than), &gt; (greater than), ≤ (less than or equal) and ≥ (greater than or equal). Solve them like equations, with one extra rule:</p>
${box("Multiplying or dividing by a negative number flips the inequality sign")}
${ex("Example", "2x + 3 &lt; 11 → 2x &lt; 8 → x &lt; 4.")}
${ex("Example", "−3x + 1 ≥ 13 → −3x ≥ 12 → x ≤ −4 (the sign flipped because we divided by −3).")}
<p>An inequality has many solutions. To check whether a value works, plug it in.</p>
${tip("Adding or subtracting a negative number does <i>not</i> flip the sign. Only multiplying or dividing does.")}`,
  gens: [
    () => { let a = nz(-6, 6); if (Math.abs(a) < 2) a = -3; const x0 = nz(-6, 8), b = nz(-10, 10), c = a * x0 + b, op = pick(["<", ">", "≤", "≥"]), o2 = a < 0 ? flipOp(op) : op; return { q: `Which inequality is the solution of ${lin(a, b)} ${op} ${N(c)}?`, a: `x ${o2} ${N(x0)}`, w: [`x ${flipOp(o2)} ${N(x0)}`, `x ${o2} ${N(-x0)}`, `x ${flipOp(o2)} ${N(-x0)}`], e: `Subtract ${N(b)}: ${N(a)}x ${op} ${N(c - b)}. Divide by ${N(a)}${a < 0 ? " (negative, so flip the sign)" : ""}: x ${o2} ${N(x0)}.` }; },
    () => { let a = nz(-6, 6); if (Math.abs(a) < 2) a = 2; const x0 = nz(-6, 8), b = nz(-10, 10), c = a * x0 + b, op = pick(["<", ">"]), o2 = a < 0 ? flipOp(op) : op; const good = o2 === ">" ? x0 + ri(1, 3) : x0 - ri(1, 3), bad = o2 === ">" ? [x0, x0 - 1, x0 - 2] : [x0, x0 + 1, x0 + 2]; return { q: `Which value of x is a solution of ${lin(a, b)} ${op} ${N(c)}?`, a: good, w: bad, e: `Solving gives x ${o2} ${N(x0)}. Only ${N(good)} satisfies this. (x = ${N(x0)} is not included because the inequality is strict.)` }; },
  ],
});

M(1, 3, "20", "lesson", "m1d20", "Systems of lines and the Desmos calculator", {
  sum: "Use graphs (and Desmos) to find where two lines meet.",
  body: `<p>The Digital SAT has the Desmos graphing calculator built in. It is one of the fastest ways to solve many questions.</p>
<h3>How to use it</h3><ol class="crol"><li>Type each equation on its own line, for example y = 2x + 1 and y = −x + 7.</li><li>Click the point where the graphs cross. Desmos shows its coordinates: (2, 5).</li><li>That point is the solution of the system: x = 2, y = 5.</li></ol>
<h3>Number of solutions</h3>
${tbl([["The lines…", "Solutions"], ["cross at one point (different slopes)", "Exactly one"], ["are parallel (same slope, different intercepts)", "None"], ["are the same line", "Infinitely many"]])}
${ex("Without a calculator", "y = 2x + 1 and y = −x + 7: set them equal, 2x + 1 = −x + 7 → 3x = 6 → x = 2, then y = 5.")}
${tip("You can also type an equation like 3x − 5 = 7 into Desmos: it draws a vertical line at the solution x = 4.")}`,
  gens: [
    () => { const x0 = nz(-5, 6), y0 = nz(-8, 8); let a = nz(-4, 4), c = nz(-4, 4); if (a === c) c = a + 1 || 2; const b = y0 - a * x0, d = y0 - c * x0; return { q: `At what point do the lines y = ${lin(a, b)} and y = ${lin(c, d)} intersect?`, a: pt(x0, y0), w: [pt(y0, x0), pt(0, b), pt(-x0, y0), pt(x0, -y0)], e: `Set them equal: ${lin(a, b)} = ${lin(c, d)} → ${N(a - c)}x = ${N(d - b)} → x = ${N(x0)}. Then y = ${N(y0)}. In Desmos, click the crossing point.` }; },
    fixed([
      ["Two distinct lines are parallel. How many solutions does the system of their equations have?", "No solutions", ["Exactly one", "Exactly two", "Infinitely many"], "Parallel lines never meet, so there is no point that solves both equations."],
      ["Two lines have different slopes. How many solutions does the system have?", "Exactly one", ["No solutions", "Exactly two", "Infinitely many"], "Lines with different slopes cross exactly once."],
      ["Two equations graph as the same line. How many solutions does the system have?", "Infinitely many", ["No solutions", "Exactly one", "Exactly two"], "Every point on the line solves both equations."],
      ["In Desmos, the graphs of two equations cross at one point. What does that point represent?", "The solution of the system", ["The slope of each line", "The y-intercepts", "A point on only one of the lines"], "The crossing point lies on both lines, so its (x, y) makes both equations true."],
      ["The system y = 3x + 2 and y = 3x − 5 has how many solutions?", "No solutions", ["Exactly one", "Infinitely many", "Exactly two"], "Both lines have slope 3 but different intercepts, so they are parallel and never meet."],
    ]),
  ],
});
M(1, 3, "21", "review", "m1d21", "Week 3 review", { from: ["m1d15", "m1d16", "m1d17", "m1d18", "m1d19", "m1d20"], n: 10, sum: "Mixed quiz on graphs, slope, lines and inequalities." });

M(1, 4, "22", "lesson", "m1d22", "Ratios and proportions", {
  sum: "Ratios, splitting a total in a ratio, and scaling recipes.",
  body: `<p>A <b>ratio</b> compares two amounts. 3 : 5 means for every 3 of the first, there are 5 of the second.</p>
<h3>Splitting a total</h3><p>Boys to girls is 3 : 5 and there are 40 students. Parts: 3 + 5 = 8, so one part is 40 ÷ 8 = 5. Boys = 3 × 5 = 15, girls = 5 × 5 = 25.</p>
<h3>Proportions</h3>
${box("If a/b = c/d, then a·d = b·c")}
${ex("Example", "A recipe uses 2 cups of flour for 6 servings. For 15 servings: 2/6 = x/15 → 6x = 30 → x = 5 cups.")}
${tip("Keep the same units in the same position: cups over servings on both sides.")}`,
  gens: [
    () => { const b = ri(2, 9), k = ri(2, 8), c = b * k, a = ri(1, 12); return { q: `If ${a}/${b} = x/${c}, what is x?`, a: a * k, w: [a + c - b, a * c, a * k + k], e: `${c} is ${k} times ${b}, so x = ${a} × ${k} = ${a * k}.` }; },
    () => { const r1 = ri(1, 7); let r2 = ri(1, 7); if (r2 === r1) r2 = r1 + 1; const k = ri(2, 9), T = (r1 + r2) * k, who = pick(["girls", "boys"]); const g = who === "girls" ? r2 * k : r1 * k; return { q: `In a class, the ratio of boys to girls is ${r1} : ${r2}. There are ${T} students. How many ${who} are there?`, a: g, w: [who === "girls" ? r1 * k : r2 * k, T - k, isInt(T / (who === "girls" ? r2 : r1)) ? T / (who === "girls" ? r2 : r1) : g + k], e: `${r1} + ${r2} = ${r1 + r2} parts. One part = ${T} ÷ ${r1 + r2} = ${k}. ${who[0].toUpperCase() + who.slice(1)}: ${who === "girls" ? r2 : r1} × ${k} = ${g}.` }; },
    () => { const s = ri(2, 6), m = ri(2, 5), t = s * m, c = ri(1, 5); return { q: `A recipe uses ${c} cups of flour for ${s} servings. How many cups are needed for ${t} servings?`, a: c * m, w: [c * t, c + t - s, c * m + 1], e: `${t} servings is ${m} times ${s} servings, so use ${m} × ${c} = ${c * m} cups.` }; },
  ],
});

M(1, 4, "23", "lesson", "m1d23", "Perimeter and area", {
  sum: "Rectangles, squares and triangles.",
  body: `<p><b>Perimeter</b> is the distance around a shape. <b>Area</b> is the space inside it, in square units.</p>
${tbl([["Shape", "Perimeter", "Area"], ["Rectangle (length l, width w)", "2l + 2w", "l × w"], ["Square (side s)", "4s", "s²"], ["Triangle (base b, height h)", "add the 3 sides", "½ × b × h"]])}
${ex("Example", "A square has area 49. Its side is √49 = 7, so its perimeter is 4 × 7 = 28.")}
${ex("Example", "A rectangle has area 60 and length 12. Its width is 60 ÷ 12 = 5.")}
${tip("The height of a triangle is perpendicular to the base, not the slanted side.")}`,
  gens: [
    () => { const l = ri(3, 15), w = ri(2, 12), ask = pick(["area", "perimeter"]); return ask === "area" ? { q: `A rectangle is ${l} cm long and ${w} cm wide. What is its area, in square centimeters?`, a: l * w, w: [2 * (l + w), l + w, 2 * l * w], e: `Area = ${l} × ${w} = ${l * w}.` } : { q: `A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter, in centimeters?`, a: 2 * (l + w), w: [l * w, l + w, 4 * l], e: `Perimeter = 2(${l}) + 2(${w}) = ${2 * (l + w)}.` }; },
    () => { const b = 2 * ri(2, 9), h = ri(3, 12); return { q: `A triangle has a base of ${b} and a height of ${h}. What is its area?`, a: b * h / 2, w: [b * h, b + h, b * h / 4], e: `Area = ½ × ${b} × ${h} = ${b * h / 2}.` }; },
    () => { const s = ri(3, 12); return { q: `A square has an area of ${s * s}. What is its perimeter?`, a: 4 * s, w: [s, s * s / 4, 2 * s], e: `Side = √${s * s} = ${s}. Perimeter = 4 × ${s} = ${4 * s}.` }; },
    () => { const l = ri(4, 15), w = ri(2, 12), A = l * w; return { q: `A rectangle has an area of ${A} and a length of ${l}. What is its width?`, a: w, w: [A - l, 2 * w, l - w], e: `Width = area ÷ length = ${A} ÷ ${l} = ${w}.` }; },
  ],
});

const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
M(1, 4, "24", "lesson", "m1d24", "Reading data: mean, median and range", {
  sum: "Find the mean, median and range of a data set.",
  body: `${tbl([["Measure", "How to find it"], ["Mean (average)", "sum of the values ÷ number of values"], ["Median", "the middle value after sorting (average of the two middle values if the count is even)"], ["Range", "largest − smallest"], ["Mode", "the value that appears most often"]])}
${ex("Example", "Data: 7, 2, 9, 4, 8. Sorted: 2, 4, 7, 8, 9. Mean = 30 ÷ 5 = 6. Median = 7. Range = 9 − 2 = 7.")}
<h3>Missing value</h3><p>If 4 numbers have a mean of 10, their sum is 4 × 10 = 40. If three of them are 8, 12 and 9, the fourth is 40 − 29 = 11.</p>
${box("sum = mean × count")}
${tip("Always sort the data before finding the median.")}`,
  gens: [
    () => { const n = ri(4, 6), v = Array.from({ length: n }, () => ri(1, 20)); const s = v.reduce((a, b) => a + b, 0); v[n - 1] += (n - s % n) % n; const sum = v.reduce((a, b) => a + b, 0); return { q: `What is the mean of ${v.join(", ")}?`, a: sum / n, w: [median(v), sum, Math.max(...v) - Math.min(...v)], e: `Sum = ${sum}, count = ${n}. Mean = ${sum} ÷ ${n} = ${sum / n}.` }; },
    () => { const n = pick([5, 7]); let v; do v = Array.from({ length: n }, () => ri(1, 30)); while (v[(n - 1) / 2] === median(v)); return { q: `What is the median of ${v.join(", ")}?`, a: median(v), w: [v[(n - 1) / 2], Math.max(...v) - Math.min(...v), Math.round(v.reduce((a, b) => a + b, 0) / n)], e: `Sorted: ${v.slice().sort((a, b) => a - b).join(", ")}. The middle value is ${median(v)}.` }; },
    () => { const Mn = ri(8, 20), a = ri(1, 25), b = ri(1, 25), c = ri(1, 25), d = 4 * Mn - a - b - c; if (d < 1) return null; return { q: `The mean of four numbers is ${Mn}. Three of the numbers are ${a}, ${b} and ${c}. What is the fourth number?`, a: d, w: [Mn, 4 * Mn, 3 * Mn - a - b - c > 0 ? 3 * Mn - a - b - c : d + 3], e: `Sum = 4 × ${Mn} = ${4 * Mn}. Fourth = ${4 * Mn} − ${a} − ${b} − ${c} = ${d}.` }; },
    () => { const v = Array.from({ length: ri(5, 7) }, () => ri(1, 40)); const r = Math.max(...v) - Math.min(...v); return { q: `What is the range of ${v.join(", ")}?`, a: r, w: [Math.max(...v), median(v), Math.max(...v) + Math.min(...v)], e: `Largest − smallest = ${Math.max(...v)} − ${Math.min(...v)} = ${r}.` }; },
  ],
});

M(1, 4, "25", "lesson", "m1d25", "How the Digital SAT Math section works", {
  sum: "Format, timing, question types and the adaptive second module.",
  body: `${tbl([["Feature", "Digital SAT Math"], ["Modules", "2 modules, 22 questions each (44 total)"], ["Time", "35 minutes per module (70 minutes total)"], ["Calculator", "Allowed on every question; Desmos is built in"], ["Question types", "About 75% multiple choice, about 25% student-produced response (you type the answer)"], ["Adaptive", "Your Module 1 result decides whether Module 2 is easier or harder"], ["Reference sheet", "Common formulas are available during the test"], ["Guessing", "No penalty for wrong answers, so never leave a question blank"], ["Score", "200–800 for Math"]])}
<h3>Content</h3><p>About 35% Algebra, 35% Advanced Math, 15% Problem-Solving and Data Analysis, 15% Geometry and Trigonometry.</p>
<h3>Practice</h3><p>Install the College Board <b>Bluebook</b> app to take official practice tests in the real format. SAT Studio's Math tests use the same two-module format.</p>
${tip("A strong Module 1 matters: only the harder Module 2 leads to the top scores.")}`,
  gens: [
    fixed([
      ["How many questions are in the Digital SAT Math section in total?", "44", ["22", "54", "58"], "There are 2 modules with 22 questions each, 44 in total."],
      ["How long is each Digital SAT Math module?", "35 minutes", ["32 minutes", "45 minutes", "70 minutes"], "Each module is 35 minutes, so the Math section is 70 minutes in total."],
      ["When can you use a calculator on Digital SAT Math?", "On every question", ["Only in Module 2", "Never", "Only on student-produced responses"], "A calculator (including the built-in Desmos) is allowed for the whole Math section."],
      ["What decides the difficulty of Math Module 2?", "Your performance in Module 1", ["Your Reading & Writing score", "A random choice", "Your previous SAT score"], "The test is adaptive: a stronger Module 1 leads to a harder Module 2, which allows a higher score."],
      ["What happens if you answer a question wrong on the Digital SAT?", "Nothing is subtracted, so guessing is better than leaving it blank", ["You lose a quarter point", "The test ends early", "Your next question gets harder"], "There is no penalty for wrong answers. Always answer every question."],
      ["About what share of Digital SAT Math questions ask you to type your own answer?", "About 25%", ["About 5%", "About 50%", "About 75%"], "Roughly one quarter of the questions are student-produced responses; the rest are multiple choice."],
      ["What is the score range for the SAT Math section?", "200–800", ["0–100", "400–1600", "1–36"], "Each SAT section is scored from 200 to 800; the total is 400–1600."],
    ]),
  ],
});
M(1, 4, "26–27", "review", "m1d26", "Month 1 mixed practice", { from: ["m1d1", "m1d3", "m1d5", "m1d9", "m1d11", "m1d13", "m1d16", "m1d18", "m1d19", "m1d22", "m1d23", "m1d24"], n: 12, sum: "12 mixed questions from the whole month. Score 100% to finish the foundations." });
M(1, 4, "28", "task", "m1d28", "Diagnostic test", { sum: "Take your first full Math practice test.", body: `<p>Take one full Math test in the real two-module format. Don't worry about the score: this test shows where you start.</p><ul><li>Sit somewhere quiet and set aside 70 minutes.</li><li>Use Desmos when it helps.</li><li>Answer every question, even if you have to guess.</li></ul>`, act: [["tests", "Open Math tests"]] });
M(1, 4, "29–30", "task", "m1d29", "Analyze your diagnostic test", { sum: "Turn your mistakes into a study list for Month 2.", body: `<p>Open your diagnostic test in <b>History</b> and go through every question you missed or guessed.</p><ol class="crol"><li>Start an error notebook: for each mistake, write the question topic, why you got it wrong, and the correct method.</li><li>Group your mistakes by topic. The topics with the most mistakes need the most attention in Month 2.</li><li>Check the <b>Progress</b> page to see your weakest skills.</li></ol>`, act: [["history", "Open History"], ["progress", "Open Progress"]] });

/* ===== MONTH 2: SAT TOPICS ===== */

M(2, 1, "1", "lesson", "m2d1", "Linear equations in one variable (SAT level)", {
  sum: "Harder linear equations, and equations with no solution or infinitely many.",
  body: `<p>SAT linear equations combine distributing, like terms and fractions. Use the same steps as before, carefully.</p>
${ex("Example", "3(x − 4) + 5 = 2x + 7 → 3x − 12 + 5 = 2x + 7 → 3x − 7 = 2x + 7 → x = 14.")}
<h3>How many solutions?</h3>
<p>Simplify both sides to the form ax + b = cx + d.</p>
${tbl([["Case", "Number of solutions", "Example"], ["a ≠ c", "Exactly one", "2x + 1 = 5x − 8"], ["a = c and b ≠ d", "No solution", "4x + 3 = 4x + 5"], ["a = c and b = d", "Infinitely many", "2(x + 3) = 2x + 6"]])}
${ex("Example", "For what k does kx + 3 = 4x + 5 have no solution? The x-coefficients must match and the constants differ: k = 4.")}
${tip("“No solution” questions are about coefficients, not about solving for x.")}`,
  gens: [
    () => { const x0 = nz(-8, 10), k = ri(2, 6), m = nz(-6, 6), n = nz(-9, 9); let p = nz(-4, 7); if (p === k) p = k + 1; const q = k * (x0 - m) + n - p * x0; return { q: `If ${k}(x ${sg(-m)}) ${sg(n)} = ${lin(p, q)}, what is the value of x?`, a: x0, w: [-x0, x0 + m, x0 - m, x0 + 1], e: `Distribute: ${lin(k, -k * m + n)} = ${lin(p, q)}. Then ${N(k - p)}x = ${N(q + k * m - n)}, so x = ${N(x0)}.` }; },
    () => { const a = nz(-7, 9), b = nz(-9, 9); let c = nz(-9, 9); if (c === b) c = b + 2; return { q: `For what value of k does the equation ${lin(a, b)} = kx ${sg(c)} have no solution?`, a: a, w: [-a, b, c, b - c], e: `With k = ${N(a)}, both sides have ${N(a)}x but different constants (${N(b)} and ${N(c)}), so they can never be equal.` }; },
    () => { const a = ri(2, 8), b = nz(-9, 9); return { q: `In the equation ${a}(x ${sg(b)}) = ${a}x + k, k is a constant. For what value of k does the equation have infinitely many solutions?`, a: a * b, w: [b, a + b, -a * b], e: `${a}(x ${sg(b)}) = ${lin(a, a * b)}. The sides are identical when k = ${N(a * b)}.` }; },
  ],
});

M(2, 1, "2", "lesson", "m2d2", "Linear functions and their meaning", {
  sum: "Function notation, building linear models, and evaluating them.",
  body: `<p>A linear function f(x) = mx + b is the same as the line y = mx + b. f(3) means “put 3 in for x”.</p>
${ex("Example", "f(x) = 4x − 1. f(3) = 4(3) − 1 = 11. If f(x) = 19, then 4x − 1 = 19 and x = 5.")}
<h3>Linear models</h3>
<p>In a real situation, the <b>slope</b> is the rate of change (per hour, per item, per year) and the <b>intercept</b> is the starting value.</p>
${ex("Example", "A plumber charges a $60 visit fee plus $45 per hour. Cost after h hours: C(h) = 45h + 60. Slope 45 = cost per hour. Intercept 60 = the fixed fee.")}
${tip("f(3) is not f × 3. It is the output when the input is 3.")}`,
  gens: [
    () => { const m = nz(-6, 7), b = nz(-9, 9), t = nz(-5, 6); return { q: `If f(x) = ${lin(m, b)}, what is f(${N(t)})?`, a: m * t + b, w: [m * t - b, m + t + b, b * t + m], e: `f(${N(t)}) = ${N(m)}(${N(t)}) ${sg(b)} = ${N(m * t + b)}.` }; },
    () => { const r = ri(20, 80), f = ri(30, 120); return { q: `A plumber charges a $${f} visit fee plus $${r} for each hour of work. Which function gives the total cost C, in dollars, for h hours of work?`, a: `C(h) = ${r}h + ${f}`, w: [`C(h) = ${f}h + ${r}`, `C(h) = ${r + f}h`, `C(h) = ${r}(h + ${f})`], e: `The cost grows by ${r} each hour (slope) and starts at the ${f} fee (intercept): C(h) = ${r}h + ${f}.` }; },
    () => { const m = pick([2, 3, 4, 5, 6]), b = ri(30, 90); return { q: `The equation y = ${b} − ${m}x gives the number of gallons of water in a tank x minutes after a leak starts. What does ${m} represent?`, a: `The tank loses ${m} gallons each minute.`, w: [`The tank holds ${m} gallons at the start.`, `The tank is empty after ${m} minutes.`, `The tank gains ${m} gallons each minute.`], e: `${m} is the slope (rate of change). It is subtracted for every minute x, so the tank loses ${m} gallons per minute.` }; },
    () => { const m = nz(-6, 7), b = nz(-9, 9), t = nz(-6, 8), v = m * t + b; return { q: `If f(x) = ${lin(m, b)} and f(a) = ${N(v)}, what is a?`, a: t, w: [v - b, m * v + b, isInt((v + b) / m) ? (v + b) / m : t + 2], e: `${lin(m, b, "a")} = ${N(v)} → ${N(m)}a = ${N(v - b)} → a = ${N(t)}.` }; },
  ],
});

M(2, 1, "3", "lesson", "m2d3", "Parallel and perpendicular lines", {
  sum: "Slopes of parallel and perpendicular lines and lines in standard form.",
  body: `${box("Parallel lines: same slope &nbsp;&nbsp;·&nbsp;&nbsp; Perpendicular lines: slopes multiply to −1 (negative reciprocals)")}
${ex("Example", "A line perpendicular to y = 2x + 3 has slope −1/2. A line perpendicular to y = −3/4 x has slope 4/3.")}
<h3>Standard form</h3><p>For Ax + By = C, the slope is −A/B. Example: 2x + 3y = 12 → 3y = −2x + 12 → y = −2/3 x + 4, so the slope is −2/3.</p>
${ex("Line through a point", "Parallel to y = 3x − 1 through (2, 9): slope 3, so 9 = 3(2) + b and b = 3. The line is y = 3x + 3.")}
${tip("Perpendicular means flip the fraction <i>and</i> change the sign.")}`,
  gens: [
    () => { const m = nz(-6, 6), b = nz(-9, 9); return { q: `What is the slope of a line perpendicular to y = ${lin(m, b)}?`, a: F(-1, m), w: [F(1, m), N(-m), N(m)], e: `The perpendicular slope is the negative reciprocal of ${N(m)}: −1/${P(m)} = ${F(-1, m)}.` }; },
    () => { const m = nz(-5, 5), b = nz(-9, 9), p = nz(-5, 5), q = nz(-9, 9); return { q: `Line ℓ is parallel to y = ${lin(m, b)} and passes through ${pt(p, q)}. What is the y-intercept of line ℓ?`, a: q - m * p, w: [q + m * p, b, q - p], e: `Parallel lines share the slope ${N(m)}. b = ${N(q)} − (${N(m)})(${N(p)}) = ${N(q - m * p)}.` }; },
    () => { const s = nz(-5, 5), B = ri(1, 4), A = -s * B, Cc = nz(-12, 12); const eq = poly([[A, "x"], [B, "y"]]); return { q: `What is the slope of a line parallel to ${eq} = ${N(Cc)}?`, a: F(-A, B), w: [F(A, B), F(B, A), F(-B, A)], e: `Solve for y: y = ${F(-A, B)}x + …, so the slope is −A/B = ${F(-A, B)}. Parallel lines have the same slope.` }; },
  ],
});

M(2, 1, "4", "lesson", "m2d4", "Systems of linear equations", {
  sum: "Substitution, elimination, and the number of solutions.",
  body: `<h3>Elimination</h3><p>Add or subtract the equations so one variable disappears.</p>
${ex("Example", "x + y = 10 and x − y = 4. Add: 2x = 14, so x = 7 and y = 3.")}
<h3>Substitution</h3><p>Solve one equation for a variable and put it into the other.</p>
${ex("Example", "y = 2x and 3x + y = 25 → 3x + 2x = 25 → x = 5, y = 10.")}
<h3>Number of solutions</h3><p>Write both in y = mx + b form: different slopes → one solution; same slope, different intercept → none; same line → infinitely many.</p>
${tip("Read what the question asks for. It may ask for x + y or 2x, not x alone.")}`,
  gens: [
    () => { const x = nz(-6, 12), y = nz(-6, 12), ask = pick(["x", "y"]); return { q: `If x + y = ${N(x + y)} and x − y = ${N(x - y)}, what is the value of ${ask}?`, a: ask === "x" ? x : y, w: [ask === "x" ? y : x, x + y, x - y], e: `Add the equations: 2x = ${N(2 * x)}, so x = ${N(x)}. Then y = ${N(x + y)} − ${P(x)} = ${N(y)}.` }; },
    () => { const x = nz(-5, 6), y = nz(-5, 6); let a1 = nz(-4, 5), b1 = nz(-4, 5), a2 = nz(-4, 5), b2 = nz(-4, 5); if (a1 * b2 - a2 * b1 === 0) return null; const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y; return { q: `The system ${poly([[a1, "x"], [b1, "y"]])} = ${N(c1)} and ${poly([[a2, "x"], [b2, "y"]])} = ${N(c2)} has solution (x, y). What is x?`, a: x, w: [y, -x, x + y], e: `Solving (by elimination, or in Desmos) gives x = ${N(x)} and y = ${N(y)}. Check: ${a1}(${N(x)}) + ${b1}(${N(y)}) = ${N(c1)}. ✓` }; },
    () => { const m = nz(-4, 4), b = nz(-6, 6), c = pick(["none", "inf", "one"]); let sys, ans; if (c === "none") { sys = `y = ${lin(m, b)} and y = ${lin(m, b + nz(-5, 5))}`; ans = "No solution"; } else if (c === "inf") { const k = ri(2, 4); sys = `y = ${lin(m, b)} and ${k}y = ${lin(k * m, k * b)}`; ans = "Infinitely many"; } else { sys = `y = ${lin(m, b)} and y = ${lin(m + nz(-3, 3), b)}`; ans = "Exactly one"; } return { q: `How many solutions does the system ${sys} have?`, a: ans, w: ["No solution", "Infinitely many", "Exactly one", "Exactly two"].filter(x => x !== ans), e: c === "none" ? "Same slope, different intercepts: the lines are parallel and never meet." : c === "inf" ? "Divide the second equation by its y-coefficient: it is the same line, so every point works." : "Different slopes: the lines cross exactly once." }; },
  ],
});

M(2, 1, "5", "lesson", "m2d5", "Linear inequalities in context", {
  sum: "Budgets, “at least / at most”, and points that satisfy inequalities.",
  body: `${tbl([["Words", "Symbol"], ["at least, no less than, minimum", "≥"], ["at most, no more than, maximum", "≤"], ["more than", "&gt;"], ["fewer than, less than", "&lt;"]])}
${ex("Budget", "Lola has $50. Entry costs $8 and each ride costs $5. 8 + 5r ≤ 50 → 5r ≤ 42 → r ≤ 8.4, so at most 8 rides.")}
<p>When the answer must be a whole number (people, rides, tickets), round in the direction the situation allows.</p>
${ex("Points", "Is (2, 3) a solution of y ≤ 2x − 1? 2(2) − 1 = 3, and 3 ≤ 3 is true, so yes.")}
${tip("For “greatest number of rides”, round down even if the decimal is .9: you can't afford a partial ride.")}`,
  gens: [
    () => { const p = ri(3, 9), f = ri(5, 20); let B; do B = f + ri(20, 90); while ((B - f) % p === 0); const ans = Math.floor((B - f) / p); return { q: `Aziza has $${B}. She pays a $${f} entrance fee and $${p} for each ride. What is the greatest number of rides she can take?`, a: ans, w: [ans + 1, Math.floor(B / p), Math.floor((B + f) / p)], e: `${f} + ${p}r ≤ ${B} → ${p}r ≤ ${B - f} → r ≤ ${N((B - f) / p)}. The greatest whole number is ${ans}.` }; },
    () => { const m = nz(-3, 3), b = nz(-5, 5), xs = shuf([-3, -2, -1, 0, 1, 2, 3]).slice(0, 4); const good = pt(xs[0], m * xs[0] + b - ri(0, 3)), bad = xs.slice(1).map(x => pt(x, m * x + b + ri(1, 4))); return { q: `Which point is a solution of the inequality y ≤ ${lin(m, b)}?`, a: good, w: bad, e: `Put each point in. For ${good}: ${lin(m, b)} = ${N(m * xs[0] + b)} at x = ${N(xs[0])}, and the y-value is not greater than that. The other points have y-values above the line.` }; },
    () => { const t = pick([70, 75, 80, 85]), a = ri(t - 12, Math.min(100, t + 15)), b = ri(t - 12, Math.min(100, t + 15)), need = 3 * t - a - b; if (need > 100 || need < 40) return null; return { q: `To pass, a student needs an average of at least ${t} on three tests. She scored ${a} and ${b} on the first two. What is the minimum score she needs on the third test?`, a: need, w: [t, Math.round((a + b) / 2), need + 1], e: `(${a} + ${b} + x)/3 ≥ ${t} → ${a + b} + x ≥ ${3 * t} → x ≥ ${need}.` }; },
  ],
});

M(2, 1, "6", "lesson", "m2d6", "Linear word problems and models", {
  sum: "Read, build and interpret linear models in real situations.",
  body: `<p>Most SAT linear questions come in a story. Identify the two key numbers:</p>
<ul><li><b>Rate</b> (slope): words like <i>per, each, every</i>.</li><li><b>Starting amount</b> (intercept): <i>fixed fee, initial, at the start, when t = 0</i>.</li></ul>
${ex("Example", "A phone plan costs $15 per month plus $4 per GB. Last month's bill was $43. 15 + 4g = 43 → g = 7 GB.")}
${ex("Two data points", "A car rental costs $130 for 2 days and $230 for 4 days. Rate = (230 − 130)/(4 − 2) = $50 per day. Fee: 130 − 2(50) = $30.")}
${ex("Interpreting", "P = 2.5t + 40 gives a town's population in thousands t years after 2010. 40 = population in 2010 (40,000). 2.5 = growth of 2,500 people per year.")}
${tip("Check the units in the answer choices: thousands, per year, dollars per day.")}`,
  gens: [
    () => { const f = ri(10, 30), r = ri(2, 9), g = ri(2, 12), T = f + r * g; return { q: `A phone plan costs $${f} per month plus $${r} for each gigabyte (GB) of data. Last month's bill was $${T}. How many GB were used?`, a: g, w: [isInt(T / r) ? T / r : g + 2, isInt((T + f) / r) ? (T + f) / r : g + 1, T - f], e: `${f} + ${r}g = ${T} → ${r}g = ${T - f} → g = ${g}.` }; },
    () => { const m = pick([1.5, 2, 2.5, 3, 4]), b = ri(20, 60); return { q: `The equation P = ${m}t + ${b} gives the population of a town, in thousands, t years after 2010. What does ${b} represent?`, a: `The population was ${b} thousand in 2010.`, w: [`The population grows by ${b} thousand each year.`, `The population will be ${b} thousand in ${m} years.`, `It takes ${b} years for the population to double.`], e: `${b} is the value of P when t = 0, which is the year 2010.` }; },
    () => { const r = ri(25, 90), f = ri(10, 60), d1 = ri(1, 4), d2 = d1 + ri(1, 5), A = f + r * d1, B = f + r * d2; return { q: `A car rental company charges a fixed fee plus a daily rate. Renting for ${d1} days costs $${A}, and renting for ${d2} days costs $${B}. What is the daily rate, in dollars?`, a: r, w: [isInt(B / d2) ? B / d2 : r + 5, isInt(A / d1) ? A / d1 : r - 5, B - A], e: `Rate = (${B} − ${A}) / (${d2} − ${d1}) = ${B - A}/${d2 - d1} = ${r}.` }; },
  ],
});
M(2, 1, "7", "review", "m2d7", "Algebra review", { from: ["m2d1", "m2d2", "m2d3", "m2d4", "m2d5", "m2d6"], n: 10, sum: "Mixed SAT Algebra quiz." });

M(2, 2, "8", "lesson", "m2d8", "Exponent rules and radicals", {
  sum: "Product, power and quotient rules, and rational exponents.",
  body: `${tbl([["Rule", "Example"], ["xᵃ · xᵇ = xᵃ⁺ᵇ", "x³ · x⁴ = x⁷"], ["xᵃ / xᵇ = xᵃ⁻ᵇ", "x⁷ / x² = x⁵"], ["(xᵃ)ᵇ = xᵃᵇ", "(x²)⁵ = x¹⁰"], ["x⁰ = 1", "7⁰ = 1"], ["x⁻ᵃ = 1/xᵃ", "2⁻³ = 1/8"], ["x^(a/b) = ᵇ√(xᵃ)", "8^(2/3) = (∛8)² = 4"]])}
${ex("Rational exponent", "16^(3/4): the 4th root of 16 is 2, then 2³ = 8.")}
${ex("Radical to exponent", "√(x⁵) = x^(5/2).")}
${tip("x³ · x⁴ is x⁷, not x¹². Multiply the bases → add the exponents.")}`,
  gens: [
    () => { const a = ri(2, 7), b = ri(2, 7); return { q: `Which expression is equivalent to ${xp("x", a)} · ${xp("x", b)}?`, a: xp("x", a + b), w: [xp("x", a * b), "2" + xp("x", a + b), xp("x", Math.abs(a - b) || a + b + 1)], e: `Same base, multiply → add exponents: ${a} + ${b} = ${a + b}.` }; },
    () => { const a = ri(2, 6), b = ri(2, 5); return { q: `Which expression is equivalent to (${xp("x", a)})${"<sup>" + b + "</sup>"}?`, a: xp("x", a * b), w: [xp("x", a + b), xp("x", a ** b), xp("x", a * b + 1)], e: `Power of a power → multiply exponents: ${a} × ${b} = ${a * b}.` }; },
    () => { const [b, e, v, r] = pick([[8, "2/3", 4, 2], [27, "2/3", 9, 3], [16, "3/4", 8, 2], [32, "3/5", 8, 2], [64, "2/3", 16, 4], [81, "3/4", 27, 3], [25, "3/2", 125, 5], [4, "5/2", 32, 2], [9, "3/2", 27, 3]]); const [p, q] = e.split("/").map(Number); return { q: `What is the value of ${b}<sup>${e}</sup>?`, a: v, w: [r, Math.round(b * p / q * 100) / 100, v * r], e: `The denominator ${q} means a ${q === 2 ? "square" : q === 3 ? "cube" : q + "th"} root: ${r}. Then raise to the power ${p}: ${r}<sup>${p}</sup> = ${v}.` }; },
    () => { const a = pick([3, 5, 7, 9]); return { q: `Which expression is equivalent to √(${xp("x", a)}) for x > 0?`, a: xp("x", a + "/2"), w: [xp("x", 2 * a), xp("x", a - 2), xp("x", "2/" + a)], e: `A square root is the power 1/2: (${xp("x", a)})<sup>1/2</sup> = ${xp("x", a + "/2")}.` }; },
  ],
});

M(2, 2, "9", "lesson", "m2d9", "Polynomials: expanding and factoring", {
  sum: "Multiply binomials, factor trinomials, and special products.",
  body: `<h3>Expanding</h3>${box("(x + a)(x + b) = x² + (a + b)x + ab")}
${ex("Example", "(x + 3)(x − 5) = x² − 2x − 15.")}
<h3>Factoring x² + px + q</h3><p>Find two numbers that <b>multiply</b> to q and <b>add</b> to p.</p>
${ex("Example", "x² + 7x + 12: 3 × 4 = 12 and 3 + 4 = 7, so it is (x + 3)(x + 4).")}
<h3>Special products</h3>
${tbl([["Pattern", "Result"], ["(a + b)²", "a² + 2ab + b²"], ["(a − b)²", "a² − 2ab + b²"], ["a² − b² (difference of squares)", "(a − b)(a + b)"]])}
${tip("(x + 3)² is not x² + 9. It is x² + 6x + 9.")}`,
  gens: [
    () => { const a = nz(-7, 7), b = nz(-7, 7); return { q: `Which expression is equivalent to (x ${sg(a)})(x ${sg(b)})?`, a: quad(1, a + b, a * b), w: [quad(1, a * b, a + b), quad(1, 0, a * b), quad(1, a + b, -a * b)], e: `x·x = x², outer + inner = ${N(a)}x + ${N(b)}x = ${N(a + b)}x, last = (${N(a)})(${N(b)}) = ${N(a * b)}.` }; },
    () => { let r = nz(-8, 8), s = nz(-8, 8); if (r === s || r === -s) return null; const f = (u, v) => `(x ${sg(u)})(x ${sg(v)})`; return { q: `Which is a factored form of ${quad(1, r + s, r * s)}?`, a: f(r, s), w: [f(-r, -s), f(r, -s), f(-r, s), f(r + s, r * s)], e: `Find two numbers that multiply to ${N(r * s)} and add to ${N(r + s)}: ${N(r)} and ${N(s)}. So it is ${f(r, s)}.` }; },
    () => { const k = ri(2, 12); return { q: `Which expression is equivalent to x² − ${k * k}?`, a: `(x − ${k})(x + ${k})`, w: [`(x − ${k})²`, `(x + ${k})²`, `(x − ${k * k})(x + 1)`], e: `x² − ${k * k} is a difference of squares: x² − ${k}² = (x − ${k})(x + ${k}).` }; },
  ],
});

M(2, 2, "10", "lesson", "m2d10", "Quadratic equations", {
  sum: "Solve by factoring, use the discriminant, and sum/product of solutions.",
  body: `<h3>Solving by factoring</h3>${ex("Example", "x² − x − 12 = 0 → (x − 4)(x + 3) = 0 → x = 4 or x = −3.")}
<h3>Quadratic formula</h3>${box("For ax² + bx + c = 0: x = (−b ± √(b² − 4ac)) / (2a)")}
<h3>The discriminant D = b² − 4ac</h3>
${tbl([["D", "Real solutions"], ["D &gt; 0", "Two"], ["D = 0", "One"], ["D &lt; 0", "None"]])}
<h3>Sum and product of solutions</h3>${box("sum = −b/a &nbsp;&nbsp;·&nbsp;&nbsp; product = c/a")}
${ex("Example", "2x² − 10x + 7 = 0: the sum of the solutions is −(−10)/2 = 5.")}
${tip("If (x − 4) = 0, then x = 4 (positive). The sign flips when you solve each factor.")}`,
  gens: [
    () => { let r = nz(-8, 8), s = nz(-8, 8); if (r === s) s = r === 1 ? 2 : 1; const L = (u, v) => { const [p, q] = [u, v].sort((x, y) => x - y); return `x = ${N(p)} or x = ${N(q)}`; }; return { q: `What are the solutions of ${quad(1, -(r + s), r * s)} = 0?`, a: L(r, s), w: [L(-r, -s), L(r, -s), L(-r, s)], e: `It factors as (x ${sg(-r)})(x ${sg(-s)}) = 0, so x = ${N(r)} or x = ${N(s)}.` }; },
    () => { const a = nz(-4, 5), b = nz(-12, 12), c = nz(-12, 12); return { q: `What is the sum of the solutions of ${quad(a, b, c)} = 0?`, a: F(-b, a), w: [F(b, a), F(c, a), F(-c, a)], e: `Sum = −b/a = −(${N(b)})/${P(a)} = ${F(-b, a)}.` }; },
    () => { const c = pick(["two", "one", "none"]); let eq; if (c === "one") { const h = nz(-6, 6); eq = quad(1, -2 * h, h * h); } else if (c === "two") { const r = nz(-6, 6), s = nz(-6, 6); if (r === s) return null; eq = quad(1, -(r + s), r * s); } else { const b = ri(-4, 4), cc = Math.floor(b * b / 4) + ri(1, 6); eq = quad(1, b, cc); } const ans = { two: "Exactly two", one: "Exactly one", none: "No real solutions" }[c]; return { q: `How many real solutions does ${eq} = 0 have?`, a: ans, w: ["Exactly two", "Exactly one", "No real solutions", "Infinitely many"].filter(x => x !== ans), e: `Compute the discriminant b² − 4ac: it is ${c === "two" ? "positive → two solutions" : c === "one" ? "zero → one solution" : "negative → no real solutions"}.` }; },
    () => { const a = nz(-4, 5), b = nz(-12, 12), c = nz(-12, 12); return { q: `What is the product of the solutions of ${quad(a, b, c)} = 0?`, a: F(c, a), w: [F(-c, a), F(-b, a), F(b, a)], e: `Product = c/a = ${N(c)}/${P(a)} = ${F(c, a)}.` }; },
  ],
});

M(2, 2, "11", "lesson", "m2d11", "Parabolas: graphs of quadratics", {
  sum: "Vertex, axis of symmetry, minimum or maximum, and intercepts.",
  body: `<p>The graph of y = ax² + bx + c is a parabola. If a &gt; 0 it opens up (has a minimum); if a &lt; 0 it opens down (has a maximum).</p>
${box("Vertex form: y = a(x − h)² + k → vertex (h, k)")}
${ex("Example", "y = 2(x − 3)² + 5 has vertex (3, 5) and a minimum value of 5.")}
${box("Standard form: vertex x = −b / (2a)")}
${ex("Example", "y = x² − 8x + 10: vertex x = 8/2 = 4, y = 16 − 32 + 10 = −6. Vertex (4, −6).")}
<p>The y-intercept is c (put x = 0). The x-intercepts are the solutions of ax² + bx + c = 0.</p>
${tip("In y = (x + 2)² − 1 the vertex is (−2, −1): x + 2 = x − (−2).")}`,
  gens: [
    () => { const a = nz(-3, 3), h = nz(-7, 7), k = nz(-9, 9); return { q: `What is the vertex of the graph of y = ${a === 1 ? "" : a === -1 ? "−" : N(a)}(x ${sg(-h)})² ${sg(k)}?`, a: pt(h, k), w: [pt(-h, k), pt(k, h), pt(h, -k)], e: `In vertex form y = a(x − h)² + k, the vertex is (h, k) = ${pt(h, k)}.` }; },
    () => { const h = nz(-6, 6), c = nz(-9, 9), b = -2 * h; return { q: `What is the x-coordinate of the vertex of y = ${quad(1, b, c)}?`, a: h, w: [-h, b, c], e: `x = −b/(2a) = −(${N(b)})/2 = ${N(h)}.` }; },
    () => { const a = nz(-3, 3), h = nz(-6, 6), k = nz(-9, 9), mm = a > 0 ? "minimum" : "maximum"; return { q: `What is the ${mm} value of y = ${a === 1 ? "" : a === -1 ? "−" : N(a)}(x ${sg(-h)})² ${sg(k)}?`, a: k, w: [h, -k, a], e: `a is ${a > 0 ? "positive, so the parabola opens up and has a minimum" : "negative, so it opens down and has a maximum"} at the vertex height k = ${N(k)}.` }; },
    () => { const a = nz(-4, 4), b = nz(-9, 9), c = nz(-12, 12); return { q: `At what point does the graph of y = ${quad(a, b, c)} cross the y-axis?`, a: pt(0, c), w: [pt(c, 0), pt(0, a), pt(0, b)], e: `Put x = 0: y = ${N(c)}. The point is ${pt(0, c)}.` }; },
  ],
});

M(2, 2, "12", "lesson", "m2d12", "Exponential growth and decay", {
  sum: "Model percent growth and decay with f(t) = a(1 ± r)ᵗ.",
  body: `${box("f(t) = a(1 + r)ᵗ for growth &nbsp;&nbsp;·&nbsp;&nbsp; f(t) = a(1 − r)ᵗ for decay")}
<p>a is the starting amount and r is the percent change per time period, as a decimal.</p>
${ex("Growth", "A town of 2,000 grows 5% per year: P(t) = 2000(1.05)ᵗ.")}
${ex("Decay", "A car worth $20,000 loses 12% of its value each year: V(t) = 20000(0.88)ᵗ.")}
${ex("Reading a model", "f(t) = 500(0.85)ᵗ decreases by 15% each period, because 1 − 0.85 = 0.15.")}
${ex("Doubling", "Bacteria start at 300 and double every 4 hours: B(t) = 300 · 2^(t/4). After 12 hours: 300 · 2³ = 2,400.")}
${tip("Linear change adds the same amount each time; exponential change multiplies by the same factor.")}`,
  gens: [
    () => { const a = ri(2, 9), b = pick([2, 3]), t = ri(2, b === 2 ? 5 : 3); return { q: `If f(t) = ${a}(${b})<sup>t</sup>, what is f(${t})?`, a: a * b ** t, w: [(a * b) ** t, a * b * t, a + b ** t], e: `${b}<sup>${t}</sup> = ${b ** t}, then × ${a} = ${a * b ** t}.` }; },
    () => { const P0 = ri(2, 9) * 1000, r = pick([3, 4, 5, 6, 8, 10, 12, 15]), up = pick([true, false]); const g = up ? 1 + r / 100 : 1 - r / 100, o = up ? 1 - r / 100 : 1 + r / 100; return { q: `A town has ${P0.toLocaleString("en-US")} people. The population ${up ? "increases" : "decreases"} by ${r}% each year. Which function gives the population t years from now?`, a: `P(t) = ${P0}(${N(g)})<sup>t</sup>`, w: [`P(t) = ${P0}(${N(o)})<sup>t</sup>`, `P(t) = ${P0}(${r})<sup>t</sup>`, `P(t) = ${P0} ${up ? "+" : "−"} ${r}t`], e: `${up ? "Growth" : "Decay"} by ${r}% each year means multiplying by 1 ${up ? "+" : "−"} ${r / 100} = ${N(g)} each year.` }; },
    () => { const f = pick([0.75, 0.8, 0.85, 0.9, 0.95, 1.05, 1.1, 1.2, 1.25, 1.4]), a = ri(2, 9) * 100, p = Math.round(Math.abs(f - 1) * 100), up = f > 1; const ans = `${up ? "Increases" : "Decreases"} by ${p}% each year`; return { q: `The value of an investment is modeled by V(t) = ${a}(${N(f)})<sup>t</sup>, where t is in years. Which describes how V changes?`, a: ans, w: [`${up ? "Decreases" : "Increases"} by ${p}% each year`, `${up ? "Increases" : "Decreases"} by ${Math.round(f * 100)}% each year`, `${up ? "Increases" : "Decreases"} by $${p} each year`], e: `The factor is ${N(f)} = 1 ${up ? "+" : "−"} ${p / 100}, so the value ${up ? "grows" : "shrinks"} by ${p}% each year.` }; },
    () => { const a = ri(1, 9) * 100, d = pick([2, 3, 4, 5, 6]), k = ri(2, 4); return { q: `A bacteria culture starts with ${a} cells and doubles every ${d} hours. How many cells are there after ${k * d} hours?`, a: a * 2 ** k, w: [a * 2 * k, a * 2 ** (k + 1), a + 2 ** k], e: `${k * d} hours is ${k} doublings: ${a} × 2<sup>${k}</sup> = ${a * 2 ** k}.` }; },
  ],
});

M(2, 2, "13", "lesson", "m2d13", "Functions, transformations and nonlinear systems", {
  sum: "Composite functions, graph shifts, undefined values and line–parabola systems.",
  body: `<h3>Composite functions</h3><p>f(g(x)) means: find g(x) first, then put that result into f.</p>
${ex("Example", "f(x) = 2x + 1 and g(x) = x². f(g(3)) = f(9) = 19.")}
<h3>Shifts</h3>${tbl([["Change", "Graph moves"], ["f(x) + k", "up k"], ["f(x) − k", "down k"], ["f(x − k)", "right k"], ["f(x + k)", "left k"]])}
<h3>Undefined values</h3><p>A fraction is undefined when its denominator is 0. f(x) = (x + 1)/(x − 4) is undefined at x = 4.</p>
<h3>Line and parabola</h3><p>A horizontal line y = k meets y = x² in 2 points if k &gt; 0, 1 point if k = 0, and none if k &lt; 0. In general, use Desmos to count crossings.</p>
${tip("f(x − 3) moves the graph <i>right</i>, not left.")}`,
  gens: [
    () => { const a = nz(-5, 5), b = nz(-9, 9), t = nz(-4, 4); return { q: `If f(x) = ${lin(a, b)} and g(x) = x², what is f(g(${N(t)}))?`, a: a * t * t + b, w: [(a * t + b) ** 2, a * t + b, -a * t * t + b], e: `g(${N(t)}) = ${t * t}. Then f(${t * t}) = ${N(a)}(${t * t}) ${sg(b)} = ${N(a * t * t + b)}.` }; },
    () => { const k = ri(2, 9), c = pick(["up", "down", "right", "left"]); const form = { up: `y = f(x) + ${k}`, down: `y = f(x) − ${k}`, right: `y = f(x − ${k})`, left: `y = f(x + ${k})` }[c]; return { q: `How is the graph of ${form} related to the graph of y = f(x)?`, a: `Shifted ${c} ${k} units`, w: ["up", "down", "right", "left"].filter(x => x !== c).map(x => `Shifted ${x} ${k} units`), e: `${c === "up" || c === "down" ? "Adding outside the function moves the graph vertically" : "A change inside the parentheses moves the graph horizontally, in the opposite direction of the sign"}: ${c} ${k}.` }; },
    () => { const a = nz(-9, 9), b = nz(-9, 9); if (a === -b) return null; return { q: `For what value of x is f(x) = (x ${sg(a)})/(x ${sg(-b)}) not defined?`, a: b, w: [-b, -a, a], e: `The denominator x ${sg(-b)} is 0 when x = ${N(b)}.` }; },
    () => { const k = pick([-9, -4, -1, 0, 1, 4, 9, 16]), c = nz(-5, 5); const ans = k > 0 ? "2" : k === 0 ? "1" : "0"; return { q: `How many points do the graphs of y = ${quad(1, 0, c)} and y = ${N(k + c)} have in common?`, a: ans, w: ["0", "1", "2", "Infinitely many"].filter(x => x !== ans), e: `Set them equal: x² ${sg(c)} = ${N(k + c)} → x² = ${N(k)}. ${k > 0 ? "A positive number has two square roots" : k === 0 ? "Only x = 0 works" : "No real number squared is negative"}, so ${ans} point${ans === "1" ? "" : "s"}.` }; },
  ],
});
M(2, 2, "14", "review", "m2d14", "Advanced Math review", { from: ["m2d8", "m2d9", "m2d10", "m2d11", "m2d12", "m2d13"], n: 10, sum: "Mixed SAT Advanced Math quiz." });

M(2, 3, "15", "lesson", "m2d15", "Ratios, rates and unit conversion", {
  sum: "Unit rates, distance = rate × time, and converting units.",
  body: `${box("distance = rate × time")}
${ex("Rate", "A car goes 150 miles in 3 hours: 50 miles per hour. In 5 hours it goes 250 miles.")}
<h3>Unit conversion</h3><p>Multiply by a fraction equal to 1, with the unit you want on top and the unit you are cancelling on the bottom.</p>
${ex("Example", "12 feet per second × 60 seconds / 1 minute = 720 feet per minute.")}
${tbl([["Conversion", ""], ["1 foot", "12 inches"], ["1 yard", "3 feet"], ["1 hour", "60 minutes"], ["1 minute", "60 seconds"], ["1 kilometer", "1,000 meters"]])}
${tip("Write the units next to every number; units that cancel tell you whether to multiply or divide.")}`,
  gens: [
    () => { const [u1, u2, f] = pick([["feet", "inches", 12], ["yards", "feet", 3], ["hours", "minutes", 60], ["minutes", "seconds", 60], ["kilometers", "meters", 1000]]), n = ri(2, 15); return { q: `How many ${u2} are in ${n} ${u1}?`, a: n * f, w: [n + f, isInt(n / f) ? n / f : n * f / 10, n * f * 2], e: `1 ${u1.slice(0, -1)} = ${f} ${u2}, so ${n} × ${f} = ${n * f}.` }; },
    () => { const s = ri(30, 75), t = ri(2, 5), T = ri(2, 9); return { q: `A car travels ${s * t} miles in ${t} hours at a constant speed. How far does it travel in ${T} hours at the same speed?`, a: s * T, w: [s * t * T, s * t + T, s + T], e: `Speed = ${s * t} ÷ ${t} = ${s} mph. Distance = ${s} × ${T} = ${s * T} miles.` }; },
    () => { const x = ri(3, 25); return { q: `An object moves at ${x} feet per second. What is its speed in feet per minute?`, a: 60 * x, w: [x * 3600, x + 60, Math.round(x / 60 * 100) / 100], e: `${x} ft/s × 60 s/min = ${60 * x} ft/min.` }; },
  ],
});

M(2, 3, "16", "lesson", "m2d16", "Percent change and repeated percents", {
  sum: "Percent increase and decrease, original price, and successive changes.",
  body: `${box("percent change = (new − old) / old × 100%")}
${ex("Example", "From 80 to 100: (100 − 80)/80 = 0.25 → a 25% increase.")}
<h3>Finding the original</h3>${ex("Example", "After a 20% discount, a shirt costs $48. 0.80 × original = 48, so original = 48 ÷ 0.80 = $60.")}
<h3>Successive changes</h3><p>Multiply the factors. +20% then −20%: 1.20 × 0.80 = 0.96, a 4% decrease overall (not 0%).</p>
${tip("Percent change is always measured from the <i>original</i> value.")}`,
  gens: [
    () => { const a = ri(2, 20) * 20, p = pick([5, 10, 15, 20, 25, 30, 40, 50]), up = pick([true, false]), b = a * (1 + (up ? p : -p) / 100); const dir = up ? "increase" : "decrease", o = up ? "decrease" : "increase"; return { q: `A value changes from ${a} to ${N(b)}. What is the percent change?`, a: `${p}% ${dir}`, w: [`${p}% ${o}`, `${N(Math.abs(b - a))}% ${dir}`, `${N(Math.round(Math.abs(b - a) / b * 1000) / 10)}% ${dir}`], e: `(${N(b)} − ${a}) / ${a} = ${N((b - a) / a)} → ${p}% ${dir}.` }; },
    () => { const p = pick([10, 20, 30, 40, 50]), d = p * p / 100; return { q: `A price is increased by ${p}% and then the new price is decreased by ${p}%. What is the overall change from the original price?`, a: `${N(d)}% decrease`, w: ["No change", `${N(d)}% increase`, `${2 * p}% decrease`], e: `${1 + p / 100} × ${1 - p / 100} = ${N(1 - d / 100)}, which is a ${N(d)}% decrease.` }; },
    () => { const p = pick([10, 20, 25, 40, 50]), O = ri(2, 30) * 20, Sp = O * (1 - p / 100); return { q: `After a ${p}% discount, a pair of shoes costs $${N(Sp)}. What was the original price, in dollars?`, a: O, w: [Sp * (1 + p / 100), Sp + p, O * (1 - p / 100) * (1 - p / 100)], e: `${N(1 - p / 100)} × original = ${N(Sp)}, so original = ${N(Sp)} ÷ ${N(1 - p / 100)} = ${O}.` }; },
  ],
});

M(2, 3, "17", "lesson", "m2d17", "Mean, median and outliers", {
  sum: "Center of data, adding values, and how outliers change the mean.",
  body: `<p>Review: mean = sum ÷ count; median = middle value of sorted data (average of the two middle values for an even count).</p>
${ex("Even count", "Median of 3, 5, 8, 12 is (5 + 8)/2 = 6.5.")}
<h3>Adding a value</h3>${ex("Example", "The mean of 5 numbers is 12 (sum 60). A sixth number, 18, is added: new mean = 78 ÷ 6 = 13.")}
<h3>Outliers</h3><p>An outlier is a value far from the rest. It pulls the mean toward it a lot, but barely moves the median. Removing a very large outlier decreases the mean much more than the median.</p>
${tip("SAT questions often ask “which changes more, the mean or the median?” The answer is almost always the mean.")}`,
  gens: [
    () => { const n = ri(4, 6), v = Array.from({ length: n }, () => ri(1, 30)); const s = v.reduce((a, b) => a + b, 0); v[n - 1] += (n - s % n) % n; const sum = v.reduce((a, b) => a + b, 0); return { q: `What is the mean of ${v.join(", ")}?`, a: sum / n, w: [median(v), sum, sum / (n - 1)], e: `${sum} ÷ ${n} = ${sum / n}.` }; },
    () => { let v; do v = Array.from({ length: 6 }, () => ri(1, 40)); while (median(v) === v.reduce((a, b) => a + b, 0) / 6); const s = v.slice().sort((a, b) => a - b); return { q: `What is the median of ${v.join(", ")}?`, a: median(v), w: [s[2], s[3], Math.round(v.reduce((a, b) => a + b, 0) / 6 * 10) / 10], e: `Sorted: ${s.join(", ")}. The two middle values are ${s[2]} and ${s[3]}; their average is ${N(median(v))}.` }; },
    () => { const n = ri(3, 8), Mn = ri(10, 30), M2 = Mn + nz(-4, 6), v = (n + 1) * M2 - n * Mn; if (v <= 0) return null; return { q: `The mean of ${n} numbers is ${Mn}. When one more number, ${v}, is added, what is the new mean?`, a: M2, w: [(Mn + v) / 2, Mn, M2 + 1], e: `Old sum = ${n} × ${Mn} = ${n * Mn}. New sum = ${n * Mn + v}. New mean = ${n * Mn + v} ÷ ${n + 1} = ${M2}.` }; },
    fixed([
      ["A data set includes one value that is much larger than all the others. If this value is removed, what happens?", "The mean decreases more than the median", ["The median decreases more than the mean", "The mean increases", "Neither the mean nor the median changes"], "A large outlier pulls the mean up a lot. Removing it lowers the mean noticeably, while the median barely moves."],
      ["Which measure is least affected by an outlier?", "The median", ["The mean", "The range", "The sum"], "The median depends only on the middle position, so one extreme value hardly changes it."],
      ["A data set has a very small outlier. Compared with the median, the mean is most likely:", "Smaller", ["Larger", "Equal", "Impossible to compare"], "A very small value pulls the mean down, below the median."],
    ]),
  ],
});

M(2, 3, "18", "lesson", "m2d18", "Spread: standard deviation and box plots", {
  sum: "Compare spread without heavy calculation; read box plots.",
  body: `<p><b>Standard deviation</b> (SD) measures how spread out the data is from the mean. You almost never calculate it on the SAT; you compare it.</p>
<ul><li>Data bunched close to the mean → small SD.</li><li>Data spread far from the mean → large SD.</li><li>Adding the same number to every value: mean changes, SD stays the same.</li><li>Multiplying every value by k: mean and SD are both multiplied by k.</li></ul>
<h3>Box plots</h3><p>A box plot shows 5 numbers: minimum, Q1, median, Q3, maximum.</p>
${box("interquartile range (IQR) = Q3 − Q1 &nbsp;&nbsp;·&nbsp;&nbsp; range = max − min")}
${tip("Same mean does not mean same spread. 49, 50, 51 and 10, 50, 90 both have mean 50.")}`,
  gens: [
    () => { const c = ri(3, 12); return { q: `The same number, ${c}, is added to every value in a data set. How do the mean and the standard deviation change?`, a: `The mean increases by ${c}; the standard deviation does not change.`, w: [`Both increase by ${c}.`, `The mean does not change; the standard deviation increases by ${c}.`, `Neither changes.`], e: `Shifting all values moves the center by ${c} but keeps the distances between values the same, so the spread is unchanged.` }; },
    () => { const m = ri(20, 60), s1 = ri(1, 2), s2 = ri(8, 15); const A = [m - 2 * s1, m - s1, m, m + s1, m + 2 * s1], B = [m - 2 * s2, m - s2, m, m + s2, m + 2 * s2]; const sw = pick([true, false]); const X = sw ? B : A, Y = sw ? A : B; return { q: `Set A: ${X.map(N).join(", ")}. Set B: ${Y.map(N).join(", ")}. Which set has the larger standard deviation?`, a: sw ? "Set A" : "Set B", w: [sw ? "Set B" : "Set A", "They are equal", "It cannot be determined"], e: `Both sets have mean ${m}, but ${sw ? "Set A" : "Set B"} is much more spread out from the mean, so its standard deviation is larger.` }; },
    () => { const mn = ri(1, 20), q1 = mn + ri(3, 10), md = q1 + ri(2, 10), q3 = md + ri(2, 10), mx = q3 + ri(3, 15); return { q: `A box plot shows: minimum ${mn}, first quartile ${q1}, median ${md}, third quartile ${q3}, maximum ${mx}. What is the interquartile range?`, a: q3 - q1, w: [mx - mn, md - q1, q3 - md + 1], e: `IQR = Q3 − Q1 = ${q3} − ${q1} = ${q3 - q1}.` }; },
    () => { const k = ri(2, 5); return { q: `Every value in a data set is multiplied by ${k}. What happens to the standard deviation?`, a: `It is multiplied by ${k}.`, w: ["It does not change.", `It increases by ${k}.`, `It is divided by ${k}.`], e: `Multiplying stretches every distance from the mean by ${k}, so the standard deviation is multiplied by ${k}.` }; },
  ],
});

M(2, 3, "19", "lesson", "m2d19", "Scatter plots and lines of best fit", {
  sum: "Make predictions, interpret slope, and find residuals.",
  body: `<p>A line of best fit shows the trend in a scatter plot. Use its equation to predict.</p>
${ex("Prediction", "Line of best fit y = 1.5x + 12. At x = 10, the predicted y = 1.5(10) + 12 = 27.")}
${box("residual = actual value − predicted value")}
${ex("Residual", "If the actual value at x = 10 is 30, the residual is 30 − 27 = 3 (the point is above the line).")}
<h3>Interpreting</h3><p>The slope is the predicted change in y for each 1-unit increase in x. The intercept is the predicted y when x = 0.</p>
${tip("Words like <i>predicted</i> or <i>estimated</i> matter: the line gives estimates, not exact values.")}`,
  gens: [
    () => { const m = pick([0.5, 1.5, 2, 2.5, 3, 4]), b = ri(2, 30), x = 2 * ri(2, 15); return { q: `The line of best fit for a scatter plot is y = ${N(m)}x + ${b}. What is the predicted value of y when x = ${x}?`, a: m * x + b, w: [m * x, m + b, b * x + m], e: `y = ${N(m)}(${x}) + ${b} = ${N(m * x)} + ${b} = ${N(m * x + b)}.` }; },
    () => { const m = pick([1.5, 2, 2.5, 3]), b = ri(2, 30), x = 2 * ri(2, 12), pr = m * x + b, act = pr + nz(-6, 6); return { q: `A line of best fit is y = ${N(m)}x + ${b}. One data point is (${x}, ${N(act)}). What is the residual for this point?`, a: act - pr, w: [pr - act, act, pr], e: `Predicted: ${N(pr)}. Residual = actual − predicted = ${N(act)} − ${N(pr)} = ${N(act - pr)}.` }; },
    () => { const m = pick([1.2, 2.4, 3.5, 0.8]), b = ri(5, 20); return { q: `The line of best fit y = ${N(m)}x + ${b} models a plant's height y, in centimeters, x weeks after it was planted. What does ${N(m)} represent?`, a: `The predicted growth of the plant each week, in centimeters`, w: [`The plant's height when it was planted`, `The number of weeks needed to grow ${N(m)} cm`, `The plant's height after ${N(m)} weeks`], e: `${N(m)} is the slope: the predicted change in height (cm) for each additional week.` }; },
  ],
});

M(2, 3, "20", "lesson", "m2d20", "Probability, two-way tables and inference", {
  sum: "Probability from tables, estimating from samples, and margin of error.",
  body: `${box("probability = favorable outcomes / total outcomes")}
<h3>Two-way tables</h3><p>Read the question carefully to find the right total. “Given that a senior is chosen” means the total is only the seniors row.</p>
<h3>Samples and inference</h3><ul><li>A random sample can be used to estimate the whole population: if 30% of a random sample says yes, about 30% of the population would say yes.</li><li>A margin of error gives a likely range: 45% ± 3% means the true value is probably between 42% and 48%.</li><li>Results only apply to the population the sample was randomly chosen from.</li></ul>
${tip("A bigger random sample gives a smaller margin of error.")}`,
  gens: [
    () => { const jA = ri(10, 60), jB = ri(10, 60), sA = ri(10, 60), sB = ri(10, 60), tot = jA + jB + sA + sB; return { q: `Students were asked which club they prefer.${tbl([["", "Chess", "Robotics", "Total"], ["Juniors", jA, jB, jA + jB], ["Seniors", sA, sB, sA + sB], ["Total", jA + sA, jB + sB, tot]])}If a senior is chosen at random, what is the probability that the senior prefers Robotics?`, a: F(sB, sA + sB), w: [F(sB, tot), F(sB, jB + sB), F(sA, sA + sB)], e: `Only seniors count: ${sA + sB} seniors, and ${sB} prefer Robotics. Probability = ${sB}/${sA + sB} = ${F(sB, sA + sB)}.` }; },
    () => { const n = pick([40, 50, 80, 100, 200]), f = pick([[1, 4], [1, 5], [2, 5], [3, 10], [3, 4], [3, 5]]), k = n * f[0] / f[1], Np = pick([600, 1200, 2000, 3000, 4000]); const ans = Np * f[0] / f[1]; return { q: `In a random sample of ${n} students from a school of ${Np.toLocaleString("en-US")}, ${k} said they walk to school. Based on the sample, about how many students in the school walk to school?`, a: ans, w: [k, Np - ans, ans / 2], e: `${k}/${n} = ${F(k, n)} of the sample. ${F(k, n)} × ${Np} = ${ans}.` }; },
    () => { const p = ri(30, 70), m = ri(2, 6); return { q: `A survey estimates that ${p}% of voters support a plan, with a margin of error of ${m}%. Which is the most reasonable conclusion?`, a: `The true percent is likely between ${p - m}% and ${p + m}%.`, w: [`Exactly ${p}% of voters support the plan.`, `The true percent is likely between ${p}% and ${p + m}%.`, `The true percent is likely between ${p - 2 * m}% and ${p + 2 * m}%.`], e: `A margin of error gives a range on both sides: ${p} − ${m} to ${p} + ${m}.` }; },
    () => { const r = ri(2, 9), b = ri(2, 9), g = ri(2, 9), t = r + b + g; return { q: `A bag has ${r} red, ${b} blue and ${g} green marbles. One marble is picked at random. What is the probability that it is NOT red?`, a: F(b + g, t), w: [F(r, t), F(b + g, r), F(b, t)], e: `Not red = ${b} + ${g} = ${b + g} of ${t} marbles: ${F(b + g, t)}.` }; },
  ],
});
M(2, 3, "21", "review", "m2d21", "Problem-Solving and Data Analysis review", { from: ["m2d15", "m2d16", "m2d17", "m2d18", "m2d19", "m2d20"], n: 10, sum: "Mixed SAT data analysis quiz." });

M(2, 4, "22", "lesson", "m2d22", "Angles, parallel lines and triangles", {
  sum: "Angle sums, supplementary and vertical angles, and parallel lines.",
  body: `${tbl([["Fact", "Rule"], ["Angles in a triangle", "add up to 180°"], ["Angles on a straight line (supplementary)", "add up to 180°"], ["Vertical angles", "are equal"], ["Exterior angle of a triangle", "= sum of the two opposite interior angles"], ["Parallel lines cut by a transversal", "alternate interior and corresponding angles are equal; same-side interior angles add to 180°"]])}
${ex("Example", "A triangle has angles 47° and 68°. The third angle is 180 − 47 − 68 = 65°.")}
${ex("Exterior angle", "If two interior angles are 50° and 60°, the exterior angle at the third vertex is 110°.")}
${tip("Mark every angle you find on your scratch paper. One angle often unlocks the others.")}`,
  gens: [
    () => { const a = ri(20, 90), b = ri(20, 150 - a); return { q: `Two angles of a triangle measure ${a}° and ${b}°. What is the measure of the third angle, in degrees?`, a: 180 - a - b, w: [a + b, 360 - a - b, 90 - Math.abs(a - b)], e: `180 − ${a} − ${b} = ${180 - a - b}.` }; },
    () => { const x = ri(15, 165); if (x === 90) return null; return { q: `Two angles form a straight line. One measures ${x}°. What is the other angle, in degrees?`, a: 180 - x, w: [x, 360 - x, Math.abs(90 - x)], e: `Angles on a line add to 180: 180 − ${x} = ${180 - x}.` }; },
    () => { const a = ri(25, 80), b = ri(25, 80); return { q: `In a triangle, two interior angles measure ${a}° and ${b}°. What is the exterior angle at the third vertex, in degrees?`, a: a + b, w: [180 - a - b, 180 - a, Math.abs(a - b)], e: `The exterior angle equals the sum of the two opposite interior angles: ${a} + ${b} = ${a + b}.` }; },
    () => { const x = ri(20, 160); if (x === 90) return null; const kind = pick(["alt", "same"]); return kind === "alt" ? { q: `Two parallel lines are cut by a transversal. One angle measures ${x}°. What is the measure of its alternate interior angle?`, a: x, w: [180 - x, Math.abs(90 - x), 2 * x], e: `Alternate interior angles are equal: ${x}°.` } : { q: `Two parallel lines are cut by a transversal. One angle measures ${x}°. What is the measure of the same-side interior angle paired with it?`, a: 180 - x, w: [x, Math.abs(90 - x), 360 - x], e: `Same-side interior angles add to 180°: 180 − ${x} = ${180 - x}.` }; },
  ],
});

M(2, 4, "23", "lesson", "m2d23", "Pythagorean theorem and special right triangles", {
  sum: "Find missing sides; 45-45-90 and 30-60-90 triangles.",
  body: `${box("a² + b² = c² &nbsp;&nbsp;(c is the hypotenuse, the side across from the right angle)")}
${ex("Example", "Legs 6 and 8: c² = 36 + 64 = 100, so c = 10.")}
<p>Common triples (and their multiples): 3-4-5, 5-12-13, 8-15-17, 7-24-25.</p>
<h3>Special right triangles</h3>
${tbl([["Triangle", "Sides"], ["45°-45°-90°", "x : x : x√2"], ["30°-60°-90°", "x : x√3 : 2x (short leg : long leg : hypotenuse)"]])}
${ex("Example", "A 30-60-90 triangle with short leg 5 has hypotenuse 10 and long leg 5√3.")}
${tip("The hypotenuse is always the longest side. If your answer is shorter than a leg, check your work.")}`,
  gens: [
    () => { const [a, b, c] = pick(TRIPLES), k = ri(1, 4); return { q: `A right triangle has legs of length ${a * k} and ${b * k}. What is the length of the hypotenuse?`, a: c * k, w: [(a + b) * k, (c + 1) * k, (b - a + c) * k], e: `${a * k}² + ${b * k}² = ${(a * k) ** 2 + (b * k) ** 2} = ${c * k}². So the hypotenuse is ${c * k}.` }; },
    () => { const [a, b, c] = pick(TRIPLES), k = ri(1, 4); return { q: `A right triangle has a hypotenuse of ${c * k} and one leg of ${a * k}. What is the length of the other leg?`, a: b * k, w: [(c - a) * k, (c + a) * k, a * k + 1], e: `${c * k}² − ${a * k}² = ${(c * k) ** 2 - (a * k) ** 2} = ${b * k}². The other leg is ${b * k}.` }; },
    () => { const s = ri(2, 12); return { q: `In a 45°-45°-90° triangle, each leg is ${s}. What is the hypotenuse?`, a: `${s}√2`, w: [`${2 * s}`, `${s}√3`, `${2 * s}√2`], e: `The sides are x : x : x√2, so the hypotenuse is ${s}√2.` }; },
    () => { const s = ri(2, 12), ask = pick(["hyp", "long"]); return ask === "hyp" ? { q: `In a 30°-60°-90° triangle, the shortest side is ${s}. What is the hypotenuse?`, a: `${2 * s}`, w: [`${s}√3`, `${s}√2`, `${3 * s}`], e: `The sides are x : x√3 : 2x, so the hypotenuse is 2 × ${s} = ${2 * s}.` } : { q: `In a 30°-60°-90° triangle, the shortest side is ${s}. What is the length of the longer leg?`, a: `${s}√3`, w: [`${2 * s}`, `${s}√2`, `${2 * s}√3`], e: `The sides are x : x√3 : 2x, so the longer leg is ${s}√3.` }; },
  ],
});

M(2, 4, "24", "lesson", "m2d24", "Similar triangles", {
  sum: "Scale factors for sides and areas; shadow problems.",
  body: `<p>Similar triangles have the same angles and proportional sides. If the scale factor is k, every side is multiplied by k.</p>
${box("sides × k &nbsp;&nbsp;·&nbsp;&nbsp; areas × k²")}
${ex("Example", "Triangle ABC ~ triangle DEF, AB = 4 and DE = 12, so k = 3. If BC = 5, then EF = 15. If the area of ABC is 10, the area of DEF is 10 × 9 = 90.")}
${ex("Shadows", "A 6 ft person casts a 4 ft shadow. At the same time a tree casts a 20 ft shadow. 6/4 = h/20 → h = 30 ft.")}
${tip("Match corresponding sides by their position (or the equal angles), not by size alone.")}`,
  gens: [
    () => { const k = ri(2, 5), p = ri(2, 9), q = ri(2, 12); return { q: `Triangle ABC is similar to triangle DEF. AB = ${p}, DE = ${k * p} and BC = ${q}. What is EF?`, a: k * q, w: [q + (k * p - p), q * p, isInt(q / k) ? q / k : q + k], e: `Scale factor = ${k * p}/${p} = ${k}. EF = ${k} × ${q} = ${k * q}.` }; },
    () => { const k = ri(2, 5), A = ri(3, 20); return { q: `Two similar triangles have a scale factor of ${k} (the larger to the smaller). The smaller triangle has an area of ${A}. What is the area of the larger triangle?`, a: k * k * A, w: [k * A, 2 * k * A, A + k], e: `Areas scale by k² = ${k * k}: ${A} × ${k * k} = ${k * k * A}.` }; },
    () => { const s1 = ri(2, 8), r = ri(2, 6), h1 = s1 * ri(1, 3), s2 = s1 * r; return { q: `${[8, 11, 18].includes(h1) ? "An" : "A"} ${h1}-foot pole casts a ${s1}-foot shadow. At the same time, a tree casts a ${s2}-foot shadow. How tall is the tree, in feet?`, a: h1 * r, w: [s2 * s1 / h1, h1 + s2 - s1, s2], e: `${h1}/${s1} = h/${s2} → h = ${h1} × ${s2} ÷ ${s1} = ${h1 * r}.` }; },
  ],
});

M(2, 4, "25", "lesson", "m2d25", "Area and volume", {
  sum: "Circles, cylinders, boxes and spheres (answers in terms of π).",
  body: `${tbl([["Shape", "Formula"], ["Circle area", "πr²"], ["Circle circumference", "2πr"], ["Rectangular box volume", "l × w × h"], ["Cylinder volume", "πr²h"], ["Sphere volume", "(4/3)πr³"], ["Cone volume", "(1/3)πr²h"]])}
<p>These formulas are on the SAT reference sheet, but knowing them saves time.</p>
${ex("Example", "A cylinder with radius 3 and height 5: V = π(9)(5) = 45π.")}
${ex("Example", "A sphere with radius 3: V = (4/3)π(27) = 36π.")}
${tip("Diameter = 2 × radius. If a question gives the diameter, halve it first.")}`,
  gens: [
    () => { const r = ri(3, 12); return { q: `A circle has a radius of ${r}. What is its area?`, a: `${r * r}π`, w: [`${2 * r}π`, `${r}π`, `${4 * r * r}π`], e: `A = πr² = π(${r})² = ${r * r}π.` }; },
    () => { const r = ri(2, 6), h = ri(2, 10); return { q: `A cylinder has a radius of ${r} and a height of ${h}. What is its volume?`, a: `${r * r * h}π`, w: [`${2 * r * h}π`, `${r * h}π`, `${(2 * r) ** 2 * h}π`], e: `V = πr²h = π(${r * r})(${h}) = ${r * r * h}π.` }; },
    () => { const l = ri(2, 12), w = ri(2, 10), h = ri(2, 9); return { q: `A rectangular box is ${l} cm long, ${w} cm wide and ${h} cm tall. What is its volume, in cubic centimeters?`, a: l * w * h, w: [2 * (l * w + l * h + w * h), l + w + h, l * w], e: `V = ${l} × ${w} × ${h} = ${l * w * h}.` }; },
    () => { const r = pick([3, 6]); return { q: `A sphere has a radius of ${r}. What is its volume?`, a: `${4 * r ** 3 / 3}π`, w: [`${4 * r * r}π`, `${r ** 3}π`, `${8 * r ** 3 / 3}π`], e: `V = (4/3)πr³ = (4/3)π(${r ** 3}) = ${4 * r ** 3 / 3}π.` }; },
  ],
});

M(2, 4, "26", "lesson", "m2d26", "Circles: equations, arcs and radians", {
  sum: "Center and radius from an equation, arc length, sectors and radians.",
  body: `${box("(x − h)² + (y − k)² = r² &nbsp;→&nbsp; center (h, k), radius r")}
${ex("Example", "(x + 2)² + (y − 5)² = 49 has center (−2, 5) and radius 7.")}
<h3>Arcs and sectors</h3>${box("arc length = (θ/360) × 2πr &nbsp;&nbsp;·&nbsp;&nbsp; sector area = (θ/360) × πr²")}
${ex("Example", "Radius 6, central angle 60°: arc = (60/360)(12π) = 2π.")}
<h3>Radians</h3>${box("180° = π radians")}
<p>To convert degrees to radians, multiply by π/180: 90° = π/2, 60° = π/3, 45° = π/4.</p>
${tip("The equation shows r², not r. If the right side is 49, the radius is 7.")}`,
  gens: [
    () => { const h = nz(-8, 8), k = nz(-8, 8), r = ri(2, 9); const eq = `(x ${sg(-h)})² + (y ${sg(-k)})² = ${r * r}`; return { q: `What are the center and radius of the circle ${eq}?`, a: `Center ${pt(h, k)}, radius ${r}`, w: [`Center ${pt(-h, -k)}, radius ${r}`, `Center ${pt(h, k)}, radius ${r * r}`, `Center ${pt(-h, -k)}, radius ${r * r}`], e: `Compare with (x − h)² + (y − k)² = r²: h = ${N(h)}, k = ${N(k)}, r = √${r * r} = ${r}.` }; },
    () => { const r = ri(2, 12), t = pick([30, 45, 60, 90, 120, 150, 180]); return { q: `A circle has a radius of ${r}. What is the length of an arc with a central angle of ${t}°?`, a: piF(t * 2 * r, 360), w: [piF(t * r * r, 360), piF(t * 2 * r, 180), piF(t * r, 180 * 4)], e: `Arc = (${t}/360) × 2π(${r}) = ${piF(t * 2 * r, 360)}.` }; },
    () => { const t = pick([30, 45, 60, 90, 120, 135, 150, 270]); return { q: `What is ${t}° in radians?`, a: piF(t, 180), w: [piF(180, t), piF(t, 360), `${t}π`], e: `Multiply by π/180: ${t} × π/180 = ${piF(t, 180)}.` }; },
    () => { const r = ri(2, 10), t = pick([30, 45, 60, 90, 120, 180]); return { q: `A circle has a radius of ${r}. What is the area of a sector with a central angle of ${t}°?`, a: piF(t * r * r, 360), w: [piF(t * 2 * r, 360), piF(r * r, 1), piF(t * r * r, 180)], e: `Sector = (${t}/360) × π(${r * r}) = ${piF(t * r * r, 360)}.` }; },
  ],
});

M(2, 4, "27", "lesson", "m2d27", "Right-triangle trigonometry", {
  sum: "SOH-CAH-TOA, and sine and cosine of complementary angles.",
  body: `${box("sin = opposite / hypotenuse &nbsp;·&nbsp; cos = adjacent / hypotenuse &nbsp;·&nbsp; tan = opposite / adjacent")}
<p>Remember it as SOH-CAH-TOA. “Opposite” and “adjacent” depend on which angle you are looking from.</p>
${ex("Example", "Right triangle with sides 5, 12, 13. For the angle opposite the 5: sin = 5/13, cos = 12/13, tan = 5/12.")}
<h3>Complementary angles</h3>${box("sin(x°) = cos(90° − x°)")}
<p>In a right triangle, the two acute angles A and B add to 90°, so sin A = cos B.</p>
${ex("Example", "If sin(x°) = cos(25°), then x = 65.")}
${tip("The hypotenuse is never “opposite” or “adjacent”; it is always across from the right angle.")}`,
  gens: [
    () => { const [a, b, c] = pick(TRIPLES), f = pick(["sin", "cos", "tan"]); const ans = { sin: F(a, c), cos: F(b, c), tan: F(a, b) }[f]; return { q: `In right triangle ABC, angle C is the right angle, BC = ${a}, AC = ${b} and AB = ${c}. What is ${f} A?`, a: ans, w: [F(a, c), F(b, c), F(a, b), F(b, a), F(c, a)].filter(x => x !== ans), e: `From angle A: opposite = BC = ${a}, adjacent = AC = ${b}, hypotenuse = AB = ${c}. ${f} A = ${ans}.` }; },
    () => { const x = ri(10, 80); if (x === 45) return null; return { q: `If sin(${x}°) = cos(y°), where 0 &lt; y &lt; 90, what is y?`, a: 90 - x, w: [x, 180 - x, 90 + x], e: `sin(x°) = cos(90° − x°), so y = 90 − ${x} = ${90 - x}.` }; },
    () => { const [a, b, c] = pick(TRIPLES); return { q: `In a right triangle, the two acute angles are A and B, and sin A = ${a}/${c}. What is cos B?`, a: F(a, c), w: [F(b, c), F(a, b), F(c, a)], e: `A and B are complementary, so cos B = sin A = ${a}/${c}.` }; },
  ],
});
M(2, 4, "28", "review", "m2d28", "Geometry and Trigonometry review", { from: ["m2d22", "m2d23", "m2d24", "m2d25", "m2d26", "m2d27"], n: 10, sum: "Mixed SAT geometry and trig quiz." });
M(2, 4, "29", "task", "m2d29", "Full Math practice test", { sum: "Take a full Math test and log every mistake.", body: `<p>Take a full two-module Math test under real timing (2 × 35 minutes). Then write every missed question in your error notebook.</p>`, act: [["tests", "Open Math tests"]] });
M(2, 4, "30", "task", "m2d30", "Fix your weakest topics", { sum: "Rework the 2–3 topics with the most mistakes.", body: `<p>Look at your error notebook and the <b>Progress</b> page. Pick the 2 or 3 topics with the most mistakes, go back to those lessons in this course, then practice them in <b>Quick Practice</b>.</p>`, act: [["quick", "Open Quick Practice"], ["progress", "Open Progress"]] });

/* ===== MONTH 3: HARD QUESTIONS AND FULL TESTS ===== */
const m3 = [
  ["Your 3 weakest topics", "Work on the 3 weakest topics from your error notebook. Do about 25 Medium questions a day in Quick Practice, and review the matching lessons from Month 2."],
  ["Algebra and Advanced Math, harder", "Each day: 15 Medium + 10 Hard questions on Algebra and Advanced Math in Quick Practice. Write every mistake in your error notebook."],
  ["Data analysis and Geometry, harder", "Each day: 15 Medium + 10 Hard questions on Problem-Solving and Data Analysis and Geometry and Trigonometry. Check answers with Desmos where you can."],
  ["Mistakes and timing", "Redo only the question types you missed on tests. Practice finishing each 35-minute module in about 30 minutes so you have time to check."],
];
m3.forEach(([t, b], i) => {
  M(3, i + 1, `${i * 7 + 1}–${i * 7 + 6}`, "task", `m3w${i + 1}a`, t, { sum: "6 days of focused practice.", body: `<p>${b}</p>`, act: [["quick", "Open Quick Practice"]] });
  M(3, i + 1, `${i * 7 + 7}`, "task", `m3w${i + 1}b`, `Full test ${i + 2}`, { sum: "Sunday: a full Math test under real timing.", body: `<p>Take a full Math test under real timing, then review every mistake the same day. Compare your score with last week.</p>`, act: [["tests", "Open Math tests"], ["history", "Open History"]] });
});
M(3, 4, "29–30", "task", "m3d29", "Final review and rest", { sum: "Light review before test day.", body: `<p>Re-read your error notebook and the formula list. Do a few easy questions to stay sharp, sleep well, and don't start new topics.</p>`, act: [["quick", "Open Quick Practice"]] });

const MONTHS = { 1: ["Month 1", "Foundations", "Numbers, fractions, equations and graphs: the basics every SAT question needs."], 2: ["Month 2", "SAT topics", "The four SAT Math domains, most common topics first."], 3: ["Month 3", "Hard questions and full tests", "Harder practice and a full test every week."] };
const WEEKS = { "1-1": "Arithmetic", "1-2": "Introduction to algebra", "1-3": "Lines and graphs", "1-4": "Moving to the SAT", "2-1": "Algebra", "2-2": "Advanced Math", "2-3": "Problem-Solving and Data Analysis", "2-4": "Geometry and Trigonometry", "3-1": "Week 1", "3-2": "Week 2", "3-3": "Week 3", "3-4": "Week 4" };
const BY = Object.fromEntries(C.map((x, i) => [x.id, Object.assign(x, { i })]));

/* ---------- progress ---------- */
function prog() { if (!SETTINGS.course || typeof SETTINGS.course !== "object") SETTINGS.course = { done: {} }; if (!SETTINGS.course.done) SETTINGS.course.done = {}; return SETTINGS.course.done; }
function save() { try { persist(JSON.parse(JSON.stringify(SETTINGS))); } catch (e) { } }
const isDone = id => !!(prog()[id] && prog()[id].ok);
const unlocked = it => it.i === 0 || isDone(C[it.i - 1].id);
const current = () => C.find(x => !isDone(x.id)) || null;
function mark(id, data) { const d = prog(); d[id] = Object.assign({}, d[id] || {}, data); save(); }

/* ---------- quiz building ---------- */
function makeQuiz(it) {
  let gens, n;
  if (it.kind === "lesson") { gens = it.gens.map(g => [g]); n = 5; }
  else { gens = it.from.map(id => BY[id].gens); n = it.n; }
  const out = [], seen = new Set();
  let order = [];
  for (let guard = 0; out.length < n && guard < n * 20; guard++) {
    if (!order.length) order = shuf(gens.map((_, k) => k));
    const pool = gens[order.pop()], q = build(pick(pool));
    if (q && !seen.has(q.q)) { seen.add(q.q); out.push(q); }
  }
  return out;
}

/* ---------- styles ---------- */
const CSS = `
.crbar{height:10px;border-radius:999px;background:var(--surface2);overflow:hidden;margin:10px 0 4px}
.crbar i{display:block;height:100%;background:linear-gradient(90deg,var(--g1),var(--g2));border-radius:inherit}
.crmon{display:grid;gap:14px}
.crmon h2{margin:0}
.crwk{margin:6px 0 2px;font:700 13px var(--ui);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.crlist{display:grid;gap:8px}
.critem{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:12px 14px;border:1.5px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}
.critem:hover:not(:disabled){border-color:var(--primary)}
.critem:disabled{cursor:not-allowed;opacity:.55}
.critem.cur{border-color:var(--primary);background:var(--sel)}
.critem .crs{flex:none;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface2);color:var(--muted);font:700 13px var(--ui)}
.critem.ok .crs{background:var(--ok-bg);color:var(--ok)}
.critem.cur .crs{background:var(--primary);color:var(--primary-ink)}
.critem .crs svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.critem b{display:block;font-weight:700}
.critem small{display:block;color:var(--muted);font-size:.86rem}
.critem .crk{margin-left:auto;font:700 12px var(--ui);color:var(--muted);white-space:nowrap}
.crbody{font-size:1.02rem;line-height:1.65}
.crbody h3{margin:22px 0 8px}
.crbody ul,.crol{margin:0 0 12px;padding-left:22px}
.crbody li{margin:4px 0}
.crx{font:700 1.02rem/1.5 var(--ui);background:var(--sel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:12px 0;text-align:center}
.crex{border-left:4px solid var(--primary);background:var(--surface2);border-radius:0 12px 12px 0;padding:12px 16px;margin:12px 0}
.crex b{display:block;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--primary);margin-bottom:4px}
.crtip{border-left:4px solid var(--sun);background:rgba(246,190,94,.10);border-radius:0 12px 12px 0;padding:12px 16px;margin:14px 0}
.crtbl{border-collapse:collapse;margin:10px 0 14px;font-size:.95rem;max-width:100%;display:block;overflow-x:auto}
.crtbl th,.crtbl td{border:1px solid var(--line);padding:7px 11px;text-align:left}
.crtbl th{background:var(--surface2);font-weight:700}
.crq{padding:18px 0;border-top:1px solid var(--line)}
.crq:first-of-type{border-top:0;padding-top:4px}
.crq .stem{font:18px/1.55 var(--math)}
.crq .choices{margin-top:14px}
.crq .choice.right{border-color:var(--ok)!important;background:var(--ok-bg)!important;box-shadow:inset 0 0 0 2px var(--ok)!important}
.crq .choice.wrong{border-color:var(--bad)!important;background:var(--bad-bg)!important;box-shadow:inset 0 0 0 2px var(--bad)!important}
.crq .choice.right .l{background:var(--ok)!important;color:#fff!important}
.crq .choice.wrong .l{background:var(--bad)!important;color:#fff!important}
@media (max-width:560px){.critem .crk{display:none}.critem{padding:11px 12px}}
.crq .choice:disabled{cursor:default}
.crfb{margin-top:12px;padding:12px 16px;border-radius:12px;background:var(--surface2);font-size:.97rem}
.crfb.ok b{color:var(--ok)}.crfb.no b{color:var(--bad)}
.crres{text-align:center;padding:26px 22px}
.crres .big{font:800 3rem/1 var(--display);margin:6px 0 10px}
.crres.pass .big{color:var(--ok)}.crres.fail .big{color:var(--bad)}
.cract{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.crres .cract{justify-content:center}
.crlock{display:flex;gap:10px;align-items:center;color:var(--muted);font-size:.95rem}
`;
function css() { if (!document.getElementById("crCSS")) { const s = document.createElement("style"); s.id = "crCSS"; s.textContent = CSS; document.head.appendChild(s); } }
const LOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
window.CR_ICON = '<svg viewBox="0 0 24 24"><path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M7 9.8V15c0 1.7 2.2 3 5 3s5-1.3 5-3V9.8"/><path d="M21 7.5V13"/></svg>';
const kindLabel = it => it.kind === "lesson" ? "Lesson + quiz" : it.kind === "review" ? `Review quiz · ${it.n} Q` : "Task";

/* ---------- course map ---------- */
function renderCourse() {
  css(); view = "course";
  const total = C.length, done = C.filter(x => isDone(x.id)).length, cur = current();
  const row = it => {
    const ok = isDone(it.id), open = unlocked(it), isCur = cur && cur.id === it.id, best = prog()[it.id];
    const icon = ok ? CHECK : open ? esc(String(it.day).split("–")[0]) : LOCK;
    const right = ok ? (it.kind === "task" ? "Done" : "100%") : best && best.best != null ? `Best ${best.best}%` : kindLabel(it);
    return `<button class="critem${ok ? " ok" : ""}${isCur ? " cur" : ""}" data-cr="${it.id}"${open ? "" : " disabled aria-disabled=\"true\""}><span class="crs" aria-hidden="true">${icon}</span><span><b>Day ${esc(it.day)} · ${esc(it.title)}</b><small>${esc(it.sum || "")}</small></span><span class="crk">${esc(right)}</span></button>`;
  };
  let html = "";
  for (const m of [1, 2, 3]) {
    const items = C.filter(x => x.m === m), md = items.filter(x => isDone(x.id)).length;
    html += `<section class="card crmon"><div class="toolbar"><div><span class="chip">${MONTHS[m][0]}</span><h2 style="margin-top:8px">${MONTHS[m][1]}</h2></div><span class="muted">${md}/${items.length} done</span></div><p class="fine" style="margin:0">${MONTHS[m][2]}</p>`;
    for (const w of [1, 2, 3, 4]) { const wi = items.filter(x => x.w === w); if (!wi.length) continue; html += `<div class="crwk">Week ${w} · ${esc(WEEKS[m + "-" + w])}</div><div class="crlist">${wi.map(row).join("")}</div>`; }
    html += `</section>`;
  }
  shell(`<div class="pagehead"><div><h1>90-Day Course</h1><p class="muted">From the basics to SAT Math. Each lesson explains the topic, then gives a quiz. Score 100% to unlock the next lesson.</p></div>${cur ? `<button class="btn" id="crGo">${done ? "Continue" : "Start"}: Day ${esc(cur.day)}</button>` : ""}</div>
  <div class="stack">
  <section class="card"><div class="toolbar"><h2 style="margin:0">Your progress</h2><span class="muted">${done} of ${total} steps</span></div><div class="crbar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${Math.round(done / total * 100)}%"></i></div>
  <p class="fine" style="margin:6px 0 0">${cur ? `Next up: <b>Month ${cur.m}, Day ${esc(cur.day)} · ${esc(cur.title)}</b>` : "You finished the whole course. Keep taking full tests until test day."}</p></section>
  ${html}</div>`);
  $$("[data-cr]").forEach(b => b.onclick = () => openItem(b.dataset.cr));
  const g = $("#crGo"); if (g) g.onclick = () => openItem(cur.id);
  bindCommon();
}

function head(it) { return `<div class="pagehead"><div><button class="btn ghost sm" id="crBack">← Course</button><h1 style="margin-top:14px">${esc(it.title)}</h1><p class="muted">Month ${it.m} · Day ${esc(it.day)} · ${esc(WEEKS[it.m + "-" + it.w])}</p></div>${isDone(it.id) ? `<span class="chip" style="background:var(--ok-bg);color:var(--ok)">Passed</span>` : ""}</div>`; }
function next(it) { return C[it.i + 1] || null; }

function openItem(id) {
  css(); const it = BY[id]; if (!it) return renderCourse();
  if (!unlocked(it)) return renderCourse();
  view = "course";
  if (it.kind === "lesson") {
    shell(`${head(it)}<div class="stack"><section class="card crbody">${it.body}</section>
    <section class="card"><h2>Lesson quiz</h2><p class="muted" style="margin:0">5 questions with new numbers every time. You need <b>5 out of 5</b> to unlock the next lesson. If you miss one, read the explanation, review the lesson and take a new quiz.</p><div class="cract"><button class="btn" id="crQuiz">Start the quiz</button></div></section></div>`);
    $("#crQuiz").onclick = () => runQuiz(it);
  } else if (it.kind === "review") {
    const names = it.from.map(x => BY[x].title);
    shell(`${head(it)}<div class="stack"><section class="card"><h2>${esc(it.title)}</h2><p>${esc(it.sum)}</p><p class="fine">Topics: ${names.map(esc).join(" · ")}</p><p class="muted">${it.n} questions. You need <b>${it.n} out of ${it.n}</b> to move on.</p><div class="cract"><button class="btn" id="crQuiz">Start the quiz</button></div></section></div>`);
    $("#crQuiz").onclick = () => runQuiz(it);
  } else {
    const ok = isDone(it.id), nx = next(it);
    shell(`${head(it)}<div class="stack"><section class="card crbody">${it.body}<div class="cract">${(it.act || []).map(([v, l]) => `<button class="btn ghost" data-go="${v}">${esc(l)}</button>`).join("")}</div></section>
    <section class="card">${ok ? `<p style="margin:0">This step is done.</p>${nx ? `<div class="cract"><button class="btn" id="crNext">Next: ${esc(nx.title)}</button></div>` : ""}` : `<p class="muted" style="margin:0">When you have finished this step, mark it as done to unlock the next one.</p><div class="cract"><button class="btn" id="crDone">Mark as done</button></div>`}</section></div>`);
    const d = $("#crDone"); if (d) d.onclick = () => { mark(it.id, { ok: true, at: new Date().toISOString() }); openItem(it.id); };
    const n2 = $("#crNext"); if (n2) n2.onclick = () => openItem(nx.id);
  }
  $("#crBack").onclick = renderCourse;
  bindCommon(); window.scrollTo(0, 0);
}

function runQuiz(it) {
  const Q = makeQuiz(it), ans = new Array(Q.length).fill(null);
  const L = "ABCD";
  shell(`${head(it)}<div class="stack"><section class="card" id="crQ"><div class="toolbar"><h2 style="margin:0">${it.kind === "lesson" ? "Lesson quiz" : esc(it.title)}</h2><span class="muted" id="crCount">0 of ${Q.length} answered</span></div>
  ${Q.map((q, qi) => `<div class="crq" data-q="${qi}"><div class="stem"><b>${qi + 1}.</b> ${q.q}</div><div class="choices">${q.c.map((c, ci) => `<button class="choice" data-q="${qi}" data-c="${ci}" aria-pressed="false"><span class="l">${L[ci]}</span><span>${c}</span></button>`).join("")}</div></div>`).join("")}
  <div class="cract"><button class="btn" id="crCheck" disabled>Check answers</button><button class="btn ghost" id="crLesson">Back to the lesson</button></div></section></div>`);
  $("#crBack").onclick = renderCourse;
  $("#crLesson").onclick = () => openItem(it.id);
  $$(".crq .choice").forEach(b => b.onclick = () => {
    const qi = +b.dataset.q; ans[qi] = +b.dataset.c;
    $$(`.choice[data-q="${qi}"]`).forEach(o => o.setAttribute("aria-pressed", String(o === b)));
    const n = ans.filter(x => x != null).length; $("#crCount").textContent = `${n} of ${Q.length} answered`;
    $("#crCheck").disabled = n < Q.length;
  });
  $("#crCheck").onclick = () => grade(it, Q, ans);
  bindCommon(); window.scrollTo(0, 0);
}

function grade(it, Q, ans) {
  const right = Q.filter((q, i) => ans[i] === q.a).length, pct = Math.round(right / Q.length * 100), pass = right === Q.length;
  const prev = prog()[it.id] || {};
  mark(it.id, { tries: (prev.tries || 0) + 1, best: Math.max(prev.best || 0, pct), ok: !!prev.ok || pass, at: pass ? new Date().toISOString() : prev.at });
  Q.forEach((q, i) => {
    const box = $(`.crq[data-q="${i}"]`);
    box.querySelectorAll(".choice").forEach(o => { const c = +o.dataset.c; o.disabled = true; if (c === q.a) { o.classList.add("right"); o.querySelector(".l").textContent = "✓"; } else if (c === ans[i]) { o.classList.add("wrong"); o.querySelector(".l").textContent = "✗"; } });
    const ok = ans[i] === q.a;
    box.insertAdjacentHTML("beforeend", `<div class="crfb ${ok ? "ok" : "no"}"><b>${ok ? "Correct." : "Not quite."}</b> ${q.e}</div>`);
  });
  const nx = next(it);
  const res = pass
    ? `<section class="card crres pass"><p class="muted" style="margin:0">Your score</p><div class="big">${right}/${Q.length}</div><p><b>100%. ${nx ? "The next step is unlocked." : "You finished the course!"}</b></p><div class="cract">${nx ? `<button class="btn" id="crNext">Next: ${esc(nx.title)}</button>` : ""}<button class="btn ghost" id="crMap">Course map</button></div></section>`
    : `<section class="card crres fail"><p class="muted" style="margin:0">Your score</p><div class="big">${right}/${Q.length}</div><p><b>You need ${Q.length}/${Q.length} to unlock the next lesson.</b> Read the explanations below, then try a new quiz.</p><div class="cract"><button class="btn" id="crRetry">Take a new quiz</button>${it.kind === "lesson" ? `<button class="btn ghost" id="crRev">Review the lesson</button>` : ""}</div></section>`;
  $("#crCheck").remove(); $("#crLesson").remove();
  $("#crQ").insertAdjacentHTML("beforebegin", res);
  const g = id => $(id); if (g("#crNext")) g("#crNext").onclick = () => openItem(nx.id);
  if (g("#crMap")) g("#crMap").onclick = renderCourse;
  if (g("#crRetry")) g("#crRetry").onclick = () => runQuiz(it);
  if (g("#crRev")) g("#crRev").onclick = () => openItem(it.id);
  window.scrollTo(0, 0);
}

window.renderCourse = renderCourse;
window.courseHomeStrip = function () {
  const total = C.length, done = C.filter(x => isDone(x.id)).length, cur = current();
  if (!cur) return "";
  return `<section class="resume"><div class="info"><b>90-Day Course · Month ${cur.m}, Day ${esc(cur.day)}</b><div class="muted" style="font-size:.9rem">Next: ${esc(cur.title)} · ${done} of ${total} steps done</div><div class="mini"><i style="width:${Math.round(done / total * 100)}%"></i></div></div><div class="actions"><button class="btn sm" data-go="course">${done ? "Continue" : "Start the course"}</button></div></section>`;
};
window.CR = { C, BY, build, makeQuiz };
})();
