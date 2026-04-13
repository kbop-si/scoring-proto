// 땅표(약식 야구 기록 코드) → CellData 필드 파서

export type DangpyoResult = {
  result: string;
  ballType?: '땅' | '뜬' | '라';
  isDP?: boolean;
  isTP?: boolean;
};

// 한자 → 수비 번호 (一=투수1, 二=2루수4, 三=3루수5)
const HANJA_POS: Record<string, number> = { 一: 1, 二: 4, 三: 5 };

// 한글 수비 호칭 → 수비 번호
const KOR_POS: Record<string, number> = {
  투: 1,
  포: 2,
  일: 3,
  이: 4,
  삼: 5,
  유: 6,
  좌: 7,
  중: 8,
  우: 9,
};

/**
 * 입력 문자열에서 수비 번호 배열 추출.
 * 숫자 '2'는 다른 수비수와 함께 쓰이면 2루수(4)로 해석.
 * '포'는 항상 포수(2).
 */
function tokenizePos(s: string): number[] {
  const out: { val: number; fromDigit: boolean }[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (HANJA_POS[ch] !== undefined) {
      out.push({ val: HANJA_POS[ch], fromDigit: false });
    } else if (KOR_POS[ch] !== undefined) {
      out.push({ val: KOR_POS[ch], fromDigit: false });
    } else if (/[1-9]/.test(ch)) {
      out.push({ val: parseInt(ch), fromDigit: true });
    }
    // 하이픈, 공백 등은 무시
  }
  const hasMultiple = out.length > 1;
  return out.map(({ val, fromDigit }) =>
    // 숫자 '2'를 다른 수비수와 함께 쓰면 2루수(4)로 변환
    fromDigit && val === 2 && hasMultiple ? 4 : val
  );
}

export function parseDangpyo(raw: string): DangpyoResult {
  let s = raw.trim();

  // ── 1. 전체 문자열 직접 매핑 ────────────────────────────────────────────
  const DIRECT: Record<string, DangpyoResult> = {
    삼진: { result: 'K' },
    스낫: { result: 'K' },
    '4구': { result: 'B' },
    고4: { result: 'B' },
    볼넷: { result: 'B' },
    사구: { result: 'HP' },
    야선: { result: 'FC' },
    타방: { result: 'INT' },
    희비: { result: 'SF', ballType: '뜬' },
    희번: { result: 'SH' },
    희타: { result: 'SH' },
    병: { result: 'DP', isDP: true },
  };
  if (DIRECT[s]) return DIRECT[s];

  // ── 2. 복합 희생 패턴 ────────────────────────────────────────────────────
  if (s.includes('희비')) {
    return { result: s.includes('실') ? 'SFE' : 'SF', ballType: '뜬' };
  }
  if (s.includes('희번') || s.includes('희타')) return { result: 'SH' };

  // ── 3. 타구 유형 추출 ────────────────────────────────────────────────────
  let ballType: DangpyoResult['ballType'];
  if (s.includes('땅')) {
    ballType = '땅';
    s = s.replace(/땅/g, '');
  } else if (/비|플|파|뜬/.test(s)) {
    ballType = '뜬';
    s = s.replace(/비|플|파|뜬/g, '');
  } else if (/직|라이/.test(s)) {
    ballType = '라';
    s = s.replace(/직|라이/g, '');
  }

  // ── 4. 병살 / 삼중살 ─────────────────────────────────────────────────────
  const isDP = /병|DP/.test(s);
  const isTP = /삼중살|삼중|TP/.test(s);
  s = s.replace(/삼중살|삼중|병|DP|TP/g, '');

  // ── 5. 홈런 ──────────────────────────────────────────────────────────────
  if (/홈|HR/.test(s)) return { result: 'HR', ballType };

  // ── 6. 안타 종류 ─────────────────────────────────────────────────────────
  if (s.includes('안')) return { result: 'H1', ballType };
  if (/2루타|2안/.test(s)) return { result: 'H2', ballType };
  if (/3루타|3안/.test(s)) return { result: 'H3', ballType };

  // ── 7. 실책 ──────────────────────────────────────────────────────────────
  if (s.includes('실')) {
    const pos = tokenizePos(s.replace(/실/g, ''));
    const errOn = pos.length > 0 ? pos[pos.length - 1] : '';
    return { result: errOn ? `E${errOn}` : 'E', ballType };
  }

  // ── 8. 번트 ──────────────────────────────────────────────────────────────
  const hasBunt = /번/.test(s);
  s = s.replace(/번/g, '');

  // ── 9. 수비 번호 조합 ────────────────────────────────────────────────────
  const pos = tokenizePos(s);
  if (pos.length === 0) return { result: raw, ballType };

  const resultStr = pos.join('-');
  return {
    result: resultStr,
    ballType: hasBunt ? (ballType ?? '땅') : ballType,
    isDP: isDP || undefined,
    isTP: isTP || undefined,
  };
}
