import { useState } from 'react';
import type { Screen, GameSetup, Player } from './types';
import { SAMPLE } from './data/constants';
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

  const gotoLineupWithDefaults = (
    teams: { awayTeam: string; homeTeam: string; date: string; league: string },
    extra?: Partial<GameSetup>
  ) => {
    updateSetup({
      ...teams,
      ...extra,
      awayLineup: [
        ...SAMPLE.away.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 })),
        { ...SAMPLE.away[9], order: 0 },
      ],
      homeLineup: [
        ...SAMPLE.home.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 })),
        { ...SAMPLE.home[9], order: 0 },
      ],
      awayBench: SAMPLE.away.slice(10),
      homeBench: SAMPLE.home.slice(10),
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
          onConfirm={(awayTeam, homeTeam, date) => {
            updateSetup({ awayTeam, homeTeam, date });
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
