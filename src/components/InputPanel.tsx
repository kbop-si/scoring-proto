import type { GameState, PitchType } from '../types';

interface Props {
  G: GameState;
  selRunnerBadge: string;
  onPitch: (t: PitchType) => void;
  onBatAdv: () => void;
  onBatOut: () => void;
  onRunAdv: () => void;
  onRunOut: () => void;
  onDefl: () => void;
  onMoundVisit: () => void;
  onBatterTimeout: () => void;
  onPitcherLeave: () => void;
  onPitcherChange: () => void;
  onNextBatter: () => void;
  onNextInning: () => void;
  onUndo: () => void;
  onClear: () => void;
  onOverflow: () => void;
  onPlaceBatter: () => void;
  onEnd: () => void;
  onToast: (msg: string) => void;
}

export default function InputPanel({
  G, selRunnerBadge,
  onPitch, onBatAdv, onBatOut, onRunAdv, onRunOut, onMoundVisit, onBatterTimeout, onPitcherLeave,
  onNextBatter, onNextInning, onUndo, onClear, onPlaceBatter, onEnd, onToast,
}: Props) {
  const pb = G.pendingBatter;
  
  return (
    <div className="ip" id="ip">
      {/* Pitcher section — grid layout */}
      <div className="ip-pitcher">
        {/* Left: Info card (pitcher info) */}
        <div className="ip-info-card">
          <div className="info-row">
            <span className="info-lbl">투수  :</span>
            <span className="info-val">{G.pitcher.name || '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-lbl">투구  :</span>
            <span className="info-val">{G.pitcher.pitchCount || 0}</span>
          </div>
            <div className="info-row">
            <span className="info-val">
              (B:{G.pitchBalls} S:{G.pitchStrikes})
            </span>
           </div>
        </div>

        {/* Right: BSO card */}
        <div className="ip-bso-card">
          <div className="bso-line">
            <div className="bso-big-lbl">B</div>
            <div className="bso-big-dots">
              {[0, 1, 2].map((i) => <span key={i} className={`dot${i < G.balls ? ' b' : ''}`} />)}
            </div>
          </div>
          <div className="bso-line">
            <div className="bso-big-lbl">S</div>
            <div className="bso-big-dots">
              {[0, 1].map((i) => <span key={i} className={`dot${i < G.strikes ? ' s' : ''}`} />)}
            </div>
          </div>
          <div className="bso-line">
            <div className="bso-big-lbl">O</div>
            <div className="bso-big-dots">
              {[0, 1].map((i) => <span key={i} className={`dot${i < G.outs ? ' o' : ''}`} />)}
            </div>
          </div>
        </div>
      </div>

      {/* 타자 배치 대기 배너 */}
      {pb && (
        <div style={{ background: '#fef3c7', borderBottom: '1px solid #f59e0b', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>
            {pb.runner.name} → {pb.dest} 대기 중 | 주자 이동 후 배치
          </span>
          <button
            onClick={onPlaceBatter}
            style={{ background: '#d97706', color: '#fff', border: 'none', padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 2, cursor: 'pointer', animation: 'cell-pulse 1s step-start infinite' }}
          >
            ▶ 타자 배치
          </button>
        </div>
      )}

      {/* Ball count */}
      <div className="ip-sec">
        <div className="ip-sec-t">볼 카운트</div>
        <div className="ip-g2 ip-g2-special">
          <button className="ip-btn b-S" onClick={() => onPitch('S')}>
            <span className="ip-lbl">스트라이크</span>
          </button>
          <button className="ip-btn b-SW" onClick={() => onPitch('SW')}>
            <span className="ip-lbl">헛스윙</span>
          </button>
          <button className="ip-btn b-B" onClick={() => onPitch('B')}>
            <span className="ip-lbl">볼</span>
          </button>
          <button className="ip-btn b-F" onClick={() => onPitch('F')}>
            <span className="ip-lbl">파울</span>
          </button>
        </div>
        <div className="ip-g3 ip-g2-special" style={{ marginTop: 5 }}>
          <button className="ip-btn b-S" onClick={() => onPitch('FE')}>
            <span className="ip-lbl">파울실책</span>
          </button>
          <button className="ip-btn b-S" onClick={() => onPitch('BS')}>
            <span className="ip-lbl">번트헛스윙</span>
          </button>
          <button className="ip-btn b-S" onClick={() => onPitch('BF')}>
            <span className="ip-lbl">번트파울</span>
          </button>
        </div>
        <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 4, marginTop: 5 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text3)', marginBottom: 3 }}>피치클락</div>
          <div className="ip-g3 ip-g2-special">
            <button className="ip-btn b-S" onClick={() => onPitch('PC1')}>
              <span className="ip-lbl">투수위반 볼</span>
            </button>
            <button className="ip-btn b-S" onClick={() => onPitch('PC2')}>
              <span className="ip-lbl">포수위반 볼</span>
            </button>
            <button className="ip-btn b-S" onClick={() => onPitch('PC3')}>
              <span className="ip-lbl">타자위반</span><span className="ip-sub">스트라이크</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batter / Runner */}
      <div className="ip-sec">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div className="ta-lbl">타자</div>
            <div className="ta-row">
              <button className="ta-btn adv" onClick={onBatAdv}>진루</button>
              <button className="ta-btn out" onClick={onBatOut}>아웃</button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="ta-lbl">
              주자 <span style={{ fontSize: 9, color: 'var(--blue)', fontWeight: 700 }}>{selRunnerBadge}</span>
            </div>
            <div className="ta-row">
              <button className="ta-btn adv" onClick={onRunAdv}>진루</button>
              <button className="ta-btn out" onClick={onRunOut}>아웃</button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 2, fontSize: 8, color: 'var(--text3)' }}>
          주자: 다이아몬드 클릭으로 선택 (재클릭=취소)
        </div>
      </div>

      {/* 견제/기타 */}
      <div className="ip-sec">
        <div className="ip-sec-t">견제/기타</div>
        <div className="ip-g2" style={{ marginTop: 2 }}>
          <button className="ip-btn b-S" onClick={onPitcherLeave}>
            <span className="ip-lbl">투수판이탈</span>
          </button>
          <button className="ip-btn b-S" onClick={onBatterTimeout}>
            <span className="ip-lbl">타자타임</span>
          </button>
          <button className="ip-btn b-S" onClick={onMoundVisit}>
            <span className="ip-lbl">마운드방문</span>
          </button>
          <button className="ip-btn b-S" onClick={() => onToast('메모')}>
            <span className="ip-lbl">메모</span>
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="ip-sec">
        <div className="ip-sec-t">타순 / 이닝 / 기록</div>
        <div className="act-row">
          <button className="act-btn a-next" onClick={onNextBatter}>다음타자</button>
          <button className="act-btn a-inn" onClick={onNextInning}>다음이닝</button>
          <button className="act-btn a-undo" onClick={onUndo}>되돌리기</button>
          <button className="act-btn a-clear" onClick={onClear}>타석지우기</button>
          <button className="act-btn" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={onEnd}>게임종료</button>
        </div>
      </div>
    </div>
  );
}
