import React from 'react';

type KumiteLiveScoreboardProps = {
  akaName: string;
  aoName: string;
  akaAcademy?: string;
  aoAcademy?: string;
  akaCountry?: string;
  aoCountry?: string;
  
  akaScore: number;
  aoScore: number;
  akaIppon: number;
  aoIppon: number;
  akaWazaari: number;
  aoWazaari: number;
  akaYuko: number;
  aoYuko: number;
  
  akaC1: number;
  aoC1: number;
  akaC2: number;
  aoC2: number;
  
  akaSenshu: boolean;
  aoSenshu: boolean;

  timerDisplay: string;
  timerColor: string;
  matchStatus: string;
  
  title?: string;
  categoryName?: string;
  matchId?: string;

  winnerName?: string;
  winnerColor?: 'aka' | 'ao';
};

export default function KumiteLiveScoreboard({
  akaName, aoName, akaAcademy, aoAcademy, akaCountry, aoCountry,
  akaScore, aoScore, akaIppon, aoIppon, akaWazaari, aoWazaari, akaYuko, aoYuko,
  akaC1, aoC1, akaC2, aoC2, akaSenshu, aoSenshu,
  timerDisplay, timerColor, matchStatus, title = 'TAIKAIX', categoryName = '', matchId = '',
  winnerName, winnerColor
}: KumiteLiveScoreboardProps) {

  const renderDots = (count: number) => {
    return Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className={`kls-dot ${i < count ? 'active' : ''}`}></div>
    ));
  };

  return (
    <div className="kls-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .kls-root { container-type: inline-size; width: 100%; height: 100%; min-height: 300px; display: flex; flex-direction: column; background: var(--kuro); color: var(--shiro); font-family: var(--font-body); overflow: hidden; }
        .kls-container { flex: 1; display: grid; grid-template-columns: 1fr minmax(15cqw, 20cqw) 1fr; position: relative; }
        
        .kls-side { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4cqw; position: relative; transition: background-color 0.3s ease; }
        .kls-side.aka { background: var(--aka); }
        .kls-side.ao { background: var(--ao); }
        
        .kls-name { font-family: var(--font-display); font-size: 7cqw; line-height: 1; text-transform: uppercase; text-align: center; margin-bottom: 1cqw; text-shadow: 0 0.5cqw 1cqw rgba(0,0,0,0.3); word-break: break-word; max-width: 100%; }
        .kls-country { font-family: var(--font-display); font-size: 2cqw; color: rgba(255,255,255,0.7); letter-spacing: 0.1em; margin-bottom: 3cqw; text-align: center; }
        
        .kls-score-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .kls-score { font-family: var(--font-display); font-size: 22cqw; line-height: 0.8; margin: 0; color: var(--shiro); }
        
        .kls-points { display: flex; gap: 2cqw; margin-top: 3cqw; }
        .kls-pt-item { display: flex; flex-direction: column; align-items: center; gap: 0.5cqw; }
        .kls-pt-label { font-size: 1cqw; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; }
        .kls-pt-val { font-family: var(--font-display); font-size: 3.5cqw; line-height: 1; }
        
        .kls-pens { display: grid; grid-template-columns: 1fr 1fr; gap: 2cqw; margin-top: 4cqw; width: 100%; max-width: 25cqw; }
        .kls-pen-grp { display: flex; flex-direction: column; gap: 1cqw; }
        .kls-pen-title { font-size: 0.9cqw; font-weight: 700; text-transform: uppercase; opacity: 0.6; text-align: center; }
        .kls-pen-dots { display: flex; justify-content: center; gap: 0.8cqw; }
        .kls-dot { width: 1.2cqw; height: 1.2cqw; border-radius: 50%; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); transition: all 0.3s ease; }
        .kls-dot.active { background: var(--shiro); box-shadow: 0 0 1cqw var(--shiro); border-color: var(--shiro); }
        
        .kls-senshu { position: absolute; top: 3cqw; font-family: var(--font-display); font-size: 2cqw; background: var(--shiro); color: var(--kuro); padding: 0.5cqw 1.5cqw; border-radius: 0.5cqw; opacity: 0; transition: opacity 0.3s ease; }
        .kls-senshu.active { opacity: 1; }
        
        .kls-center { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 3cqw 0; background: var(--kuro); border-left: 1px solid var(--neutral-900); border-right: 1px solid var(--neutral-900); z-index: 10; }
        .kls-logo { font-family: var(--font-display); font-size: 2cqw; color: var(--shiro); letter-spacing: 0.1em; text-align: center; }
        
        .kls-timer-wrap { display: flex; flex-direction: column; align-items: center; gap: 1cqw; }
        .kls-timer { font-family: var(--font-mono); font-size: 6cqw; font-weight: 700; line-height: 1; }
        .kls-status { text-transform: uppercase; font-size: 1cqw; letter-spacing: 0.2em; font-weight: 700; }
        
        .kls-info { text-align: center; display: flex; flex-direction: column; gap: 0.5cqw; }
        .kls-match-id { font-family: var(--font-display); font-size: 1.5cqw; color: var(--neutral-500); }
        .kls-cat { font-size: 1cqw; font-weight: 600; color: var(--neutral-300); text-transform: uppercase; max-width: 15cqw; margin: 0 auto; line-height: 1.4; }
        
        .kls-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 200; opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
        .kls-overlay.active { opacity: 1; pointer-events: auto; }
        .kls-win-label { font-family: var(--font-display); font-size: 3cqw; color: var(--status-live); letter-spacing: 0.2em; margin-bottom: 2cqw; }
        .kls-win-name { font-family: var(--font-display); font-size: 10cqw; text-transform: uppercase; text-align: center; line-height: 1; max-width: 90cqw; }
        .kls-win-aka { color: var(--aka); }
        .kls-win-ao { color: var(--ao); }
      `}} />

      <div className={\`kls-overlay \${winnerName ? 'active' : ''}\`}>
        <div className="kls-win-label">MATCH WINNER</div>
        <div className={\`kls-win-name \${winnerColor === 'aka' ? 'kls-win-aka' : 'kls-win-ao'}\`}>{winnerName}</div>
      </div>

      <div className="kls-container">
        {/* AKA SIDE */}
        <div className="kls-side aka">
          <div className={\`kls-senshu \${akaSenshu ? 'active' : ''}\`}>SENSHU</div>
          <div className="kls-name">{akaName}</div>
          <div className="kls-country">{[akaAcademy, akaCountry || 'JAPAN'].filter(Boolean).join(' • ').toUpperCase()}</div>
          
          <div className="kls-score-wrap">
            <div className="kls-score">{akaScore}</div>
          </div>

          <div className="kls-points">
            <div className="kls-pt-item">
              <div className="kls-pt-label">Ippon</div>
              <div className="kls-pt-val">{akaIppon}</div>
            </div>
            <div className="kls-pt-item">
              <div className="kls-pt-label">Waza-ari</div>
              <div className="kls-pt-val">{akaWazaari}</div>
            </div>
            <div className="kls-pt-item">
              <div className="kls-pt-label">Yuko</div>
              <div className="kls-pt-val">{akaYuko}</div>
            </div>
          </div>

          <div className="kls-pens">
            <div className="kls-pen-grp">
              <div className="kls-pen-title">Category 1</div>
              <div className="kls-pen-dots">{renderDots(akaC1)}</div>
            </div>
            <div className="kls-pen-grp">
              <div className="kls-pen-title">Category 2</div>
              <div className="kls-pen-dots">{renderDots(akaC2)}</div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="kls-center">
          <div className="kls-logo">{title}</div>
          
          <div className="kls-timer-wrap">
            <div className="kls-timer" style={{ color: timerColor }}>
              {timerDisplay}
            </div>
            <div className="kls-status" style={{ color: matchStatus === 'MATCH LIVE' ? 'var(--status-live)' : 'var(--neutral-500)' }}>
              {matchStatus}
            </div>
          </div>

          <div className="kls-info">
            {matchId && <div className="kls-match-id">{matchId}</div>}
            {categoryName && <div className="kls-cat">{categoryName}</div>}
          </div>
        </div>

        {/* AO SIDE */}
        <div className="kls-side ao">
          <div className={\`kls-senshu \${aoSenshu ? 'active' : ''}\`}>SENSHU</div>
          <div className="kls-name">{aoName}</div>
          <div className="kls-country">{[aoAcademy, aoCountry || 'JAPAN'].filter(Boolean).join(' • ').toUpperCase()}</div>
          
          <div className="kls-score-wrap">
            <div className="kls-score">{aoScore}</div>
          </div>

          <div className="kls-points">
            <div className="kls-pt-item">
              <div className="kls-pt-label">Ippon</div>
              <div className="kls-pt-val">{aoIppon}</div>
            </div>
            <div className="kls-pt-item">
              <div className="kls-pt-label">Waza-ari</div>
              <div className="kls-pt-val">{aoWazaari}</div>
            </div>
            <div className="kls-pt-item">
              <div className="kls-pt-label">Yuko</div>
              <div className="kls-pt-val">{aoYuko}</div>
            </div>
          </div>

          <div className="kls-pens">
            <div className="kls-pen-grp">
              <div className="kls-pen-title">Category 1</div>
              <div className="kls-pen-dots">{renderDots(aoC1)}</div>
            </div>
            <div className="kls-pen-grp">
              <div className="kls-pen-title">Category 2</div>
              <div className="kls-pen-dots">{renderDots(aoC2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
