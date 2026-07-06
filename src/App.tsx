import { useState } from 'react';
import type { Screen, GameSetup, Player } from './types';
import { KBO_ROSTER } from './data/kboRoster';

function buildLineupFromRoster(teamName: string): { lineup: Player[]; bench: Player[] } {
  const roster = KBO_ROSTER[teamName] ?? [];
  const pitcher = roster.find((p) => p.pos === 1);
  const pitcherSlot = pitcher ? { ...pitcher, order: 0 } : null;
  const starters = roster
    .filter((p) => p.order > 0 && p.pos !== 1)
    .sort((a, b) => a.order - b.order)
    .map((p, i) => ({ ...p, order: i + 1 }));
  const bench = roster.filter((p) => p !== pitcher && p.order === 0);
  return { lineup: pitcherSlot ? [...starters, pitcherSlot] : starters, bench };
}
import SplashScreen from './pages/SplashScreen';
import LeagueScreen from './pages/LeagueScreen';
import CreateScreen from './pages/CreateScreen';
import GameInfoScreen from './pages/GameInfoScreen';
import LineupScreen from './pages/LineupScreen';
import GameScreen from './pages/GameScreen';

const defaultSetup: GameSetup = {
  league: 'KBO',
  awayTeam: 'KIA',
  homeTeam: '한화',
  date: '',
  doubleHeader: '--------',
  awayLineup: [],
  homeLineup: [],
  awayBench: [],
  homeBench: [],
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [setup, setSetup] = useState<GameSetup>(defaultSetup);

  const updateSetup = (partial: Partial<GameSetup>) =>
    setSetup((prev) => ({ ...prev, ...partial }));

  const gotoLineupWithDefaults = (teams: GameSetup, extra?: Partial<GameSetup>) => {
    const merged = { ...teams, ...extra };
    const away = buildLineupFromRoster(merged.awayTeam);
    const home = buildLineupFromRoster(merged.homeTeam);
    updateSetup({
      ...merged,
      awayLineup: away.lineup,
      homeLineup: home.lineup,
      awayBench: away.bench,
      homeBench: home.bench,
    });
    setScreen('lineup');
  };

  const updateLineups = (
    awayLineup: Player[],
    homeLineup: Player[],
    awayBench: Player[],
    homeBench: Player[]
  ) => {
    updateSetup({ awayLineup, homeLineup, awayBench, homeBench });
  };

  return (
    <>
      {screen === 'splash' && <SplashScreen onStart={() => setScreen('league')} />}
      {screen === 'league' && (
        <LeagueScreen
          onSelect={(league) => {
            updateSetup({ league });
            setScreen('create');
          }}
          onBack={() => setScreen('splash')}
        />
      )}
      {screen === 'create' && (
        <CreateScreen
          setup={setup}
          onConfirm={(awayTeam, homeTeam, date, dh) => {
            updateSetup({ awayTeam, homeTeam, date, doubleHeader: dh });
            setScreen('gameinfo');
          }}
          onBack={() => setScreen('league')}
        />
      )}
      {screen === 'gameinfo' && (
        <GameInfoScreen
          setup={setup}
          onConfirm={(extra) => gotoLineupWithDefaults(setup, extra)}
          onBack={() => setScreen('create')}
        />
      )}
      {screen === 'lineup' && (
        <LineupScreen
          setup={setup}
          onUpdateLineups={updateLineups}
          onStart={() => setScreen('game')}
        />
      )}
      {screen === 'game' && <GameScreen setup={setup} onEnd={() => setScreen('splash')} />}
    </>
  );
}
